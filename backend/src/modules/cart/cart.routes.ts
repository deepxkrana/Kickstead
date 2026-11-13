import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { input, validate } from '../../middleware/validate.js';
import { addCartItemBody, cartItemParams, updateCartItemBody } from './cart.schemas.js';
import { addItem, clearCart, getCart, removeItem, updateItem } from './cart.service.js';

/** The signed-in user's own cart. Every mutation returns the full, recalculated cart. */
export function createCartRouter({ requireAuth }: AuthMiddleware) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    res.json({ data: await getCart(req.user!.id) });
  });

  router.post('/items', validate({ body: addCartItemBody }), async (req, res) => {
    const { productId, quantity } = input(req, 'body', addCartItemBody);
    res.status(201).json({ data: await addItem(req.user!.id, productId, quantity) });
  });

  router.patch(
    '/items/:itemId',
    validate({ params: cartItemParams, body: updateCartItemBody }),
    async (req, res) => {
      const { itemId } = input(req, 'params', cartItemParams);
      const { quantity } = input(req, 'body', updateCartItemBody);
      res.json({ data: await updateItem(req.user!.id, itemId, quantity) });
    },
  );

  router.delete('/items/:itemId', validate({ params: cartItemParams }), async (req, res) => {
    const { itemId } = input(req, 'params', cartItemParams);
    res.json({ data: await removeItem(req.user!.id, itemId) });
  });

  router.delete('/', async (req, res) => {
    res.json({ data: await clearCart(req.user!.id) });
  });

  return router;
}
