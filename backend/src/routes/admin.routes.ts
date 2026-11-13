import { Router } from 'express';
import { requireRole, type AuthMiddleware } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { listCustomers } from '../modules/users/users.controller.js';
import { listCustomersQuery } from '../modules/users/users.schemas.js';

/**
 * Every /api/admin route is behind requireAuth + requireRole('ADMIN') at the router level,
 * so a new admin endpoint cannot be added without protection.
 */
export function createAdminRouter({ requireAuth }: AuthMiddleware) {
  const router = Router();

  router.use(requireAuth, requireRole('ADMIN'));

  router.get('/customers', validate({ query: listCustomersQuery }), listCustomers);

  return router;
}
