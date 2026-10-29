import { redirect } from 'next/navigation';
import { connection } from 'next/server';
import { auth } from '@/lib/auth';
import { roleHome } from '@/lib/guard';
import { AuthShell } from '@/components/auth-shell';
import { RegisterForm } from '@/components/register-form';

export const instant = false;

export const metadata = { title: 'Create an account' };

export default async function RegisterPage() {
  await connection();
  const session = await auth();
  if (session?.user) redirect(roleHome(session.user.role));

  return (
    <AuthShell
      title="Create a guest account"
      subtitle="Free to join. Book any property in the franchise in under a minute."
    >
      <RegisterForm />
    </AuthShell>
  );
}
