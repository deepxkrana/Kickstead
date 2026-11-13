import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createUser, prisma, resetDatabase } from './helpers/db.js';
import { authHeader, testApp as app } from './helpers/app.js';

let alice: { id: string };
let bob: { id: string };

const valid = {
  fullName: 'Alice Shah',
  phone: '+91 98200 11122',
  line1: '12 Hill Road',
  city: 'Mumbai',
  state: 'Maharashtra',
  postalCode: '400050',
};

beforeEach(async () => {
  await resetDatabase();
  alice = await createUser();
  bob = await createUser();
});
afterAll(() => prisma.$disconnect());

const create = (user: { id: string }, body: object) =>
  request(app).post('/api/addresses').set(authHeader(user)).send(body);

describe('addresses', () => {
  it('requires authentication', async () => {
    expect((await request(app).get('/api/addresses')).status).toBe(401);
  });

  it('creates the first address as default with country India', async () => {
    const res = await create(alice, valid);
    expect(res.status).toBe(201);
    expect(res.body.data).toMatchObject({ ...valid, line2: null, country: 'India', isDefault: true });
  });

  it('keeps exactly one default when a new default is added', async () => {
    const first = await create(alice, valid);
    const second = await create(alice, { ...valid, city: 'Pune', isDefault: true });
    expect(second.body.data.isDefault).toBe(true);
    const list = await request(app).get('/api/addresses').set(authHeader(alice));
    expect(list.body.data.map((a: { id: string; isDefault: boolean }) => [a.id, a.isDefault])).toEqual([
      [second.body.data.id, true],
      [first.body.data.id, false],
    ]);
  });

  it('updates only the given fields and can switch the default', async () => {
    const first = await create(alice, valid);
    const second = await create(alice, { ...valid, city: 'Pune' });
    const edited = await request(app).patch(`/api/addresses/${first.body.data.id}`).set(authHeader(alice)).send({ line1: '99 New Road' });
    expect(edited.body.data).toMatchObject({ line1: '99 New Road', city: 'Mumbai', isDefault: true });

    const switched = await request(app).patch(`/api/addresses/${second.body.data.id}`).set(authHeader(alice)).send({ isDefault: true });
    expect(switched.body.data.isDefault).toBe(true);
    expect((await prisma.address.findUniqueOrThrow({ where: { id: first.body.data.id } })).isDefault).toBe(false);
  });

  it('promotes another address when the default is deleted', async () => {
    const first = await create(alice, valid);
    const second = await create(alice, { ...valid, city: 'Pune' });
    const res = await request(app).delete(`/api/addresses/${first.body.data.id}`).set(authHeader(alice));
    expect(res.status).toBe(204);
    expect((await prisma.address.findUniqueOrThrow({ where: { id: second.body.data.id } })).isDefault).toBe(true);
  });

  it("hides other users' addresses (ownership → 404)", async () => {
    const mine = await create(alice, valid);
    const id = mine.body.data.id;
    expect((await request(app).get('/api/addresses').set(authHeader(bob))).body.data).toEqual([]);
    expect((await request(app).patch(`/api/addresses/${id}`).set(authHeader(bob)).send({ city: 'X' })).status).toBe(404);
    expect((await request(app).delete(`/api/addresses/${id}`).set(authHeader(bob))).status).toBe(404);
    expect(await prisma.address.count({ where: { id } })).toBe(1);
  });

  it.each([
    [{ ...valid, phone: 'call me' }, 'phone'],
    [{ ...valid, postalCode: '!' }, 'postalCode'],
    [{ ...valid, fullName: '  ' }, 'fullName'],
    [{ ...valid, userId: '00000000-0000-4000-8000-000000000000' }, ''],
  ])('rejects invalid input (%#)', async (body, path) => {
    const res = await create(alice, body);
    expect(res.status).toBe(400);
    expect(res.body.error.details.issues[0].path).toBe(path);
  });
});
