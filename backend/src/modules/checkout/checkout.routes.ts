import { Router, type RequestHandler } from 'express';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { input, validate } from '../../middleware/validate.js';
import { checkoutBody } from './checkout.schemas.js';
import { checkout } from './checkout.service.js';

export function createCheckoutRouter({ requireAuth }: AuthMiddleware, rateLimit: RequestHandler) {
  const router = Router();

  /** 201 for a new order; 200 + Idempotent-Replayed: true when the key was already used. */
  router.post('/', requireAuth, rateLimit, validate({ body: checkoutBody }), async (req, res) => {
    const { addressId, address, idempotencyKey } = input(req, 'body', checkoutBody);
    const { order, replayed } = await checkout(req.user!.id, { addressId, address }, idempotencyKey);
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    res.status(replayed ? 200 : 201).json({ data: order });
  });

  return router;
}
