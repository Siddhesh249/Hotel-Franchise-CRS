import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import type { Role } from '@/types';

export function roleHome(role: Role | null | undefined): string {
  if (role === 'Admin') return '/admin';
  if (role === 'Staff') return '/staff';
  if (role === 'Guest') return '/my-bookings';
  return '/';
}

/** Only allow relative, same-origin callback paths. */
export function safeCallback(value: string | null | undefined, fallback = '/'): string {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return fallback;
  return value;
}

/**
 * Server-side page guard. Redirects anonymous visitors to /login with a
 * callback URL, and signed-in users without the right role to their own home.
 */
export async function requirePageRole(roles: Role[], callbackPath: string) {
  // Reading the session during the static prerender trips Next's unstable
  // crypto check (the JWT is decrypted with Web Crypto). Opt into request time
  // before touching auth().
  await connection();
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }
  if (!roles.includes(session.user.role)) {
    redirect(roleHome(session.user.role));
  }
  return session;
}
