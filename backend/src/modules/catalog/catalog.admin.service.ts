import { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { LOW_STOCK_THRESHOLD } from '../../config/pricing.js';
import { prisma } from '../../db/prisma.js';
import { AppError, Errors } from '../../shared/errors/AppError.js';
import { pageMeta } from '../../shared/http/pagination.js';
import { likeLiteral } from '../../shared/db/like.js';
import { AuditAction, recordAudit } from '../audit/audit.service.js';
import { stockStatus } from './catalog.service.js';
import {
  slugify,
  type adminListProductsQuery,
  type categoryBody,
  type createProductBody,
  type stockBody,
  type updateCategoryBody,
  type updateProductBody,
} from './catalog.admin.schemas.js';

const adminProductSelect = {
  id: true,
  slug: true,
  name: true,
  brand: true,
  description: true,
  pricePaise: true,
  stockQuantity: true,
  imageUrl: true,
  isActive: true,
  isFeatured: true,
  createdAt: true,
  updatedAt: true,
  category: { select: { id: true, name: true, slug: true, isActive: true } },
} satisfies Prisma.ProductSelect;

type AdminProductRow = Prisma.ProductGetPayload<{ select: typeof adminProductSelect }>;
const toAdminProduct = (row: AdminProductRow) => ({ ...row, stockStatus: stockStatus(row.stockQuantity) });

/** Translates unique-constraint errors on slug/name into a clear 409. */
function rethrowUnique(err: unknown, entity: 'product' | 'category'): never {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
    const target = JSON.stringify(err.meta?.target ?? '');
    const field = target.includes('name') ? 'name' : 'slug';
    throw Errors.conflict(`${entity.toUpperCase()}_${field.toUpperCase()}_TAKEN`, `Another ${entity} already uses this ${field}.`, { field });
  }
  throw err;
}

async function assertCategoryExists(categoryId: string) {
  if (!(await prisma.category.count({ where: { id: categoryId } }))) {
    throw new AppError(422, 'CATEGORY_NOT_FOUND', 'The selected category does not exist.');
  }
}

/** Admins see every product, including inactive ones and those in inactive categories. */
export async function adminListProducts(query: z.infer<typeof adminListProductsQuery>) {
  const filters: Prisma.ProductWhereInput[] = [];
  if (query.q) {
    const q = likeLiteral(query.q);
    filters.push({
      OR: [
        { name: { contains: q, mode: 'insensitive' } },
        { brand: { contains: q, mode: 'insensitive' } },
        { slug: { contains: q, mode: 'insensitive' } },
      ],
    });
  }
  if (query.categoryId) filters.push({ categoryId: query.categoryId });
  if (query.status !== 'all') filters.push({ isActive: query.status === 'active' });
  if (query.lowStock) filters.push({ stockQuantity: { lte: LOW_STOCK_THRESHOLD } });
  const where: Prisma.ProductWhereInput = { AND: filters };

  const [rows, total] = await prisma.$transaction([
    prisma.product.findMany({
      where,
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      skip: (query.page - 1) * query.limit,
      take: query.limit,
      select: adminProductSelect,
    }),
    prisma.product.count({ where }),
  ]);
  return { data: rows.map(toAdminProduct), meta: pageMeta(query.page, query.limit, total) };
}

export async function adminGetProduct(id: string) {
  const row = await prisma.product.findUnique({ where: { id }, select: adminProductSelect });
  if (!row) throw Errors.notFound('Product');
  return toAdminProduct(row);
}

export async function createProduct(actorUserId: string, input: z.infer<typeof createProductBody>) {
  await assertCategoryExists(input.categoryId);
  const { initialStock, ...fields } = input;
  try {
    const product = await prisma.$transaction(async (tx) => {
      const created = await tx.product.create({
        data: { ...fields, slug: fields.slug ?? slugify(fields.name), imageUrl: fields.imageUrl ?? null, stockQuantity: initialStock },
        select: adminProductSelect,
      });
      if (initialStock > 0) {
        await tx.inventoryMovement.create({
          data: {
            productId: created.id,
            quantityChange: initialStock,
            stockAfter: initialStock,
            reason: 'ADMIN_ADJUSTMENT',
            actorUserId,
            note: 'Initial stock',
          },
        });
      }
      await recordAudit(tx, {
        actorUserId,
        action: AuditAction.PRODUCT_CREATED,
        entityType: 'PRODUCT',
        entityId: created.id,
        metadata: { name: created.name, slug: created.slug, pricePaise: created.pricePaise, initialStock },
      });
      return created;
    });
    return toAdminProduct(product);
  } catch (err) {
    rethrowUnique(err, 'product');
  }
}

export async function updateProduct(actorUserId: string, id: string, input: z.infer<typeof updateProductBody>) {
  if (input.categoryId) await assertCategoryExists(input.categoryId);
  try {
    const product = await prisma.$transaction(async (tx) => {
      const before = await tx.product.findUnique({ where: { id }, select: adminProductSelect });
      if (!before) throw Errors.notFound('Product');
      const after = await tx.product.update({ where: { id }, data: input, select: adminProductSelect });

      // Record only fields that actually changed, with before → after values.
      const changes: Record<string, { from: Prisma.InputJsonValue | null; to: Prisma.InputJsonValue | null }> = {};
      for (const key of Object.keys(input) as (keyof typeof input)[]) {
        const from = key === 'categoryId' ? before.category.id : before[key as Exclude<typeof key, 'categoryId'>];
        const to = key === 'categoryId' ? after.category.id : after[key as Exclude<typeof key, 'categoryId'>];
        if (from !== to) changes[key] = { from: from as Prisma.InputJsonValue | null, to: to as Prisma.InputJsonValue | null };
      }
      if (Object.keys(changes).length) {
        await recordAudit(tx, {
          actorUserId,
          action: AuditAction.PRODUCT_UPDATED,
          entityType: 'PRODUCT',
          entityId: id,
          metadata: { name: after.name, changes },
        });
      }
      return after;
    });
    return toAdminProduct(product);
  } catch (err) {
    rethrowUnique(err, 'product');
  }
}

/**
 * Manual stock change. Locks the product row so it cannot interleave with a checkout,
 * refuses negative results, and logs an ADMIN_ADJUSTMENT movement plus an audit record.
 */
export async function adjustStock(actorUserId: string, id: string, input: z.infer<typeof stockBody>) {
  return prisma.$transaction(async (tx) => {
    const locked = await tx.$queryRaw<{ stockQuantity: number }[]>`
      SELECT stock_quantity AS "stockQuantity" FROM products WHERE id = ${id}::uuid FOR UPDATE`;
    if (!locked[0]) throw Errors.notFound('Product');
    const current = locked[0].stockQuantity;

    if (input.mode === 'set' && input.quantity < 0) {
      throw Errors.unprocessable('STOCK_NEGATIVE', 'Stock cannot be negative.', { current });
    }
    const next = input.mode === 'set' ? input.quantity : current + input.quantity;
    if (next < 0) {
      throw Errors.unprocessable('STOCK_NEGATIVE', `Only ${current} in stock; cannot remove ${-input.quantity}.`, { current });
    }
    if (next === current) throw Errors.unprocessable('NO_CHANGE', 'The stock level is unchanged.', { current });

    await tx.product.update({ where: { id }, data: { stockQuantity: next } });
    await tx.inventoryMovement.create({
      data: {
        productId: id,
        quantityChange: next - current,
        stockAfter: next,
        reason: 'ADMIN_ADJUSTMENT',
        actorUserId,
        note: input.note ?? null,
      },
    });
    await recordAudit(tx, {
      actorUserId,
      action: AuditAction.INVENTORY_ADJUSTED,
      entityType: 'PRODUCT',
      entityId: id,
      metadata: { from: current, to: next, change: next - current, mode: input.mode, ...(input.note ? { note: input.note } : {}) },
    });

    const row = await tx.product.findUniqueOrThrow({ where: { id }, select: adminProductSelect });
    return toAdminProduct(row);
  });
}

export async function productMovements(id: string) {
  return prisma.inventoryMovement.findMany({
    where: { productId: id },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      quantityChange: true,
      stockAfter: true,
      reason: true,
      note: true,
      createdAt: true,
      order: { select: { id: true, orderNumber: true } },
      actor: { select: { name: true, email: true } },
    },
  });
}

export async function adminListCategories() {
  const rows = await prisma.category.findMany({
    orderBy: { name: 'asc' },
    select: { id: true, name: true, slug: true, description: true, isActive: true, _count: { select: { products: true } } },
  });
  return rows.map(({ _count, ...category }) => ({ ...category, productCount: _count.products }));
}

export async function createCategory(actorUserId: string, input: z.infer<typeof categoryBody>) {
  try {
    return await prisma.$transaction(async (tx) => {
      const category = await tx.category.create({
        data: { ...input, slug: input.slug ?? slugify(input.name), description: input.description ?? null },
      });
      await recordAudit(tx, {
        actorUserId,
        action: AuditAction.CATEGORY_CREATED,
        entityType: 'CATEGORY',
        entityId: category.id,
        metadata: { name: category.name, slug: category.slug },
      });
      return category;
    });
  } catch (err) {
    rethrowUnique(err, 'category');
  }
}

/** Deactivating a category hides all of its products from shoppers (and blocks checkout of them). */
export async function updateCategory(actorUserId: string, id: string, input: z.infer<typeof updateCategoryBody>) {
  try {
    return await prisma.$transaction(async (tx) => {
      const before = await tx.category.findUnique({ where: { id } });
      if (!before) throw Errors.notFound('Category');
      const after = await tx.category.update({ where: { id }, data: input });
      await recordAudit(tx, {
        actorUserId,
        action: AuditAction.CATEGORY_UPDATED,
        entityType: 'CATEGORY',
        entityId: id,
        metadata: {
          name: after.name,
          changes: Object.fromEntries(
            (Object.keys(input) as (keyof typeof input)[])
              .filter((key) => before[key] !== after[key])
              .map((key) => [key, { from: before[key], to: after[key] }]),
          ),
        },
      });
      return after;
    });
  } catch (err) {
    rethrowUnique(err, 'category');
  }
}
