import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { roleHome } from '@/lib/routes';
import { RegisterForm } from '@/components/register-form';

export const metadata = { title: 'Create an account' };

export default async function RegisterPage() {
  const session = await auth();
  if (session?.user) redirect(roleHome(session.user.role));
  return (
    <main className="container-page flex justify-center py-12">
      <div className="animate-fade w-full max-w-sm">
        <h1 className="text-2xl font-semibold tracking-tight">Create a guest account</h1>
        <p className="muted mt-1">Book any hotel in the franchise.</p>
        <RegisterForm />
      </div>
    </main>
  );
}
