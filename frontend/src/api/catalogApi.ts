import { api } from './client';
import type { Category, PageMeta, ProductDetail, ProductQuery, ProductSummary } from '../features/catalog/types';

export const catalogApi = {
  categories: () => api.get<{ data: Category[] }>('/categories').then((res) => res.data),
  products: (query: ProductQuery, signal?: AbortSignal) =>
    api.get<{ data: ProductSummary[]; meta: PageMeta }>('/products', { ...query }, signal),
  product: (idOrSlug: string) =>
    api.get<{ data: ProductDetail }>(`/products/${encodeURIComponent(idOrSlug)}`).then((res) => res.data),
};
