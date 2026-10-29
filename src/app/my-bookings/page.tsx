import { MyBookingsClient } from '@/components/my-bookings-client';
import { requirePageRole } from '@/lib/guard';

export const instant = false;

export const metadata = { title: 'My bookings' };

export default async function MyBookingsPage() {
  const session = await requirePageRole(['Guest'], '/my-bookings');
  return <MyBookingsClient guestName={session.user?.name ?? session.user?.email ?? 'guest'} />;
}
