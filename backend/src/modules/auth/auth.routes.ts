import { Router } from 'express';
import type { AuthMiddleware } from '../../middleware/auth.js';

/**
 * Registration, login and logout happen in the browser through Supabase Auth
 * (Google OAuth or email/password). The API only needs to know who the caller is.
 */
export function createAuthRouter({ requireAuth }: AuthMiddleware) {
  const router = Router();

  router.get('/me', requireAuth, (req, res) => {
    res.json({ data: req.user });
  });

  return router;
}
