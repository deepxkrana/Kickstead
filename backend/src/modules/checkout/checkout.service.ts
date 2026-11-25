import { randomBytes } from 'node:crypto';
import { Prisma } from '@prisma/client';
import { MAX_QUANTITY_PER_ITEM, PRICING } from '../../config/pricing.js';
import { prisma, type TransactionClient } from '../../db/prisma.js';
import { AppError, Errors } from '../../shared/errors/AppError.js';
import { calculateOrderTotals, lineTotalPaise } from '../../shared/money/pricing.js';
import { AuditAction, recordAudit } from '../audit/audit.service.js';
import { reserveStock } from '../inventory/inventory.service.js';
import { orderDetailInclude, toOrderView, type OrderView } from '../orders/orders.view.js';
import type { CheckoutAddressInput } from './checkout.schemas.js';

interface LockedProduct {
  id: string;
  name: string;
  pricePaise: number;
  stockQuantity: number;
  imageUrl: string | null;
  available: boolean;
}

export interface CheckoutResult {
  order: OrderView;
  /** True when this idempotency key already produced the order (no side effects repeated). */
  replayed: boolean;
}

/** Interactive transactions wait on row locks, so allow more than Prisma's 5 s default. */
const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

const BASE32 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
function newOrderNumber(now = new Date()): string {
  const date = now.toISOString().slice(0, 10).replaceAll('-', '');
  const suffix = Array.from(randomBytes(6), (b) => BASE32[b % BASE32.length]).join('');
  return `KS-${date}-${suffix}`;
}

async function findByKey(db: TransactionClient | typeof prisma, userId: string, idempotencyKey: string) {
  return db.order.findUnique({
    where: { userId_idempotencyKey: { userId, idempotencyKey } },
    include: orderDetailInclude,
  });
}

async function pendingOrderConflict(db: TransactionClient | typeof prisma, userId: string) {
  const pending = await db.order.findFirst({ where: { userId, status: 'PLACED' }, select: { id: true, orderNumber: true } });
  return Errors.conflict('PENDING_ORDER_EXISTS', 'You already have an order awaiting payment. Pay or cancel it first.', {
    orderId: pending?.id ?? null,
    orderNumber: pending?.orderNumber ?? null,
  });
}

/**
 * Places an order from the customer's cart in ONE transaction:
 *   lock products (FOR UPDATE, by id) → recheck availability and stock → price from the database
 *   → insert order + items + pending payment → take stock → log movements → audit → commit.
 * Any failure rolls back everything. The cart is kept until payment succeeds.
 *
 * Idempotency: the same customer + key always returns the original order. Enforced by
 * UNIQUE(user_id, idempotency_key); concurrent duplicates are caught and replayed.
 */
export async function checkout(
  userId: string,
  addressTarget: { addressId?: string; address?: CheckoutAddressInput },
  idempotencyKey: string,
): Promise<CheckoutResult> {
  const existing = await findByKey(prisma, userId, idempotencyKey);
  if (existing) return { order: toOrderView(existing), replayed: true };

  try {
    return await prisma.$transaction(async (tx) => {
      let addressSnapshot: {
        fullName: string;
        phone: string;
        line1: string;
        line2: string | null;
        city: string;
        state: string;
        postalCode: string;
        country: string;
      };

      if (addressTarget.addressId) {
        const address = await tx.address.findFirst({ where: { id: addressTarget.addressId, userId } });
        if (!address) throw new AppError(404, 'ADDRESS_NOT_FOUND', 'Address not found.');
        addressSnapshot = {
          fullName: address.fullName,
          phone: address.phone,
          line1: address.line1,
          line2: address.line2,
          city: address.city,
          state: address.state,
          postalCode: address.postalCode,
          country: address.country,
        };
      } else if (addressTarget.address) {
        const a = addressTarget.address;
        addressSnapshot = {
          fullName: a.fullName,
          phone: a.phone,
          line1: a.line1,
          line2: a.line2 ?? null,
          city: a.city,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country,
        };
      } else {
        throw Errors.badRequest('Provide either addressId or address.');
      }

      const cartItems = await tx.cartItem.findMany({
        where: { cart: { userId } },
        select: { productId: true, quantity: true },
      });
      if (cartItems.length === 0) throw Errors.unprocessable('CART_EMPTY', 'Your cart is empty.');

      // Lock in a consistent order (by id) so concurrent checkouts cannot deadlock.
      const productIds = cartItems.map((item) => item.productId);
      const locked = await tx.$queryRaw<LockedProduct[]>`
        SELECT p.id, p.name, p.price_paise AS "pricePaise", p.stock_quantity AS "stockQuantity",
               p.image_url AS "imageUrl", (p.is_active AND c.is_active) AS "available"
        FROM products p
        JOIN categories c ON c.id = p.category_id
        WHERE p.id = ANY(${productIds}::uuid[])
        ORDER BY p.id
        FOR UPDATE OF p`;

      // A duplicate request may have committed while we waited for the locks.
      const committed = await findByKey(tx, userId, idempotencyKey);
      if (committed) return { order: toOrderView(committed), replayed: true };

      if (await tx.order.count({ where: { userId, status: 'PLACED' } })) throw await pendingOrderConflict(tx, userId);

      const byId = new Map(locked.map((product) => [product.id, product]));
      const unavailable = cartItems.filter((item) => !byId.get(item.productId)?.available);
      if (unavailable.length) {
        throw Errors.unprocessable('PRODUCT_UNAVAILABLE', 'Some items in your cart are no longer available.', {
          productIds: unavailable.map((item) => item.productId),
        });
      }
      const short = cartItems
        .map((item) => ({ item, product: byId.get(item.productId)! }))
        .filter(({ item, product }) => item.quantity > product.stockQuantity || item.quantity > MAX_QUANTITY_PER_ITEM);
      if (short.length) {
        throw Errors.conflict('INSUFFICIENT_STOCK', 'One or more products are no longer available in the requested quantity.', {
          items: short.map(({ item, product }) => ({
            productId: product.id,
            name: product.name,
            available: Math.min(product.stockQuantity, MAX_QUANTITY_PER_ITEM),
            requested: item.quantity,
          })),
        });
      }

      const lines = cartItems.map((item) => {
        const product = byId.get(item.productId)!;
        return { product, quantity: item.quantity };
      });
      const totals = calculateOrderTotals(
        lines.map(({ product, quantity }) => ({ unitPricePaise: product.pricePaise, quantity })),
      );

      const order = await tx.order.create({
        data: {
          orderNumber: newOrderNumber(),
          userId,
          status: 'PLACED',
          idempotencyKey,
          currency: PRICING.currency,
          addressSnapshot,
          ...totals,
          items: {
            create: lines.map(({ product, quantity }) => ({
              productId: product.id,
              productNameSnapshot: product.name,
              productImageSnapshot: product.imageUrl,
              unitPricePaise: product.pricePaise,
              quantity,
              lineTotalPaise: lineTotalPaise({ unitPricePaise: product.pricePaise, quantity }),
            })),
          },
          payment: { create: { status: 'PENDING', amountPaise: totals.totalPaise } },
        },
      });

      await reserveStock(
        tx,
        lines.map(({ product, quantity }) => ({ productId: product.id, quantity })),
        { orderId: order.id, actorUserId: userId },
      );

      await recordAudit(tx, {
        actorUserId: userId,
        action: AuditAction.ORDER_CREATED,
        entityType: 'ORDER',
        entityId: order.id,
        metadata: { orderNumber: order.orderNumber, totalPaise: totals.totalPaise, itemCount: lines.length },
      });

      const created = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderDetailInclude });
      return { order: toOrderView(created), replayed: false };
    }, TX_OPTIONS);
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
      const target = JSON.stringify(err.meta?.target ?? '');
      if (target.includes('idempotency_key')) {
        // A concurrent request with the same key won the race: return its order.
        const winner = await findByKey(prisma, userId, idempotencyKey);
        if (winner) return { order: toOrderView(winner), replayed: true };
      }
      // orders_one_placed_per_user: a parallel checkout with a different key already placed an order.
      throw await pendingOrderConflict(prisma, userId);
    }
    throw err;
  }
}
