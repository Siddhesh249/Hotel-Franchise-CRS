/**
 * API authorization helpers. Every route handler calls one of these before it
 * touches a database; a returned Response short-circuits the handler.
 */

import { NextResponse } from 'next/server';
import type { Role, SessionUser } from '@/types';

/** Standard error body: { error: { code, message } } */
export function apiError(code: string, message: string, status: number): NextResponse {
  return NextResponse.json({ error: { code, message } }, { status });
}

/** Returns null when the session holds one of the allowed roles. */
export function requireRole(session: SessionUser | null, allowedRoles: Role[]): NextResponse | null {
  if (!session) return apiError('UNAUTHENTICATED', 'Sign in is required', 401);
  if (!allowedRoles.includes(session.role)) {
    return apiError('FORBIDDEN', 'You do not have permission for this resource', 403);
  }
  return null;
}
