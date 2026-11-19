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

/** Strict YYYY-MM-DD parser that rejects impossible calendar dates. */
export function parseDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value ? null : value;
}

export function positiveInt(value: unknown): number | null {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

export function boundedNumber(value: unknown, min: number, max: number): number | null {
  if (value === '' || value === null || value === undefined) return null;
  const number = Number(value);
  return Number.isFinite(number) && number >= min && number <= max ? number : null;
}

function field(error: unknown, key: string): string | undefined {
  return typeof error === 'object' && error !== null && key in error
    ? String((error as Record<string, unknown>)[key])
    : undefined;
}

export function isDuplicateEntry(error: unknown): boolean {
  return field(error, 'code') === 'ER_DUP_ENTRY';
}

/** A RESTRICT foreign key blocked the delete (e.g. a hotel that still has bookings). */
export function isReferenced(error: unknown): boolean {
  const code = field(error, 'code');
  return code === 'ER_ROW_IS_REFERENCED_2' || code === 'ER_ROW_IS_REFERENCED';
}

/** A foreign key points at a parent row that does not exist. */
export function isMissingParent(error: unknown): boolean {
  const code = field(error, 'code');
  return code === 'ER_NO_REFERENCED_ROW_2' || code === 'ER_NO_REFERENCED_ROW';
}

/**
 * A SIGNAL SQLSTATE '45000' raised by one of our triggers. The message is
 * written for humans, so it is safe to show.
 */
export function triggerMessage(error: unknown): string | null {
  return field(error, 'sqlState') === '45000' ? field(error, 'sqlMessage') ?? null : null;
}
