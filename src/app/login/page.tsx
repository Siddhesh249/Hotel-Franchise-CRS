/**
 * /login — Shared login page for Guest, Staff, and Admin (Public)
 *
 * Calls Auth.js signIn() with the Credentials provider.
 * The role-based redirect after login is determined by the JWT's role field.
 * Phase 1 — §1.2 Auth & route protection
 *
 * TODO: Phase 1 (1.2) — implement login form
 *   - email / password fields
 *   - On success: redirect Guest → /my-bookings, Staff → /staff, Admin → /admin
 *   - On failure: show Auth.js error message
 */
"use client";
import { FormEvent, useState } from 'react';
import { signIn } from 'next-auth/react';

export default function LoginPage() {
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) { event.preventDefault(); setError(''); const data = new FormData(event.currentTarget); const result = await signIn('credentials', { email: data.get('email'), password: data.get('password'), redirect: false }); if (result?.error) setError('Invalid email or password'); else window.location.href = '/'; }
  return <main className="mx-auto w-full max-w-md p-8"><h1 className="text-3xl font-bold">Sign in</h1><form onSubmit={submit} className="mt-6 space-y-4"><input name="email" type="email" required placeholder="Email" className="w-full rounded border p-3" /><input name="password" type="password" required placeholder="Password" className="w-full rounded border p-3" />{error && <p className="text-red-600">{error}</p>}<button className="w-full rounded bg-black p-3 text-white">Sign in</button></form><a className="mt-4 block underline" href="/register">Create an account</a></main>;
}
