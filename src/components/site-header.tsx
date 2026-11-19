import Link from 'next/link';
import { auth } from '@/lib/auth';
import { UserMenu } from '@/components/user-menu';
import { roleHome } from '@/lib/routes';

export async function SiteHeader() {
  const session = await auth();
  const user = session?.user;
  const role = user?.role;

  const links = [{ href: '/hotels', label: 'Hotels' }];
  if (role === 'Guest') links.push({ href: '/my-bookings', label: 'My bookings' });
  if (role === 'Staff') links.push({ href: '/staff', label: 'Front desk' });
  if (role === 'Admin') links.push({ href: '/admin', label: 'Admin' }, { href: '/staff', label: 'Front desk' });

  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="container-page flex h-14 items-center justify-between gap-4">
        <div className="flex items-center gap-6">
          <Link href="/hotels" className="text-sm font-semibold tracking-tight text-ink-900">
            Nightingale <span className="font-normal text-ink-500">Reservations</span>
          </Link>
          <nav className="flex items-center gap-4 text-sm" aria-label="Main">
            {links.map((link) => (
              <Link key={link.href} href={link.href} className="text-ink-600 transition hover:text-ink-900">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>
        {user ? (
          <UserMenu name={user.name ?? user.email ?? 'Account'} role={role!} home={roleHome(role)} />
        ) : (
          <div className="flex items-center gap-2">
            <Link href="/login" className="btn-secondary btn-sm">Sign in</Link>
            <Link href="/register" className="btn-primary btn-sm">Create account</Link>
          </div>
        )}
      </div>
    </header>
  );
}

export function SiteHeaderSkeleton() {
  return (
    <header className="border-b border-ink-200 bg-white">
      <div className="container-page flex h-14 items-center">
        <span className="text-sm font-semibold">Nightingale <span className="font-normal text-ink-500">Reservations</span></span>
      </div>
    </header>
  );
}
