/**
 * /my-bookings — Guest's bookings dashboard (Guest only)
 *
 * Fetches GET /api/bookings/mine.
 * Allows cancellation via POST /api/bookings/[id]/cancel.
 * Shows payment status and allows payment via POST /api/payments.
 *
 * Phase 1 — §1.4 Guest booking flow
 *
 * TODO: Phase 1 (1.4) — implement my bookings UI
 *   - List bookings with status badges (Confirmed / Confirmed-Overbooked / Waitlisted / Cancelled)
 *   - Cancel button (only for active bookings)
 *   - Show when a Waitlisted booking has been promoted to Confirmed
 *   - Payment status + Pay button
 */
export default function MyBookingsPage() {
  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">My Bookings</h1>
      {/* TODO: Phase 1 (1.4) — fetch and render booking list */}
      <p className="text-gray-500">Your bookings will appear here (Phase 1).</p>
    </main>
  );
}
