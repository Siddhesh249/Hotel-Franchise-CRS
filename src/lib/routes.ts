import type { Role } from '@/types';

/** Where each role lands after signing in. Safe to import from client code. */
export function roleHome(role: Role | null | undefined): string {
  if (role === 'Admin') return '/admin';
  if (role === 'Staff') return '/staff';
  if (role === 'Guest') return '/my-bookings';
  return '/hotels';
}

/** Only allow relative, same-origin callback paths. */
export function safeCallback(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}
