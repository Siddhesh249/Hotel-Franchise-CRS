import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { roleHome, safeCallback } from '@/lib/routes';
import { LoginForm } from '@/components/login-form';

export const metadata = { title: 'Sign in' };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const session = await auth();
  if (session?.user) redirect(roleHome(session.user.role));

  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);
  return (
    <main className="container-page flex justify-center py-12">
      <div className="animate-fade w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Sign in</h1>
        <p className="muted mt-1">Guests, hotel staff and franchise admins all sign in here.</p>
        <LoginForm callbackUrl={safeCallback(first(params.callbackUrl))} registered={first(params.registered) === '1'} />
      </div>
    </main>
  );
}
