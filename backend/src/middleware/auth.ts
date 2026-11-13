import type { RequestHandler } from 'express';
import type { Role } from '@prisma/client';
import { AppError, Errors } from '../shared/errors/AppError.js';
import { resolveUser, type AuthUser } from '../modules/auth/auth.service.js';
import { InvalidTokenError, type TokenVerifier } from '../modules/auth/tokenVerifier.js';

declare module 'express-serve-static-core' {
  interface Request {
    /** Set by `requireAuth`. Present on every route behind it. */
    user?: AuthUser;
  }
}

function bearerToken(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, token, ...rest] = header.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== 'bearer' || !token || rest.length > 0) return null;
  return token;
}

export interface AuthMiddleware {
  /** 401 unless the request carries a valid Supabase access token; sets `req.user`. */
  requireAuth: RequestHandler;
}

export function createAuthMiddleware(verifier: TokenVerifier): AuthMiddleware {
  const requireAuth: RequestHandler = async (req, _res, next) => {
    const token = bearerToken(req.headers.authorization);
    if (!token) {
      throw Errors.unauthenticated();
    }

    let identity;
    try {
      identity = await verifier.verify(token);
    } catch (err) {
      if (err instanceof InvalidTokenError) {
        throw new AppError(
          401,
          err.reason === 'expired' ? 'TOKEN_EXPIRED' : 'INVALID_TOKEN',
          err.message,
        );
      }
      throw err;
    }

    req.user = await resolveUser(identity);
    next();
  };

  return { requireAuth };
}

/**
 * 403 unless `req.user` has one of the given roles. Must run after `requireAuth`.
 * This is the authorization boundary; the frontend only hides links.
 */
export function requireRole(...roles: Role[]): RequestHandler {
  return (req, _res, next) => {
    if (!req.user) {
      throw Errors.unauthenticated();
    }
    if (!roles.includes(req.user.role)) {
      throw Errors.forbidden();
    }
    next();
  };
}
