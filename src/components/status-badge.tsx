import type { BookingRow } from '@/types';

type Tone = 'brand' | 'amber' | 'rose' | 'slate';
const styles: Record<Tone, string> = {
  brand: 'badge-brand',
  amber: 'badge-amber',
  rose: 'badge-rose',
  slate: 'badge-slate',
};

function Badge({ tone, children }: { tone: Tone; children: React.ReactNode }) {
  return <span className={styles[tone]}>{children}</span>;
}

/** What a guest or staff member should read for a booking, derived from status + stay phase. */
export function bookingLabel(booking: Pick<BookingRow, 'booking_status' | 'stay_phase' | 'cancellable'>): { label: string; tone: Tone } {
  if (booking.booking_status === 'Cancelled') return { label: 'Cancelled', tone: 'rose' };
  if (booking.booking_status === 'Waitlisted') {
    return booking.cancellable
      ? { label: 'Waitlisted', tone: 'amber' }
      : { label: 'Waitlist expired', tone: 'slate' };
  }
  if (booking.stay_phase === 'Past') return { label: 'Completed', tone: 'slate' };
  if (booking.stay_phase === 'Current') return { label: 'In stay', tone: 'brand' };
  return { label: 'Confirmed', tone: 'brand' };
}

export function BookingBadge({ booking }: { booking: BookingRow }) {
  const { label, tone } = bookingLabel(booking);
  return (
    <span className="inline-flex flex-wrap items-center gap-1">
      <Badge tone={tone}>{label}</Badge>
      {booking.is_overbooked && booking.booking_status === 'Confirmed' && <Badge tone="amber">Buffer</Badge>}
    </span>
  );
}

/** Payment state. Waitlisted, expired and cancelled-unpaid bookings have nothing to show. */
export function PaymentBadge({ booking }: { booking: BookingRow }) {
  if (booking.payment_status === 'Completed') return <Badge tone="brand">Paid</Badge>;
  if (booking.payment_status === 'Refunded') return <Badge tone="slate">Refunded</Badge>;
  if (booking.booking_status === 'Confirmed' && booking.is_open) return <Badge tone="amber">Unpaid</Badge>;
  return <span className="text-ink-400">-</span>;
}
