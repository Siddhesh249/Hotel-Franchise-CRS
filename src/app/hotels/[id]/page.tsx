/**
 * /hotels/[id] — Hotel detail page (Public)
 *
 * Fetches GET /api/hotels/[id] — SQL hotel row + room types + Mongo amenities.
 * Phase 1 — §1.3 Public site
 *
 * TODO: Phase 1 (1.3) — implement hotel detail UI
 */

import { Suspense } from 'react';

// Allow this route to block on params (Next.js 16 + cacheComponents).
export const instant = false;

function HotelDetailContent({ id }: { id: string }) {
  return (
    <>
      <h1 className="text-3xl font-bold mb-4">Hotel Detail — ID: {id}</h1>
      {/* TODO: Phase 1 (1.3) — fetch hotel detail + room types + amenities and render */}
      <p className="text-gray-500">Loading hotel… (Phase 1)</p>
    </>
  );
}

export default async function HotelDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <main className="max-w-4xl mx-auto p-8">
      <Suspense fallback={<p className="text-gray-500">Loading…</p>}>
        <HotelDetailContent id={id} />
      </Suspense>
    </main>
  );
}
