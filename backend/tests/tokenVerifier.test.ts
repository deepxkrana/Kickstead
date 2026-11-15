import { beforeAll, describe, expect, it } from 'vitest';
import { createLocalJWKSet, exportJWK, generateKeyPair, SignJWT, type CryptoKey, type JWK } from 'jose';
import {
  AuthUnavailableError,
  createSupabaseTokenVerifier,
  InvalidTokenError,
  type TokenVerifier,
} from '../src/modules/auth/tokenVerifier.js';

const ISSUER = 'https://test-project.supabase.co/auth/v1';
const USER_ID = '6f1c2a3b-4d5e-4f60-8a71-92b3c4d5e6f7';

let signingKey: CryptoKey;
let otherKey: CryptoKey;
let verifier: TokenVerifier;

beforeAll(async () => {
  const pair = await generateKeyPair('ES256');
  signingKey = pair.privateKey;
  otherKey = (await generateKeyPair('ES256')).privateKey;
  const publicJwk: JWK = { ...(await exportJWK(pair.publicKey)), kid: 'test-key', alg: 'ES256' };
  verifier = createSupabaseTokenVerifier({
    issuer: ISSUER,
    keys: createLocalJWKSet({ keys: [publicJwk] }),
  });
});

function token(overrides: { claims?: Record<string, unknown>; key?: CryptoKey; iss?: string; aud?: string; exp?: string | number } = {}) {
  return new SignJWT({
    email: 'Shopper@Example.com',
    role: 'authenticated',
    user_metadata: { full_name: '  Asha Rao ' },
    ...overrides.claims,
  })
    .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
    .setSubject(USER_ID)
    .setIssuer(overrides.iss ?? ISSUER)
    .setAudience(overrides.aud ?? 'authenticated')
    .setIssuedAt()
    .setExpirationTime(overrides.exp ?? '1h')
    .sign(overrides.key ?? signingKey);
}

async function expectInvalid(jwt: string, reason: 'expired' | 'invalid') {
  const err = await verifier.verify(jwt).catch((e: unknown) => e);
  expect(err).toBeInstanceOf(InvalidTokenError);
  expect((err as InvalidTokenError).reason).toBe(reason);
}

describe('Supabase token verifier', () => {
  it('accepts a valid token and normalises the identity', async () => {
    await expect(verifier.verify(await token())).resolves.toEqual({
      id: USER_ID,
      email: 'shopper@example.com',
      name: 'Asha Rao',
    });
  });

  it('falls back to user_metadata.name, then null', async () => {
    expect((await verifier.verify(await token({ claims: { user_metadata: { name: 'Ravi' } } }))).name).toBe('Ravi');
    expect((await verifier.verify(await token({ claims: { user_metadata: {} } }))).name).toBeNull();
  });

  it('rejects an expired token as expired', async () => {
    await expectInvalid(await token({ exp: Math.floor(Date.now() / 1000) - 60 }), 'expired');
  });

  it('rejects a token signed by a different key', async () => {
    await expectInvalid(await token({ key: otherKey }), 'invalid');
  });

  it('rejects the wrong issuer', async () => {
    await expectInvalid(await token({ iss: 'https://evil.supabase.co/auth/v1' }), 'invalid');
  });

  it('rejects the wrong audience (e.g. anon tokens)', async () => {
    await expectInvalid(await token({ aud: 'anon' }), 'invalid');
  });

  it('rejects a symmetric HS256 token', async () => {
    const hs = await new SignJWT({ email: 'a@b.c' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(USER_ID)
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(new TextEncoder().encode('a-shared-secret-that-is-long-enough!!'));
    await expectInvalid(hs, 'invalid');
  });

  it('rejects an unsigned alg:none token (signature-stripping attack)', async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({
      sub: USER_ID,
      email: 'admin@kickstead.dev',
      iss: ISSUER,
      aud: 'authenticated',
      exp: Math.floor(Date.now() / 1000) + 3600,
    })}.`;
    await expectInvalid(unsigned, 'invalid');
  });

  it('rejects a valid token whose payload was tampered with after signing', async () => {
    const [header, , signature] = (await token()).split('.');
    const forged = Buffer.from(JSON.stringify({ sub: USER_ID, email: 'admin@kickstead.dev', iss: ISSUER, aud: 'authenticated', exp: 9_999_999_999 })).toString('base64url');
    await expectInvalid(`${header}.${forged}.${signature}`, 'invalid');
  });

  it('rejects tokens without an email or a UUID subject', async () => {
    await expectInvalid(await token({ claims: { email: undefined } }), 'invalid');
    const badSub = await new SignJWT({ email: 'a@b.c' })
      .setProtectedHeader({ alg: 'ES256', kid: 'test-key' })
      .setSubject('not-a-uuid')
      .setIssuer(ISSUER)
      .setAudience('authenticated')
      .setExpirationTime('1h')
      .sign(signingKey);
    await expectInvalid(badSub, 'invalid');
  });

  it('rejects garbage', async () => {
    await expectInvalid('not.a.jwt', 'invalid');
  });

  it('reports an unreachable key server as AuthUnavailableError (503), not an invalid token', async () => {
    const offline = createSupabaseTokenVerifier({
      issuer: ISSUER,
      keys: async () => {
        throw new TypeError('fetch failed');
      },
    });
    await expect(offline.verify(await token())).rejects.toBeInstanceOf(AuthUnavailableError);
  });
});
