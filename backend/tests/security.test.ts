import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { createApp } from '../src/app.js';
import { InvalidTokenError, type TokenVerifier } from '../src/modules/auth/tokenVerifier.js';
import { createAddress, createCategory, createProduct, createUser, fillCart, prisma, resetDatabase } from './helpers/db.js';
import { authHeader, testApp as app } from './helpers/app.js';

beforeEach(() => resetDatabase());
afterAll(() => prisma.$disconnect());

const id = randomUUID();

describe('every customer endpoint requires authentication', () => {
  const protectedEndpoints: [string, string][] = [
    ['get', '/api/auth/me'],
    ['patch', '/api/profile'],
    ['get', '/api/cart'],
    ['post', '/api/cart/items'],
    ['patch', `/api/cart/items/${id}`],
    ['delete', `/api/cart/items/${id}`],
    ['delete', '/api/cart'],
    ['get', '/api/addresses'],
    ['post', '/api/addresses'],
    ['patch', `/api/addresses/${id}`],
    ['delete', `/api/addresses/${id}`],
    ['post', '/api/checkout'],
    ['get', '/api/orders'],
    ['get', `/api/orders/${id}`],
    ['post', `/api/orders/${id}/payment`],
    ['post', `/api/orders/${id}/cancel`],
  ];

  it.each(protectedEndpoints)('%s %s → 401', async (method, path) => {
    const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[method]!(path).send({});
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each([['/api/health'], ['/api/categories'], ['/api/products']])('%s stays public', async (path) => {
    expect((await request(app).get(path)).status).toBe(200);
  });
});

describe('response hardening', () => {
  it('sets no-store, a request id, and security headers on API responses', async () => {
    const res = await request(app).get('/api/products');
    expect(res.headers['cache-control']).toBe('no-store');
    expect(res.headers['x-request-id']).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['strict-transport-security']).toBeDefined();
  });

  it('reuses a well-formed incoming request id and replaces a malformed one', async () => {
    expect((await request(app).get('/api/health').set('X-Request-Id', 'proxy-abc-12345')).headers['x-request-id']).toBe('proxy-abc-12345');
    expect((await request(app).get('/api/health').set('X-Request-Id', '<script>')).headers['x-request-id']).not.toBe('<script>');
  });

  it('rejects oversized bodies with 413', async () => {
    const res = await request(app).post('/api/checkout').set('Content-Type', 'application/json').send(JSON.stringify({ x: 'a'.repeat(120_000) }));
    expect(res.status).toBe(413);
    expect(res.body.error.code).toBe('PAYLOAD_TOO_LARGE');
  });

  it('rejects absurd page numbers', async () => {
    expect((await request(app).get('/api/products?page=999999')).status).toBe(400);
  });

  it('does not allow other origins via CORS', async () => {
    const res = await request(app).get('/api/products').set('Origin', 'https://evil.example');
    expect(res.headers['access-control-allow-origin']).toBeUndefined();
    const ok = await request(app).get('/api/products').set('Origin', 'http://localhost:5173');
    expect(ok.headers['access-control-allow-origin']).toBe('http://localhost:5173');
  });
});

describe('search treats SQL wildcards literally', () => {
  it('"%" and "_" do not match everything', async () => {
    const category = await createCategory();
    await createProduct(category.id, { name: 'Alpha Runner' });
    await createProduct(category.id, { name: '100% Cotton Tee' });
    await createProduct(category.id, { name: 'Under_score' });
    const names = async (q: string) =>
      (await request(app).get(`/api/products?q=${encodeURIComponent(q)}`)).body.data.map((p: { name: string }) => p.name);
    expect(await names('%')).toEqual(['100% Cotton Tee']);
    expect(await names('_')).toEqual(['Under_score']);
    expect(await names('d_r')).toEqual([]); // as a wildcard this would match "Under"
  });
});

describe('rate limiting', () => {
  const verifier: TokenVerifier = {
    async verify(token) {
      const user = await prisma.user.findUnique({ where: { id: token.replace('user:', '') } });
      if (!user) throw new InvalidTokenError('invalid', 'invalid');
      return { id: user.id, email: user.email, name: user.name };
    },
  };

  it('limits checkout attempts per user with 429 RATE_LIMITED', async () => {
    const limited = createApp({ tokenVerifier: verifier, rateLimits: { globalPerMinute: 1000, sensitivePerMinute: 2 } });
    const user = await createUser();
    const address = await createAddress(user.id);
    const product = await createProduct((await createCategory()).id, { stockQuantity: 50 });
    await fillCart(user.id, [{ productId: product.id, quantity: 1 }]);
    const attempt = () => request(limited).post('/api/checkout').set(authHeader(user)).send({ addressId: address.id, idempotencyKey: `k-${randomUUID()}` });

    const statuses = [(await attempt()).status, (await attempt()).status];
    const third = await attempt();
    expect(statuses).toEqual([201, 409]); // second is blocked by the pending-order rule
    expect(third.status).toBe(429);
    expect(third.body.error.code).toBe('RATE_LIMITED');
    expect(third.headers['ratelimit-policy'] ?? third.headers.ratelimit).toBeDefined();

    // Another user is not affected.
    const other = await createUser();
    const otherAddress = await createAddress(other.id);
    await fillCart(other.id, [{ productId: product.id, quantity: 1 }]);
    const res = await request(limited).post('/api/checkout').set(authHeader(other)).send({ addressId: otherAddress.id, idempotencyKey: `k-${randomUUID()}` });
    expect(res.status).toBe(201);
  });

  it('applies a global per-IP limit', async () => {
    const limited = createApp({ tokenVerifier: verifier, rateLimits: { globalPerMinute: 3, sensitivePerMinute: 100 } });
    const results = [];
    for (let i = 0; i < 4; i += 1) results.push((await request(limited).get('/api/health')).status);
    expect(results).toEqual([200, 200, 200, 429]);
  });
});
