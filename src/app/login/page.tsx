import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { roleHome, safeCallback } from '@/lib/guard';
import { AuthShell } from '@/components/auth-shell';
import { LoginForm } from '@/components/login-form';

export const instant = false;

export const metadata = { title: 'Sign in' };

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await connection();
  const session = await auth();
  if (session?.user) redirect(roleHome(session.user.role));

  const params = await searchParams;
  const callbackUrl = safeCallback(first(params.callbackUrl), '/');
  const registered = first(params.registered) === '1';

  return (
    <AuthShell
      title="Sign in to your account"
      subtitle="Guests, hotel staff, and franchise admins all sign in here."
    >
      <LoginForm callbackUrl={callbackUrl === '/' ? null : callbackUrl} registered={registered} />
    </AuthShell>
  );
}
