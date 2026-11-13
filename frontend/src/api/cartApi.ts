import { api } from './client';
import type { Cart } from '../features/cart/types';

const unwrap = (res: { data: Cart }) => res.data;

/** Only product ids and quantities are sent. Prices and totals always come from the server. */
export const cartApi = {
  get: () => api.get<{ data: Cart }>('/cart').then(unwrap),
  add: (productId: string, quantity: number) =>
    api.post<{ data: Cart }>('/cart/items', { productId, quantity }).then(unwrap),
  update: (itemId: string, quantity: number) =>
    api.patch<{ data: Cart }>(`/cart/items/${itemId}`, { quantity }).then(unwrap),
  remove: (itemId: string) => api.delete<{ data: Cart }>(`/cart/items/${itemId}`).then(unwrap),
  clear: () => api.delete<{ data: Cart }>('/cart').then(unwrap),
};
