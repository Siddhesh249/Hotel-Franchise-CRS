/**
 * Auth.js route handler — handles all /api/auth/* paths.
 *
 * This exposes the sign-in, sign-out, session, and CSRF endpoints
 * expected by next-auth v5.
 *
 * The Credentials provider configuration lives in src/lib/auth.ts.
 *
 * Phase 1 — §1.2 Auth & route protection
 */

import { handlers } from '@/lib/auth';

export const { GET, POST } = handlers;
