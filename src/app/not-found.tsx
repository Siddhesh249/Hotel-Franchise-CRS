import Link from 'next/link';
import { Icon } from '@/components/icons';

export default function NotFound() {
  return (
    <main className="container-page flex min-h-[60vh] flex-col items-center justify-center py-20 text-center">
      <span className="flex size-14 items-center justify-center rounded-2xl bg-ink-100 text-ink-600">
        <Icon name="search" size={26} />
      </span>
      <p className="eyebrow mt-6">404</p>
      <h1 className="mt-2 text-3xl font-semibold">Page not found</h1>
      <p className="muted mt-2 max-w-md">
        The page you were looking for does not exist, or the hotel or booking has been removed.
      </p>
      <div className="mt-7 flex flex-wrap justify-center gap-3">
        <Link href="/" className="btn-primary">Back to home</Link>
        <Link href="/hotels" className="btn-secondary">Browse hotels</Link>
      </div>
    </main>
  );
}
