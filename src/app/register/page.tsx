/**
 * /register — Guest self-registration page (Public)
 *
 * Submits to POST /api/auth/register.
 * Phase 1 — §1.2 Auth & route protection
 *
 * TODO: Phase 1 (1.2) — implement registration form
 */
"use client";
import { FormEvent, useState } from 'react';

export default function RegisterPage() {
  const [message, setMessage] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); const form = new FormData(event.currentTarget); if (form.get('password') !== form.get('confirm_password')) return setMessage('Passwords do not match'); const response = await fetch('/api/auth/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(Object.fromEntries(form)) }); const data = await response.json(); setMessage(response.ok ? 'Account created. You can now sign in.' : data.error?.message ?? 'Registration failed'); }
  return <main className="mx-auto w-full max-w-md p-8"><h1 className="text-3xl font-bold">Create account</h1><form onSubmit={submit} className="mt-6 space-y-4"><input name="full_name" required placeholder="Full name" className="w-full rounded border p-3" /><input name="email" type="email" required placeholder="Email" className="w-full rounded border p-3" /><input name="phone" placeholder="Phone" className="w-full rounded border p-3" /><input name="password" type="password" minLength={8} required placeholder="Password" className="w-full rounded border p-3" /><input name="confirm_password" type="password" minLength={8} required placeholder="Confirm password" className="w-full rounded border p-3" /><button className="w-full rounded bg-black p-3 text-white">Register</button></form>{message && <p className="mt-4">{message}</p>}</main>;
}
