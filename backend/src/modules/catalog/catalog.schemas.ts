import { z } from 'zod';
import { paginationQuery } from '../../shared/http/pagination.js';

export const PRODUCT_SORTS = ['newest', 'price_asc', 'price_desc', 'name_asc'] as const;

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((value) => (value ? value : undefined));

/** Prices are integer paise, matching how money is stored. */
const paiseFilter = z.coerce.number().int().min(0).max(100_000_000).optional();

export const listProductsQuery = paginationQuery
  .extend({
    limit: z.coerce.number().int().min(1).max(48).default(12),
    q: optionalText(100),
    categoryId: z.uuid().optional(),
    category: optionalText(120),
    minPrice: paiseFilter,
    maxPrice: paiseFilter,
    sort: z.enum(PRODUCT_SORTS).default('newest'),
    featured: z
      .enum(['true', 'false'])
      .optional()
      .transform((value) => (value === undefined ? undefined : value === 'true')),
  })
  .refine((query) => query.minPrice === undefined || query.maxPrice === undefined || query.minPrice <= query.maxPrice, {
    path: ['minPrice'],
    message: 'minPrice must be less than or equal to maxPrice',
  });

export type ListProductsQuery = z.infer<typeof listProductsQuery>;

/** Products can be opened by id (UUID) or by slug. */
export const productParams = z.object({
  idOrSlug: z.string().trim().min(1).max(220),
});
