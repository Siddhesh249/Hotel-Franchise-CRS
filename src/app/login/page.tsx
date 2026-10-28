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
export default function LoginPage() {
  return (
    <main className="max-w-md mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Sign In</h1>
      {/* TODO: Phase 1 (1.2) — login form with email + password */}
      <p className="text-gray-500">Login form coming in Phase 1.</p>
    </main>
  );
}
