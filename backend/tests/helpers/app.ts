import { createApp } from '../../src/app.js';
import { InvalidTokenError, type TokenVerifier } from '../../src/modules/auth/tokenVerifier.js';
import { prisma } from '../../src/db/prisma.js';

/**
 * Test tokens are simply `user:<id>`. The fake verifier resolves them against the users
 * table, so database-backed tests exercise the real requireAuth/requireRole path.
 */
const testVerifier: TokenVerifier = {
  async verify(token) {
    const id = token.startsWith('user:') ? token.slice(5) : '';
    const user = id ? await prisma.user.findUnique({ where: { id } }) : null;
    if (!user) throw new InvalidTokenError('The access token is invalid.', 'invalid');
    return { id: user.id, email: user.email, name: user.name };
  },
};

export const testApp = createApp({ tokenVerifier: testVerifier });

export function authHeader(user: { id: string }) {
  return { Authorization: `Bearer user:${user.id}` };
}
