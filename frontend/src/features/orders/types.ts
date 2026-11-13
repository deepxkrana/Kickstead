import type { Totals } from '../cart/types';

export type OrderStatus =
  | 'PLACED'
  | 'PAID'
  | 'PACKED'
  | 'SHIPPED'
  | 'DELIVERED'
  | 'CANCELLED'
  | 'PAYMENT_FAILED'
  | 'PAYMENT_CANCELLED';

export type PaymentStatus = 'PENDING' | 'SUCCEEDED' | 'FAILED' | 'CANCELLED' | 'REFUNDED';

export interface OrderSummary {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  paymentStatus: PaymentStatus | null;
  totalPaise: number;
  itemCount: number;
  imageUrl: string | null;
  createdAt: string;
}

export interface Order {
  id: string;
  orderNumber: string;
  status: OrderStatus;
  currency: string;
  createdAt: string;
  updatedAt: string;
  cancelledAt: string | null;
  cancelReason: string | null;
  totals: Totals;
  address: {
    fullName: string;
    phone: string;
    line1: string;
    line2: string | null;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  items: {
    id: string;
    productId: string | null;
    productSlug: string | null;
    name: string;
    imageUrl: string | null;
    unitPricePaise: number;
    quantity: number;
    lineTotalPaise: number;
  }[];
  payment: { status: PaymentStatus; provider: string; reference: string | null; amountPaise: number } | null;
  actions: { canPay: boolean; canCancel: boolean };
}

export type PaymentOutcome = 'SUCCESS' | 'FAILED' | 'CANCELLED';
