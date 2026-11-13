import { api } from './client';
import type {
  AdminCategory,
  AdminOrderDetail,
  AdminOrderRow,
  AdminProduct,
  AdminProductDetail,
  AuditEntry,
  Customer,
  Dashboard,
  Paged,
  ProductInput,
} from '../features/admin/types';
import type { OrderStatus } from '../features/orders/types';

type Query = Record<string, string | number | boolean | undefined>;
const data = <T>(res: { data: T }) => res.data;

export const adminApi = {
  dashboard: () => api.get<{ data: Dashboard }>('/admin/dashboard').then(data),

  products: (query: Query) => api.get<Paged<AdminProduct>>('/admin/products', query),
  product: (id: string) => api.get<{ data: AdminProductDetail }>(`/admin/products/${id}`).then(data),
  createProduct: (input: ProductInput) => api.post<{ data: AdminProduct }>('/admin/products', input).then(data),
  updateProduct: (id: string, input: Partial<ProductInput>) =>
    api.patch<{ data: AdminProduct }>(`/admin/products/${id}`, input).then(data),
  adjustStock: (id: string, body: { mode: 'set' | 'adjust'; quantity: number; note?: string }) =>
    api.patch<{ data: AdminProduct }>(`/admin/products/${id}/stock`, body).then(data),

  categories: () => api.get<{ data: AdminCategory[] }>('/admin/categories').then(data),
  createCategory: (input: { name: string; description?: string | null; isActive?: boolean }) =>
    api.post<{ data: AdminCategory }>('/admin/categories', input).then(data),
  updateCategory: (id: string, input: Partial<{ name: string; description: string | null; isActive: boolean }>) =>
    api.patch<{ data: AdminCategory }>(`/admin/categories/${id}`, input).then(data),

  orders: (query: Query) => api.get<Paged<AdminOrderRow>>('/admin/orders', query),
  order: (id: string) => api.get<{ data: AdminOrderDetail }>(`/admin/orders/${id}`).then(data),
  updateOrderStatus: (id: string, status: OrderStatus, reason?: string) =>
    api.patch<{ data: AdminOrderDetail }>(`/admin/orders/${id}/status`, reason ? { status, reason } : { status }).then(data),

  customers: (query: Query) => api.get<Paged<Customer>>('/admin/customers', query),
  auditLogs: (query: Query) => api.get<Paged<AuditEntry>>('/admin/audit-logs', query),
};
