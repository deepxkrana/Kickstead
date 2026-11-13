import type { OrderStatus } from '../features/orders/types';

const LABEL: Record<OrderStatus, string> = {
  PLACED: 'Awaiting payment',
  PAID: 'Paid',
  PACKED: 'Packed',
  SHIPPED: 'Shipped',
  DELIVERED: 'Delivered',
  CANCELLED: 'Cancelled',
  PAYMENT_FAILED: 'Payment failed',
  PAYMENT_CANCELLED: 'Payment cancelled',
};

const STYLE: Record<OrderStatus, string> = {
  PLACED: 'bg-secondary text-error-strong ring-1 ring-error',
  PAID: 'bg-primary text-secondary',
  PACKED: 'bg-primary text-secondary',
  SHIPPED: 'bg-primary text-secondary',
  DELIVERED: 'bg-neutral text-primary ring-1 ring-primary',
  CANCELLED: 'bg-neutral text-primary-60',
  PAYMENT_FAILED: 'bg-error-strong text-secondary',
  PAYMENT_CANCELLED: 'bg-neutral text-primary-60',
};

export function StatusBadge({ status }: { status: OrderStatus }) {
  return <span className={`chip ${STYLE[status]}`}>{LABEL[status]}</span>;
}

export function statusLabel(status: OrderStatus) {
  return LABEL[status];
}
