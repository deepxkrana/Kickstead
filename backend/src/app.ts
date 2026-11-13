import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import { env } from './config/env.js';
import { createAuthMiddleware } from './middleware/auth.js';
import { errorHandler } from './middleware/errorHandler.js';
import { notFound } from './middleware/notFound.js';
import { createAddressesRouter } from './modules/addresses/addresses.routes.js';
import { createAuthRouter } from './modules/auth/auth.routes.js';
import { createCartRouter } from './modules/cart/cart.routes.js';
import { createCatalogRouter } from './modules/catalog/catalog.routes.js';
import { createCheckoutRouter } from './modules/checkout/checkout.routes.js';
import { createOrdersRouter } from './modules/orders/orders.routes.js';
import { createProfileRouter } from './modules/users/profile.routes.js';
import { createDefaultTokenVerifier, type TokenVerifier } from './modules/auth/tokenVerifier.js';
import { healthRouter } from './modules/health/health.routes.js';
import { createAdminRouter } from './routes/admin.routes.js';

export interface AppDependencies {
  /** Defaults to verifying real Supabase tokens. Tests pass a fake. */
  tokenVerifier?: TokenVerifier;
}

export function createApp({ tokenVerifier = createDefaultTokenVerifier() }: AppDependencies = {}) {
  const app = express();
  const auth = createAuthMiddleware(tokenVerifier);

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
  app.use('/api/auth', createAuthRouter(auth));
  app.use('/api', createCatalogRouter());
  app.use('/api/cart', createCartRouter(auth));
  app.use('/api/profile', createProfileRouter(auth));
  app.use('/api/addresses', createAddressesRouter(auth));
  app.use('/api/checkout', createCheckoutRouter(auth));
  app.use('/api/orders', createOrdersRouter(auth));
  app.use('/api/admin', createAdminRouter(auth));

  app.use(notFound);
  app.use(errorHandler);

  return app;
}
