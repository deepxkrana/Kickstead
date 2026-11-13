import { Router } from 'express';
import { z } from 'zod';
import { requireRole, type AuthMiddleware } from '../middleware/auth.js';
import { input, validate } from '../middleware/validate.js';
import { listAuditLogs } from '../modules/audit/audit.service.js';
import {
  adminListProductsQuery,
  categoryBody,
  createProductBody,
  idParams,
  stockBody,
  updateCategoryBody,
  updateProductBody,
} from '../modules/catalog/catalog.admin.schemas.js';
import {
  adjustStock,
  adminGetProduct,
  adminListCategories,
  adminListProducts,
  createCategory,
  createProduct,
  productMovements,
  updateCategory,
  updateProduct,
} from '../modules/catalog/catalog.admin.service.js';
import {
  adminGetOrder,
  adminListOrders,
  adminListOrdersQuery,
  adminStatusBody,
  adminUpdateStatus,
} from '../modules/orders/orders.admin.service.js';
import { getDashboard } from '../modules/reports/reports.service.js';
import { listCustomers } from '../modules/users/users.controller.js';
import { listCustomersQuery } from '../modules/users/users.schemas.js';
import { paginationQuery } from '../shared/http/pagination.js';

const auditQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(100).default(25),
  action: z.string().trim().max(80).optional().transform((v) => v || undefined),
  entityType: z.enum(['ORDER', 'PRODUCT', 'CATEGORY']).optional(),
  entityId: z.uuid().optional(),
});

/**
 * Every /api/admin route is behind requireAuth + requireRole('ADMIN') at the router level,
 * so a new admin endpoint cannot be added without protection.
 */
export function createAdminRouter({ requireAuth }: AuthMiddleware) {
  const router = Router();
  router.use(requireAuth, requireRole('ADMIN'));

  router.get('/dashboard', async (_req, res) => {
    res.json({ data: await getDashboard() });
  });

  // Products
  router.get('/products', validate({ query: adminListProductsQuery }), async (req, res) => {
    res.json(await adminListProducts(input(req, 'query', adminListProductsQuery)));
  });
  router.get('/products/:id', validate({ params: idParams }), async (req, res) => {
    const { id } = input(req, 'params', idParams);
    const [product, movements] = await Promise.all([adminGetProduct(id), productMovements(id)]);
    res.json({ data: { ...product, movements } });
  });
  router.post('/products', validate({ body: createProductBody }), async (req, res) => {
    res.status(201).json({ data: await createProduct(req.user!.id, input(req, 'body', createProductBody)) });
  });
  router.patch('/products/:id', validate({ params: idParams, body: updateProductBody }), async (req, res) => {
    const { id } = input(req, 'params', idParams);
    res.json({ data: await updateProduct(req.user!.id, id, input(req, 'body', updateProductBody)) });
  });
  router.patch('/products/:id/stock', validate({ params: idParams, body: stockBody }), async (req, res) => {
    const { id } = input(req, 'params', idParams);
    res.json({ data: await adjustStock(req.user!.id, id, input(req, 'body', stockBody)) });
  });

  // Categories
  router.get('/categories', async (_req, res) => {
    res.json({ data: await adminListCategories() });
  });
  router.post('/categories', validate({ body: categoryBody }), async (req, res) => {
    res.status(201).json({ data: await createCategory(req.user!.id, input(req, 'body', categoryBody)) });
  });
  router.patch('/categories/:id', validate({ params: idParams, body: updateCategoryBody }), async (req, res) => {
    const { id } = input(req, 'params', idParams);
    res.json({ data: await updateCategory(req.user!.id, id, input(req, 'body', updateCategoryBody)) });
  });

  // Orders
  router.get('/orders', validate({ query: adminListOrdersQuery }), async (req, res) => {
    res.json(await adminListOrders(input(req, 'query', adminListOrdersQuery)));
  });
  router.get('/orders/:id', validate({ params: idParams }), async (req, res) => {
    const { id } = input(req, 'params', idParams);
    res.json({ data: await adminGetOrder(id) });
  });
  router.patch('/orders/:id/status', validate({ params: idParams, body: adminStatusBody }), async (req, res) => {
    const { id } = input(req, 'params', idParams);
    res.json({ data: await adminUpdateStatus(req.user!.id, id, input(req, 'body', adminStatusBody)) });
  });

  // Customers and audit trail
  router.get('/customers', validate({ query: listCustomersQuery }), listCustomers);
  router.get('/audit-logs', validate({ query: auditQuery }), async (req, res) => {
    res.json(await listAuditLogs(input(req, 'query', auditQuery)));
  });

  return router;
}
