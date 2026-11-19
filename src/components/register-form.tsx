'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';
import { Alert } from '@/components/ui';

const empty = { first_name: '', last_name: '', email: '', phone: '', password: '', confirm: '' };

export function RegisterForm() {
  const router = useRouter();
  const [form, setForm] = useState(empty);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const set = (key: keyof typeof empty) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (form.password !== form.confirm) {
      setError('The two passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, confirm: undefined }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message ?? 'Registration failed. Please try again.');
        return;
      }
      const result = await signIn('credentials', { email: form.email, password: form.password, redirect: false });
      router.push(result?.error ? '/login?registered=1' : '/my-bookings');
      router.refresh();
    } catch {
      setError('Could not create the account. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="card mt-5 space-y-3 p-5">
      <div className="grid grid-cols-2 gap-3">
        <label><span className="label">First name</span><input required maxLength={50} autoComplete="given-name" value={form.first_name} onChange={set('first_name')} className="input" /></label>
        <label><span className="label">Last name</span><input required maxLength={50} autoComplete="family-name" value={form.last_name} onChange={set('last_name')} className="input" /></label>
      </div>
      <label className="block"><span className="label">Email</span><input type="email" required autoComplete="email" value={form.email} onChange={set('email')} className="input" /></label>
      <label className="block"><span className="label">Phone (optional)</span><input type="tel" maxLength={15} autoComplete="tel" value={form.phone} onChange={set('phone')} className="input" /></label>
      <label className="block"><span className="label">Password (8+ characters)</span><input type="password" required minLength={8} autoComplete="new-password" value={form.password} onChange={set('password')} className="input" /></label>
      <label className="block"><span className="label">Confirm password</span><input type="password" required minLength={8} autoComplete="new-password" value={form.confirm} onChange={set('confirm')} className="input" /></label>
      {error && <Alert tone="error">{error}</Alert>}
      <button type="submit" disabled={submitting} className="btn-primary w-full">{submitting ? 'Creating…' : 'Create account'}</button>
      <p className="text-center text-sm text-ink-600">
        Already registered? <Link href="/login" className="font-medium text-brand-700 hover:underline">Sign in</Link>
      </p>
    </form>
  );
}
