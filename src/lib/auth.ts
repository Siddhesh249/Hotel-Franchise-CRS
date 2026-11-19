/**
 * Auth.js (next-auth v5) setup: one Credentials provider that checks the
 * guest table first and then staff_account. The JWT carries
 * { sub, name, actorType, role, hotelId } (hotelId is null for guests/admins).
 */

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import bcrypt from 'bcryptjs';
import type { RowDataPacket } from 'mysql2';
import pool from '@/lib/db';
import type { ActorType, Role } from '@/types';

type GuestRow = RowDataPacket & {
  guest_id: number; first_name: string; last_name: string; email: string; password_hash: string;
};
type StaffRow = RowDataPacket & {
  staff_id: number; full_name: string; email: string; password_hash: string;
  role: 'Staff' | 'Admin'; hotel_id: number | null;
};

async function passwordMatches(password: string, hash: string): Promise<boolean> {
  return /^\$2[aby]\$/.test(hash) && bcrypt.compare(password, hash);
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  trustHost: true,
  session: { strategy: 'jwt', maxAge: 60 * 60 * 24 * 7 },
  pages: { signIn: '/login' },
  providers: [
    Credentials({
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = String(credentials?.email ?? '').trim().toLowerCase();
        const password = String(credentials?.password ?? '');
        if (!email || !password) return null;

        const [guests] = await pool.execute<GuestRow[]>(
          'SELECT guest_id, first_name, last_name, email, password_hash FROM guest WHERE email = ?',
          [email],
        );
        if (guests.length) {
          const guest = guests[0];
          if (!(await passwordMatches(password, guest.password_hash))) return null;
          return {
            id: String(guest.guest_id),
            name: `${guest.first_name} ${guest.last_name}`.trim(),
            email: guest.email,
            actorType: 'guest' as ActorType,
            role: 'Guest' as Role,
            hotelId: null,
          };
        }

        const [staff] = await pool.execute<StaffRow[]>(
          'SELECT staff_id, full_name, email, password_hash, role, hotel_id FROM staff_account WHERE email = ?',
          [email],
        );
        if (!staff.length) return null;
        const account = staff[0];
        if (!(await passwordMatches(password, account.password_hash))) return null;
        return {
          id: String(account.staff_id),
          name: account.full_name,
          email: account.email,
          actorType: 'staff' as ActorType,
          role: account.role as Role,
          hotelId: account.hotel_id === null ? null : Number(account.hotel_id),
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.actorType = user.actorType;
        token.role = user.role;
        token.hotelId = user.hotelId;
        token.name = user.name ?? token.name;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.sub as string;
      session.user.actorType = token.actorType as ActorType;
      session.user.role = token.role as Role;
      session.user.hotelId = (token.hotelId ?? null) as number | null;
      session.user.name = token.name ?? session.user.name;
      return session;
    },
  },
});
