'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { Alert } from '@/components/ui';
import { roleHome } from '@/lib/routes';

const DEMO_PASSWORD = 'Demo@1234';
const demoAccounts = [
  { label: 'Guest', email: 'arjun.mehta@example.com' },
  { label: 'Admin', email: 'admin@example.com' },
  { label: 'Staff · Koramangala', email: 'staff.koramangala@example.com' },
  { label: 'Staff · Andheri', email: 'staff.andheri@example.com' },
  { label: 'Staff · BKC', email: 'staff.bkc@example.com' },
];

export function LoginForm({ callbackUrl, registered }: { callbackUrl: string | null; registered: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('That email and password did not match an account.');
        return;
      }
      const session = await getSession();
      router.push(callbackUrl ?? roleHome(session?.user?.role));
      router.refresh();
    } catch {
      setError('Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mt-5 space-y-5">
      {registered && <Alert>Account created. Sign in to start booking.</Alert>}

      <form onSubmit={submit} className="card space-y-3 p-5">
        <label className="block">
          <span className="label">Email</span>
          <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="input" />
        </label>
        <label className="block">
          <span className="label">Password</span>
          <input type="password" required autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="input" />
        </label>
        {error && <Alert tone="error">{error}</Alert>}
        <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Signing in…' : 'Sign in'}</button>
        <p className="text-center text-sm text-ink-600">
          New here? <Link href="/register" className="font-medium text-brand-700 hover:underline">Create an account</Link>
        </p>
      </form>

      <div className="card p-4">
        <p className="eyebrow">Demo accounts</p>
        <p className="muted mt-1">
          Staff only see their own hotel&apos;s bookings. Password for all: <code className="rounded bg-ink-100 px-1 font-mono text-xs">{DEMO_PASSWORD}</code>
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {demoAccounts.map((account) => (
            <button
              key={account.label}
              type="button"
              onClick={() => { setEmail(account.email); setPassword(DEMO_PASSWORD); setError(''); }}
              className="btn-secondary btn-sm"
            >
              {account.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
