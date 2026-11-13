import type { RequestHandler } from 'express';
import { input } from '../../middleware/validate.js';
import { pageMeta } from '../../shared/http/pagination.js';
import { usersRepository } from './users.repository.js';
import { listCustomersQuery } from './users.schemas.js';

export const listCustomers: RequestHandler = async (req, res) => {
  const { page, limit, q } = input(req, 'query', listCustomersQuery);
  const { rows, total } = await usersRepository.listCustomers({ page, limit, q });

  res.json({
    data: rows.map(({ _count, ...customer }) => ({ ...customer, orderCount: _count.orders })),
    meta: pageMeta(page, limit, total),
  });
};
