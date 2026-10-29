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

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import pool from '@/lib/db';

export const { handlers, signIn, signOut, auth } = NextAuth({
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
        const [guests] = await pool.execute<any[]>('SELECT guest_id, email, password_hash FROM guest WHERE email = ?', [email]);
        if (guests.length) {
          const guest = guests[0];
          if (!(await bcrypt.compare(password, guest.password_hash))) return null;
          return { id: String(guest.guest_id), actorType: 'guest', role: 'Guest', hotelId: null };
        }
        const [staff] = await pool.execute<any[]>('SELECT staff_id, email, password_hash, role, hotel_id FROM staff_account WHERE email = ?', [email]);
        if (!staff.length || !(await bcrypt.compare(password, staff[0].password_hash))) return null;
        return { id: String(staff[0].staff_id), actorType: 'staff', role: staff[0].role, hotelId: staff[0].hotel_id };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.actorType = (user as any).actorType;
        token.role = (user as any).role;
        token.hotelId = (user as any).hotelId;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        const user = session.user as typeof session.user & { actorType?: string; role?: string; hotelId?: number | null };
        user.actorType = token.actorType as string;
        user.role = token.role as string;
        user.hotelId = token.hotelId as number | null;
        user.id = token.sub as string;
      }
      return session;
    },
  },
  pages: {
    signIn: '/login',
  },
});
