import { z } from 'zod';
import { MAX_QUANTITY_PER_ITEM } from '../../config/pricing.js';

const quantity = z.number().int().min(1).max(MAX_QUANTITY_PER_ITEM);

/**
 * Strict objects: unknown fields (e.g. a client-supplied "price") are rejected with 400,
 * so the server can never be tricked into using browser-provided prices.
 */
export const addCartItemBody = z.strictObject({
  productId: z.uuid(),
  quantity: quantity.default(1),
});

export const updateCartItemBody = z.strictObject({ quantity });

export const cartItemParams = z.object({ itemId: z.uuid() });
