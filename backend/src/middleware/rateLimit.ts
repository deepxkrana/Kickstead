import type { RequestHandler } from 'express';
import { ipKeyGenerator, rateLimit } from 'express-rate-limit';

export interface RateLimitConfig {
  /** Requests per minute per client IP across the whole API. */
  globalPerMinute: number;
  /** Checkout / payment / cancellation requests per minute per signed-in user. */
  sensitivePerMinute: number;
}

export const DEFAULT_RATE_LIMITS: RateLimitConfig = { globalPerMinute: 300, sensitivePerMinute: 20 };

const rejected = (message: string) =>
  ({ error: { code: 'RATE_LIMITED', message, details: {} } }) as const;

/** Broad per-IP limit. Behind Vercel/a proxy, `trust proxy` makes req.ip the real client IP. */
export function globalRateLimit(perMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    message: rejected('Too many requests. Please slow down and try again shortly.'),
  });
}

/**
 * Tighter limit for state-changing order operations. Keyed by user id (falls back to IP),
 * so one account cannot hammer checkout from many tabs. Must run after requireAuth.
 */
export function sensitiveRateLimit(perMinute: number): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    limit: perMinute,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    keyGenerator: (req) => (req.user ? `user:${req.user.id}` : ipKeyGenerator(req.ip ?? '')),
    message: rejected('Too many order requests. Please wait a minute and try again.'),
  });
}

/** No-op used when limits are disabled (unit/integration tests). */
export const noLimit: RequestHandler = (_req, _res, next) => next();
