import type { RequestHandler } from 'express';
import type { z } from 'zod';

interface ValidationSchemas {
  body?: z.ZodType;
  query?: z.ZodType;
  params?: z.ZodType;
}

export interface ValidatedInput {
  body?: unknown;
  query?: unknown;
  params?: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    /** Parsed, validated input. Set by the `validate` middleware. */
    validated?: ValidatedInput;
  }
}

/**
 * Validates body, query and route params with zod. A ZodError goes to the error handler,
 * which returns 400 VALIDATION_ERROR. Express 5 makes `req.query` read-only, so parsed
 * values are stored on `req.validated` and read back with `input()`.
 */
export function validate(schemas: ValidationSchemas): RequestHandler {
  return (req, _res, next) => {
    req.validated = {
      body: schemas.body ? schemas.body.parse(req.body) : undefined,
      query: schemas.query ? schemas.query.parse(req.query) : undefined,
      params: schemas.params ? schemas.params.parse(req.params) : undefined,
    };
    next();
  };
}

/** Typed access to validated input inside a controller. */
export function input<T extends z.ZodType>(
  req: { validated?: ValidatedInput },
  part: keyof ValidatedInput,
  _schema: T,
): z.infer<T> {
  return req.validated?.[part] as z.infer<T>;
}
