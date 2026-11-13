import { randomUUID } from 'node:crypto';
import type { Role } from '@prisma/client';
import { prisma } from '../../src/db/prisma.js';

const TABLES = [
  'audit_logs',
  'inventory_movements',
  'payments',
  'order_items',
  'orders',
  'cart_items',
  'carts',
  'addresses',
  'products',
  'categories',
  'users',
];

/** Wipes every application table. Only ever runs against the local test database. */
export async function resetDatabase() {
  const url = process.env.DATABASE_URL ?? '';
  if (/supabase\.(co|com)/i.test(url) || !url.includes('kickstead_test')) {
    throw new Error('resetDatabase refused: DATABASE_URL is not the local kickstead_test database.');
  }
  await prisma.$executeRawUnsafe(`TRUNCATE TABLE ${TABLES.map((t) => `"${t}"`).join(', ')} CASCADE`);
}

let counter = 0;
const next = () => (counter += 1);

export async function createCategory(overrides: { name?: string; slug?: string; isActive?: boolean } = {}) {
  const n = next();
  return prisma.category.create({
    data: { name: overrides.name ?? `Category ${n}`, slug: overrides.slug ?? `category-${n}`, isActive: overrides.isActive ?? true },
  });
}

export async function createProduct(
  categoryId: string,
  overrides: Partial<{
    name: string;
    slug: string;
    brand: string;
    description: string;
    pricePaise: number;
    stockQuantity: number;
    isActive: boolean;
    isFeatured: boolean;
    createdAt: Date;
  }> = {},
) {
  const n = next();
  return prisma.product.create({
    data: {
      categoryId,
      name: overrides.name ?? `Product ${n}`,
      slug: overrides.slug ?? `product-${n}`,
      brand: overrides.brand ?? 'Testbrand',
      description: overrides.description ?? 'A test product.',
      pricePaise: overrides.pricePaise ?? 100_000,
      stockQuantity: overrides.stockQuantity ?? 10,
      isActive: overrides.isActive ?? true,
      isFeatured: overrides.isFeatured ?? false,
      ...(overrides.createdAt ? { createdAt: overrides.createdAt } : {}),
    },
  });
}

export async function createUser(overrides: { email?: string; role?: Role; isActive?: boolean } = {}) {
  const n = next();
  return prisma.user.create({
    data: {
      id: randomUUID(),
      email: overrides.email ?? `user${n}@test.dev`,
      name: `User ${n}`,
      role: overrides.role ?? 'CUSTOMER',
      isActive: overrides.isActive ?? true,
    },
  });
}

export { prisma };

export async function createAddress(userId: string, overrides: { isDefault?: boolean; city?: string } = {}) {
  return prisma.address.create({
    data: {
      userId,
      fullName: 'Test Person',
      phone: '+91 98765 43210',
      line1: '1 Test Street',
      city: overrides.city ?? 'Mumbai',
      state: 'Maharashtra',
      postalCode: '400001',
      country: 'India',
      isDefault: overrides.isDefault ?? true,
    },
  });
}

/** Puts items straight into a user's cart (bypassing the API's early stock checks). */
export async function fillCart(userId: string, lines: { productId: string; quantity: number }[]) {
  const cart = await prisma.cart.upsert({ where: { userId }, create: { userId }, update: {} });
  for (const line of lines) {
    await prisma.cartItem.upsert({
      where: { cartId_productId: { cartId: cart.id, productId: line.productId } },
      create: { cartId: cart.id, ...line },
      update: { quantity: line.quantity },
    });
  }
  return cart;
}

export async function stockOf(productId: string) {
  return (await prisma.product.findUniqueOrThrow({ where: { id: productId } })).stockQuantity;
}
