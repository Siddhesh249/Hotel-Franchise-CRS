import Link from 'next/link';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { Icon } from '@/components/icons';
import { MobileNav, type NavLink } from '@/components/mobile-nav';
import { UserMenu, type HeaderUser } from '@/components/user-menu';
import { roleHome } from '@/lib/guard';

function Brand() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label="Nightingale CRS home">
      <span className="flex size-9 items-center justify-center rounded-xl bg-ink-900 text-white shadow-sm transition group-hover:bg-brand-700">
        <Icon name="building" size={18} />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold tracking-tight text-ink-900">Nightingale</span>
        <span className="block text-[10px] font-semibold tracking-[0.18em] text-brand-700 uppercase">Central reservations</span>
      </span>
    </Link>
  );
}

export async function SiteHeader() {
  // The header reads the session, so it must render at request time rather
  // than being attempted during the static prerender.
  await connection();
  const session = await auth();
  const sessionUser = session?.user;
  const user: HeaderUser | null = sessionUser
    ? {
        name: sessionUser.name ?? 'Signed in',
        email: sessionUser.email ?? '',
        role: sessionUser.role,
        home: roleHome(sessionUser.role),
      }
    : null;

  const links: NavLink[] = [{ href: '/hotels', label: 'Hotels' }];
  if (user?.role === 'Guest') links.push({ href: '/my-bookings', label: 'My bookings' });
  if (user?.role === 'Staff') links.push({ href: '/staff', label: 'Staff desk' });
  if (user?.role === 'Admin') links.push({ href: '/admin', label: 'Admin' });

  return (
    <header className="relative z-30 border-b border-ink-100/80 bg-sand-50/85 backdrop-blur-md">
      <div className="container-page flex h-16 items-center justify-between gap-4">
        <Brand />

        <nav className="hidden items-center gap-1 md:flex" aria-label="Main navigation">
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-ink-600 transition hover:bg-white hover:text-ink-900"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          {user ? (
            <div className="hidden md:block">
              <UserMenu user={user} />
            </div>
          ) : (
            <div className="hidden items-center gap-2 md:flex">
              <Link href="/login" className="btn-ghost btn-sm">
                Sign in
              </Link>
              <Link href="/register" className="btn-primary btn-sm">
                Create account
              </Link>
            </div>
          )}
          <MobileNav links={links} user={user} />
        </div>
      </div>
    </header>
  );
}

export function SiteHeaderSkeleton() {
  return (
    <header className="border-b border-ink-100/80 bg-sand-50/85">
      <div className="container-page flex h-16 items-center justify-between">
        <Brand />
        <div className="skeleton h-9 w-28" />
      </div>
    </header>
  );
}
