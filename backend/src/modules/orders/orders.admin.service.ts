import type { OrderStatus, Prisma } from '@prisma/client';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { likeLiteral } from '../../shared/db/like.js';
import { AppError } from '../../shared/errors/AppError.js';
import { pageMeta, paginationQuery } from '../../shared/http/pagination.js';
import { ALLOWED_TRANSITIONS, assertTransition } from '../../shared/orderStates/orderStates.js';
import { AuditAction, recordAudit } from '../audit/audit.service.js';
import { cancelLockedOrder, lockOrder, orderNotFound } from './orders.service.js';
import { orderDetailInclude, toOrderView } from './orders.view.js';

const ORDER_STATUSES = ['PLACED', 'PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED'] as const;

/**
 * Admins move orders through fulfilment and can cancel. Payment outcomes (PAID, PAYMENT_FAILED,
 * PAYMENT_CANCELLED) are recorded only by the payment flow, never set by hand.
 */
export const ADMIN_TARGET_STATUSES: readonly OrderStatus[] = ['PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'];

export const adminListOrdersQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional().transform((v) => v || undefined),
  status: z.enum(ORDER_STATUSES).optional(),
});

export const adminStatusBody = z.strictObject({
  status: z.enum(ORDER_STATUSES),
  reason: z.string().trim().max(300).optional(),
});

export function adminNextStatuses(status: OrderStatus): OrderStatus[] {
  return ALLOWED_TRANSITIONS[status].filter((next) => ADMIN_TARGET_STATUSES.includes(next));
}

export async function adminListOrders(query: z.infer<typeof adminListOrdersQuery>) {
  const filters: Prisma.OrderWhereInput[] = [];
  if (query.status) filters.push({ status: query.status });
  if (query.q) {
    const q = likeLiteral(query.q);
    filters.push({
      OR: [
        { orderNumber: { contains: q, mode: 'insensitive' } },
        { user: { email: { contains: q, mode: 'insensitive' } } },
        { user: { name: { contains: q, mode: 'insensitive' } } },
      ],
    });
  }
  const where: Prisma.OrderWhereInput = { AND: filters };

  const [rows, total] = await prisma.$transaction([
    prisma.order.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalPaise: true,
        createdAt: true,
        user: { select: { id: true, name: true, email: true } },
        payment: { select: { status: true } },
        items: { select: { quantity: true } },
      },
    }),
    prisma.order.count({ where }),
  ]);

  return {
    data: rows.map(({ user, payment, items, ...order }) => ({
      ...order,
      customer: user,
      paymentStatus: payment?.status ?? null,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
    })),
    meta: pageMeta(query.page, query.limit, total),
  };
}

export async function adminGetOrder(id: string) {
  const order = await prisma.order.findUnique({
    where: { id },
    include: { ...orderDetailInclude, user: { select: { id: true, name: true, email: true } } },
  });
  if (!order) throw orderNotFound();

  const [history, movements] = await Promise.all([
    prisma.auditLog.findMany({
      where: { entityType: 'ORDER', entityId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, action: true, metadata: true, createdAt: true, actor: { select: { name: true, email: true, role: true } } },
    }),
    prisma.inventoryMovement.findMany({
      where: { orderId: id },
      orderBy: { createdAt: 'asc' },
      select: { id: true, quantityChange: true, stockAfter: true, reason: true, createdAt: true, product: { select: { name: true } } },
    }),
  ]);

  return {
    ...toOrderView(order),
    customer: order.user,
    adminActions: { nextStatuses: adminNextStatuses(order.status) },
    history,
    movements,
  };
}

/** Locks the order, validates the transition against the shared state machine, and audits it. */
export async function adminUpdateStatus(actorUserId: string, id: string, input: z.infer<typeof adminStatusBody>) {
  if (!ADMIN_TARGET_STATUSES.includes(input.status)) {
    throw new AppError(422, 'PAYMENT_STATUS_NOT_ADMIN', 'Payment outcomes are recorded by the payment flow, not set by admins.', {
      allowed: ADMIN_TARGET_STATUSES,
    });
  }

  await prisma.$transaction(
    async (tx) => {
      const order = await lockOrder(tx, id);
      if (input.status === 'CANCELLED') {
        await cancelLockedOrder(tx, order, actorUserId, input.reason);
        return;
      }
      assertTransition(order.status, input.status);
      await tx.order.update({ where: { id }, data: { status: input.status } });
      await recordAudit(tx, {
        actorUserId,
        action: AuditAction.ORDER_STATUS_CHANGED,
        entityType: 'ORDER',
        entityId: id,
        metadata: { orderNumber: order.orderNumber, from: order.status, to: input.status, ...(input.reason ? { reason: input.reason } : {}) },
      });
    },
    { maxWait: 10_000, timeout: 20_000 },
  );

  return adminGetOrder(id);
}
