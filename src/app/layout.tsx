import type { Metadata } from 'next';
import { Suspense } from 'react';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { SiteHeader, SiteHeaderSkeleton } from '@/components/site-header';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });

export const metadata: Metadata = {
  title: { default: 'Nightingale Reservations', template: '%s · Nightingale Reservations' },
  description: 'Central reservation system for the Nightingale Suites hotel franchise.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="flex min-h-full flex-col">
        <Suspense fallback={<SiteHeaderSkeleton />}>
          <SiteHeader />
        </Suspense>
        <div className="flex-1">{children}</div>
        <footer className="border-t border-ink-200 py-4 text-center text-xs text-ink-500">
          DBMS course project · MariaDB + MongoDB + Next.js · payments are simulated
        </footer>
      </body>
    </html>
  );
}
