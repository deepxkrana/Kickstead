import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { input, validate } from '../../middleware/validate.js';
import { cancelBody, listOrdersQuery, orderParams, paymentBody } from './orders.schemas.js';
import { cancelOwnOrder, getOwnOrder, listOwnOrders, recordPayment } from './orders.service.js';

/** The signed-in customer's own orders. Another user's order id returns 404. */
export function createOrdersRouter({ requireAuth }: AuthMiddleware) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', validate({ query: listOrdersQuery }), async (req, res) => {
    const { page, limit } = input(req, 'query', listOrdersQuery);
    res.json(await listOwnOrders(req.user!.id, page, limit));
  });

  router.get('/:id', validate({ params: orderParams }), async (req, res) => {
    const { id } = input(req, 'params', orderParams);
    res.json({ data: await getOwnOrder(req.user!.id, id) });
  });

  router.post('/:id/payment', validate({ params: orderParams, body: paymentBody }), async (req, res) => {
    const { id } = input(req, 'params', orderParams);
    const { outcome } = input(req, 'body', paymentBody);
    const { order, replayed } = await recordPayment(req.user!.id, id, outcome);
    if (replayed) res.setHeader('Idempotent-Replayed', 'true');
    res.json({ data: order });
  });

  router.post('/:id/cancel', validate({ params: orderParams, body: cancelBody }), async (req, res) => {
    const { id } = input(req, 'params', orderParams);
    const { reason } = input(req, 'body', cancelBody);
    res.json({ data: await cancelOwnOrder(req.user!.id, id, reason) });
  });

  return router;
}
