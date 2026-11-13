import { randomUUID } from 'node:crypto';
import type { OrderStatus, PaymentStatus } from '@prisma/client';
import { prisma, type TransactionClient } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { pageMeta } from '../../shared/http/pagination.js';
import { assertTransition, CUSTOMER_CANCELLABLE_STATUSES } from '../../shared/orderStates/orderStates.js';
import { AuditAction, recordAudit } from '../audit/audit.service.js';
import { releaseStock } from '../inventory/inventory.service.js';
import { orderDetailInclude, toOrderView, type OrderView } from './orders.view.js';

const TX_OPTIONS = { maxWait: 10_000, timeout: 20_000 } as const;

export const orderNotFound = () => new AppError(404, 'ORDER_NOT_FOUND', 'Order not found.');

/**
 * Locks the order row for the rest of the transaction, so two status changes on the same order
 * (double-clicked Pay, Pay vs Cancel, customer vs admin) run one after the other.
 * With `ownerId`, another user's order is reported as not found.
 */
export async function lockOrder(tx: TransactionClient, orderId: string, ownerId?: string) {
  const rows = ownerId
    ? await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${orderId}::uuid AND user_id = ${ownerId}::uuid FOR UPDATE`
    : await tx.$queryRaw<{ id: string }[]>`SELECT id FROM orders WHERE id = ${orderId}::uuid FOR UPDATE`;
  if (rows.length === 0) throw orderNotFound();
  return tx.order.findUniqueOrThrow({ where: { id: orderId }, include: orderDetailInclude });
}

export async function listOwnOrders(userId: string, page: number, limit: number) {
  const where = { userId };
  const [rows, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaise: true,
        currency: true,
        createdAt: true,
        payment: { select: { status: true } },
        items: { select: { productImageSnapshot: true, quantity: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: rows.map(({ items, payment, ...order }) => ({
      ...order,
      paymentStatus: payment?.status ?? null,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      imageUrl: items[0]?.productImageSnapshot ?? null,
    })),
    meta: pageMeta(page, limit, total),
  };
}

export async function getOwnOrder(userId: string, orderId: string): Promise<OrderView> {
  const order = await prisma.order.findFirst({ where: { id: orderId, userId }, include: orderDetailInclude });
  if (!order) throw orderNotFound();
  return toOrderView(order);
}

export type PaymentOutcome = 'SUCCESS' | 'FAILED' | 'CANCELLED';

const OUTCOME: Record<PaymentOutcome, { order: OrderStatus; payment: PaymentStatus }> = {
  SUCCESS: { order: 'PAID', payment: 'SUCCEEDED' },
  FAILED: { order: 'PAYMENT_FAILED', payment: 'FAILED' },
  CANCELLED: { order: 'PAYMENT_CANCELLED', payment: 'CANCELLED' },
};

/**
 * Records the simulated payment result for a PLACED order.
 * - SUCCESS → PAID; the ordered products are removed from the cart.
 * - FAILED / CANCELLED → reserved stock is returned (logged); the cart is kept for a retry.
 * Repeating the same outcome returns the order unchanged (no double side effects).
 */
export async function recordPayment(userId: string, orderId: string, outcome: PaymentOutcome) {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId, userId);
    const target = OUTCOME[outcome];

    if (order.status === target.order) return { order: toOrderView(order), replayed: true };
    assertTransition(order.status, target.order);

    await tx.order.update({ where: { id: order.id }, data: { status: target.order } });
    await tx.payment.update({
      where: { orderId: order.id },
      data: {
        status: target.payment,
        providerReference: outcome === 'SUCCESS' ? `SIM-${randomUUID()}` : null,
      },
    });

    const productIds = order.items.flatMap((item) => (item.productId ? [item.productId] : []));
    if (outcome === 'SUCCESS') {
      await tx.cartItem.deleteMany({ where: { cart: { userId }, productId: { in: productIds } } });
    } else {
      await releaseStock(tx, order.items, { orderId: order.id, actorUserId: userId, reason: 'ORDER_RELEASED' });
    }

    await recordAudit(tx, {
      actorUserId: userId,
      action: AuditAction.PAYMENT_RECORDED,
      entityType: 'ORDER',
      entityId: order.id,
      metadata: { orderNumber: order.orderNumber, outcome, from: order.status, to: target.order, amountPaise: order.totalPaise },
    });

    const updated = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderDetailInclude });
    return { order: toOrderView(updated), replayed: false };
  }, TX_OPTIONS);
}

/**
 * Cancels an order and returns its stock. Shared by customers (own PLACED/PAID orders) and admins.
 * A paid order's simulated payment is marked REFUNDED; an unpaid one's is marked CANCELLED.
 */
export async function cancelLockedOrder(
  tx: TransactionClient,
  order: Awaited<ReturnType<typeof lockOrder>>,
  actorUserId: string,
  reason: string | undefined,
) {
  assertTransition(order.status, 'CANCELLED');

  await tx.order.update({
    where: { id: order.id },
    data: { status: 'CANCELLED', cancelledAt: new Date(), cancelReason: reason ?? null },
  });
  const refund = order.status === 'PAID';
  await tx.payment.update({ where: { orderId: order.id }, data: { status: refund ? 'REFUNDED' : 'CANCELLED' } });
  await releaseStock(tx, order.items, { orderId: order.id, actorUserId, reason: 'ORDER_CANCELLED' });

  await recordAudit(tx, {
    actorUserId,
    action: AuditAction.ORDER_CANCELLED,
    entityType: 'ORDER',
    entityId: order.id,
    metadata: { orderNumber: order.orderNumber, from: order.status, refund, ...(reason ? { reason } : {}) },
  });

  return tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderDetailInclude });
}

export async function cancelOwnOrder(userId: string, orderId: string, reason?: string): Promise<OrderView> {
  return prisma.$transaction(async (tx) => {
    const order = await lockOrder(tx, orderId, userId);
    if (!(CUSTOMER_CANCELLABLE_STATUSES as readonly OrderStatus[]).includes(order.status)) {
      throw new AppError(409, 'ORDER_NOT_CANCELLABLE', `An order that is ${order.status} can no longer be cancelled.`, {
        status: order.status,
      });
    }
    return toOrderView(await cancelLockedOrder(tx, order, userId, reason));
  }, TX_OPTIONS);
}
