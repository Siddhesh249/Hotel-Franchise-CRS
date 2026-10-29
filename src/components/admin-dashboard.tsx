'use client';

import { FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';
import { formatCurrency, humanize } from '@/lib/format';

type Hotel = {
  hotel_id: number;
  franchise_id: number;
  hotel_name: string;
  city: string;
  state: string | null;
  address: string | null;
  star_rating: number | null;
  contact_number: string | null;
  room_type_count: number;
  physical_rooms: number;
};

type Franchise = { franchise_id: number; franchise_name: string };
type RoomType = {
  room_type_id: number;
  hotel_id: number;
  hotel_name: string;
  type_name: string;
  base_price: number | string;
  max_occupancy: number;
  total_rooms: number;
  overbook_percentage: number | string;
  physical_room_count: number;
};
type Row = Record<string, unknown>;
type Tab = 'catalog' | 'policies' | 'amenities' | 'reports';

const field = 'input';
const emptyFeatures = '{\n  "amenities": {\n    "general": [],\n    "wellness": [],\n    "policies": {}\n  },\n  "room_type_features": {}\n}';

async function api(url: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(url, options);
  if (response.status === 401 && typeof window !== 'undefined') {
    window.location.href = new URL(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`, window.location.origin).href;
    throw new Error('Sign in is required.');
  }
  const data: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = typeof data === 'object' && data && 'error' in data
      ? String((data as { error: { message?: string } }).error.message ?? 'Request failed')
      : 'Request failed';
    throw new Error(message);
  }
  return data;
}

function SectionHeading({ title, detail }: { title: string; detail: string }) {
  return (
    <div className="mb-4">
      <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      <p className="muted mt-1">{detail}</p>
    </div>
  );
}

function ReportTable({ title, rows }: { title: string; rows: Row[] }) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return (
    <article className="table-shell">
      <h3 className="border-b border-ink-100 bg-sand-50 px-4 py-3 text-sm font-bold text-ink-800">{title}</h3>
      {rows.length ? (
        <table>
          <thead>
            <tr>
              {columns.map((column) => <th key={column}>{humanize(column)}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td key={column}>{String(row[column] ?? '—')}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="p-4 text-sm text-ink-500">No data loaded.</p>
      )}
    </article>
  );
}

export function AdminDashboard() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [tab, setTab] = useState<Tab>('catalog');

  const [editingHotel, setEditingHotel] = useState<Hotel | null>(null);
  const [editingType, setEditingType] = useState<RoomType | null>(null);

  const [featureHotel, setFeatureHotel] = useState('');
  const [featureText, setFeatureText] = useState(emptyFeatures);
  const [featureLoading, setFeatureLoading] = useState(false);

  const [overbooked, setOverbooked] = useState<Row[]>([]);
  const [amenityReport, setAmenityReport] = useState<Row[]>([]);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportsLoaded, setReportsLoaded] = useState(false);

  const load = useCallback(async () => {
    setError('');
    try {
      const [catalog, roomTypes] = await Promise.all([
        api('/api/admin/hotels') as Promise<{ hotels: Hotel[]; franchises: Franchise[] }>,
        api('/api/admin/room-types') as Promise<RoomType[]>,
      ]);
      setHotels(catalog.hotels);
      setFranchises(catalog.franchises);
      setTypes(roomTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the catalog.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  // Reports load on first visit to the tab (or via the refresh button).
  const loadReports = useCallback(async () => {
    setReportLoading(true);
    setError('');
    try {
      const [over, amenities] = await Promise.all([
        api('/api/admin/reports/overbooked') as Promise<Row[]>,
        api('/api/admin/reports/amenities') as Promise<Row[]>,
      ]);
      setOverbooked(over);
      setAmenityReport(amenities);
      setReportsLoaded(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports.');
    } finally {
      setReportLoading(false);
    }
  }, []);

  async function submitHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setError('');
    setNotice('');
    try {
      await api('/api/admin/hotels', {
        method: editingHotel ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingHotel ? { ...body, hotel_id: editingHotel.hotel_id } : body),
      });
      setNotice(editingHotel ? 'Hotel updated.' : 'Hotel created.');
      setEditingHotel(null);
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the hotel.');
    }
  }

  async function submitType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const body = Object.fromEntries(new FormData(form));
    setError('');
    setNotice('');
    try {
      await api('/api/admin/room-types', {
        method: editingType ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingType ? { ...body, room_type_id: editingType.room_type_id } : body),
      });
      setNotice(editingType ? 'Room type updated.' : 'Room type created.');
      setEditingType(null);
      form.reset();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the room type.');
    }
  }

  async function deleteItem(url: string, label: string) {
    if (!window.confirm(`Delete ${label}? This cannot be undone.`)) return;
    setError('');
    setNotice('');
    try {
      await api(url, { method: 'DELETE' });
      setNotice(`${label} deleted.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Unable to delete ${label}.`);
    }
  }

  function editHotel(hotel: Hotel) {
    setEditingHotel(hotel);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function editRoomType(roomType: RoomType) {
    setEditingType(roomType);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async function syncRooms(roomType: RoomType) {    setError('');
    setNotice('');
    try {
      const data = await api(`/api/admin/room-types/${roomType.room_type_id}/rooms`, { method: 'POST' }) as {
        created: number;
        physical_room_count: number;
      };
      setNotice(
        data.created
          ? `${data.created} physical room(s) created for ${roomType.hotel_name} · ${roomType.type_name}.`
          : `All ${data.physical_room_count} physical rooms already exist.`,
      );
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to create physical rooms.');
    }
  }

  async function savePolicy(roomType: RoomType, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const percent = Number(new FormData(event.currentTarget).get('percent'));
    setError('');
    setNotice('');
    try {
      await api(`/api/admin/overbooking-policy/${roomType.room_type_id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ overbook_percentage: percent }),
      });
      setNotice(`Buffer updated for ${roomType.hotel_name} · ${roomType.type_name}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save the policy.');
    }
  }

  async function loadFeatures(hotelId: string) {
    setFeatureHotel(hotelId);
    setFeatureLoading(true);
    setError('');
    if (!hotelId) {
      setFeatureText(emptyFeatures);
      setFeatureLoading(false);
      return;
    }
    try {
      const data = await api(`/api/admin/hotels/${hotelId}/features`);
      setFeatureText(JSON.stringify(data, null, 2));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load features.');
    } finally {
      setFeatureLoading(false);
    }
  }

  async function saveFeatures() {
    setError('');
    setNotice('');
    if (!featureHotel) {
      setError('Choose a hotel first.');
      return;
    }
    try {
      const parsed: unknown = JSON.parse(featureText);
      await api(`/api/admin/hotels/${featureHotel}/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      setNotice('Amenities and room-type features saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The JSON could not be saved.');
    }
  }

  const stats = useMemo(() => ({
    hotels: hotels.length,
    types: types.length,
    rooms: hotels.reduce((sum, hotel) => sum + Number(hotel.physical_rooms ?? 0), 0),
    buffers: types.filter((type) => Number(type.overbook_percentage) > 0).length,
  }), [hotels, types]);

  const tabs: Array<{ id: Tab; label: string; icon: 'building' | 'shield' | 'sparkles' | 'chart' }> = [
    { id: 'catalog', label: 'Catalog', icon: 'building' },
    { id: 'policies', label: 'Overbooking buffers', icon: 'shield' },
    { id: 'amenities', label: 'Amenities', icon: 'sparkles' },
    { id: 'reports', label: 'Reports', icon: 'chart' },
  ];

  return (
    <div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Hotels', value: stats.hotels, icon: 'building' as const },
          { label: 'Room types', value: stats.types, icon: 'bed' as const },
          { label: 'Physical rooms', value: stats.rooms, icon: 'users' as const },
          { label: 'Types with a buffer', value: stats.buffers, icon: 'shield' as const },
        ].map((stat) => (
          <div key={stat.label} className="card flex items-center gap-3 p-4">
            <span className="flex size-10 items-center justify-center rounded-xl bg-brand-50 text-brand-700">
              <Icon name={stat.icon} size={18} />
            </span>
            <div>
              <p className="text-xs font-semibold tracking-wide text-ink-500 uppercase">{stat.label}</p>
              <p className="text-lg font-bold text-ink-900">{loading ? '…' : stat.value}</p>
            </div>
          </div>
        ))}
      </div>

      {notice && (
        <div className="mt-5 flex gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
          <p>{notice}</p>
        </div>
      )}
      {error && (
        <div className="mt-5 flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="mt-7 flex flex-wrap gap-1.5 rounded-xl border border-ink-100 bg-white p-1.5">
        {tabs.map((item) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setTab(item.id);
              if (item.id === 'reports' && !reportsLoaded) void loadReports();
            }}
            className={`flex items-center gap-2 rounded-lg px-3.5 py-2.5 text-sm font-semibold transition ${
              tab === item.id ? 'bg-ink-900 text-white' : 'text-ink-600 hover:bg-ink-50'
            }`}
          >
            <Icon name={item.icon} size={15} />
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'catalog' && (
        <div className="mt-6 space-y-8">
          <div className="grid gap-5 lg:grid-cols-2">
            <section className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <SectionHeading title={editingHotel ? 'Edit hotel' : 'Create hotel'} detail="Hotels belong to a franchise and appear on the public site immediately." />
                {editingHotel && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingHotel(null)}>Cancel</button>
                )}
              </div>
              <form key={editingHotel?.hotel_id ?? 'new-hotel'} className="grid gap-3 sm:grid-cols-2" onSubmit={submitHotel}>
                <label className="sm:col-span-2">
                  <span className="label">Franchise</span>
                  <select required name="franchise_id" defaultValue={editingHotel?.franchise_id ?? ''} className={field}>
                    <option disabled value="">Choose franchise</option>
                    {franchises.map((franchise) => (
                      <option key={franchise.franchise_id} value={franchise.franchise_id}>{franchise.franchise_name}</option>
                    ))}
                  </select>
                </label>
                <label className="sm:col-span-2">
                  <span className="label">Hotel name</span>
                  <input required name="hotel_name" defaultValue={editingHotel?.hotel_name ?? ''} className={field} placeholder="Nightingale Suites - Indiranagar" />
                </label>
                <label>
                  <span className="label">City</span>
                  <input required name="city" defaultValue={editingHotel?.city ?? ''} className={field} placeholder="Bengaluru" />
                </label>
                <label>
                  <span className="label">State</span>
                  <input name="state" defaultValue={editingHotel?.state ?? ''} className={field} placeholder="Karnataka" />
                </label>
                <label className="sm:col-span-2">
                  <span className="label">Address</span>
                  <input name="address" defaultValue={editingHotel?.address ?? ''} className={field} placeholder="Street, area" />
                </label>
                <label>
                  <span className="label">Contact number</span>
                  <input name="contact_number" defaultValue={editingHotel?.contact_number ?? ''} className={field} placeholder="080…" />
                </label>
                <label>
                  <span className="label">Star rating</span>
                  <input required name="star_rating" type="number" min="1" max="7" defaultValue={editingHotel?.star_rating ?? 4} className={field} />
                </label>
                <button type="submit" className="btn-primary sm:col-span-2">
                  {editingHotel ? 'Save hotel' : 'Create hotel'}
                </button>
              </form>
            </section>

            <section className="card p-5">
              <div className="flex items-start justify-between gap-3">
                <SectionHeading title={editingType ? 'Edit room type' : 'Create room type'} detail="Physical room rows are what staff assign; keep total rooms in sync with the building." />
                {editingType && (
                  <button type="button" className="btn-ghost btn-sm" onClick={() => setEditingType(null)}>Cancel</button>
                )}
              </div>
              <form key={editingType?.room_type_id ?? 'new-type'} className="grid gap-3 sm:grid-cols-2" onSubmit={submitType}>
                <label className="sm:col-span-2">
                  <span className="label">Hotel</span>
                  <select required name="hotel_id" defaultValue={editingType?.hotel_id ?? ''} className={field}>
                    <option disabled value="">Choose hotel</option>
                    {hotels.map((hotel) => (
                      <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  <span className="label">Type name</span>
                  <input required name="type_name" defaultValue={editingType?.type_name ?? ''} className={field} placeholder="Deluxe" />
                </label>
                <label>
                  <span className="label">Base price (₹)</span>
                  <input required name="base_price" type="number" min="1" step="0.01" defaultValue={editingType?.base_price ?? ''} className={field} placeholder="5500" />
                </label>
                <label>
                  <span className="label">Max occupancy</span>
                  <input required name="max_occupancy" type="number" min="1" defaultValue={editingType?.max_occupancy ?? 2} className={field} />
                </label>
                <label>
                  <span className="label">Total physical rooms</span>
                  <input required name="total_rooms" type="number" min="1" defaultValue={editingType?.total_rooms ?? 1} className={field} />
                </label>
                <button type="submit" className="btn-primary sm:col-span-2">
                  {editingType ? 'Save room type' : 'Create room type'}
                </button>
              </form>
            </section>
          </div>

          <section>
            <SectionHeading title="Hotels" detail="Deleting a hotel also removes its MongoDB feature document. Hotels with bookings cannot be deleted." />
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Hotel</th><th>City</th><th>Rating</th><th>Types</th><th>Rooms</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {hotels.map((hotel) => (
                    <tr key={hotel.hotel_id}>
                      <td className="font-medium text-ink-900">{hotel.hotel_name}</td>
                      <td>{hotel.city}{hotel.state ? `, ${hotel.state}` : ''}</td>
                      <td>{hotel.star_rating ? `${hotel.star_rating} ★` : '—'}</td>
                      <td>{hotel.room_type_count}</td>
                      <td>{hotel.physical_rooms}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button type="button" onClick={() => editHotel(hotel)} className="btn-secondary btn-sm">
                            <Icon name="edit" size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteItem(`/api/admin/hotels?hotel_id=${hotel.hotel_id}`, hotel.hotel_name)}
                            className="btn-danger btn-sm"
                          >
                            <Icon name="trash" size={13} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <SectionHeading title="Room types" detail="Total rooms is the physical inventory of the category. Overbooking buffers are tuned in the next tab." />
            <div className="table-shell">
              <table>
                <thead>
                  <tr>
                    <th>Hotel</th><th>Type</th><th>Rate</th><th>Occupancy</th><th>Rooms</th><th>Buffer</th><th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.room_type_id}>
                      <td>{type.hotel_name}</td>
                      <td className="font-medium text-ink-900">{type.type_name}</td>
                      <td>{formatCurrency(type.base_price)}</td>
                      <td>{type.max_occupancy}</td>
                      <td>{type.physical_room_count} / {type.total_rooms}</td>
                      <td>{Number(type.overbook_percentage)}%</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          {Number(type.physical_room_count) < Number(type.total_rooms) && (
                            <button type="button" onClick={() => void syncRooms(type)} className="btn-secondary btn-sm">
                              <Icon name="plus" size={13} />
                              Create rooms
                            </button>
                          )}
                          <button type="button" onClick={() => editRoomType(type)} className="btn-secondary btn-sm">
                            <Icon name="edit" size={13} />
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => void deleteItem(`/api/admin/room-types?room_type_id=${type.room_type_id}`, `${type.hotel_name} ${type.type_name}`)}
                            className="btn-danger btn-sm"
                          >
                            <Icon name="trash" size={13} />
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {types.some((type) => Number(type.physical_room_count) !== Number(type.total_rooms)) && (
              <p className="mt-3 rounded-xl border border-accent-200 bg-accent-50 p-3 text-sm text-accent-800">
                Some room types do not match their physical room rows. Use “Create rooms” to add missing rows;
                extra rows are never deleted automatically because they may already have assignments.
              </p>
            )}
          </section>
        </div>
      )}

      {tab === 'policies' && (
        <div className="mt-6 space-y-4">
          <SectionHeading
            title="Overbooking buffers"
            detail="A buffer lets a room type sell up to total_rooms + floor(total_rooms × percent / 100). Suite categories usually stay at 0%."
          />
          {types.map((type) => {
            const percent = Number(type.overbook_percentage);
            const buffer = Math.floor(Number(type.total_rooms) * percent / 100);
            return (
              <form key={type.room_type_id} onSubmit={(event) => void savePolicy(type, event)} className="card grid gap-4 p-5 md:grid-cols-[1fr_140px_120px_100px] md:items-center">
                <div>
                  <p className="font-semibold text-ink-900">{type.hotel_name}</p>
                  <p className="muted">{type.type_name} · {type.total_rooms} physical rooms</p>
                </div>
                <label>
                  <span className="label">Buffer %</span>
                  <input name="percent" type="number" min="0" max="50" step="0.01" defaultValue={percent} className={field} />
                </label>
                <div className="rounded-xl bg-sand-50 px-3 py-2 text-sm">
                  <p className="text-xs font-semibold text-ink-500 uppercase">Max sellable</p>
                  <p className="font-semibold text-ink-900">{Number(type.total_rooms) + buffer} rooms</p>
                </div>
                <button type="submit" className="btn-primary">Save</button>
              </form>
            );
          })}
        </div>
      )}

      {tab === 'amenities' && (
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_340px]">
          <section className="card p-5">
            <SectionHeading title="Amenities & room-type features" detail="A flexible MongoDB document. Edit the JSON directly; it is validated before saving." />
            <label>
              <span className="label">Hotel</span>
              <select value={featureHotel} onChange={(event) => void loadFeatures(event.target.value)} className={field}>
                <option value="">Choose a hotel</option>
                {hotels.map((hotel) => <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>)}
              </select>
            </label>
            <label className="mt-4 block">
              <span className="label">Document JSON</span>
              <textarea
                value={featureText}
                onChange={(event) => setFeatureText(event.target.value)}
                spellCheck={false}
                className={`${field} min-h-80 font-mono text-xs`}
                disabled={featureLoading}
              />
            </label>
            <div className="mt-3 flex flex-wrap gap-2">
              <button type="button" onClick={() => void saveFeatures()} disabled={!featureHotel || featureLoading} className="btn-primary">
                Save features
              </button>
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  try {
                    setFeatureText(JSON.stringify(JSON.parse(featureText), null, 2));
                    setError('');
                  } catch {
                    setError('That is not valid JSON.');
                  }
                }}
              >
                Format JSON
              </button>
            </div>
          </section>
          <aside className="card-muted h-fit p-5 text-sm text-ink-700">
            <h3 className="font-semibold text-ink-900">Document shape</h3>
            <pre className="mt-3 overflow-x-auto rounded-xl bg-ink-950 p-4 font-mono text-[11px] leading-5 text-ink-100">{`{
  "amenities": {
    "general": ["free wifi"],
    "wellness": ["pool"],
    "policies": { "pet_friendly": true }
  },
  "room_type_features": {
    "Deluxe": { "ac": true, "tv": "43 inch" }
  }
}`}</pre>
            <p className="muted mt-3">
              General and wellness amenities are shown as chips on the public hotel page. Room-type keys
              must match the room type names exactly.
            </p>
          </aside>
        </div>
      )}

      {tab === 'reports' && (
        <div className="mt-6 space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <SectionHeading title="Reports" detail="Overbooking usage from MariaDB and the required amenity aggregation from MongoDB." />
            <button type="button" onClick={() => void loadReports()} disabled={reportLoading} className="btn-secondary btn-sm">
              <Icon name="refresh" size={14} />
              {reportLoading ? 'Loading…' : 'Refresh reports'}
            </button>
          </div>
          <div className="grid gap-5 xl:grid-cols-2">
            <ReportTable title="Bookings relying on the overbooking buffer" rows={overbooked} />
            <ReportTable title="Amenities by city (MongoDB aggregation)" rows={amenityReport} />
          </div>
        </div>
      )}
    </div>
  );
}
