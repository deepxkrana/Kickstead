import { PrismaClient } from '@prisma/client';
import { env } from '../config/env.js';

/** Single shared Prisma client. It connects lazily on the first query. */
export const prisma = new PrismaClient({
  datasourceUrl: env.databaseUrl,
  log: env.isProduction ? ['error'] : ['warn', 'error'],
});

/** Prisma interactive transaction client, for services that run inside `prisma.$transaction`. */
export type TransactionClient = Parameters<Parameters<typeof prisma.$transaction>[0]>[0];
