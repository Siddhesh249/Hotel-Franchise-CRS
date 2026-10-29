'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Icon } from '@/components/icons';

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState({ full_name: '', email: '', phone: '', password: '', confirm_password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function update(key: keyof typeof form, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm_password) {
      setError('The two passwords do not match.');
      return;
    }
    if (form.password.length < 8) {
      setError('Use a password of at least 8 characters.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: form.full_name,
          email: form.email,
          phone: form.phone || undefined,
          password: form.password,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message ?? 'Registration failed. Please try again.');
        return;
      }
      const result = await signIn('credentials', {
        email: form.email,
        password: form.password,
        redirect: false,
      });
      if (result?.error) {
        router.push('/login?registered=1');
        return;
      }
      router.push('/my-bookings');
      router.refresh();
    } catch {
      setError('We could not create the account. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <form onSubmit={submit} className="space-y-4">
        <label>
          <span className="label">Full name</span>
          <input
            required
            autoComplete="name"
            value={form.full_name}
            onChange={(event) => update('full_name', event.target.value)}
            placeholder="Arjun Mehta"
            className="input"
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <label>
            <span className="label">Email address</span>
            <input
              type="email"
              required
              autoComplete="email"
              value={form.email}
              onChange={(event) => update('email', event.target.value)}
              placeholder="you@example.com"
              className="input"
            />
          </label>
          <label>
            <span className="label">Phone <span className="font-normal text-ink-400">(optional)</span></span>
            <input
              type="tel"
              autoComplete="tel"
              value={form.phone}
              onChange={(event) => update('phone', event.target.value)}
              placeholder="98765 43210"
              className="input"
            />
          </label>
        </div>
        <label>
          <span className="label">Password</span>
          <span className="relative block">
            <input
              type={showPassword ? 'text' : 'password'}
              required
              minLength={8}
              autoComplete="new-password"
              value={form.password}
              onChange={(event) => update('password', event.target.value)}
              placeholder="At least 8 characters"
              className="input pr-16"
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
        <label>
          <span className="label">Confirm password</span>
          <input
            type={showPassword ? 'text' : 'password'}
            required
            minLength={8}
            autoComplete="new-password"
            value={form.confirm_password}
            onChange={(event) => update('confirm_password', event.target.value)}
            placeholder="Repeat your password"
            className="input"
          />
        </label>

        {error && (
          <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
            <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Creating account…' : 'Create account'}
          {!submitting && <Icon name="arrow-right" size={16} />}
        </button>
      </form>

      <p className="mt-5 text-xs leading-5 text-ink-500">
        By creating an account you agree that this is a DBMS course project and that all payments
        are simulated.
      </p>

      <p className="mt-6 text-center text-sm text-ink-600">
        Already have an account?{' '}
        <Link href="/login" className="font-semibold text-brand-700 hover:text-brand-800">
          Sign in
        </Link>
      </p>
    </div>
  );
}
