import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createCategory, createProduct, createUser, prisma, resetDatabase } from './helpers/db.js';
import { authHeader, testApp as app } from './helpers/app.js';

let customer: { id: string };
let otherCustomer: { id: string };
let shoe: { id: string };
let lastPair: { id: string };
let retired: { id: string };

beforeEach(async () => {
  await resetDatabase();
  customer = await createUser();
  otherCustomer = await createUser();
  const category = await createCategory();
  shoe = await createProduct(category.id, { pricePaise: 100_000, stockQuantity: 5 });
  lastPair = await createProduct(category.id, { pricePaise: 250_000, stockQuantity: 1 });
  retired = await createProduct(category.id, { isActive: false });
});

afterAll(() => prisma.$disconnect());

const add = (user: { id: string }, body: object) =>
  request(app).post('/api/cart/items').set(authHeader(user)).send(body);

describe('cart access', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/cart')).status).toBe(401);
    expect((await request(app).post('/api/cart/items').send({ productId: shoe.id })).status).toBe(401);
  });

  it('returns an empty cart for a new user without creating one', async () => {
    const res = await request(app).get('/api/cart').set(authHeader(customer));
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ id: null, items: [], itemCount: 0, canCheckout: false });
    expect(await prisma.cart.count()).toBe(0);
  });
});

describe('adding items', () => {
  it('adds an item and calculates totals on the server', async () => {
    const res = await add(customer, { productId: shoe.id, quantity: 2 });
    expect(res.status).toBe(201);
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0]).toMatchObject({ quantity: 2, lineTotalPaise: 200_000, issue: null });
    expect(res.body.data.totals).toEqual({
      subtotalPaise: 200_000,
      discountPaise: 0,
      taxPaise: 36_000,
      shippingPaise: 9_900,
      totalPaise: 245_900,
    });
    expect(res.body.data.canCheckout).toBe(true);
  });

  it('persists the cart in the database', async () => {
    await add(customer, { productId: shoe.id, quantity: 1 });
    const res = await request(app).get('/api/cart').set(authHeader(customer));
    expect(res.body.data.itemCount).toBe(1);
    expect(await prisma.cartItem.count()).toBe(1);
  });

  it('increments the existing line when the same product is added again', async () => {
    await add(customer, { productId: shoe.id, quantity: 2 });
    const res = await add(customer, { productId: shoe.id, quantity: 3 });
    expect(res.body.data.items).toHaveLength(1);
    expect(res.body.data.items[0].quantity).toBe(5);
  });

  it('rejects quantities above stock with 409 and leaves the cart unchanged', async () => {
    await add(customer, { productId: lastPair.id, quantity: 1 });
    const res = await add(customer, { productId: lastPair.id, quantity: 1 });
    expect(res.status).toBe(409);
    expect(res.body.error).toMatchObject({ code: 'INSUFFICIENT_STOCK', details: { available: 1, requested: 2, inCart: 1 } });
    const cart = await request(app).get('/api/cart').set(authHeader(customer));
    expect(cart.body.data.items[0].quantity).toBe(1);
  });

  it('caps a line at 10 units', async () => {
    expect((await add(customer, { productId: shoe.id, quantity: 11 })).status).toBe(400);
    const many = await createProduct((await createCategory()).id, { stockQuantity: 50 });
    await add(customer, { productId: many.id, quantity: 8 });
    const res = await add(customer, { productId: many.id, quantity: 3 });
    expect(res.status).toBe(422);
    expect(res.body.error.code).toBe('QUANTITY_LIMIT');
  });

  it('rejects client-supplied prices or any unknown field', async () => {
    const res = await add(customer, { productId: shoe.id, quantity: 1, pricePaise: 1 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  it.each([
    [{ productId: 'nope' }, 400],
    [{ productId: shoe?.id, quantity: 0 }, 400],
    [{ productId: shoe?.id, quantity: 1.5 }, 400],
  ])('validates the body %j', async (body, status) => {
    const res = await add(customer, { ...body, productId: body.productId ?? shoe.id });
    expect(res.status).toBe(status);
  });

  it('rejects inactive products with 422 and unknown products with 404', async () => {
    expect((await add(customer, { productId: retired.id })).body.error.code).toBe('PRODUCT_UNAVAILABLE');
    expect((await add(customer, { productId: '00000000-0000-4000-8000-000000000000' })).status).toBe(404);
  });
});

describe('updating and removing items', () => {
  async function itemId() {
    const res = await add(customer, { productId: shoe.id, quantity: 1 });
    return res.body.data.items[0].id as string;
  }

  it('updates the quantity', async () => {
    const id = await itemId();
    const res = await request(app).patch(`/api/cart/items/${id}`).set(authHeader(customer)).send({ quantity: 4 });
    expect(res.status).toBe(200);
    expect(res.body.data.items[0]).toMatchObject({ quantity: 4, lineTotalPaise: 400_000 });
  });

  it('rejects an update above stock with 409', async () => {
    const id = await itemId();
    const res = await request(app).patch(`/api/cart/items/${id}`).set(authHeader(customer)).send({ quantity: 6 });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INSUFFICIENT_STOCK');
  });

  it("returns 404 for another customer's cart item (ownership)", async () => {
    const id = await itemId();
    const patch = await request(app).patch(`/api/cart/items/${id}`).set(authHeader(otherCustomer)).send({ quantity: 2 });
    const del = await request(app).delete(`/api/cart/items/${id}`).set(authHeader(otherCustomer));
    expect(patch.status).toBe(404);
    expect(del.status).toBe(404);
    expect(await prisma.cartItem.findUnique({ where: { id } })).toMatchObject({ quantity: 1 });
  });

  it('removes an item and clears the cart', async () => {
    const id = await itemId();
    await add(customer, { productId: lastPair.id });
    const removed = await request(app).delete(`/api/cart/items/${id}`).set(authHeader(customer));
    expect(removed.body.data.items).toHaveLength(1);
    const cleared = await request(app).delete('/api/cart').set(authHeader(customer));
    expect(cleared.status).toBe(200);
    expect(cleared.body.data.items).toEqual([]);
  });
});

describe('cart reflects current stock and availability', () => {
  it('flags items whose stock dropped or that were deactivated, and blocks checkout', async () => {
    await add(customer, { productId: shoe.id, quantity: 3 });
    await add(customer, { productId: lastPair.id, quantity: 1 });
    await prisma.product.update({ where: { id: shoe.id }, data: { stockQuantity: 2 } });
    await prisma.product.update({ where: { id: lastPair.id }, data: { isActive: false } });

    const res = await request(app).get('/api/cart').set(authHeader(customer));
    const issues = Object.fromEntries(res.body.data.items.map((i: { product: { id: string }; issue: string }) => [i.product.id, i.issue]));
    expect(issues).toEqual({ [shoe.id]: 'INSUFFICIENT_STOCK', [lastPair.id]: 'UNAVAILABLE' });
    expect(res.body.data.canCheckout).toBe(false);
  });

  it('always uses the current database price', async () => {
    await add(customer, { productId: shoe.id, quantity: 1 });
    await prisma.product.update({ where: { id: shoe.id }, data: { pricePaise: 120_000 } });
    const res = await request(app).get('/api/cart').set(authHeader(customer));
    expect(res.body.data.totals.subtotalPaise).toBe(120_000);
  });
});
