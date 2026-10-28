/**
 * /admin/clock — Virtual clock controls page (Admin only)
 *
 * Reads/writes GET|PUT /api/admin/clock.
 * Phase 2 — §2.3 Virtual clock admin UI
 *
 * TODO: Phase 2 (2.3) — implement clock control UI
 *   - Display current virtual_now, tick_minutes, is_running
 *   - Pause / Resume button
 *   - Fast-forward by N days input
 *   - Set tick rate input
 */
export default function AdminClockPage() {
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Virtual Clock</h1>
      {/* TODO: Phase 2 (2.3) — clock controls */}
      <p className="text-gray-500">Clock controls coming in Phase 2.</p>
    </main>
  );
}
