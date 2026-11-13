import type { RequestHandler } from 'express';
import { AppError } from '../shared/errors/AppError.js';

export const notFound: RequestHandler = (req, _res, next) => {
  next(new AppError(404, 'ROUTE_NOT_FOUND', `No route for ${req.method} ${req.path}.`));
};
