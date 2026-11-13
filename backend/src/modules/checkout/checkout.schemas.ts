import { z } from 'zod';

/**
 * Only an address and an idempotency key. Prices, totals and items are never accepted from
 * the browser: the cart and current prices are read from the database inside the transaction.
 */
export const checkoutBody = z.strictObject({
  addressId: z.uuid(),
  idempotencyKey: z
    .string()
    .trim()
    .min(8)
    .max(120)
    .regex(/^[A-Za-z0-9._:-]+$/, 'Use letters, digits, ".", "_", ":" or "-"'),
});
