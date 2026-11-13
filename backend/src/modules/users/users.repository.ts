import { Prisma, type Role, type User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';

export interface NewUserInput {
  id: string;
  email: string;
  name: string;
  role: Role;
}

export const usersRepository = {
  findById(id: string): Promise<User | null> {
    return prisma.user.findUnique({ where: { id } });
  },

  /**
   * Creates the user on first sign-in. `upsert` makes concurrent first requests safe:
   * the second one finds the row instead of failing.
   */
  createIfMissing(input: NewUserInput): Promise<User> {
    return prisma.user.upsert({
      where: { id: input.id },
      create: input,
      update: {},
    });
  },

  updateEmail(id: string, email: string): Promise<User> {
    return prisma.user.update({ where: { id }, data: { email } });
  },

  async listCustomers(params: { page: number; limit: number; q?: string }) {
    const where: Prisma.UserWhereInput = {
      role: 'CUSTOMER',
      ...(params.q
        ? {
            OR: [
              { name: { contains: params.q, mode: 'insensitive' } },
              { email: { contains: params.q, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [rows, total] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (params.page - 1) * params.limit,
        take: params.limit,
        select: {
          id: true,
          email: true,
          name: true,
          isActive: true,
          createdAt: true,
          _count: { select: { orders: true } },
        },
      }),
      prisma.user.count({ where }),
    ]);

    return { rows, total };
  },
};
