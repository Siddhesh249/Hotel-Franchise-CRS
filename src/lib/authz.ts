/**
 * API authorization helpers.
 *
 * Pattern (from ARCHITECTURE.md §6):
 *
 *   requireRole(session, ['Admin'])
 *   requireRole(session, ['Staff'], { sameHotel: true })
 *   requireRole(session, ['Guest'])
 *   requireOwnership(session, booking.guest_id)
 *
 * Every API route must call one of these before touching either database.
 * Returning a 401/403 Response object short-circuits the handler.
 */

import { NextResponse } from 'next/server';

export type Role = 'Guest' | 'Staff' | 'Admin';

export interface SessionUser {
  sub: string;
  actorType: 'guest' | 'staff';
  role: Role;
  hotelId: number | null;
}

/** Standard error response shape (ARCHITECTURE.md §11) */
export function apiError(
  code: string,
  message: string,
  status: number,
): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/**
 * Asserts the session carries one of the allowed roles.
 * Pass `{ sameHotel: true }` to additionally enforce that staff can only
 * access their own hotel's data.
 *
 * @returns null if authorized, or a 401/403 NextResponse to return early.
 */
export function requireRole(
  session: SessionUser | null,
  allowedRoles: Role[],
  opts?: { sameHotel?: boolean; hotelId?: number },
): NextResponse | null {
  if (!session) return apiError('UNAUTHENTICATED', 'Sign in is required', 401);
  if (!allowedRoles.includes(session.role)) return apiError('FORBIDDEN', 'You do not have permission for this resource', 403);
  if (opts?.sameHotel && session.role === 'Staff' && opts.hotelId !== undefined && session.hotelId !== opts.hotelId) {
    return apiError('FORBIDDEN', 'This staff account is restricted to its assigned hotel', 403);
  }
  return null;
}

/**
 * Asserts the authenticated guest owns the resource (e.g., their booking).
 * @returns null if authorized, or a 403 NextResponse to return early.
 */
export function requireOwnership(
  session: SessionUser | null,
  ownerGuestId: number,
): NextResponse | null {
  if (!session) return apiError('UNAUTHENTICATED', 'Sign in is required', 401);
  if (session.role !== 'Guest' || Number(session.sub) !== ownerGuestId) return apiError('FORBIDDEN', 'You can only access your own bookings', 403);
  return null;
}
