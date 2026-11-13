import type { ErrorRequestHandler } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { AppError, type ErrorDetails } from '../shared/errors/AppError.js';

interface ErrorBody {
  error: { code: string; message: string; details: ErrorDetails };
}

function body(code: string, message: string, details: ErrorDetails = {}): ErrorBody {
  return { error: { code, message, details } };
}

/** Errors raised by express.json() (body-parser) carry a `type` and an HTTP status. */
function isBodyParserError(err: unknown): err is { type: string; status: number } {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    typeof (err as { type: unknown }).type === 'string' &&
    'status' in err
  );
}

export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json(body(err.code, err.message, err.details));
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json(
      body('VALIDATION_ERROR', 'The request is invalid.', {
        issues: err.issues.map((issue) => ({
          path: issue.path.join('.'),
          message: issue.message,
        })),
      }),
    );
    return;
  }

  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      res.status(400).json(body('INVALID_JSON', 'The request body is not valid JSON.'));
      return;
    }
    if (err.type === 'entity.too.large') {
      res.status(413).json(body('PAYLOAD_TOO_LARGE', 'The request body is too large.'));
      return;
    }
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    switch (err.code) {
      case 'P2002':
        res.status(409).json(
          body('UNIQUE_CONSTRAINT', 'A record with these values already exists.', {
            target: err.meta?.target ?? null,
          }),
        );
        return;
      case 'P2003':
        res.status(409).json(body('FOREIGN_KEY_CONSTRAINT', 'A related record does not exist.'));
        return;
      case 'P2004':
        res.status(409).json(body('CONSTRAINT_VIOLATION', 'A database rule was violated.'));
        return;
      case 'P2025':
        res.status(404).json(body('NOT_FOUND', 'Resource not found.'));
        return;
    }
  }

  // Unexpected: log the cause on the server, return a safe message to the client.
  console.error(`[error] ${req.method} ${req.originalUrl}`, err);
  res.status(500).json(body('INTERNAL_ERROR', 'Something went wrong. Please try again.'));
};
