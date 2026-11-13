import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createAddress, createCategory, createProduct, createUser, fillCart, prisma, resetDatabase, stockOf } from './helpers/db.js';
import { authHeader, testApp as app } from './helpers/app.js';

let customer: { id: string };
let stranger: { id: string };
let address: { id: string };
let shoe: { id: string };
let other: { id: string };

beforeEach(async () => {
  await resetDatabase();
  customer = await createUser();
  stranger = await createUser();
  address = await createAddress(customer.id);
  const category = await createCategory();
  shoe = await createProduct(category.id, { pricePaise: 100_000, stockQuantity: 5 });
  other = await createProduct(category.id, { pricePaise: 50_000, stockQuantity: 5 });
});
afterAll(() => prisma.$disconnect());

async function placeOrder(quantity = 2) {
  await fillCart(customer.id, [{ productId: shoe.id, quantity }]);
  const res = await request(app)
    .post('/api/checkout')
    .set(authHeader(customer))
    .send({ addressId: address.id, idempotencyKey: `k-${randomUUID()}` });
  expect(res.status).toBe(201);
  return res.body.data as { id: string };
}

const pay = (orderId: string, outcome: string, user = customer) =>
  request(app).post(`/api/orders/${orderId}/payment`).set(authHeader(user)).send({ outcome });
const cancel = (orderId: string, user = customer, body: object = {}) =>
  request(app).post(`/api/orders/${orderId}/cancel`).set(authHeader(user)).send(body);

describe('simulated payment', () => {
  it('SUCCESS marks the order PAID, records a reference, and removes ordered items from the cart', async () => {
    const order = await placeOrder();
    await fillCart(customer.id, [{ productId: other.id, quantity: 1 }]); // added after ordering
    const res = await pay(order.id, 'SUCCESS');

    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'PAID', payment: { status: 'SUCCEEDED' }, actions: { canPay: false, canCancel: true } });
    expect(res.body.data.payment.reference).toMatch(/^SIM-/);
    expect(await stockOf(shoe.id)).toBe(3);
    const cart = await prisma.cartItem.findMany();
    expect(cart.map((i) => i.productId)).toEqual([other.id]);
    expect(await prisma.auditLog.count({ where: { action: 'PAYMENT_RECORDED', entityId: order.id } })).toBe(1);
  });

  it('repeating SUCCESS is idempotent', async () => {
    const order = await placeOrder();
    await pay(order.id, 'SUCCESS');
    const again = await pay(order.id, 'SUCCESS');
    expect(again.status).toBe(200);
    expect(again.headers['idempotent-replayed']).toBe('true');
    expect(await prisma.auditLog.count({ where: { action: 'PAYMENT_RECORDED' } })).toBe(1);
  });

  it.each([
    ['FAILED', 'PAYMENT_FAILED', 'FAILED'],
    ['CANCELLED', 'PAYMENT_CANCELLED', 'CANCELLED'],
  ])('AC-04: %s returns the stock, keeps the cart, and records the state', async (outcome, orderStatus, paymentStatus) => {
    const order = await placeOrder(2);
    expect(await stockOf(shoe.id)).toBe(3);
    const res = await pay(order.id, outcome);

    expect(res.body.data).toMatchObject({ status: orderStatus, payment: { status: paymentStatus }, actions: { canPay: false, canCancel: false } });
    expect(await stockOf(shoe.id)).toBe(5);
    const released = await prisma.inventoryMovement.findFirst({ where: { orderId: order.id, reason: 'ORDER_RELEASED' } });
    expect(released).toMatchObject({ quantityChange: 2, stockAfter: 5 });
    expect(await prisma.cartItem.count()).toBe(1);
  });

  it('a failed order is final; the customer can check out again with a new key', async () => {
    const order = await placeOrder();
    await pay(order.id, 'FAILED');
    const retry = await pay(order.id, 'SUCCESS');
    expect(retry.status).toBe(409);
    expect(retry.body.error.code).toBe('INVALID_STATUS_TRANSITION');

    const next = await placeOrder();
    expect(next.id).not.toBe(order.id);
  });

  it('concurrent Pay and Fail on the same order apply exactly one outcome', async () => {
    const order = await placeOrder(2);
    const [a, b] = await Promise.all([pay(order.id, 'SUCCESS'), pay(order.id, 'FAILED')]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const final = await prisma.order.findUniqueOrThrow({ where: { id: order.id } });
    expect(await stockOf(shoe.id)).toBe(final.status === 'PAID' ? 3 : 5);
  });

  it("returns 404 for another customer's order and validates the outcome", async () => {
    const order = await placeOrder();
    expect((await pay(order.id, 'SUCCESS', stranger)).status).toBe(404);
    expect((await pay(order.id, 'MAYBE')).status).toBe(400);
  });
});

describe('order history', () => {
  it("lists only the customer's own orders, newest first, with item counts", async () => {
    const first = await placeOrder(2);
    await pay(first.id, 'SUCCESS');
    const second = await placeOrder(1);

    const res = await request(app).get('/api/orders').set(authHeader(customer));
    expect(res.status).toBe(200);
    expect(res.body.data.map((o: { id: string; itemCount: number; paymentStatus: string }) => [o.id, o.itemCount, o.paymentStatus])).toEqual([
      [second.id, 1, 'PENDING'],
      [first.id, 2, 'SUCCEEDED'],
    ]);
    expect(res.body.meta.total).toBe(2);
    expect((await request(app).get('/api/orders').set(authHeader(stranger))).body.data).toEqual([]);
  });

  it("returns 404 for another customer's order detail", async () => {
    const order = await placeOrder();
    expect((await request(app).get(`/api/orders/${order.id}`).set(authHeader(stranger))).status).toBe(404);
  });
});

describe('customer cancellation', () => {
  it('cancels a PLACED order: stock returned, payment CANCELLED, audit written', async () => {
    const order = await placeOrder(2);
    const res = await cancel(order.id, customer, { reason: 'Changed my mind' });
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', cancelReason: 'Changed my mind', payment: { status: 'CANCELLED' } });
    expect(await stockOf(shoe.id)).toBe(5);
    expect(await prisma.inventoryMovement.count({ where: { orderId: order.id, reason: 'ORDER_CANCELLED' } })).toBe(1);
    expect(await prisma.auditLog.count({ where: { action: 'ORDER_CANCELLED', entityId: order.id } })).toBe(1);
  });

  it('cancels a PAID order with a simulated refund', async () => {
    const order = await placeOrder(2);
    await pay(order.id, 'SUCCESS');
    const res = await cancel(order.id);
    expect(res.body.data).toMatchObject({ status: 'CANCELLED', payment: { status: 'REFUNDED' } });
    expect(await stockOf(shoe.id)).toBe(5);
  });

  it('cannot cancel twice, after packing, or someone else\'s order', async () => {
    const order = await placeOrder();
    expect((await cancel(order.id, stranger)).status).toBe(404);
    await cancel(order.id);
    const twice = await cancel(order.id);
    expect(twice.status).toBe(409);
    expect(await stockOf(shoe.id)).toBe(5); // returned once, not twice

    const packed = await placeOrder();
    await pay(packed.id, 'SUCCESS');
    await prisma.order.update({ where: { id: packed.id }, data: { status: 'PACKED' } });
    const late = await cancel(packed.id);
    expect(late.status).toBe(409);
    expect(late.body.error.code).toBe('ORDER_NOT_CANCELLABLE');
  });
});
