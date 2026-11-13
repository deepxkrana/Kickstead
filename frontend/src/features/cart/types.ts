import type { StockStatus } from '../catalog/types';

export type CartItemIssue = 'UNAVAILABLE' | 'OUT_OF_STOCK' | 'INSUFFICIENT_STOCK';

export interface CartItem {
  id: string;
  quantity: number;
  lineTotalPaise: number;
  issue: CartItemIssue | null;
  product: {
    id: string;
    slug: string;
    name: string;
    brand: string;
    imageUrl: string | null;
    pricePaise: number;
    stockQuantity: number;
    stockStatus: StockStatus;
    isAvailable: boolean;
  };
}

export interface Totals {
  subtotalPaise: number;
  discountPaise: number;
  taxPaise: number;
  shippingPaise: number;
  totalPaise: number;
}

export interface Cart {
  id: string | null;
  items: CartItem[];
  itemCount: number;
  totals: Totals;
  canCheckout: boolean;
}
