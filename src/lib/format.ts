/** Small formatting helpers shared by server and client components. */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** Parse a SQL DATE (`YYYY-MM-DD`) as a UTC calendar date. */
function parseCalendarDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(value);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.valueOf()) ? null : date;
}

export function formatDate(value: string | null | undefined, options?: { weekday?: boolean; year?: boolean }): string {
  if (!value) return '—';
  const date = parseCalendarDate(value);
  if (!date) return String(value);
  const weekday = options?.weekday ? `${WEEKDAYS[date.getUTCDay()]}, ` : '';
  const year = options?.year === false ? '' : ` ${date.getUTCFullYear()}`;
  return `${weekday}${date.getUTCDate()} ${MONTHS[date.getUTCMonth()]}${year}`;
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  // SQL DATETIME strings are server-local; parse them as local time.
  const normalized = value.includes('T') ? value : value.replace(' ', 'T');
  const date = new Date(normalized);
  if (Number.isNaN(date.valueOf())) return formatDate(value);
  return `${formatDate(value)} · ${date.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`;
}

export function formatCurrency(value: string | number | null | undefined): string {
  const amount = Number(value ?? 0);
  if (!Number.isFinite(amount)) return '₹0';
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: amount % 1 === 0 ? 0 : 2,
  }).format(amount);
}

/** Nights between two SQL DATE strings. */
export function nightsBetween(checkIn: string, checkOut: string): number {
  const start = parseCalendarDate(checkIn);
  const end = parseCalendarDate(checkOut);
  if (!start || !end) return 0;
  return Math.max(0, Math.round((end.valueOf() - start.valueOf()) / 86_400_000));
}

/** Today as YYYY-MM-DD in the browser's local calendar. */
export function todayIso(): string {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

export function addDaysIso(value: string, days: number): string {
  const date = parseCalendarDate(value);
  if (!date) return value;
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export function humanize(value: string | null | undefined): string {
  if (!value) return '—';
  return value
    .replace(/_/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function initials(name: string | null | undefined): string {
  if (!name) return '?';
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
