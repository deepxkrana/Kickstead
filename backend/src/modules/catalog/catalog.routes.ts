import { Router } from 'express';
import { input, validate } from '../../middleware/validate.js';
import { listProductsQuery, productParams } from './catalog.schemas.js';
import { getProduct, listCategories, listProducts } from './catalog.service.js';

/** Public catalogue. No authentication required. */
export function createCatalogRouter() {
  const router = Router();

  router.get('/categories', async (_req, res) => {
    res.json({ data: await listCategories() });
  });

  router.get('/products', validate({ query: listProductsQuery }), async (req, res) => {
    res.json(await listProducts(input(req, 'query', listProductsQuery)));
  });

  router.get('/products/:idOrSlug', validate({ params: productParams }), async (req, res) => {
    const { idOrSlug } = input(req, 'params', productParams);
    res.json({ data: await getProduct(idOrSlug) });
  });

  return router;
}
