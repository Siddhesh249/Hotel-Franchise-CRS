/**
 * Auth.js (next-auth v5) configuration.
 *
 * Session JWT shape (ARCHITECTURE.md §6):
 *   {
 *     sub: string,           // guest_id or staff_id
 *     name: string,
 *     actorType: 'guest' | 'staff',
 *     role: 'Guest' | 'Staff' | 'Admin',
 *     hotelId: number | null  // null for Admin, set for Staff
 *   }
 *
 * Two credential sources:
 *   - guest table (password_hash column)
 *   - staff_account table (password_hash column)
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

/** bcrypt hashes are always 60 characters. Anything else cannot match. */
function isBcryptHash(value: unknown): value is string {
  return typeof value === 'string' && value.length === 60 && /^\$2[aby]\$/.test(value);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  providers: [
    Credentials({
      name: 'Credentials',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const [guests] = await pool.execute<any[]>(
          'SELECT guest_id, first_name, last_name, email, password_hash FROM guest WHERE email = ? LIMIT 1',
          [email],
        );
        if (guests.length) {
          const guest = guests[0];
          if (!isBcryptHash(guest.password_hash)) return null;
          if (!(await bcrypt.compare(password, guest.password_hash))) return null;
          return {
            id: String(guest.guest_id),
            name: `${guest.first_name} ${guest.last_name}`.trim(),
            email: guest.email,
            actorType: 'guest' as const,
            role: 'Guest' as const,
            hotelId: null,
          };
        }

        const [staff] = await pool.execute<any[]>(
          'SELECT staff_id, full_name, email, password_hash, role, hotel_id FROM staff_account WHERE email = ? LIMIT 1',
          [email],
        );
        if (!staff.length) return null;
        const account = staff[0];
        if (!isBcryptHash(account.password_hash)) return null;
        if (!(await bcrypt.compare(password, account.password_hash))) return null;
        return {
          id: String(account.staff_id),
          name: account.full_name,
          email: account.email,
          actorType: 'staff' as const,
          role: account.role as 'Staff' | 'Admin',
          hotelId: account.hotel_id === null ? null : Number(account.hotel_id),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.actorType = (user as any).actorType;
        token.role = (user as any).role;
        token.hotelId = (user as any).hotelId;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as typeof session.user & {
          actorType?: string;
          role?: string;
          hotelId?: number | null;
        };
        user.actorType = token.actorType as 'guest' | 'staff';
        user.role = token.role as 'Guest' | 'Staff' | 'Admin';
        user.hotelId = token.hotelId as number | null;
        user.id = token.sub as string;
        user.name = token.name ?? user.name;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
