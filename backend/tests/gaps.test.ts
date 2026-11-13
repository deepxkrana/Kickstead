/** Edge cases found in the Phase 8 coverage + acceptance-criteria review. */
import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { Prisma } from '@prisma/client';
import type { Request, Response } from 'express';
import { createApp } from '../src/app.js';
import { errorHandler } from '../src/middleware/errorHandler.js';
import { reserveStock } from '../src/modules/inventory/inventory.service.js';
import { InvalidTokenError, type TokenVerifier } from '../src/modules/auth/tokenVerifier.js';
import { AppError } from '../src/shared/errors/AppError.js';
import { createAddress, createCategory, createProduct, createUser, fillCart, prisma, resetDatabase, stockOf } from './helpers/db.js';
import { authHeader, testApp as app } from './helpers/app.js';

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

const key = () => `g-${randomUUID()}`;

async function setup(stock = 10, pricePaise = 100_000) {
  const customer = await createUser();
  const address = await createAddress(customer.id);
  const category = await createCategory();
  const product = await createProduct(category.id, { stockQuantity: stock, pricePaise });
  return { customer, address, category, product };
}

describe('checkout edge cases', () => {
  it('two tabs with different keys at the same time → one order, one 409, stock taken once', async () => {
    const { customer, address, product } = await setup(10);
    await fillCart(customer.id, [{ productId: product.id, quantity: 2 }]);
    const [a, b] = await Promise.all([
      request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: address.id, idempotencyKey: key() }),
      request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: address.id, idempotencyKey: key() }),
    ]);
    expect([a.status, b.status].sort()).toEqual([201, 409]);
    expect([a, b].find((r) => r.status === 409)!.body.error.code).toBe('PENDING_ORDER_EXISTS');
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(product.id)).toBe(8);
  });

  it('uses the price at checkout time, not when the item was added to the cart', async () => {
    const { customer, address, product } = await setup(10, 100_000);
    await request(app).post('/api/cart/items').set(authHeader(customer)).send({ productId: product.id, quantity: 1 });
    await prisma.product.update({ where: { id: product.id }, data: { pricePaise: 150_000 } });
    const res = await request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: address.id, idempotencyKey: key() });
    expect(res.body.data.items[0].unitPricePaise).toBe(150_000);
    expect(res.body.data.totals.subtotalPaise).toBe(150_000);
  });

  it('rejects products whose category was deactivated (422)', async () => {
    const { customer, address, product, category } = await setup();
    await fillCart(customer.id, [{ productId: product.id, quantity: 1 }]);
    await prisma.category.update({ where: { id: category.id }, data: { isActive: false } });
    const res = await request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: address.id, idempotencyKey: key() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRODUCT_UNAVAILABLE');
  });

  it('enforces the 10-per-item cap at checkout even if the cart was modified directly', async () => {
    const { customer, address, product } = await setup(50);
    await fillCart(customer.id, [{ productId: product.id, quantity: 11 }]);
    const res = await request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: address.id, idempotencyKey: key() });
    expect(res.status).toBe(409);
    expect(res.body.error.details.items[0]).toMatchObject({ available: 10, requested: 11 });
    expect(await stockOf(product.id)).toBe(50);
  });

  it('a reused key with a different address returns the original order unchanged', async () => {
    const { customer, address, product } = await setup();
    const other = await createAddress(customer.id, { isDefault: false, city: 'Delhi' });
    await fillCart(customer.id, [{ productId: product.id, quantity: 1 }]);
    const k = key();
    const first = await request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: address.id, idempotencyKey: k });
    const again = await request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: other.id, idempotencyKey: k });
    expect(again.status).toBe(200);
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(again.body.data.address.city).toBe('Mumbai');
  });

  it('the conditional stock update is a second guard behind the row lock', async () => {
    const { product } = await setup(1);
    const err = await prisma
      .$transaction((tx) => reserveStock(tx, [{ productId: product.id, quantity: 2 }], { orderId: randomUUID(), actorUserId: randomUUID() }))
      .catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).code).toBe('INSUFFICIENT_STOCK');
    expect(await stockOf(product.id)).toBe(1);
  });
});

describe('admin vs customer on the same order', () => {
  it('admin cancels an unpaid order: stock returned; the customer can no longer pay it', async () => {
    const { customer, address, product } = await setup(5);
    const admin = await createUser({ role: 'ADMIN' });
    await fillCart(customer.id, [{ productId: product.id, quantity: 2 }]);
    const order = (await request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: address.id, idempotencyKey: key() })).body.data;

    const cancelled = await request(app).patch(`/api/admin/orders/${order.id}/status`).set(authHeader(admin)).send({ status: 'CANCELLED' });
    expect(cancelled.body.data).toMatchObject({ status: 'CANCELLED', payment: { status: 'CANCELLED' } });
    expect(await stockOf(product.id)).toBe(5);

    const pay = await request(app).post(`/api/orders/${order.id}/payment`).set(authHeader(customer)).send({ outcome: 'SUCCESS' });
    expect(pay.status).toBe(409);
  });

  it('AC-05: a customer calling the admin status endpoint changes nothing', async () => {
    const { customer, address, product } = await setup();
    await fillCart(customer.id, [{ productId: product.id, quantity: 1 }]);
    const order = (await request(app).post('/api/checkout').set(authHeader(customer)).send({ addressId: address.id, idempotencyKey: key() })).body.data;
    const res = await request(app).patch(`/api/admin/orders/${order.id}/status`).set(authHeader(customer)).send({ status: 'CANCELLED' });
    expect(res.status).toBe(403);
    expect((await prisma.order.findUniqueOrThrow({ where: { id: order.id } })).status).toBe('PLACED');
    expect(await stockOf(product.id)).toBe(9);
  });
});

describe('profile', () => {
  it('updates the name and cannot be used to change role or email', async () => {
    const user = await createUser();
    const ok = await request(app).patch('/api/profile').set(authHeader(user)).send({ name: '  Asha Rao ' });
    expect(ok.body.data).toMatchObject({ name: 'Asha Rao', role: 'CUSTOMER' });
    expect((await request(app).patch('/api/profile').set(authHeader(user)).send({ name: 'x', role: 'ADMIN' })).status).toBe(400);
    expect((await request(app).patch('/api/profile').set(authHeader(user)).send({ email: 'evil@x.dev' })).status).toBe(400);
    expect((await request(app).patch('/api/profile').set(authHeader(user)).send({ name: '' })).status).toBe(400);
    expect((await prisma.user.findUniqueOrThrow({ where: { id: user.id } })).role).toBe('CUSTOMER');
  });
});

describe('address rules', () => {
  it('caps saved addresses at 10 and requires choosing another default instead of un-defaulting', async () => {
    const user = await createUser();
    const body = { fullName: 'A', phone: '+91 90000 00000', line1: 'x', city: 'y', state: 'z', postalCode: '400001' };
    for (let i = 0; i < 10; i += 1) await request(app).post('/api/addresses').set(authHeader(user)).send(body);
    const eleventh = await request(app).post('/api/addresses').set(authHeader(user)).send(body);
    expect(eleventh.status).toBe(422);
    expect(eleventh.body.error.code).toBe('ADDRESS_LIMIT');

    const def = await prisma.address.findFirstOrThrow({ where: { userId: user.id, isDefault: true } });
    const res = await request(app).patch(`/api/addresses/${def.id}`).set(authHeader(user)).send({ isDefault: false });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('DEFAULT_ADDRESS_REQUIRED');
  });
});

describe('admin catalogue edge cases', () => {
  it('product detail includes stock history; unknown category is 422; duplicate category name is 409; empty update is 400', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const A = authHeader(admin);
    const category = await createCategory({ name: 'Running', slug: 'running' });
    await createCategory({ name: 'Lifestyle', slug: 'lifestyle' });
    const product = (await request(app).post('/api/admin/products').set(A).send({ name: 'Shoe', brand: 'B', description: 'Ten chars plus.', pricePaise: 1, categoryId: category.id, initialStock: 3 })).body.data;

    const detail = await request(app).get(`/api/admin/products/${product.id}`).set(A);
    expect(detail.body.data.movements).toHaveLength(1);
    expect(detail.body.data.movements[0]).toMatchObject({ quantityChange: 3, reason: 'ADMIN_ADJUSTMENT', actor: { email: expect.any(String) } });

    const badCategory = await request(app).post('/api/admin/products').set(A).send({ name: 'Shoe 2', brand: 'B', description: 'Ten chars plus.', pricePaise: 1, categoryId: randomUUID() });
    expect(badCategory.body.error.code).toBe('CATEGORY_NOT_FOUND');
    const rename = await request(app).patch(`/api/admin/categories/${category.id}`).set(A).send({ name: 'Lifestyle' });
    expect(rename.status).toBe(409);
    expect(rename.body.error.code).toBe('CATEGORY_NAME_TAKEN');
    expect((await request(app).patch(`/api/admin/products/${product.id}`).set(A).send({})).status).toBe(400);
    expect((await request(app).get(`/api/admin/products/${randomUUID()}`).set(A)).status).toBe(404);
  });
});

describe('first sign-in provisioning against the real database', () => {
  // Tokens here describe brand-new Supabase users: "<uuid>|<email>|<name>" (no spaces: a Bearer
  // token never contains one, and the parser rightly rejects it).
  const verifier: TokenVerifier = {
    async verify(token) {
      const [id, email, name] = token.split('|');
      if (!id || !email) throw new InvalidTokenError('invalid', 'invalid');
      return { id, email, name: name || null };
    },
  };
  const provisioningApp = createApp({ tokenVerifier: verifier });
  const me = (token: string) => request(provisioningApp).get('/api/auth/me').set('Authorization', `Bearer ${token}`);

  it('creates the users row on first request, with the role from ADMIN_EMAILS', async () => {
    const customerId = randomUUID();
    const adminId = randomUUID();
    expect((await me(`${customerId}|new@test.dev|New_Person`)).body.data).toMatchObject({ role: 'CUSTOMER', name: 'New_Person' });
    expect((await me(`${adminId}|admin@test.dev|`)).body.data).toMatchObject({ role: 'ADMIN', name: 'admin' });
    expect(await prisma.user.count()).toBe(2);
  });

  it('concurrent first requests all succeed and create exactly one row (regression)', async () => {
    // Before the fix, ~80% of parallel first requests failed with 409 (non-atomic upsert).
    for (let round = 0; round < 10; round += 1) {
      const id = randomUUID();
      const responses = await Promise.all(Array.from({ length: 8 }, () => me(`${id}|race${round}@test.dev|Racer`)));
      expect(responses.map((r) => r.status)).toEqual(Array(8).fill(200));
      expect(await prisma.user.count({ where: { id } })).toBe(1);
    }
  });

  it('the same email under a different Supabase id is a 409 ACCOUNT_CONFLICT, not a silent merge', async () => {
    await me(`${randomUUID()}|dup@test.dev|One`);
    const res = await me(`${randomUUID()}|dup@test.dev|Two`);
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ACCOUNT_CONFLICT');
  });

  it('keeps the email in sync when it changes in Supabase', async () => {
    const id = randomUUID();
    await me(`${id}|old@test.dev|Sam`);
    expect((await me(`${id}|new-address@test.dev|Sam`)).body.data.email).toBe('new-address@test.dev');
  });

  it('admin customer search works against real rows and excludes admins', async () => {
    const admin = await createUser({ role: 'ADMIN', email: 'boss@test.dev' });
    await createUser({ email: 'priya@test.dev' });
    await createUser({ email: 'rahul@test.dev' });
    const res = await request(app).get('/api/admin/customers?q=priya').set(authHeader(admin));
    expect(res.body.data.map((c: { email: string }) => c.email)).toEqual(['priya@test.dev']);
    expect((await request(app).get('/api/admin/customers').set(authHeader(admin))).body.meta.total).toBe(2);
  });
});

describe('infrastructure paths', () => {
  it('health reports 503 when the database is unreachable', async () => {
    const spy = vi.spyOn(prisma, '$queryRaw').mockRejectedValueOnce(new Error('connection refused'));
    vi.spyOn(console, 'error').mockImplementationOnce(() => {});
    const res = await request(app).get('/api/health');
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: 'degraded', database: 'down' });
    spy.mockRestore();
  });

  describe('error handler mapping', () => {
    function run(err: unknown) {
      const res = { statusCode: 0, body: undefined as unknown, status(code: number) { this.statusCode = code; return this; }, json(b: unknown) { this.body = b; return this; } };
      errorHandler(err, { id: 'req-123', method: 'GET', path: '/x' } as Request, res as unknown as Response, () => {});
      return res;
    }
    const prismaError = (code: string) => new Prisma.PrismaClientKnownRequestError('db error', { code, clientVersion: '6.19.3', meta: { target: ['slug'] } });

    it.each([
      ['P2002', 409, 'UNIQUE_CONSTRAINT'],
      ['P2003', 409, 'FOREIGN_KEY_CONSTRAINT'],
      ['P2004', 409, 'CONSTRAINT_VIOLATION'],
      ['P2025', 404, 'NOT_FOUND'],
    ])('maps Prisma %s → %i %s', (code, status, errorCode) => {
      const res = run(prismaError(code));
      expect(res.statusCode).toBe(status);
      expect(res.body).toMatchObject({ error: { code: errorCode } });
    });

    it('turns unexpected errors into a safe 500 with the request id and no stack trace', () => {
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      const res = run(new Error('secret internal detail'));
      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: { code: 'INTERNAL_ERROR', message: 'Something went wrong. Please try again.', details: { requestId: 'req-123' } } });
      expect(JSON.stringify(res.body)).not.toContain('secret internal detail');
      expect(log).toHaveBeenCalled();
      log.mockRestore();
    });
  });
});
