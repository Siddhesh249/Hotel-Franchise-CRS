import { apiError } from '@/lib/authz';

export function positiveId(value: unknown): number | null {
  const id = Number(value);
  return Number.isSafeInteger(id) && id > 0 ? id : null;
}

export function boundedNumber(value: unknown, min: number, max: number): number | null {
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

export async function adminSession() {
  const { currentUser } = await import('@/lib/request');
  const { requireRole } = await import('@/lib/authz');
  const session = await currentUser();
  return { session, denied: requireRole(session, ['Admin']) };
}

export function invalid(message: string) {
  return apiError('VALIDATION_ERROR', message, 400);
}
