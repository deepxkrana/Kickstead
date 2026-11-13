import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { input, validate } from '../../middleware/validate.js';
import { addressBody, addressParams, updateAddressBody } from './addresses.schemas.js';
import { createAddress, deleteAddress, listAddresses, updateAddress } from './addresses.service.js';

/** The signed-in user's own addresses. Another user's address id returns 404. */
export function createAddressesRouter({ requireAuth }: AuthMiddleware) {
  const router = Router();
  router.use(requireAuth);

  router.get('/', async (req, res) => {
    res.json({ data: await listAddresses(req.user!.id) });
  });

  router.post('/', validate({ body: addressBody }), async (req, res) => {
    res.status(201).json({ data: await createAddress(req.user!.id, input(req, 'body', addressBody)) });
  });

  router.patch('/:id', validate({ params: addressParams, body: updateAddressBody }), async (req, res) => {
    const { id } = input(req, 'params', addressParams);
    res.json({ data: await updateAddress(req.user!.id, id, input(req, 'body', updateAddressBody)) });
  });

  router.delete('/:id', validate({ params: addressParams }), async (req, res) => {
    const { id } = input(req, 'params', addressParams);
    await deleteAddress(req.user!.id, id);
    res.status(204).end();
  });

  return router;
}
