import { z } from 'zod';
import { paginationQuery } from '../../shared/http/pagination.js';

const slug = z
  .string()
  .trim()
  .toLowerCase()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lowercase letters, digits and single hyphens');

const productFields = {
  name: z.string().trim().min(2).max(200),
  slug,
  brand: z.string().trim().min(1).max(100),
  description: z.string().trim().min(10).max(4000),
  pricePaise: z.number().int().min(0).max(100_000_000),
  imageUrl: z.url().max(2000).nullable(),
  categoryId: z.uuid(),
  isActive: z.boolean(),
  isFeatured: z.boolean(),
};

/** Stock is set separately (PATCH /stock) so every change is logged as an inventory movement. */
export const createProductBody = z.strictObject({
  ...productFields,
  slug: slug.optional(),
  imageUrl: productFields.imageUrl.optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  initialStock: z.number().int().min(0).max(100_000).default(0),
});

export const updateProductBody = z
  .strictObject(productFields)
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const stockBody = z.strictObject({
  /** "set" replaces the stock level; "adjust" adds (positive) or removes (negative) units. */
  mode: z.enum(['set', 'adjust']),
  quantity: z.number().int().min(-100_000).max(100_000),
  note: z.string().trim().max(300).optional(),
});

export const adminListProductsQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional().transform((v) => v || undefined),
  categoryId: z.uuid().optional(),
  status: z.enum(['active', 'inactive', 'all']).default('all'),
  lowStock: z.enum(['true', 'false']).optional().transform((v) => v === 'true'),
});

export const categoryBody = z.strictObject({
  name: z.string().trim().min(2).max(100),
  slug: slug.optional(),
  description: z.string().trim().max(500).nullable().optional(),
  isActive: z.boolean().default(true),
});

export const updateCategoryBody = z
  .strictObject({
    name: z.string().trim().min(2).max(100),
    slug,
    description: z.string().trim().max(500).nullable(),
    isActive: z.boolean(),
  })
  .partial()
  .refine((body) => Object.keys(body).length > 0, 'Provide at least one field to update');

export const idParams = z.object({ id: z.uuid() });

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
