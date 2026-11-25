import { api } from './client';
import type { AddressInput } from '../features/addresses/types';
import type { PageMeta } from '../features/catalog/types';
import type { Order, OrderSummary, PaymentOutcome } from '../features/orders/types';

export type CheckoutPayload =
  | { addressId: string; idempotencyKey: string }
  | { address: Omit<AddressInput, 'isDefault'>; idempotencyKey: string };

export const orderApi = {
  /** Sends only the address (saved id or one-time address) and idempotency key. The server prices the order. */
  checkout: (payload: CheckoutPayload) =>
    api.post<{ data: Order }>('/checkout', payload).then((res) => res.data),
  list: (page: number) => api.get<{ data: OrderSummary[]; meta: PageMeta }>('/orders', { page }),
  get: (id: string) => api.get<{ data: Order }>(`/orders/${id}`).then((res) => res.data),
  pay: (id: string, outcome: PaymentOutcome) =>
    api.post<{ data: Order }>(`/orders/${id}/payment`, { outcome }).then((res) => res.data),
  cancel: (id: string, reason?: string) =>
    api.post<{ data: Order }>(`/orders/${id}/cancel`, reason ? { reason } : {}).then((res) => res.data),
};
