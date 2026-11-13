export type ErrorDetails = Record<string, unknown>;

/** A predictable, client-safe business or HTTP error. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details: ErrorDetails = {},
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const Errors = {
  badRequest: (message = 'The request is invalid.', details?: ErrorDetails) =>
    new AppError(400, 'BAD_REQUEST', message, details),
  unauthenticated: (message = 'Authentication is required.') =>
    new AppError(401, 'UNAUTHENTICATED', message),
  forbidden: (message = 'You do not have permission to perform this action.') =>
    new AppError(403, 'FORBIDDEN', message),
  notFound: (resource = 'Resource') => new AppError(404, 'NOT_FOUND', `${resource} not found.`),
  conflict: (code: string, message: string, details?: ErrorDetails) =>
    new AppError(409, code, message, details),
  unprocessable: (code: string, message: string, details?: ErrorDetails) =>
    new AppError(422, code, message, details),
};
