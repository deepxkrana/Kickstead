import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { User } from '@prisma/client';
import { InvalidTokenError, type TokenVerifier, type VerifiedIdentity } from '../src/modules/auth/tokenVerifier.js';

// In-memory stand-in for the users table. Database-backed tests come in Phase 8.
const store = vi.hoisted(() => ({ users: new Map<string, User>() }));

vi.mock('../src/modules/users/users.repository.js', () => ({
  usersRepository: {
    findById: async (id: string) => store.users.get(id) ?? null,
    createIfMissing: async (input: Pick<User, 'id' | 'email' | 'name' | 'role'>) => {
      const existing = store.users.get(input.id);
      if (existing) return existing;
      const now = new Date();
      const user: User = { ...input, isActive: true, createdAt: now, updatedAt: now };
      store.users.set(user.id, user);
      return user;
    },
    updateEmail: async (id: string, email: string) => {
      const user = { ...store.users.get(id)!, email };
      store.users.set(id, user);
      return user;
    },
    listCustomers: async () => {
      const rows = [...store.users.values()]
        .filter((u) => u.role === 'CUSTOMER')
        .map(({ id, email, name, isActive, createdAt }) => ({ id, email, name, isActive, createdAt, _count: { orders: 0 } }));
      return { rows, total: rows.length };
    },
  },
}));

const { createApp } = await import('../src/app.js');
const { roleForEmail } = await import('../src/modules/auth/auth.service.js');

const ids = {
  customer: '11111111-1111-4111-8111-111111111111',
  admin: '22222222-2222-4222-8222-222222222222',
  newAdmin: '33333333-3333-4333-8333-333333333333',
  newCustomer: '44444444-4444-4444-8444-444444444444',
  disabled: '55555555-5555-4555-8555-555555555555',
};

const identities: Record<string, VerifiedIdentity> = {
  'customer-token': { id: ids.customer, email: 'customer@test.dev', name: 'Cara Customer' },
  'admin-token': { id: ids.admin, email: 'admin@test.dev', name: 'Ada Admin' },
  'new-admin-token': { id: ids.newAdmin, email: 'boss@test.dev', name: null },
  'new-customer-token': { id: ids.newCustomer, email: 'fresh@test.dev', name: 'Fresh Face' },
  'disabled-token': { id: ids.disabled, email: 'gone@test.dev', name: 'Gone' },
};

const fakeVerifier: TokenVerifier = {
  async verify(token) {
    if (token === 'expired-token') throw new InvalidTokenError('The session has expired.', 'expired');
    const identity = identities[token];
    if (!identity) throw new InvalidTokenError('The access token is invalid.', 'invalid');
    return identity;
  },
};

const app = createApp({ tokenVerifier: fakeVerifier });

function seedUser(id: string, email: string, role: User['role'], isActive = true) {
  const now = new Date();
  store.users.set(id, { id, email, name: email.split('@')[0]!, role, isActive, createdAt: now, updatedAt: now });
}

beforeEach(() => {
  store.users.clear();
  seedUser(ids.customer, 'customer@test.dev', 'CUSTOMER');
  seedUser(ids.admin, 'admin@test.dev', 'ADMIN');
  seedUser(ids.disabled, 'gone@test.dev', 'CUSTOMER', false);
});

describe('authentication (requireAuth)', () => {
  it('returns 401 UNAUTHENTICATED without a token', async () => {
    const res = await request(app).get('/api/auth/me');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('UNAUTHENTICATED');
  });

  it.each(['Basic abc', 'Bearer', 'Bearer a b', 'customer-token'])(
    'returns 401 for a malformed Authorization header: %s',
    async (header) => {
      const res = await request(app).get('/api/auth/me').set('Authorization', header);
      expect(res.status).toBe(401);
    },
  );

  it('returns 401 INVALID_TOKEN for a bad token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer forged');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('INVALID_TOKEN');
  });

  it('returns 401 TOKEN_EXPIRED for an expired token', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer expired-token');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('returns the current user without internal fields', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer customer-token');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      data: { id: ids.customer, email: 'customer@test.dev', name: 'customer', role: 'CUSTOMER' },
    });
  });

  it('returns 403 ACCOUNT_DISABLED for a deactivated user', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer disabled-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_DISABLED');
  });
});

describe('first sign-in provisioning', () => {
  it('creates a CUSTOMER for an email not in ADMIN_EMAILS', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer new-customer-token');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'CUSTOMER', name: 'Fresh Face' });
    expect(store.users.get(ids.newCustomer)?.role).toBe('CUSTOMER');
  });

  it('creates an ADMIN for an email in ADMIN_EMAILS (case-insensitive) and derives a name', async () => {
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer new-admin-token');
    expect(res.status).toBe(200);
    expect(res.body.data).toMatchObject({ role: 'ADMIN', name: 'boss', email: 'boss@test.dev' });
  });

  it('keeps the stored role for existing users', async () => {
    // boss@test.dev is in ADMIN_EMAILS, but an existing CUSTOMER row is not promoted:
    // after creation the database is the source of truth for roles.
    seedUser(ids.newAdmin, 'boss@test.dev', 'CUSTOMER');
    const res = await request(app).get('/api/auth/me').set('Authorization', 'Bearer new-admin-token');
    expect(res.body.data.role).toBe('CUSTOMER');
  });

  it('roleForEmail matches the ADMIN_EMAILS list', () => {
    expect(roleForEmail('admin@test.dev')).toBe('ADMIN');
    expect(roleForEmail(' BOSS@test.dev ')).toBe('ADMIN');
    expect(roleForEmail('someone@test.dev')).toBe('CUSTOMER');
  });
});

describe('authorization (requireRole ADMIN)', () => {
  it('returns 401 for anonymous requests to admin routes', async () => {
    const res = await request(app).get('/api/admin/customers');
    expect(res.status).toBe(401);
  });

  it('returns 403 FORBIDDEN when a customer calls an admin route', async () => {
    const res = await request(app).get('/api/admin/customers').set('Authorization', 'Bearer customer-token');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  it('lets an admin list customers with pagination meta', async () => {
    const res = await request(app).get('/api/admin/customers').set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(200);
    expect(res.body.meta).toEqual({ page: 1, limit: 20, total: 2, totalPages: 1 });
    expect(res.body.data.every((c: { email: string }) => c.email !== 'admin@test.dev')).toBe(true);
  });

  it('validates pagination limits', async () => {
    const res = await request(app)
      .get('/api/admin/customers?limit=500')
      .set('Authorization', 'Bearer admin-token');
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});
