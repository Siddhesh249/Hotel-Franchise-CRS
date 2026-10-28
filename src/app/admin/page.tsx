/**
 * /admin — Admin portal root page (Admin only)
 *
 * Entry point for catalog management, reports, overbooking policy, amenities.
 * Phase 2 — §2.1 Admin catalog management
 *
 * TODO: Phase 2 (2.1) — implement admin dashboard
 */
export default function AdminPage() {
  return (
    <main className="max-w-4xl mx-auto p-8">
      <h1 className="text-3xl font-bold mb-6">Admin Portal</h1>
      <nav className="flex flex-col gap-2">
        <a href="/admin/clock" className="text-blue-600 hover:underline">Virtual Clock Controls</a>
        <a href="/admin/simulation" className="text-blue-600 hover:underline">Simulation Engine</a>
      </nav>
      {/* TODO: Phase 2 (2.1) — hotel/room-type CRUD, overbooking policy, amenity editor, reports */}
      <p className="text-gray-500 mt-4">Admin features coming in Phase 2.</p>
    </main>
  );
}
