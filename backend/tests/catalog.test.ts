import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createCategory, createProduct, prisma, resetDatabase } from './helpers/db.js';
import { testApp as app } from './helpers/app.js';

let running: { id: string };
let lifestyle: { id: string };

beforeEach(async () => {
  await resetDatabase();
  running = await createCategory({ name: 'Running', slug: 'running' });
  lifestyle = await createCategory({ name: 'Lifestyle', slug: 'lifestyle' });
  const hidden = await createCategory({ name: 'Hidden', slug: 'hidden', isActive: false });

  const day = (n: number) => new Date(Date.UTC(2026, 0, n));
  await createProduct(running.id, { name: 'Tempo Runner', slug: 'tempo', brand: 'Stridewell', pricePaise: 650_000, stockQuantity: 20, createdAt: day(1), isFeatured: true });
  await createProduct(running.id, { name: 'Glide Two', slug: 'glide', brand: 'Northline', pricePaise: 880_000, stockQuantity: 3, createdAt: day(2) });
  await createProduct(lifestyle.id, { name: 'City Classic', slug: 'city', brand: 'Kerb Club', pricePaise: 460_000, stockQuantity: 0, createdAt: day(3), description: 'Clean leather low-top' });
  await createProduct(lifestyle.id, { name: 'Retired Shoe', slug: 'retired', isActive: false });
  await createProduct(hidden.id, { name: 'Ghost Shoe', slug: 'ghost' });
});

afterAll(() => prisma.$disconnect());

const names = (res: request.Response) => res.body.data.map((p: { name: string }) => p.name);

describe('GET /api/categories', () => {
  it('lists active categories only, by name', async () => {
    const res = await request(app).get('/api/categories');
    expect(res.status).toBe(200);
    expect(res.body.data.map((c: { slug: string }) => c.slug)).toEqual(['lifestyle', 'running']);
  });
});

describe('GET /api/products', () => {
  it('shows only active products in active categories, newest first', async () => {
    const res = await request(app).get('/api/products');
    expect(res.status).toBe(200);
    expect(names(res)).toEqual(['City Classic', 'Glide Two', 'Tempo Runner']);
    expect(res.body.meta).toEqual({ page: 1, limit: 12, total: 3, totalPages: 1 });
  });

  it('searches name, brand and description case-insensitively', async () => {
    expect(names(await request(app).get('/api/products?q=TEMPO'))).toEqual(['Tempo Runner']);
    expect(names(await request(app).get('/api/products?q=northline'))).toEqual(['Glide Two']);
    expect(names(await request(app).get('/api/products?q=leather'))).toEqual(['City Classic']);
    expect(names(await request(app).get('/api/products?q=ghost'))).toEqual([]);
  });

  it('filters by category id or slug', async () => {
    expect(names(await request(app).get(`/api/products?categoryId=${lifestyle.id}`))).toEqual(['City Classic']);
    expect(names(await request(app).get('/api/products?category=running'))).toEqual(['Glide Two', 'Tempo Runner']);
  });

  it('filters by an inclusive price range in paise', async () => {
    const res = await request(app).get('/api/products?minPrice=460000&maxPrice=650000&sort=price_asc');
    expect(names(res)).toEqual(['City Classic', 'Tempo Runner']);
  });

  it('sorts by price and name', async () => {
    expect(names(await request(app).get('/api/products?sort=price_desc'))).toEqual(['Glide Two', 'Tempo Runner', 'City Classic']);
    expect(names(await request(app).get('/api/products?sort=name_asc'))).toEqual(['City Classic', 'Glide Two', 'Tempo Runner']);
  });

  it('paginates on the server', async () => {
    const res = await request(app).get('/api/products?sort=price_asc&limit=2&page=2');
    expect(names(res)).toEqual(['Glide Two']);
    expect(res.body.meta).toEqual({ page: 2, limit: 2, total: 3, totalPages: 2 });
  });

  it('filters featured products', async () => {
    expect(names(await request(app).get('/api/products?featured=true'))).toEqual(['Tempo Runner']);
  });

  it('reports stock status', async () => {
    const res = await request(app).get('/api/products?sort=price_asc');
    expect(res.body.data.map((p: { stockStatus: string }) => p.stockStatus)).toEqual(['OUT_OF_STOCK', 'IN_STOCK', 'LOW_STOCK']);
  });

  it.each([
    ['limit=500', 'limit too large'],
    ['page=0', 'page below 1'],
    ['minPrice=900&maxPrice=100', 'min above max'],
    ['sort=cheapest', 'unknown sort'],
    ['categoryId=not-a-uuid', 'bad category id'],
  ])('rejects invalid query %s (%s) with 400', async (query) => {
    const res = await request(app).get(`/api/products?${query}`);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('GET /api/products/:idOrSlug', () => {
  it('returns a product by slug or id, with description and category', async () => {
    const bySlug = await request(app).get('/api/products/tempo');
    expect(bySlug.status).toBe(200);
    expect(bySlug.body.data).toMatchObject({ name: 'Tempo Runner', pricePaise: 650_000, category: { slug: 'running' } });
    expect(bySlug.body.data.description).toBeTypeOf('string');

    const byId = await request(app).get(`/api/products/${bySlug.body.data.id}`);
    expect(byId.body.data.slug).toBe('tempo');
  });

  it('returns 404 for inactive products and products in inactive categories', async () => {
    expect((await request(app).get('/api/products/retired')).status).toBe(404);
    expect((await request(app).get('/api/products/ghost')).status).toBe(404);
    expect((await request(app).get('/api/products/nope')).status).toBe(404);
  });
});
