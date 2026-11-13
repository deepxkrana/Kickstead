import { Prisma, type Role, type User } from '@prisma/client';
import { prisma } from '../../db/prisma.js';
import { likeLiteral } from '../../shared/db/like.js';
import { AppError } from '../../shared/errors/AppError.js';

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
   * Creates the user on first sign-in. Several requests can arrive at once for a brand-new user
   * (e.g. /auth/me and /cart on the first page load). Prisma's upsert is not atomic, so insert and,
   * if another request won the race (unique violation on id), return the row it created.
   */
  async createIfMissing(input: NewUserInput): Promise<User> {
    try {
      return await prisma.user.create({ data: input });
    } catch (err) {
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        const existing = await prisma.user.findUnique({ where: { id: input.id } });
        if (existing) return existing;
        // Same email but a different Supabase id: an account conflict, not a race.
        throw new AppError(409, 'ACCOUNT_CONFLICT', 'An account with this email already exists.');
      }
      throw err;
    }
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
              { name: { contains: likeLiteral(params.q), mode: 'insensitive' } },
              { email: { contains: likeLiteral(params.q), mode: 'insensitive' } },
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
