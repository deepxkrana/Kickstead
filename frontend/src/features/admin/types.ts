import type { Category, PageMeta, StockStatus } from '../catalog/types';
import type { Order, OrderStatus, PaymentStatus } from '../orders/types';

export interface AdminProduct {
  id: string;
  slug: string;
  name: string;
  brand: string;
  description: string;
  pricePaise: number;
  stockQuantity: number;
  stockStatus: StockStatus;
  imageUrl: string | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: string;
  updatedAt: string;
  category: { id: string; name: string; slug: string; isActive: boolean };
}

export interface InventoryMovement {
  id: string;
  quantityChange: number;
  stockAfter: number;
  reason: 'ORDER_RESERVED' | 'ORDER_RELEASED' | 'ORDER_CANCELLED' | 'ADMIN_ADJUSTMENT' | 'SEED';
  note: string | null;
  createdAt: string;
  order: { id: string; orderNumber: string } | null;
  actor: { name: string; email: string } | null;
}

export interface AdminProductDetail extends AdminProduct {
  movements: InventoryMovement[];
}

export interface ProductInput {
  name: string;
  slug?: string;
  brand: string;
  description: string;
  pricePaise: number;
  imageUrl: string | null;
  categoryId: string;
  isActive: boolean;
  isFeatured: boolean;
  initialStock?: number;
}

export interface AdminCategory extends Category {
  isActive: boolean;
  productCount: number;
}

export interface Customer {
  id: string;
  email: string;
  name: string;
  isActive: boolean;
  createdAt: string;
  orderCount: number;
}

export interface AdminOrderRow {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus | null;
  totalPaise: number;
  itemCount: number;
  createdAt: string;
  customer: { id: string; name: string; email: string };
}

export interface AuditEntry {
  id: string;
  action: string;
  entityType: 'ORDER' | 'PRODUCT' | 'CATEGORY';
  entityId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt: string;
  actor: { id?: string; name: string; email: string; role: 'CUSTOMER' | 'ADMIN' } | null;
}

export interface AdminOrderDetail extends Order {
  customer: { id: string; name: string; email: string };
  adminActions: { nextStatuses: OrderStatus[] };
  history: Omit<AuditEntry, 'entityType' | 'entityId'>[];
  movements: { id: string; quantityChange: number; stockAfter: number; reason: InventoryMovement['reason']; createdAt: string; product: { name: string } }[];
}

export interface Dashboard {
  totals: {
    totalOrders: number;
    paidOrders: number;
    pendingOrders: number;
    toFulfil: number;
    cancelledOrders: number;
    failedPayments: number;
    revenuePaise: number;
  };
  byStatus: Record<OrderStatus, number>;
  revenueRule: string;
  lowStock: { threshold: number; count: number; products: { id: string; name: string; brand: string; stockQuantity: number; imageUrl: string | null }[] };
  recentOrders: { id: string; orderNumber: string; status: OrderStatus; totalPaise: number; createdAt: string; customer: { name: string; email: string } }[];
}

export type Paged<T> = { data: T[]; meta: PageMeta };
