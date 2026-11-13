import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createAddress, createCategory, createProduct, createUser, fillCart, prisma, resetDatabase, stockOf } from './helpers/db.js';
import { authHeader, testApp as app } from './helpers/app.js';

let customer: { id: string };
let address: { id: string };
let shoe: { id: string };
let lastPair: { id: string };

beforeEach(async () => {
  await resetDatabase();
  customer = await createUser();
  address = await createAddress(customer.id);
  const category = await createCategory();
  shoe = await createProduct(category.id, { name: 'Tempo', pricePaise: 100_000, stockQuantity: 5 });
  lastPair = await createProduct(category.id, { name: 'Rebound', pricePaise: 250_000, stockQuantity: 1 });
});
afterAll(() => prisma.$disconnect());

const key = () => `test-${randomUUID()}`;
const checkout = (user: { id: string }, body: object) =>
  request(app).post('/api/checkout').set(authHeader(user)).send(body);

describe('successful checkout', () => {
  it('creates one PLACED order with server prices, reserves stock, and keeps the cart', async () => {
    await fillCart(customer.id, [
      { productId: shoe.id, quantity: 2 },
      { productId: lastPair.id, quantity: 1 },
    ]);
    const res = await checkout(customer, { addressId: address.id, idempotencyKey: key() });

    expect(res.status).toBe(201);
    const order = res.body.data;
    expect(order).toMatchObject({
      status: 'PLACED',
      currency: 'INR',
      totals: { subtotalPaise: 450_000, discountPaise: 0, taxPaise: 81_000, shippingPaise: 0, totalPaise: 531_000 },
      payment: { status: 'PENDING', amountPaise: 531_000, provider: 'SIMULATED' },
      address: { fullName: 'Test Person', city: 'Mumbai' },
      actions: { canPay: true, canCancel: true },
    });
    expect(order.orderNumber).toMatch(/^KS-\d{8}-[A-Z2-9]{6}$/);
    expect(order.items.map((i: { name: string; quantity: number; lineTotalPaise: number }) => [i.name, i.quantity, i.lineTotalPaise])).toEqual([
      ['Rebound', 1, 250_000],
      ['Tempo', 2, 200_000],
    ]);

    expect(await stockOf(shoe.id)).toBe(3);
    expect(await stockOf(lastPair.id)).toBe(0);
    const movements = await prisma.inventoryMovement.findMany({ where: { orderId: order.id }, orderBy: { quantityChange: 'asc' } });
    expect(movements.map((m) => [m.reason, m.quantityChange, m.stockAfter])).toEqual([
      ['ORDER_RESERVED', -2, 3],
      ['ORDER_RESERVED', -1, 0],
    ]);
    expect(await prisma.auditLog.count({ where: { action: 'ORDER_CREATED', entityId: order.id } })).toBe(1);
    expect(await prisma.cartItem.count()).toBe(2); // cart is cleared only after payment succeeds
  });

  it('snapshots the address so later edits do not change the order', async () => {
    await fillCart(customer.id, [{ productId: shoe.id, quantity: 1 }]);
    const res = await checkout(customer, { addressId: address.id, idempotencyKey: key() });
    await prisma.address.update({ where: { id: address.id }, data: { city: 'Delhi' } });
    await prisma.product.update({ where: { id: shoe.id }, data: { pricePaise: 1, name: 'Renamed' } });
    const order = await request(app).get(`/api/orders/${res.body.data.id}`).set(authHeader(customer));
    expect(order.body.data.address.city).toBe('Mumbai');
    expect(order.body.data.items[0]).toMatchObject({ name: 'Tempo', unitPricePaise: 100_000 });
  });
});

describe('checkout validation', () => {
  it('rejects client-supplied totals or prices (unknown fields → 400)', async () => {
    await fillCart(customer.id, [{ productId: shoe.id, quantity: 1 }]);
    const res = await checkout(customer, { addressId: address.id, idempotencyKey: key(), totalPaise: 1 });
    expect(res.status).toBe(400);
    expect(await prisma.order.count()).toBe(0);
  });

  it('rejects an empty cart with 422', async () => {
    const res = await checkout(customer, { addressId: address.id, idempotencyKey: key() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('CART_EMPTY');
  });

  it("rejects another customer's address with 404 (ownership)", async () => {
    const other = await createUser();
    const theirs = await createAddress(other.id);
    await fillCart(customer.id, [{ productId: shoe.id, quantity: 1 }]);
    const res = await checkout(customer, { addressId: theirs.id, idempotencyKey: key() });
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ADDRESS_NOT_FOUND');
  });

  it('AC-02: buying 2 of a product with stock 1 returns 409 and stock stays 1', async () => {
    await fillCart(customer.id, [{ productId: lastPair.id, quantity: 2 }]);
    const res = await checkout(customer, { addressId: address.id, idempotencyKey: key() });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({
      code: 'INSUFFICIENT_STOCK',
      details: { items: [{ productId: lastPair.id, available: 1, requested: 2 }] },
    });
    expect(await stockOf(lastPair.id)).toBe(1);
    expect(await prisma.order.count()).toBe(0);
    expect(await prisma.inventoryMovement.count()).toBe(0);
  });

  it('rejects deactivated products with 422 and changes nothing', async () => {
    await fillCart(customer.id, [{ productId: shoe.id, quantity: 1 }]);
    await prisma.product.update({ where: { id: shoe.id }, data: { isActive: false } });
    const res = await checkout(customer, { addressId: address.id, idempotencyKey: key() });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('PRODUCT_UNAVAILABLE');
    expect(await stockOf(shoe.id)).toBe(5);
  });

  it('allows only one unpaid order at a time (409 PENDING_ORDER_EXISTS)', async () => {
    await fillCart(customer.id, [{ productId: shoe.id, quantity: 1 }]);
    const first = await checkout(customer, { addressId: address.id, idempotencyKey: key() });
    const second = await checkout(customer, { addressId: address.id, idempotencyKey: key() });
    expect(second.status).toBe(409);
    expect(second.body.error).toMatchObject({ code: 'PENDING_ORDER_EXISTS', details: { orderId: first.body.data.id } });
    expect(await stockOf(shoe.id)).toBe(4);
  });
});

describe('AC-03: idempotent checkout', () => {
  it('replays the original order for the same key without repeating side effects', async () => {
    await fillCart(customer.id, [{ productId: shoe.id, quantity: 2 }]);
    const body = { addressId: address.id, idempotencyKey: key() };
    const first = await checkout(customer, body);
    const again = await checkout(customer, body);

    expect(first.status).toBe(201);
    expect(again.status).toBe(200);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(again.body.data.id).toBe(first.body.data.id);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(shoe.id)).toBe(3); // deducted once
    expect(await prisma.inventoryMovement.count()).toBe(1);
  });

  it('creates exactly one order when the same key is sent concurrently (double click)', async () => {
    await fillCart(customer.id, [{ productId: shoe.id, quantity: 2 }]);
    const body = { addressId: address.id, idempotencyKey: key() };
    const responses = await Promise.all(Array.from({ length: 5 }, () => checkout(customer, body)));

    expect(responses.map((r) => r.status).sort()).toEqual([200, 200, 200, 200, 201]);
    expect(new Set(responses.map((r) => r.body.data.id)).size).toBe(1);
    expect(await prisma.order.count()).toBe(1);
    expect(await stockOf(shoe.id)).toBe(3);
  });

  it('keys are scoped per customer', async () => {
    const other = await createUser();
    const otherAddress = await createAddress(other.id);
    await fillCart(customer.id, [{ productId: shoe.id, quantity: 1 }]);
    await fillCart(other.id, [{ productId: shoe.id, quantity: 1 }]);
    const shared = key();
    const a = await checkout(customer, { addressId: address.id, idempotencyKey: shared });
    const b = await checkout(other, { addressId: otherAddress.id, idempotencyKey: shared });
    expect([a.status, b.status]).toEqual([201, 201]);
    expect(a.body.data.id).not.toBe(b.body.data.id);
  });
});

describe('AC-02: concurrent purchase of the last unit', () => {
  it('lets at most one of many buyers win; stock never goes negative', async () => {
    const buyers: { user: { id: string }; addressId: string }[] = [];
    for (let i = 0; i < 6; i += 1) {
      const user = await createUser();
      const buyerAddress = await createAddress(user.id);
      await fillCart(user.id, [{ productId: lastPair.id, quantity: 1 }]);
      buyers.push({ user, addressId: buyerAddress.id });
    }

    const responses = await Promise.all(
      buyers.map(({ user, addressId }) => checkout(user, { addressId, idempotencyKey: key() })),
    );

    const statuses = responses.map((r) => r.status);
    expect(statuses.filter((s) => s === 201)).toHaveLength(1);
    expect(statuses.filter((s) => s === 409)).toHaveLength(5);
    expect(responses.filter((r) => r.status === 409).every((r) => r.body.error.code === 'INSUFFICIENT_STOCK')).toBe(true);
    expect(await stockOf(lastPair.id)).toBe(0);
    expect(await prisma.order.count()).toBe(1);
  });
});
