import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { roleHome } from '@/lib/routes';
import type { Role } from '@/types';

/**
 * Server-side page guard. Anonymous visitors go to /login with a callback URL;
 * signed-in users with the wrong role go to their own home page.
 */
export async function requirePageRole(roles: Role[], callbackPath: string) {
  const session = await auth();
  if (!session?.user) {
    redirect(`/login?callbackUrl=${encodeURIComponent(callbackPath)}`);
  }
  if (!roles.includes(session.user.role)) {
    redirect(roleHome(session.user.role));
  }
  return session;
}
