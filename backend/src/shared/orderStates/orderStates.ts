import { OrderStatus } from '@prisma/client';
import { Errors } from '../errors/AppError.js';

/** The only allowed order status transitions. Every status change must go through here. */
export const ALLOWED_TRANSITIONS: Readonly<Record<OrderStatus, readonly OrderStatus[]>> = {
  PLACED: ['PAID', 'PAYMENT_FAILED', 'PAYMENT_CANCELLED', 'CANCELLED'],
  PAID: ['PACKED', 'CANCELLED'],
  PACKED: ['SHIPPED'],
  SHIPPED: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
  PAYMENT_FAILED: [],
  PAYMENT_CANCELLED: [],
};

/** Statuses whose order total counts as revenue. */
export const REVENUE_STATUSES: readonly OrderStatus[] = ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED'];

/** Statuses from which a customer may cancel their own order. */
export const CUSTOMER_CANCELLABLE_STATUSES: readonly OrderStatus[] = ['PLACED', 'PAID'];

/** Statuses in which the order still holds reserved stock. */
export const STOCK_HOLDING_STATUSES: readonly OrderStatus[] = [
  'PLACED',
  'PAID',
  'PACKED',
  'SHIPPED',
  'DELIVERED',
];

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function isTerminal(status: OrderStatus): boolean {
  return ALLOWED_TRANSITIONS[status].length === 0;
}

/** Throws a 409 INVALID_STATUS_TRANSITION error when the transition is not allowed. */
export function assertTransition(from: OrderStatus, to: OrderStatus): void {
  if (!canTransition(from, to)) {
    throw Errors.conflict(
      'INVALID_STATUS_TRANSITION',
      `An order cannot move from ${from} to ${to}.`,
      { from, to, allowed: ALLOWED_TRANSITIONS[from] },
    );
  }
}
