import type { ReactNode } from 'react';
import { requirePageRole } from '@/lib/guard';

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requirePageRole(['Admin'], '/admin');
  return <main className="container-page animate-fade py-8">{children}</main>;
}
