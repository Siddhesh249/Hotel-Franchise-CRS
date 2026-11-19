import { apiError, requireRole } from '@/lib/authz';
import { currentUser } from '@/lib/request';

/** Resolves the session and, if it is not an Admin, the error response to return. */
export async function adminSession() {
  const session = await currentUser();
  return { session, denied: requireRole(session, ['Admin']) };
}

export function invalid(message: string) {
  return apiError('VALIDATION_ERROR', message, 400);
}

export function serverError(code: string, message: string, error: unknown) {
  console.error(`[${code}] ${message}`, error);
  return apiError(code, message, 500);
}
