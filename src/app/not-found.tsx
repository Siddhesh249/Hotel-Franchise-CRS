import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="container-page py-20 text-center">
      <p className="eyebrow">404</p>
      <h1 className="mt-2 text-2xl">Page not found</h1>
      <p className="muted mt-2">That page, hotel or booking does not exist.</p>
      <Link href="/hotels" className="btn-primary mt-6">Browse hotels</Link>
    </main>
  );
}
