import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createAddress, createCategory, createProduct, createUser, fillCart, prisma, resetDatabase, stockOf } from './helpers/db.js';
import { authHeader, testApp as app } from './helpers/app.js';

let admin: { id: string };
let customer: { id: string };
let category: { id: string };
let shoe: { id: string };

beforeEach(async () => {
  await resetDatabase();
  admin = await createUser({ role: 'ADMIN' });
  customer = await createUser({ email: 'cara@test.dev' });
  category = await createCategory({ name: 'Running', slug: 'running' });
  shoe = await createProduct(category.id, { name: 'Tempo', slug: 'tempo', pricePaise: 100_000, stockQuantity: 10 });
});
afterAll(() => prisma.$disconnect());

const asAdmin = () => ({ get: (p: string) => request(app).get(p).set(authHeader(admin)), patch: (p: string, b: object) => request(app).patch(p).set(authHeader(admin)).send(b), post: (p: string, b: object) => request(app).post(p).set(authHeader(admin)).send(b) });

/** Places (and optionally pays) an order for `user` through the real customer API. */
async function order(user: { id: string }, quantity: number, outcome?: 'SUCCESS' | 'FAILED' | 'CANCELLED') {
  if (!(await prisma.address.count({ where: { userId: user.id } }))) await createAddress(user.id);
  const address = await prisma.address.findFirstOrThrow({ where: { userId: user.id } });
  await fillCart(user.id, [{ productId: shoe.id, quantity }]);
  const res = await request(app).post('/api/checkout').set(authHeader(user)).send({ addressId: address.id, idempotencyKey: `k-${randomUUID()}` });
  expect(res.status).toBe(201);
  if (outcome) await request(app).post(`/api/orders/${res.body.data.id}/payment`).set(authHeader(user)).send({ outcome });
  return res.body.data as { id: string; orderNumber: string; totals: { totalPaise: number } };
}

describe('AC-05: admin endpoints are admin-only', () => {
  const endpoints: [string, string, object?][] = [
    ['get', '/api/admin/dashboard'],
    ['get', '/api/admin/products'],
    ['post', '/api/admin/products', { name: 'X' }],
    ['patch', `/api/admin/products/${randomUUID()}/stock`, { mode: 'set', quantity: 1 }],
    ['get', '/api/admin/categories'],
    ['post', '/api/admin/categories', { name: 'X' }],
    ['get', '/api/admin/orders'],
    ['patch', `/api/admin/orders/${randomUUID()}/status`, { status: 'PACKED' }],
    ['get', '/api/admin/customers'],
    ['get', '/api/admin/audit-logs'],
  ];

  it.each(endpoints)('%s %s → 401 anonymous, 403 customer, no data change', async (method, path, body) => {
    const anon = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path).send(body ?? {});
    expect(anon.status).toBe(401);
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path).set(authHeader(customer)).send(body ?? {});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('a forbidden stock change leaves stock untouched', async () => {
    await request(app).patch(`/api/admin/products/${shoe.id}/stock`).set(authHeader(customer)).send({ mode: 'set', quantity: 0 });
    expect(await stockOf(shoe.id)).toBe(10);
  });
});

describe('product administration', () => {
  it('creates a product with a generated slug, initial stock movement and audit record', async () => {
    const res = await asAdmin().post('/api/admin/products', {
      name: 'Court Ace Pro', brand: 'Courtside Co.', description: 'A great court shoe for testing.', pricePaise: 899_900, categoryId: category.id, initialStock: 7,
    });
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ slug: 'court-ace-pro', stockQuantity: 7, isActive: true, isFeatured: false, imageUrl: null });
    const movement = await prisma.inventoryMovement.findFirst({ where: { productId: res.body.data.id } });
    expect(movement).toMatchObject({ reason: 'ADMIN_ADJUSTMENT', quantityChange: 7, stockAfter: 7, actorUserId: admin.id });
    expect(await prisma.auditLog.count({ where: { action: 'PRODUCT_CREATED', entityId: res.body.data.id, actorUserId: admin.id } })).toBe(1);
  });

  it('rejects a duplicate slug with 409 and bad input with 400', async () => {
    const dup = await asAdmin().post('/api/admin/products', { name: 'Tempo', slug: 'tempo', brand: 'B', description: 'Duplicate slug here.', pricePaise: 1, categoryId: category.id });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe('PRODUCT_SLUG_TAKEN');
    const bad = await asAdmin().post('/api/admin/products', { name: 'X', brand: 'B', description: 'short', pricePaise: -5, categoryId: category.id, stockQuantity: 5 });
    expect(bad.status).toBe(400);
  });

  it('updates fields with a before/after audit trail; stock cannot be changed here', async () => {
    const res = await asAdmin().patch(`/api/admin/products/${shoe.id}`, { pricePaise: 120_000, isFeatured: true });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ pricePaise: 120_000, isFeatured: true });
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'PRODUCT_UPDATED', entityId: shoe.id } });
    expect(audit.metadata).toMatchObject({ changes: { pricePaise: { from: 100_000, to: 120_000 }, isFeatured: { from: false, to: true } } });
    expect((await asAdmin().patch(`/api/admin/products/${shoe.id}`, { stockQuantity: 99 })).status).toBe(400);
  });

  it('deactivating hides the product from shoppers but not from admins', async () => {
    await asAdmin().patch(`/api/admin/products/${shoe.id}`, { isActive: false });
    expect((await request(app).get('/api/products/tempo')).status).toBe(404);
    const list = await asAdmin().get('/api/admin/products?status=inactive');
    expect(list.body.data.map((p: { slug: string }) => p.slug)).toEqual(['tempo']);
  });
});

describe('stock administration', () => {
  it('sets and adjusts stock with movements and audit records', async () => {
    const set = await asAdmin().patch(`/api/admin/products/${shoe.id}/stock`, { mode: 'set', quantity: 25, note: 'Delivery' });
    expect(set.body.data.stockQuantity).toBe(25);
    const adjust = await asAdmin().patch(`/api/admin/products/${shoe.id}/stock`, { mode: 'adjust', quantity: -5 });
    expect(adjust.body.data.stockQuantity).toBe(20);

    const movements = await prisma.inventoryMovement.findMany({ where: { productId: shoe.id }, orderBy: { createdAt: 'asc' } });
    expect(movements.map((m) => [m.quantityChange, m.stockAfter, m.reason])).toEqual([
      [15, 25, 'ADMIN_ADJUSTMENT'],
      [-5, 20, 'ADMIN_ADJUSTMENT'],
    ]);
    expect(await prisma.auditLog.count({ where: { action: 'INVENTORY_ADJUSTED', entityId: shoe.id } })).toBe(2);
  });

  it('refuses to make stock negative or to record a no-op', async () => {
    const neg = await asAdmin().patch(`/api/admin/products/${shoe.id}/stock`, { mode: 'adjust', quantity: -11 });
    expect(neg.status).toBe(422);
    expect(neg.body.error.code).toBe('STOCK_NEGATIVE');
    const same = await asAdmin().patch(`/api/admin/products/${shoe.id}/stock`, { mode: 'set', quantity: 10 });
    expect(same.body.error.code).toBe('NO_CHANGE');
    expect(await stockOf(shoe.id)).toBe(10);
  });
});

describe('category administration', () => {
  it('creates, renames and deactivates categories (hiding their products)', async () => {
    const created = await asAdmin().post('/api/admin/categories', { name: 'Trail Running' });
    expect(created.status).toBe(201);
    expect(created.body.data.slug).toBe('trail-running');
    expect((await asAdmin().post('/api/admin/categories', { name: 'Trail Running' })).status).toBe(409);

    await asAdmin().patch(`/api/admin/categories/${category.id}`, { isActive: false });
    expect((await request(app).get('/api/products')).body.data).toEqual([]);
    const list = await asAdmin().get('/api/admin/categories');
    expect(list.body.data.find((c: { id: string }) => c.id === category.id)).toMatchObject({ isActive: false, productCount: 1 });
    expect(await prisma.auditLog.count({ where: { entityType: 'CATEGORY' } })).toBe(2);
  });
});

describe('AC-06: admin order management', () => {
  it('moves a paid order through fulfilment, auditing each step', async () => {
    const o = await order(customer, 1, 'SUCCESS');
    for (const status of ['PACKED', 'SHIPPED', 'DELIVERED']) {
      const res = await asAdmin().patch(`/api/admin/orders/${o.id}/status`, { status });
      expect(res.status).toBe(200);
      expect(res.body.data.status).toBe(status);
    }
    const detail = await asAdmin().get(`/api/admin/orders/${o.id}`);
    expect(detail.body.data.adminActions.nextStatuses).toEqual([]);
    expect(detail.body.data.customer.email).toBe('cara@test.dev');
    expect(detail.body.data.history.map((h: { action: string }) => h.action)).toEqual([
      'ORDER_CREATED', 'PAYMENT_RECORDED', 'ORDER_STATUS_CHANGED', 'ORDER_STATUS_CHANGED', 'ORDER_STATUS_CHANGED',
    ]);
  });

  it.each([
    ['PLACED', undefined, 'SHIPPED'],
    ['PAID', 'SUCCESS', 'DELIVERED'],
    ['PAYMENT_FAILED', 'FAILED', 'PACKED'],
  ] as const)('rejects %s → %s with 409 INVALID_STATUS_TRANSITION', async (_from, outcome, target) => {
    const o = await order(customer, 1, outcome);
    const res = await asAdmin().patch(`/api/admin/orders/${o.id}/status`, { status: target });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATUS_TRANSITION');
  });

  it('does not let admins set payment outcomes (422)', async () => {
    const o = await order(customer, 1);
    const res = await asAdmin().patch(`/api/admin/orders/${o.id}/status`, { status: 'PAID' });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PAYMENT_STATUS_NOT_ADMIN');
  });

  it('a delivered order cannot be cancelled; a paid one is refunded and restocked', async () => {
    const paid = await order(customer, 3, 'SUCCESS');
    expect(await stockOf(shoe.id)).toBe(7);
    const cancelled = await asAdmin().patch(`/api/admin/orders/${paid.id}/status`, { status: 'CANCELLED', reason: 'Customer called' });
    expect(cancelled.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'Customer called', payment: { status: 'REFUNDED' } });
    expect(await stockOf(shoe.id)).toBe(10);
    const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: 'ORDER_CANCELLED', entityId: paid.id } });
    expect(audit.actorUserId).toBe(admin.id);

    const delivered = await order(customer, 1, 'SUCCESS');
    for (const status of ['PACKED', 'SHIPPED', 'DELIVERED']) await asAdmin().patch(`/api/admin/orders/${delivered.id}/status`, { status });
    expect((await asAdmin().patch(`/api/admin/orders/${delivered.id}/status`, { status: 'CANCELLED' })).status).toBe(409);
  });

  it('lists orders with search by order number or customer email, and status filter', async () => {
    const a = await order(customer, 1, 'SUCCESS');
    const other = await createUser({ email: 'dev@test.dev' });
    await order(other, 1);

    expect((await asAdmin().get('/api/admin/orders')).body.meta.total).toBe(2);
    expect((await asAdmin().get(`/api/admin/orders?q=${a.orderNumber.slice(-6)}`)).body.data.map((o: { id: string }) => o.id)).toEqual([a.id]);
    expect((await asAdmin().get('/api/admin/orders?q=dev@test')).body.data[0].customer.email).toBe('dev@test.dev');
    expect((await asAdmin().get('/api/admin/orders?status=PLACED')).body.data).toHaveLength(1);
  });
});

describe('AC-07: dashboard reconciles with orders', () => {
  it('counts orders by status and sums revenue only for paid/fulfilled orders', async () => {
    const other = await createUser();
    const third = await createUser();
    const paid = await order(customer, 2, 'SUCCESS'); // PAID → revenue
    const failed = await order(customer, 1, 'FAILED'); // excluded
    const shipped = await order(other, 1, 'SUCCESS');
    await asAdmin().patch(`/api/admin/orders/${shipped.id}/status`, { status: 'PACKED' });
    await asAdmin().patch(`/api/admin/orders/${shipped.id}/status`, { status: 'SHIPPED' }); // revenue
    const refunded = await order(third, 1, 'SUCCESS');
    await asAdmin().patch(`/api/admin/orders/${refunded.id}/status`, { status: 'CANCELLED' }); // excluded
    await order(customer, 1); // PLACED → pending, excluded
    await prisma.product.update({ where: { id: shoe.id }, data: { stockQuantity: 2 } });

    const res = await asAdmin().get('/api/admin/dashboard');
    expect(res.status).toBe(200);
    const d = res.body.data;
    expect(d.totals).toMatchObject({ totalOrders: 5, paidOrders: 2, pendingOrders: 1, toFulfil: 1, cancelledOrders: 1, failedPayments: 1 });
    expect(d.totals.revenuePaise).toBe(paid.totals.totalPaise + shipped.totals.totalPaise);
    expect(d.lowStock).toMatchObject({ threshold: 5, count: 1 });
    expect(d.recentOrders).toHaveLength(5);
    expect(d.revenueRule).toContain('PAID, PACKED, SHIPPED or DELIVERED');

    // Reconcile against the admin order list.
    const list = await asAdmin().get('/api/admin/orders?limit=100');
    const fromList = list.body.data
      .filter((o: { status: string }) => ['PAID', 'PACKED', 'SHIPPED', 'DELIVERED'].includes(o.status))
      .reduce((sum: number, o: { totalPaise: number }) => sum + o.totalPaise, 0);
    expect(fromList).toBe(d.totals.revenuePaise);
    expect(failed.id).toBeTruthy();
  });
});

describe('audit log', () => {
  it('lists audit records newest first with actor and filters', async () => {
    const o = await order(customer, 1, 'SUCCESS');
    await asAdmin().patch(`/api/admin/products/${shoe.id}/stock`, { mode: 'adjust', quantity: 5 });

    const all = await asAdmin().get('/api/admin/audit-logs');
    expect(all.status).toBe(200);
    expect(all.body.data[0]).toMatchObject({ action: 'INVENTORY_ADJUSTED', actor: { id: admin.id, role: 'ADMIN' } });
    expect(all.body.meta.total).toBe(3);

    const forOrder = await asAdmin().get(`/api/admin/audit-logs?entityType=ORDER&entityId=${o.id}`);
    expect(forOrder.body.data.map((a: { action: string }) => a.action)).toEqual(['PAYMENT_RECORDED', 'ORDER_CREATED']);
    // No secrets in metadata.
    expect(JSON.stringify(all.body.data)).not.toMatch(/password|token|secret/i);
  });
});
