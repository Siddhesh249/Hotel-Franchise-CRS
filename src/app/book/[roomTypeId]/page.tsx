/**
 * /book/[roomTypeId] — Booking form page (Guest only)
 *
 * Submits to POST /api/bookings.
 * CRITICAL: Must surface all three outcome states distinctly in the UI:
 *   - CONFIRMED
 *   - CONFIRMED_OVERBOOKED (accepted but over physical capacity)
 *   - WAITLISTED
 * (ARCHITECTURE.md §11, IMPLEMENTATION_PHASES.md §1.4)
 *
 * Phase 1 — §1.4 Guest booking flow
 *
 * TODO: Phase 1 (1.4) — implement booking form
 *   - check_in_date / check_out_date (default from virtual_now via /api/admin/clock)
 *   - num_guests, special_requests
 *   - Show outcome state prominently on result
 */

import { Suspense } from 'react';

// Allow this route to block on params (Next.js 16 + cacheComponents).
// Scaffolding only — Phase 1 implementation will make this a proper dynamic route.
export const instant = false;

function BookPageContent({ roomTypeId }: { roomTypeId: string }) {
  return (
    <main className="max-w-lg mx-auto p-8">
      <h1 className="text-3xl font-bold mb-4">Book a Room</h1>
      <p className="text-gray-500 mb-2">Room type ID: {roomTypeId}</p>
      {/* TODO: Phase 1 (1.4) — booking form */}
      {/*
        Booking outcome display (MUST show all three):
        - ✅ CONFIRMED — your room is confirmed
        - ⚠️ CONFIRMED_OVERBOOKED — confirmed but hotel is at capacity (overbooking buffer used)
        - 🕐 WAITLISTED — added to waitlist, will be promoted if a cancellation frees capacity
      */}
      <p className="text-gray-500">Booking form coming in Phase 1.</p>
    </main>
  );
}

export default async function BookPage({
  params,
}: {
  params: Promise<{ roomTypeId: string }>;
}) {
  const { roomTypeId } = await params;
  return (
    <Suspense fallback={<p className="p-8 text-gray-500">Loading…</p>}>
      <BookPageContent roomTypeId={roomTypeId} />
    </Suspense>
  );
}
