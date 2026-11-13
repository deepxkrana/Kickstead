/**
 * AC-01 end to end through the HTTP API (with test tokens), then the admin side:
 * the customer's order is visible to the admin, fulfilled, and reflected in the dashboard and audit log.
 * Ends with the inventory-ledger invariant: movements always add up to current stock.
 */
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createCategory, createUser, prisma, resetDatabase } from './helpers/db.js';
import { authHeader, testApp as app } from './helpers/app.js';

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

describe('AC-01: complete customer journey, confirmed by the admin', () => {
  it('login → search → detail → cart → address → checkout → pay → history → admin fulfils → dashboard + audit', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const customer = await createUser({ email: 'journey@test.dev' });
    const category = await createCategory({ name: 'Running', slug: 'running' });
    const A = authHeader(admin);
    const C = authHeader(customer);

    // Admin stocks the catalogue (audited, with an initial stock movement).
    const created = await request(app).post('/api/admin/products').set(A).send({
      name: 'Tempo Runner', brand: 'Stridewell', description: 'Responsive daily trainer.', pricePaise: 649_900, categoryId: category.id, initialStock: 5,
    });
    expect(created.status).toBe(201);

    // 1. Log in (token) and restore the current user.
    expect((await request(app).get('/api/auth/me').set(C)).body.data).toMatchObject({ role: 'CUSTOMER' });
    // 2. Find the product.
    const search = await request(app).get('/api/products?q=tempo');
    expect(search.body.data.map((p: { name: string }) => p.name)).toEqual(['Tempo Runner']);
    // 3. Open the detail page.
    const detail = await request(app).get(`/api/products/${search.body.data[0].slug}`);
    expect(detail.body.data).toMatchObject({ pricePaise: 649_900, stockQuantity: 5, stockStatus: 'LOW_STOCK' });
    // 4. Add a valid quantity to the cart.
    const cart = await request(app).post('/api/cart/items').set(C).send({ productId: detail.body.data.id, quantity: 2 });
    expect(cart.status).toBe(201);
    expect(cart.body.data.totals.totalPaise).toBe(1_299_800 + 233_964);
    // 5. Add and select an address.
    const address = await request(app).post('/api/addresses').set(C).send({
      fullName: 'Journey Tester', phone: '+91 90000 00000', line1: '1 Test Road', city: 'Pune', state: 'Maharashtra', postalCode: '411001',
    });
    expect(address.body.data.isDefault).toBe(true);
    // 6–7. Check out, then complete a successful simulated payment → exactly one order.
    const placed = await request(app).post('/api/checkout').set(C).send({ addressId: address.body.data.id, idempotencyKey: `journey-${randomUUID()}` });
    expect(placed.status).toBe(201);
    const orderId = placed.body.data.id;
    const paid = await request(app).post(`/api/orders/${orderId}/payment`).set(C).send({ outcome: 'SUCCESS' });
    expect(paid.body.data).toMatchObject({ status: 'PAID', payment: { status: 'SUCCEEDED' } });
    // 8. Order confirmation.
    const confirmation = await request(app).get(`/api/orders/${orderId}`).set(C);
    expect(confirmation.body.data).toMatchObject({ status: 'PAID', address: { city: 'Pune' }, totals: { totalPaise: 1_533_764 } });
    // 9. Order history; cart emptied; stock reduced exactly once.
    expect((await request(app).get('/api/orders').set(C)).body.data.map((o: { id: string }) => o.id)).toEqual([orderId]);
    expect((await request(app).get('/api/cart').set(C)).body.data.items).toEqual([]);
    expect((await request(app).get(`/api/products/${detail.body.data.slug}`)).body.data.stockQuantity).toBe(3);

    // Admin sees the same order and moves it on.
    const adminList = await request(app).get('/api/admin/orders?q=journey@').set(A);
    expect(adminList.body.data.map((o: { id: string }) => o.id)).toEqual([orderId]);
    const packed = await request(app).patch(`/api/admin/orders/${orderId}/status`).set(A).send({ status: 'PACKED' });
    expect(packed.body.data.status).toBe('PACKED');

    // Dashboard reflects the order and revenue.
    const dashboard = await request(app).get('/api/admin/dashboard').set(A);
    expect(dashboard.body.data.totals).toMatchObject({ totalOrders: 1, paidOrders: 1, toFulfil: 1, revenuePaise: 1_533_764 });

    // Audit log records every material action, attributed to the right actor.
    const audit = await request(app).get('/api/admin/audit-logs').set(A);
    expect(audit.body.data.map((a: { action: string; actor: { role: string } }) => `${a.action}:${a.actor.role}`).reverse()).toEqual([
      'PRODUCT_CREATED:ADMIN',
      'ORDER_CREATED:CUSTOMER',
      'PAYMENT_RECORDED:CUSTOMER',
      'ORDER_STATUS_CHANGED:ADMIN',
    ]);
  });
});

describe('inventory ledger invariant', () => {
  it('after reserve, release, cancel, refund and admin adjustments, movements sum to current stock', async () => {
    const admin = await createUser({ role: 'ADMIN' });
    const buyers = [await createUser(), await createUser()];
    const category = await createCategory();
    const product = (
      await request(app).post('/api/admin/products').set(authHeader(admin)).send({
        name: 'Ledger Shoe', brand: 'B', description: 'For ledger testing.', pricePaise: 10_000, categoryId: category.id, initialStock: 20,
      })
    ).body.data;

    for (const buyer of buyers) {
      await request(app).post('/api/addresses').set(authHeader(buyer)).send({
        fullName: 'B', phone: '+91 90000 00001', line1: 'x', city: 'y', state: 'z', postalCode: '400001',
      });
    }
    const address = async (u: { id: string }) => (await prisma.address.findFirstOrThrow({ where: { userId: u.id } })).id;
    async function buy(u: { id: string }, quantity: number, outcome?: string) {
      await request(app).post('/api/cart/items').set(authHeader(u)).send({ productId: product.id, quantity });
      const o = await request(app).post('/api/checkout').set(authHeader(u)).send({ addressId: await address(u), idempotencyKey: `l-${randomUUID()}` });
      if (outcome) await request(app).post(`/api/orders/${o.body.data.id}/payment`).set(authHeader(u)).send({ outcome });
      return o.body.data.id as string;
    }

    await buy(buyers[0]!, 3, 'FAILED'); // reserve 3, release 3
    const refunded = await buy(buyers[0]!, 2, 'SUCCESS'); // reserve 2
    await request(app).post(`/api/orders/${refunded}/cancel`).set(authHeader(buyers[0]!)); // return 2
    await buy(buyers[1]!, 4, 'SUCCESS'); // reserve 4 (kept)
    await request(app).patch(`/api/admin/products/${product.id}/stock`).set(authHeader(admin)).send({ mode: 'adjust', quantity: -5 });
    await request(app).patch(`/api/admin/products/${product.id}/stock`).set(authHeader(admin)).send({ mode: 'set', quantity: 30 });
    await buy(buyers[0]!, 1); // reserve 1, left unpaid

    const stock = (await prisma.product.findUniqueOrThrow({ where: { id: product.id } })).stockQuantity;
    const movements = await prisma.inventoryMovement.findMany({ where: { productId: product.id }, orderBy: { createdAt: 'asc' } });
    const sum = movements.reduce((total, m) => total + m.quantityChange, 0);

    expect(stock).toBe(29);
    expect(sum).toBe(stock);
    expect(movements.at(-1)!.stockAfter).toBe(stock);
    // Every running total recorded in the ledger matches the cumulative sum at that point.
    let running = 0;
    for (const m of movements) {
      running += m.quantityChange;
      expect(m.stockAfter).toBe(running);
    }
    expect(movements.map((m) => m.reason)).toEqual([
      'ADMIN_ADJUSTMENT', 'ORDER_RESERVED', 'ORDER_RELEASED', 'ORDER_RESERVED', 'ORDER_CANCELLED',
      'ORDER_RESERVED', 'ADMIN_ADJUSTMENT', 'ADMIN_ADJUSTMENT', 'ORDER_RESERVED',
    ]);
  });
});
