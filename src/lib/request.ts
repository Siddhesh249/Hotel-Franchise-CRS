import { auth } from '@/lib/auth';
import type { SessionUser } from '@/types';

export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return null;
  return {
    sub: session.user.id,
    actorType: session.user.actorType,
    role: session.user.role,
    hotelId: session.user.hotelId,
  };
}

/** Strict YYYY-MM-DD parser — rejects impossible calendar dates. */
export function parseDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function parsePositiveInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function errorCode(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : undefined;
}

/** MariaDB returns SIGNAL SQLSTATE '45000' with sqlState = '45000'. */
export function sqlState(error: unknown): string | undefined {
  return typeof error === 'object' && error !== null && 'sqlState' in error
    ? String((error as { sqlState: unknown }).sqlState)
    : undefined;
}

export function isDuplicateEntry(error: unknown): boolean {
  return errorCode(error) === 'ER_DUP_ENTRY';
}

/** A foreign-key RESTRICT violation, e.g. deleting a hotel that has bookings. */
export function isReferenced(error: unknown): boolean {
  return errorCode(error) === 'ER_ROW_IS_REFERENCED_2' || errorCode(error) === 'ER_ROW_IS_REFERENCED';
}

/** A foreign key points at a parent row that does not exist. */
export function isMissingParent(error: unknown): boolean {
  return errorCode(error) === 'ER_NO_REFERENCED_ROW_2' || errorCode(error) === 'ER_NO_REFERENCED_ROW';
}

export function isTriggerSignal(error: unknown): boolean {
  return sqlState(error) === '45000' || errorCode(error) === 'ER_SIGNAL_EXCEPTION';
}
