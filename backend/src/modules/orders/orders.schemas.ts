import { z } from 'zod';
import { paginationQuery } from '../../shared/http/pagination.js';

export const orderParams = z.object({ id: z.uuid() });

export const listOrdersQuery = paginationQuery.extend({
  limit: z.coerce.number().int().min(1).max(50).default(10),
});

/** Simulated gateway outcome chosen on the payment screen. No card data exists anywhere. */
export const paymentBody = z.strictObject({
  outcome: z.enum(['SUCCESS', 'FAILED', 'CANCELLED']),
});

export const cancelBody = z.strictObject({
  reason: z.string().trim().max(300).optional(),
});
