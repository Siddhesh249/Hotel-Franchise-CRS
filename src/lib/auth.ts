/**
 * Auth.js (next-auth v5) configuration.
 *
 * Session JWT shape (ARCHITECTURE.md §6):
 *   {
 *     sub: string,           // guest_id or staff_id
 *     actorType: 'guest' | 'staff',
 *     role: 'Guest' | 'Staff' | 'Admin',
 *     hotelId: number | null  // null for Admin, set for Staff
 *   }
 *
 * Two credential sources:
 *   - guest table (password_hash column, added in Phase 1 schema step)
 *   - staff_account table (password_hash column)
 */

// TODO: Phase 1 — implement Auth.js credentials provider
// Required env vars: AUTH_SECRET, NEXTAUTH_URL

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Credentials({
      // TODO: Phase 1 (1.2) — validate against guest / staff_account tables
      // 1. Look up email in guest table; if found, bcrypt.compare password_hash
      // 2. Else look up email in staff_account table; bcrypt.compare password_hash
      // 3. Return JWT payload with actorType, role, hotelId
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(_credentials) {
        throw new Error('Not implemented — Phase 1');
      },
    }),
  ],
  callbacks: {
    // TODO: Phase 1 (1.2) — persist actorType, role, hotelId into the JWT
    async jwt({ token, user }) {
      if (user) {
        // user is the object returned by authorize()
        // attach custom claims here
      }
      return token;
    },
    async session({ session, token }) {
      // TODO: Phase 1 (1.2) — surface JWT claims on session.user
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
