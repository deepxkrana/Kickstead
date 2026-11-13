import type { Role } from './types';

const KEY = 'kickstead:returnTo';

/** Remembers where to go after the Google redirect round-trip. Storage may be unavailable. */
export function saveReturnTo(path: string | undefined): void {
  try {
    if (path && path.startsWith('/') && !path.startsWith('//')) sessionStorage.setItem(KEY, path);
    else sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked: fall back to the role's default page */
  }
}

export function takeReturnTo(): string | null {
  try {
    const value = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    return value;
  } catch {
    return null;
  }
}

export function defaultPathFor(role: Role): string {
  return role === 'ADMIN' ? '/admin' : '/products';
}
