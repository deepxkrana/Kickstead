import { Router } from 'express';
import { z } from 'zod';
import { prisma } from '../../db/prisma.js';
import type { AuthMiddleware } from '../../middleware/auth.js';
import { input, validate } from '../../middleware/validate.js';

const updateProfileBody = z.strictObject({ name: z.string().trim().min(1).max(120) });

/** Basic profile. Email and role are managed by Supabase Auth and ADMIN_EMAILS respectively. */
export function createProfileRouter({ requireAuth }: AuthMiddleware) {
  const router = Router();
  router.use(requireAuth);

  router.patch('/', validate({ body: updateProfileBody }), async (req, res) => {
    const { name } = input(req, 'body', updateProfileBody);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: { name },
      select: { id: true, email: true, name: true, role: true },
    });
    res.json({ data: user });
  });

  return router;
}
