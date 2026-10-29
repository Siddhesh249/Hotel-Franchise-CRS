'use client';

import Link from 'next/link';
import { useEffect } from 'react';
import { Icon } from '@/components/icons';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-rose-100 text-rose-700">
        <Icon name="alert" size={26} />
      </span>
      <h1 className="mt-6 text-3xl font-semibold">Something went wrong</h1>
      <p className="muted mt-2 max-w-md">
        The page could not be loaded. The database may be unavailable, or the request hit an
        unexpected error.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">
          <Icon name="refresh" size={16} />
          Try again
        </button>
        <Link href="/" className="btn-secondary">
          Back to home
        </Link>
      </div>
    </main>
  );
}
