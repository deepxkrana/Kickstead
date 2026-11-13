import { Router } from 'express';
import { prisma } from '../../db/prisma.js';

export const healthRouter = Router();

/** Liveness + database reachability. Used by the deploy pipeline and uptime checks. */
healthRouter.get('/', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'up' });
  } catch (err) {
    console.error('[health] database check failed', err);
    res.status(503).json({ status: 'degraded', database: 'down' });
  }
});
