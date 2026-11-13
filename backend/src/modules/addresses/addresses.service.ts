import type { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import { AppError } from '../../shared/errors/AppError.js';
import { MAX_ADDRESSES_PER_USER, type addressBody, type updateAddressBody } from './addresses.schemas.js';

const addressSelect = {
  id: true,
  fullName: true,
  phone: true,
  line1: true,
  line2: true,
  city: true,
  state: true,
  postalCode: true,
  country: true,
  isDefault: true,
  createdAt: true,
} as const;

const notFound = () => new AppError(404, 'ADDRESS_NOT_FOUND', 'Address not found.');

export function listAddresses(userId: string) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
    select: addressSelect,
  });
}

/** The first address becomes the default automatically. One default per user (partial unique index). */
export async function createAddress(userId: string, input: z.infer<typeof addressBody>) {
  return prisma.$transaction(async (tx) => {
    const count = await tx.address.count({ where: { userId } });
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw new AppError(422, 'ADDRESS_LIMIT', `You can save up to ${MAX_ADDRESSES_PER_USER} addresses.`);
    }
    const makeDefault = input.isDefault || count === 0;
    if (makeDefault) await tx.address.updateMany({ where: { userId, isDefault: true }, data: { isDefault: false } });
    return tx.address.create({ data: { ...input, isDefault: makeDefault, userId }, select: addressSelect });
  });
}

export async function updateAddress(userId: string, id: string, input: z.infer<typeof updateAddressBody>) {
  return prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId } });
    if (!existing) throw notFound();
    if (input.isDefault === false && existing.isDefault) {
      throw new AppError(422, 'DEFAULT_ADDRESS_REQUIRED', 'Set another address as default instead.');
    }
    if (input.isDefault) {
      await tx.address.updateMany({ where: { userId, isDefault: true, NOT: { id } }, data: { isDefault: false } });
    }
    return tx.address.update({ where: { id }, data: input, select: addressSelect });
  });
}

/** Orders keep their own address snapshot, so deleting an address never changes order history. */
export async function deleteAddress(userId: string, id: string) {
  await prisma.$transaction(async (tx) => {
    const existing = await tx.address.findFirst({ where: { id, userId } });
    if (!existing) throw notFound();
    await tx.address.delete({ where: { id } });
    if (existing.isDefault) {
      const next = await tx.address.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } });
      if (next) await tx.address.update({ where: { id: next.id }, data: { isDefault: true } });
    }
  });
}
