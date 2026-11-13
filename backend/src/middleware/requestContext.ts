import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    /** Correlation id for logs; echoed in the X-Request-Id response header. */
    id: string;
  }
}

const SAFE_ID = /^[A-Za-z0-9-]{8,64}$/;

/**
 * Assigns a request id (reusing a well-formed incoming X-Request-Id from the proxy) and marks
 * API responses as non-cacheable, since many contain per-user data.
 */
export const requestContext: RequestHandler = (req, res, next) => {
  const incoming = req.header('x-request-id');
  req.id = incoming && SAFE_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader('X-Request-Id', req.id);
  res.setHeader('Cache-Control', 'no-store');
  next();
};
