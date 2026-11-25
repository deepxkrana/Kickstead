import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1, 'Required').max(max);

export const checkoutAddressBody = z.strictObject({
  fullName: text(120),
  phone: z
    .string()
    .trim()
    .regex(/^\+?[0-9][0-9 -]{6,18}[0-9]$/, 'Enter a valid phone number'),
  line1: text(200),
  line2: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((value) => (value ? value : null)),
  city: text(100),
  state: text(100),
  postalCode: z
    .string()
    .trim()
    .regex(/^[A-Za-z0-9 -]{3,12}$/, 'Enter a valid postal code'),
  country: text(80).default('India'),
});

export type CheckoutAddressInput = z.infer<typeof checkoutAddressBody>;

/**
 * Accepts either a saved `addressId` or a one-time `address` object, plus an idempotency key.
 * Prices, totals and items are never accepted from the browser: the cart and current prices are
 * read from the database inside the transaction.
 */
export const checkoutBody = z
  .strictObject({
    addressId: z.uuid().optional(),
    address: checkoutAddressBody.optional(),
    idempotencyKey: z
      .string()
      .trim()
      .min(8)
      .max(120)
      .regex(/^[A-Za-z0-9._:-]+$/, 'Use letters, digits, ".", "_", ":" or "-"'),
  })
  .superRefine((data, ctx) => {
    if (Boolean(data.addressId) === Boolean(data.address)) {
      ctx.addIssue({
        code: 'custom',
        message: 'Provide either addressId or address.',
        path: ['addressId'],
      });
    }
  });
