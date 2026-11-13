import { api } from './client';
import type { PageMeta } from '../features/catalog/types';
import type { Order, OrderSummary, PaymentOutcome } from '../features/orders/types';

export const orderApi = {
  /** Sends only the address and idempotency key. The server prices the order from the database. */
  checkout: (addressId: string, idempotencyKey: string) =>
    api.post<{ data: Order }>('/checkout', { addressId, idempotencyKey }).then((res) => res.data),
  list: (page: number) => api.get<{ data: OrderSummary[]; meta: PageMeta }>('/orders', { page }),
  get: (id: string) => api.get<{ data: Order }>(`/orders/${id}`).then((res) => res.data),
  pay: (id: string, outcome: PaymentOutcome) =>
    api.post<{ data: Order }>(`/orders/${id}/payment`, { outcome }).then((res) => res.data),
  cancel: (id: string, reason?: string) =>
    api.post<{ data: Order }>(`/orders/${id}/cancel`, reason ? { reason } : {}).then((res) => res.data),
};
