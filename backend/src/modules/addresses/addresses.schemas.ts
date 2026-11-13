import { z } from 'zod';

const text = (max: number) => z.string().trim().min(1, 'Required').max(max);

const addressFields = {
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
  country: text(80),
  isDefault: z.boolean(),
};

export const addressBody = z.strictObject({
  ...addressFields,
  country: text(80).default('India'),
  isDefault: z.boolean().default(false),
});

/** No defaults here: omitted fields stay unchanged on update. */
export const updateAddressBody = z.strictObject(addressFields).partial();

export const addressParams = z.object({ id: z.uuid() });

export const MAX_ADDRESSES_PER_USER = 10;
