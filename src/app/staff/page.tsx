/**
 * /staff — Staff dashboard (Staff only, scoped to session.hotelId)
 *
 * Fetches GET /api/staff/bookings.
 * Room assignment action: POST /api/staff/assign-room.
 *
 * CRITICAL: The double-assignment guard (SQLSTATE '45000') must be
 * shown as a clean user-facing error, not a raw SQL message.
 *
 * Phase 1 — §1.5 Staff portal
 *
 * TODO: Phase 1 (1.5) — implement staff dashboard
 *   - Today's arrivals list (filtered by check_in_date = virtual_now.date)
 *   - Room assignment form per booking
 *   - Error state for trigger-rejected double assignment
 */
export default function StaffPage() {
  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Staff Dashboard</h1>
      {/* TODO: Phase 1 (1.5) — fetch hotel bookings/arrivals and render */}
      <p className="text-gray-500">Staff portal coming in Phase 1.</p>
    </main>
  );
}
