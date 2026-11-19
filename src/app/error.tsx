'use client';

import Link from 'next/link';
import { useEffect } from 'react';

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="container-page py-20 text-center">
      <h1 className="text-2xl">Something went wrong</h1>
      <p className="muted mx-auto mt-2 max-w-md">The page could not be loaded. A database may be unavailable.</p>
      <div className="mt-6 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn-primary">Try again</button>
        <Link href="/hotels" className="btn-secondary">Back to hotels</Link>
      </div>
    </main>
  );
}
