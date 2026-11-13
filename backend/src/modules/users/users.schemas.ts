import { z } from 'zod';
import { paginationQuery } from '../../shared/http/pagination.js';

export const listCustomersQuery = paginationQuery.extend({
  q: z.string().trim().max(100).optional(),
});
