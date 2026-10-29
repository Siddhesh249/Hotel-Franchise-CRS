import { StaffDashboard } from '@/components/staff-dashboard';
import { requirePageRole } from '@/lib/guard';

export const instant = false;

export const metadata = { title: 'Staff desk' };

export default async function StaffPage() {
  const session = await requirePageRole(['Staff', 'Admin'], '/staff');
  return (
    <StaffDashboard
      staffName={session.user?.name ?? session.user?.email ?? 'staff'}
      isAdmin={session.user?.role === 'Admin'}
    />
  );
}
