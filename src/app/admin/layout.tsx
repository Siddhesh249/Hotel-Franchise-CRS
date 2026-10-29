import type { ReactNode } from 'react';
import { AdminShell } from '@/components/admin-shell';
import { requirePageRole } from '@/lib/guard';

export const instant = false;

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const session = await requirePageRole(['Admin'], '/admin');
  return <AdminShell userName={session.user?.name ?? session.user?.email ?? 'admin'}>{children}</AdminShell>;
}
