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

// TODO: Phase 1 (1.2) — implement requireRole and requireOwnership
// These will use the `auth()` helper from ./auth to read the active session.

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
  _session: SessionUser | null,
  _allowedRoles: Role[],
  _opts?: { sameHotel?: boolean; hotelId?: number },
): NextResponse | null {
  // TODO: Phase 1 (1.2)
  throw new Error('Not implemented — Phase 1');
}

/**
 * Asserts the authenticated guest owns the resource (e.g., their booking).
 * @returns null if authorized, or a 403 NextResponse to return early.
 */
export function requireOwnership(
  _session: SessionUser | null,
  _ownerGuestId: number,
): NextResponse | null {
  // TODO: Phase 1 (1.2)
  throw new Error('Not implemented — Phase 1');
}
