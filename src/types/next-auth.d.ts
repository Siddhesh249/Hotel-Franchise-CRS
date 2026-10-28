import 'next-auth';
import 'next-auth/jwt';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      actorType: 'guest' | 'staff';
      role: 'Guest' | 'Staff' | 'Admin';
      hotelId: number | null;
    } & DefaultSession['user'];
  }
  interface User {
    actorType: 'guest' | 'staff';
    role: 'Guest' | 'Staff' | 'Admin';
    hotelId: number | null;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    actorType?: 'guest' | 'staff';
    role?: 'Guest' | 'Staff' | 'Admin';
    hotelId?: number | null;
  }
}
