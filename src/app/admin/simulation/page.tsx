/**
 * /admin/simulation — Simulation engine controls page (Admin only)
 *
 * Reads/writes GET|POST /api/admin/simulation.
 * Phase 2 — §2.4 Simulation engine
 *
 * TODO: Phase 2 (2.4) — implement simulation engine UI
 *   - Start / Stop toggle
 *   - Spawn rate input (bookings per virtual hour)
 *   - Client archetype editor (JSON or form)
 *   - Spawn one booking on demand
 *   - Clear all synthetic data button
 */
export default function AdminSimulationPage() {
  return (
    <main className="max-w-2xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Simulation Engine</h1>
      {/* TODO: Phase 2 (2.4) — simulation controls */}
      <p className="text-gray-500">Simulation engine controls coming in Phase 2.</p>
    </main>
  );
}
