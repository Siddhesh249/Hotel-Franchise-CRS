'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { getSession, signIn } from 'next-auth/react';
import { Icon } from '@/components/icons';

function safeCallback(value: string | null | undefined): string | null {
  if (!value || !value.startsWith('/') || value.startsWith('//')) return null;
  return value;
}

function homeFor(role: string | null | undefined): string {
  if (role === 'Admin') return '/admin';
  if (role === 'Staff') return '/staff';
  return '/my-bookings';
}

const demoAccounts = [
  { label: 'Guest', email: 'arjun.mehta@example.com' },
  { label: 'Staff', email: 'staff.koramangala@example.com' },
  { label: 'Admin', email: 'admin@example.com' },
];

export function LoginForm({ callbackUrl, registered }: { callbackUrl: string | null; registered: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const result = await signIn('credentials', { email, password, redirect: false });
      if (result?.error) {
        setError('That email and password combination did not match an account.');
        return;
      }
      const session = await getSession();
      const destination = safeCallback(callbackUrl) ?? homeFor(session?.user?.role);
      router.push(destination);
      router.refresh();
    } catch {
      setError('Sign in failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {registered && (
        <div className="mb-4 flex gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
          <p>Account created. Sign in to start booking.</p>
        </div>
      )}

      <form onSubmit={submit} className="space-y-4">
        <label>
          <span className="label">Email address</span>
          <span className="relative block">
            <Icon name="mail" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
            <input
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@example.com"
              className="input pl-9"
            />
          </span>
        </label>
        <label>
          <span className="label">Password</span>
          <span className="relative block">
            <Icon name="shield" size={16} className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-ink-400" />
            <input
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Your password"
              className="input pr-16 pl-9"
            />
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="absolute top-1/2 right-2 -translate-y-1/2 rounded-md px-2 py-1 text-xs font-semibold text-ink-500 hover:bg-ink-100"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>

        {error && (
          <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Signing in…' : 'Sign in'}
          {!submitting && <Icon name="arrow-right" size={16} />}
        </button>
      </form>

      <div className="mt-6 rounded-xl border border-ink-100 bg-sand-50 p-4">
        <p className="text-xs font-bold tracking-[0.14em] text-ink-500 uppercase">Demo accounts</p>
        <p className="mt-1 text-xs text-ink-500">
          Password for all seeded accounts: <code className="rounded bg-white px-1.5 py-0.5 font-mono text-[11px] text-ink-800">Demo@1234</code>
        </p>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {demoAccounts.map((account) => (
            <button
              key={account.label}
              type="button"
              onClick={() => {
                setEmail(account.email);
                setPassword('Demo@1234');
                setError('');
              }}
              className="rounded-lg border border-ink-200 bg-white px-3 py-2 text-left transition hover:border-brand-300 hover:bg-brand-50"
            >
              <span className="block text-xs font-semibold text-ink-800">{account.label}</span>
              <span className="block truncate text-[10px] text-ink-500">{account.email}</span>
            </button>
          ))}
        </div>
      </div>

      <p className="mt-6 text-center text-sm text-ink-600">
        New here?{' '}
        <Link href="/register" className="font-semibold text-brand-700 hover:text-brand-800">
          Create a guest account
        </Link>
      </p>
    </div>
  );
}
