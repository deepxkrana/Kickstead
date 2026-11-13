import type { Role, User } from '@prisma/client';
import { env } from '../../config/env.js';
import { AppError } from '../../shared/errors/AppError.js';
import { usersRepository } from '../users/users.repository.js';
import type { VerifiedIdentity } from './tokenVerifier.js';

/** The authenticated user attached to `req.user`. Never includes secrets. */
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}

/**
 * Role assigned when a user is first created. Emails listed in ADMIN_EMAILS become ADMIN.
 * After creation the database is the source of truth: changing ADMIN_EMAILS later does not
 * promote or demote existing users.
 */
export function roleForEmail(email: string, adminEmails: readonly string[] = env.adminEmails): Role {
  return adminEmails.includes(email.trim().toLowerCase()) ? 'ADMIN' : 'CUSTOMER';
}

function displayName(identity: VerifiedIdentity): string {
  return (identity.name ?? identity.email.split('@')[0] ?? 'Customer').slice(0, 120);
}

function toAuthUser(user: User): AuthUser {
  return { id: user.id, email: user.email, name: user.name, role: user.role };
}

/** Loads the user for a verified identity, creating the row on first sign-in. */
export async function resolveUser(identity: VerifiedIdentity): Promise<AuthUser> {
  let user = await usersRepository.findById(identity.id);

  if (!user) {
    user = await usersRepository.createIfMissing({
      id: identity.id,
      email: identity.email,
      name: displayName(identity),
      role: roleForEmail(identity.email),
    });
  } else if (user.email !== identity.email) {
    // Email changed in Supabase Auth; keep our copy in sync.
    user = await usersRepository.updateEmail(user.id, identity.email);
  }

  if (!user.isActive) {
    throw new AppError(403, 'ACCOUNT_DISABLED', 'This account has been disabled.');
  }

  return toAuthUser(user);
}
