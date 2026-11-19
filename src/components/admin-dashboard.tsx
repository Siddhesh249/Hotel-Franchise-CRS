'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { AdminAmenitiesEditor } from '@/components/admin-amenities';
import { AdminInventoryChart } from '@/components/admin-inventory-chart';
import { Feedback, PageHeader, Tabs } from '@/components/ui';
import { api } from '@/lib/client-api';
import { formatCurrency, formatDate } from '@/lib/format';

type Hotel = {
  hotel_id: number; franchise_id: number; hotel_name: string; city: string; state: string | null;
  address: string | null; star_rating: number | null; contact_number: string | null;
  room_type_count: number; physical_rooms: number;
};
type Franchise = { franchise_id: number; franchise_name: string };
type RoomType = {
  room_type_id: number; hotel_id: number; hotel_name: string; type_name: string; base_price: number | string;
  max_occupancy: number; total_rooms: number; overbook_percentage: number | string; physical_room_count: number;
};
type Tab = 'catalog' | 'overbooking' | 'amenities' | 'inventory' | 'reports';
type OverbookedRow = {
  booking_id: number; hotel_name: string; type_name: string; first_name: string; last_name: string;
  check_in_date: string; check_out_date: string; total_amount: string;
};
type AmenityRow = { city: string; amenity: string; hotels_offering: number };

export function AdminDashboard() {
  const [hotels, setHotels] = useState<Hotel[]>([]);
  const [franchises, setFranchises] = useState<Franchise[]>([]);
  const [types, setTypes] = useState<RoomType[]>([]);
  const [tab, setTab] = useState<Tab>('catalog');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [hotelForm, setHotelForm] = useState<Hotel | 'new' | null>(null);
  const [typeForm, setTypeForm] = useState<RoomType | 'new' | null>(null);
  const [overbooked, setOverbooked] = useState<OverbookedRow[]>([]);
  const [amenityReport, setAmenityReport] = useState<AmenityRow[]>([]);

  const load = useCallback(async () => {
    try {
      const [catalog, roomTypes] = await Promise.all([
        api<{ hotels: Hotel[]; franchises: Franchise[] }>('/api/admin/hotels'),
        api<RoomType[]>('/api/admin/room-types'),
      ]);
      setHotels(catalog.hotels);
      setFranchises(catalog.franchises);
      setTypes(roomTypes);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the catalog.');
    }
  }, []);

  const loadReports = useCallback(async () => {
    try {
      const [over, amenities] = await Promise.all([
        api<OverbookedRow[]>('/api/admin/reports/overbooked'),
        api<AmenityRow[]>('/api/admin/reports/amenities').catch((err: Error) => {
          setError(err.message);
          return [] as AmenityRow[];
        }),
      ]);
      setOverbooked(over);
      setAmenityReport(amenities);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load reports.');
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void load();
  }, [load]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (tab === 'reports') void loadReports();
  }, [tab, loadReports]);

  async function run(action: () => Promise<unknown>, success: string) {
    setError('');
    setNotice('');
    try {
      await action();
      setNotice(success);
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong.');
      return false;
    }
  }

  async function submitHotel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const editing = hotelForm !== 'new' && hotelForm !== null ? hotelForm : null;
    const ok = await run(
      () => api('/api/admin/hotels', { method: editing ? 'PUT' : 'POST', body: editing ? { ...body, hotel_id: editing.hotel_id } : body }),
      editing ? 'Hotel updated.' : 'Hotel created.',
    );
    if (ok) setHotelForm(null);
  }

  async function submitType(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const body = Object.fromEntries(new FormData(event.currentTarget));
    const editing = typeForm !== 'new' && typeForm !== null ? typeForm : null;
    const ok = await run(
      () => api('/api/admin/room-types', { method: editing ? 'PUT' : 'POST', body: editing ? { ...body, room_type_id: editing.room_type_id, hotel_id: editing.hotel_id } : body }),
      editing ? 'Room type updated.' : 'Room type created.',
    );
    if (ok) setTypeForm(null);
  }

  const remove = (url: string, label: string) => {
    if (window.confirm(`Delete ${label}? This cannot be undone.`)) void run(() => api(url, { method: 'DELETE' }), `${label} deleted.`);
  };

  async function savePolicy(type: RoomType, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const percent = Number(new FormData(event.currentTarget).get('percent'));
    await run(
      () => api(`/api/admin/overbooking-policy/${type.room_type_id}`, { method: 'PUT', body: { overbook_percentage: percent } }),
      `Buffer saved for ${type.hotel_name}, ${type.type_name}.`,
    );
  }

  const editingHotel = hotelForm && hotelForm !== 'new' ? hotelForm : null;
  const editingType = typeForm && typeForm !== 'new' ? typeForm : null;

  return (
    <div>
      <PageHeader title="Admin" subtitle="Catalog, overbooking policy, amenities, inventory plan and reports." />
      <Feedback notice={notice} error={error} />
      <div className="mt-5">
        <Tabs
          value={tab}
          onChange={(id) => { setTab(id); setNotice(''); setError(''); }}
          tabs={[
            { id: 'catalog', label: 'Catalog' },
            { id: 'overbooking', label: 'Overbooking' },
            { id: 'amenities', label: 'Amenities' },
            { id: 'inventory', label: 'Inventory plan' },
            { id: 'reports', label: 'Reports' },
          ]}
        />
      </div>

      {tab === 'catalog' && (
        <div className="mt-5 space-y-8">
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base">Hotels</h2>
              <button type="button" className="btn-primary btn-sm" onClick={() => setHotelForm(hotelForm ? null : 'new')}>
                {hotelForm ? 'Close form' : 'Add hotel'}
              </button>
            </div>
            {hotelForm && (
              <form key={editingHotel?.hotel_id ?? 'new'} onSubmit={submitHotel} className="card animate-fade mb-3 grid gap-3 p-4 sm:grid-cols-3">
                <p className="eyebrow sm:col-span-3">{editingHotel ? `Edit ${editingHotel.hotel_name}` : 'New hotel'}</p>
                <label><span className="label">Franchise</span>
                  <select required name="franchise_id" defaultValue={editingHotel?.franchise_id ?? franchises[0]?.franchise_id} className="input">
                    {franchises.map((f) => <option key={f.franchise_id} value={f.franchise_id}>{f.franchise_name}</option>)}
                  </select></label>
                <label className="sm:col-span-2"><span className="label">Hotel name</span><input required name="hotel_name" defaultValue={editingHotel?.hotel_name} className="input" /></label>
                <label><span className="label">City</span><input required name="city" defaultValue={editingHotel?.city} className="input" /></label>
                <label><span className="label">State</span><input name="state" defaultValue={editingHotel?.state ?? ''} className="input" /></label>
                <label><span className="label">Stars (1-5)</span><input required name="star_rating" type="number" min="1" max="5" defaultValue={editingHotel?.star_rating ?? 4} className="input" /></label>
                <label className="sm:col-span-2"><span className="label">Address</span><input name="address" defaultValue={editingHotel?.address ?? ''} className="input" /></label>
                <label><span className="label">Contact number</span><input name="contact_number" maxLength={15} defaultValue={editingHotel?.contact_number ?? ''} className="input" /></label>
                <div className="sm:col-span-3"><button type="submit" className="btn-primary">{editingHotel ? 'Save hotel' : 'Create hotel'}</button></div>
              </form>
            )}
            <div className="table-shell">
              <table>
                <thead><tr><th>Hotel</th><th>City</th><th>Stars</th><th>Room types</th><th>Rooms</th><th /></tr></thead>
                <tbody>
                  {hotels.map((hotel) => (
                    <tr key={hotel.hotel_id}>
                      <td className="font-medium text-ink-900">{hotel.hotel_name}</td>
                      <td>{hotel.city}</td>
                      <td>{hotel.star_rating ?? '-'}</td>
                      <td>{hotel.room_type_count}</td>
                      <td>{hotel.physical_rooms}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => setHotelForm(hotel)}>Edit</button>
                          <button type="button" className="btn-danger btn-sm" onClick={() => remove(`/api/admin/hotels?hotel_id=${hotel.hotel_id}`, hotel.hotel_name)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-base">Room types</h2>
              <button type="button" className="btn-primary btn-sm" onClick={() => setTypeForm(typeForm ? null : 'new')}>
                {typeForm ? 'Close form' : 'Add room type'}
              </button>
            </div>
            {typeForm && (
              <form key={editingType?.room_type_id ?? 'new'} onSubmit={submitType} className="card animate-fade mb-3 grid gap-3 p-4 sm:grid-cols-5">
                <p className="eyebrow sm:col-span-5">{editingType ? `Edit ${editingType.hotel_name}, ${editingType.type_name}` : 'New room type'}</p>
                {!editingType && (
                  <label className="sm:col-span-2"><span className="label">Hotel</span>
                    <select required name="hotel_id" defaultValue={hotels[0]?.hotel_id} className="input">
                      {hotels.map((h) => <option key={h.hotel_id} value={h.hotel_id}>{h.hotel_name}</option>)}
                    </select></label>
                )}
                <label><span className="label">Name</span><input required name="type_name" defaultValue={editingType?.type_name} className="input" /></label>
                <label><span className="label">Price / night (₹)</span><input required name="base_price" type="number" min="1" step="0.01" defaultValue={editingType?.base_price} className="input" /></label>
                <label><span className="label">Sleeps</span><input required name="max_occupancy" type="number" min="1" defaultValue={editingType?.max_occupancy ?? 2} className="input" /></label>
                <label><span className="label">Physical rooms</span><input required name="total_rooms" type="number" min="1" defaultValue={editingType?.total_rooms ?? 1} className="input" /></label>
                <div className="sm:col-span-5">
                  <button type="submit" className="btn-primary">{editingType ? 'Save room type' : 'Create room type'}</button>
                  <span className="muted ml-3">Changing the room count adds or removes physical rooms to match.</span>
                </div>
              </form>
            )}
            <div className="table-shell">
              <table>
                <thead><tr><th>Hotel</th><th>Type</th><th>Rate</th><th>Sleeps</th><th>Rooms</th><th /></tr></thead>
                <tbody>
                  {types.map((type) => (
                    <tr key={type.room_type_id}>
                      <td>{type.hotel_name}</td>
                      <td className="font-medium text-ink-900">{type.type_name}</td>
                      <td>{formatCurrency(type.base_price)}</td>
                      <td>{type.max_occupancy}</td>
                      <td>{type.total_rooms}</td>
                      <td>
                        <div className="flex justify-end gap-2">
                          <button type="button" className="btn-secondary btn-sm" onClick={() => setTypeForm(type)}>Edit</button>
                          <button type="button" className="btn-danger btn-sm" onClick={() => remove(`/api/admin/room-types?room_type_id=${type.room_type_id}`, `${type.hotel_name} ${type.type_name}`)}>Delete</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {tab === 'overbooking' && (
        <section className="mt-5">
          <p className="muted mb-3 max-w-3xl">
            The percentage sets a base buffer of FLOOR(rooms × % / 100) extra sellable rooms. The database then adjusts it
            night by night from the previous night’s occupancy (see Inventory plan).
          </p>
          <div className="table-shell">
            <table>
              <thead><tr><th>Hotel</th><th>Type</th><th>Rooms</th><th>Buffer %</th><th>Base buffer</th><th>Base sellable</th><th /></tr></thead>
              <tbody>
                {types.map((type) => {
                  const percent = Number(type.overbook_percentage);
                  const buffer = Math.floor((type.total_rooms * percent) / 100);
                  return (
                    <tr key={`${type.room_type_id}-${percent}`}>
                      <td>{type.hotel_name}</td>
                      <td className="font-medium text-ink-900">{type.type_name}</td>
                      <td>{type.total_rooms}</td>
                      <td>
                        <form id={`policy-${type.room_type_id}`} onSubmit={(event) => void savePolicy(type, event)}>
                          <input name="percent" type="number" min="0" max="50" step="0.01" defaultValue={percent} aria-label={`Buffer percent for ${type.type_name}`} className="input w-24" />
                        </form>
                      </td>
                      <td>{buffer}{buffer === 0 && percent > 0 && <span className="ml-1 text-xs text-accent-700">(rounds to 0)</span>}</td>
                      <td>{type.total_rooms + buffer}</td>
                      <td className="text-right"><button type="submit" form={`policy-${type.room_type_id}`} className="btn-primary btn-sm">Save</button></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {tab === 'amenities' && (
        <div className="mt-5">
          <AdminAmenitiesEditor hotels={hotels} roomTypes={types} />
        </div>
      )}

      {tab === 'inventory' && (
        <div className="mt-5">
          <AdminInventoryChart hotels={hotels} />
        </div>
      )}

      {tab === 'reports' && (
        <div className="mt-5 grid gap-6 xl:grid-cols-2">
          <section>
            <h2 className="mb-1 text-base">Bookings using the overbooking buffer</h2>
            <p className="muted mb-2">MariaDB · confirmed, stay not yet over</p>
            <div className="table-shell">
              <table>
                <thead><tr><th>#</th><th>Hotel</th><th>Type</th><th>Guest</th><th>Stay</th></tr></thead>
                <tbody>
                  {overbooked.map((row) => (
                    <tr key={row.booking_id}>
                      <td>{row.booking_id}</td>
                      <td>{row.hotel_name}</td>
                      <td>{row.type_name}</td>
                      <td>{row.first_name} {row.last_name}</td>
                      <td className="whitespace-nowrap">{formatDate(row.check_in_date)} to {formatDate(row.check_out_date)}</td>
                    </tr>
                  ))}
                  {!overbooked.length && <tr><td colSpan={5} className="text-ink-500">None right now.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
          <section>
            <h2 className="mb-1 text-base">Amenities by city</h2>
            <p className="muted mb-2">MongoDB aggregation · number of hotels offering each amenity</p>
            <div className="table-shell">
              <table>
                <thead><tr><th>City</th><th>Amenity</th><th>Hotels</th></tr></thead>
                <tbody>
                  {amenityReport.map((row) => (
                    <tr key={`${row.city}-${row.amenity}`}>
                      <td>{row.city}</td>
                      <td className="capitalize">{row.amenity}</td>
                      <td>{row.hotels_offering}</td>
                    </tr>
                  ))}
                  {!amenityReport.length && <tr><td colSpan={3} className="text-ink-500">No data.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
