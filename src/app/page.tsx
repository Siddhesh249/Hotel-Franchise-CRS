/**
 * / — Marketing landing page (Public)
 *
 * Visible to all visitors, no auth required.
 * Phase 1 — §1.3 Public site
 *
 * TODO: Phase 1 (1.3) — implement landing page UI
 */
export default function HomePage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Hotel Franchise CRS</h1>
      <p className="text-lg text-gray-600 mb-8">
        Find and book rooms across our franchise hotels.
      </p>
      <div className="flex gap-4">
        <a
          href="/hotels"
          className="rounded-lg bg-blue-600 px-6 py-3 text-white font-medium hover:bg-blue-700 transition-colors"
        >
          Browse Hotels
        </a>
        <a
          href="/login"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50 transition-colors"
        >
          Sign In
        </a>
        <a
          href="/register"
          className="rounded-lg border border-gray-300 px-6 py-3 font-medium hover:bg-gray-50 transition-colors"
        >
          Register
        </a>
      </div>
      {/* TODO: Phase 1 (1.3) — add availability search form, hero image, etc. */}
    </main>
  );
}
