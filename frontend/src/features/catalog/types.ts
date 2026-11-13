export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export interface Category {
  id: string;
  name: string;
  slug: string;
  description: string | null;
}

export interface ProductSummary {
  id: string;
  slug: string;
  name: string;
  brand: string;
  pricePaise: number;
  stockQuantity: number;
  stockStatus: StockStatus;
  imageUrl: string | null;
  isFeatured: boolean;
  category: { id: string; name: string; slug: string };
}

export interface ProductDetail extends ProductSummary {
  description: string;
}

export interface PageMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export type ProductSort = 'newest' | 'price_asc' | 'price_desc' | 'name_asc';

export interface ProductQuery {
  q?: string;
  category?: string;
  sort?: ProductSort;
  minPrice?: number; // paise
  maxPrice?: number; // paise
  page?: number;
  limit?: number;
  featured?: boolean;
}
