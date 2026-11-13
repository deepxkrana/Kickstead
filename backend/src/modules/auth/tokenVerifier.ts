import { createRemoteJWKSet, errors as joseErrors, jwtVerify, type JWTVerifyGetKey } from 'jose';
import { env } from '../../config/env.js';

/** Identity extracted from a verified Supabase access token. */
export interface VerifiedIdentity {
  /** Supabase auth user id (auth.users.id). Also our users.id. */
  id: string;
  email: string;
  name: string | null;
}

export interface TokenVerifier {
  /** Resolves the identity, or throws `InvalidTokenError`. */
  verify(token: string): Promise<VerifiedIdentity>;
}

export class InvalidTokenError extends Error {
  constructor(
    message: string,
    public readonly reason: 'expired' | 'invalid',
  ) {
    super(message);
    this.name = 'InvalidTokenError';
  }
}

interface SupabaseVerifierOptions {
  /** Expected `iss` claim, e.g. https://<ref>.supabase.co/auth/v1 */
  issuer: string;
  /** Key source. Production uses the project's public JWKS endpoint. */
  keys: JWTVerifyGetKey;
}

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Verifies Supabase access tokens locally against the project's public signing keys.
 * Checks signature (asymmetric algorithms only), issuer, audience, expiry, and the claims we need.
 */
export function createSupabaseTokenVerifier({ issuer, keys }: SupabaseVerifierOptions): TokenVerifier {
  return {
    async verify(token) {
      let payload;
      try {
        ({ payload } = await jwtVerify(token, keys, {
          issuer,
          audience: 'authenticated',
          algorithms: ['ES256', 'RS256', 'EdDSA'],
        }));
      } catch (err) {
        if (err instanceof joseErrors.JWTExpired) {
          throw new InvalidTokenError('The session has expired.', 'expired');
        }
        throw new InvalidTokenError('The access token is invalid.', 'invalid');
      }

      const { sub, email } = payload;
      if (typeof sub !== 'string' || !UUID_PATTERN.test(sub)) {
        throw new InvalidTokenError('The access token has no valid subject.', 'invalid');
      }
      if (typeof email !== 'string' || email.length === 0) {
        throw new InvalidTokenError('The access token has no email.', 'invalid');
      }

      const metadata = (payload.user_metadata ?? {}) as Record<string, unknown>;
      const rawName = metadata.full_name ?? metadata.name;
      const name = typeof rawName === 'string' && rawName.trim() ? rawName.trim() : null;

      return { id: sub, email: email.toLowerCase(), name };
    },
  };
}

/** Production verifier for this project's Supabase Auth. JWKS are fetched once and cached. */
export function createDefaultTokenVerifier(): TokenVerifier {
  const issuer = `${env.supabaseUrl}/auth/v1`;
  return createSupabaseTokenVerifier({
    issuer,
    keys: createRemoteJWKSet(new URL(`${issuer}/.well-known/jwks.json`)),
  });
}
