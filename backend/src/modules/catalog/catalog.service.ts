import { Prisma } from '@prisma/client';
import { LOW_STOCK_THRESHOLD } from '../../config/pricing.js';
import { prisma } from '../../db/prisma.js';
import { Errors } from '../../shared/errors/AppError.js';
import { pageMeta } from '../../shared/http/pagination.js';
import type { ListProductsQuery } from './catalog.schemas.js';

export type StockStatus = 'IN_STOCK' | 'LOW_STOCK' | 'OUT_OF_STOCK';

export function stockStatus(stockQuantity: number): StockStatus {
  if (stockQuantity <= 0) return 'OUT_OF_STOCK';
  if (stockQuantity <= LOW_STOCK_THRESHOLD) return 'LOW_STOCK';
  return 'IN_STOCK';
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Only active products in active categories are visible to shoppers. */
const visibleProduct: Prisma.ProductWhereInput = { isActive: true, category: { isActive: true } };

const productSummarySelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  pricePaise: true,
  stockQuantity: true,
  imageUrl: true,
  isFeatured: true,
  category: { select: { id: true, name: true, slug: true } },
} satisfies Prisma.ProductSelect;

type ProductSummaryRow = Prisma.ProductGetPayload<{ select: typeof productSummarySelect }>;

function toSummary(row: ProductSummaryRow) {
  return { ...row, stockStatus: stockStatus(row.stockQuantity) };
}

const ORDER_BY: Record<ListProductsQuery['sort'], Prisma.ProductOrderByWithRelationInput[]> = {
  newest: [{ createdAt: 'desc' }, { id: 'asc' }],
  price_asc: [{ pricePaise: 'asc' }, { id: 'asc' }],
  price_desc: [{ pricePaise: 'desc' }, { id: 'asc' }],
  name_asc: [{ name: 'asc' }, { id: 'asc' }],
};

export async function listCategories() {
  return prisma.category.findMany({
    where: { isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, description: true },
  });
}

/** Search, filtering, sorting and pagination all run in PostgreSQL. */
export async function listProducts(query: ListProductsQuery) {
  const filters: Prisma.ProductWhereInput[] = [visibleProduct];

  if (query.q) {
    filters.push({
      OR: [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { brand: { contains: query.q, mode: 'insensitive' } },
      ],
    });
  }
  if (query.categoryId) filters.push({ categoryId: query.categoryId });
  if (query.category) filters.push({ category: { slug: query.category } });
  if (query.minPrice !== undefined) filters.push({ pricePaise: { gte: query.minPrice } });
  if (query.maxPrice !== undefined) filters.push({ pricePaise: { lte: query.maxPrice } });
  if (query.featured !== undefined) filters.push({ isFeatured: query.featured });

  const where: Prisma.ProductWhereInput = { AND: filters };

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: ORDER_BY[query.sort],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: productSummarySelect,
    }),
    prisma.product.count({ where }),
  ]);

  return { data: rows.map(toSummary), meta: pageMeta(query.page, query.limit, total) };
}

export async function getProduct(idOrSlug: string) {
  const row = await prisma.product.findFirst({
    where: {
      ...visibleProduct,
      ...(UUID_PATTERN.test(idOrSlug) ? { id: idOrSlug } : { slug: idOrSlug }),
    },
    select: { ...productSummarySelect, description: true },
  });
  if (!row) throw Errors.notFound('Product');
  return { ...row, stockStatus: stockStatus(row.stockQuantity) };
}
