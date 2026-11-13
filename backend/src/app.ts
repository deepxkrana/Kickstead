import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { healthRouter } from './modules/health/health.routes.js';

export function createApp() {
  const app = express();

  app.disable('x-powered-by');
  // Behind Vercel rewrites / a reverse proxy in production.
  app.set('trust proxy', 1);

  app.use(helmet());
  app.use(
    cors({
      origin: env.clientOrigins,
      credentials: true,
    }),
  );
  app.use(express.json({ limit: '100kb' }));
  if (!env.isTest) {
    // Logs method, path, status and timing only — never bodies or auth headers.
    app.use(morgan(env.isProduction ? 'combined' : 'dev'));
  }

  app.use('/api/health', healthRouter);

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
