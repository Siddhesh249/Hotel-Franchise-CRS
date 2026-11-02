'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Icon } from '@/components/icons';

type HotelOption = { hotel_id: number; hotel_name: string };
type RoomTypeOption = { room_type_id: number; hotel_id: number; type_name: string };
type FeatureRow = { key: string; value: string };
type PolicyRow = { key: string; value: string };

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((item) => String(item)).filter(Boolean) : [];
}

function scalarString(value: unknown): string {
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value === null || value === undefined) return '';
  return String(value);
}

function parseScalar(value: string): string | boolean {
  const trimmed = value.trim();
  if (trimmed.toLowerCase() === 'true') return true;
  if (trimmed.toLowerCase() === 'false') return false;
  return trimmed;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function AdminAmenitiesEditor({
  hotels,
  roomTypes,
}: {
  hotels: HotelOption[];
  roomTypes: RoomTypeOption[];
}) {
  const [hotelId, setHotelId] = useState(String(hotels[0]?.hotel_id ?? ''));
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const [general, setGeneral] = useState<string[]>([]);
  const [wellness, setWellness] = useState<string[]>([]);
  const [generalInput, setGeneralInput] = useState('');
  const [wellnessInput, setWellnessInput] = useState('');
  const [petFriendly, setPetFriendly] = useState(false);
  const [checkInTime, setCheckInTime] = useState('');
  const [checkOutTime, setCheckOutTime] = useState('');
  const [policies, setPolicies] = useState<PolicyRow[]>([]);
  const [features, setFeatures] = useState<Record<string, FeatureRow[]>>({});

  const hotelRoomTypes = useMemo(
    () => roomTypes.filter((type) => String(type.hotel_id) === hotelId),
    [roomTypes, hotelId],
  );

  const loadFeatures = useCallback(async (id: string) => {
    try {
      const response = await fetch(`/api/admin/hotels/${id}/features`, { cache: 'no-store' });
      if (response.status === 401) {
        window.location.href = new URL('/login?callbackUrl=/admin', window.location.origin).href;
        return;
      }
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message ?? 'Unable to load amenities.');
        return;
      }
      const amenities = isRecord(data?.amenities) ? data.amenities : {};
      const policyObject = isRecord(amenities.policies) ? amenities.policies : {};
      setGeneral(stringList(amenities.general));
      setWellness(stringList(amenities.wellness));
      setPetFriendly(policyObject.pet_friendly === true);
      setCheckInTime(scalarString(policyObject.check_in_time));
      setCheckOutTime(scalarString(policyObject.check_out_time));
      setPolicies(
        Object.entries(policyObject)
          .filter(([key]) => !['pet_friendly', 'check_in_time', 'check_out_time'].includes(key))
          .map(([key, value]) => ({ key, value: scalarString(value) })),
      );

      const featureObject = isRecord(data?.room_type_features) ? data.room_type_features : {};
      const nextFeatures: Record<string, FeatureRow[]> = {};
      for (const [typeName, value] of Object.entries(featureObject)) {
        if (!isRecord(value)) continue;
        nextFeatures[typeName] = Object.entries(value).map(([key, featureValue]) => ({
          key,
          value: scalarString(featureValue),
        }));
      }
      setFeatures(nextFeatures);
    } catch {
      setError('Unable to load amenities. Is MongoDB running?');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Fetching on hotel change is intentionally an effect; state updates happen
    // after the async request resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (hotelId) void loadFeatures(hotelId);
  }, [hotelId, loadFeatures]);

  function addChip(kind: 'general' | 'wellness') {
    const value = (kind === 'general' ? generalInput : wellnessInput).trim();
    if (!value) return;
    if (kind === 'general') {
      setGeneral((current) => [...new Set([...current, value])]);
      setGeneralInput('');
    } else {
      setWellness((current) => [...new Set([...current, value])]);
      setWellnessInput('');
    }
  }

  function updateFeature(typeName: string, index: number, key: 'key' | 'value', value: string) {
    setFeatures((current) => {
      const rows = [...(current[typeName] ?? [])];
      rows[index] = { ...rows[index], [key]: value };
      return { ...current, [typeName]: rows };
    });
  }

  function addFeature(typeName: string) {
    setFeatures((current) => ({
      ...current,
      [typeName]: [...(current[typeName] ?? []), { key: '', value: '' }],
    }));
  }

  function removeFeature(typeName: string, index: number) {
    setFeatures((current) => ({
      ...current,
      [typeName]: (current[typeName] ?? []).filter((_, rowIndex) => rowIndex !== index),
    }));
  }

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const policyObject: Record<string, string | boolean> = { pet_friendly: petFriendly };
      if (checkInTime.trim()) policyObject.check_in_time = checkInTime.trim();
      if (checkOutTime.trim()) policyObject.check_out_time = checkOutTime.trim();
      for (const row of policies) {
        if (row.key.trim()) policyObject[row.key.trim()] = parseScalar(row.value);
      }

      const featureObject: Record<string, Record<string, string | boolean>> = {};
      for (const [typeName, rows] of Object.entries(features)) {
        const cleaned: Record<string, string | boolean> = {};
        for (const row of rows) {
          if (row.key.trim()) cleaned[row.key.trim()] = parseScalar(row.value);
        }
        if (Object.keys(cleaned).length) featureObject[typeName] = cleaned;
      }

      const response = await fetch(`/api/admin/hotels/${hotelId}/features`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amenities: {
            general,
            wellness,
            policies: policyObject,
          },
          room_type_features: featureObject,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error?.message ?? 'Unable to save amenities.');
        return;
      }
      setNotice('Amenities and room-type features saved.');
    } catch {
      setError('Unable to save amenities. Is MongoDB running?');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="grid gap-5 xl:grid-cols-[1fr_320px]">
      <section className="card p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-xl font-semibold tracking-tight">Amenities & room features</h2>
            <p className="muted mt-1">Structured editor backed by the flexible MongoDB document.</p>
          </div>
          <button
            type="button"
            className="btn-ghost btn-sm"
            onClick={() => { setError(''); setNotice(''); setLoading(true); void loadFeatures(hotelId); }}
            disabled={!hotelId || loading}
          >
            <Icon name="refresh" size={14} />
            Reload
          </button>
        </div>

        <label className="mt-4 block">
          <span className="label">Hotel</span>
          <select
            value={hotelId}
            onChange={(event) => {
              setHotelId(event.target.value);
              setLoading(true);
              setError('');
              setNotice('');
            }}
            className="input"
          >
            {hotels.map((hotel) => (
              <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>
            ))}
          </select>
        </label>

        {loading ? (
          <div className="mt-5 space-y-3">
            <div className="skeleton h-24" />
            <div className="skeleton h-24" />
            <div className="skeleton h-40" />
          </div>
        ) : (
          <div className="mt-5 space-y-6">
            <div>
              <h3 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">General amenities</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {general.length ? general.map((item) => (
                  <span key={item} className="badge-slate capitalize">
                    {item}
                    <button
                      type="button"
                      aria-label={`Remove ${item}`}
                      onClick={() => setGeneral((current) => current.filter((value) => value !== item))}
                      className="ml-1 rounded-full p-0.5 text-ink-400 hover:bg-ink-200 hover:text-ink-800"
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                )) : <p className="muted">No general amenities yet.</p>}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={generalInput}
                  onChange={(event) => setGeneralInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addChip('general');
                    }
                  }}
                  placeholder="e.g. free wifi"
                  className="input"
                />
                <button type="button" onClick={() => addChip('general')} className="btn-secondary shrink-0">
                  <Icon name="plus" size={14} />
                  Add
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Wellness amenities</h3>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {wellness.length ? wellness.map((item) => (
                  <span key={item} className="badge-brand capitalize">
                    {item}
                    <button
                      type="button"
                      aria-label={`Remove ${item}`}
                      onClick={() => setWellness((current) => current.filter((value) => value !== item))}
                      className="ml-1 rounded-full p-0.5 text-brand-600 hover:bg-brand-200"
                    >
                      <Icon name="x" size={10} />
                    </button>
                  </span>
                )) : <p className="muted">No wellness amenities yet.</p>}
              </div>
              <div className="mt-2 flex gap-2">
                <input
                  value={wellnessInput}
                  onChange={(event) => setWellnessInput(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      addChip('wellness');
                    }
                  }}
                  placeholder="e.g. pool"
                  className="input"
                />
                <button type="button" onClick={() => addChip('wellness')} className="btn-secondary shrink-0">
                  <Icon name="plus" size={14} />
                  Add
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Policies</h3>
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <label className="flex items-center gap-2 rounded-xl border border-ink-200 px-3 py-2.5 text-sm">
                  <input
                    type="checkbox"
                    checked={petFriendly}
                    onChange={(event) => setPetFriendly(event.target.checked)}
                    className="size-4 rounded border-ink-300 accent-brand-700"
                  />
                  Pet friendly
                </label>
                <label>
                  <span className="label">Check-in time</span>
                  <input type="time" value={checkInTime} onChange={(event) => setCheckInTime(event.target.value)} className="input" />
                </label>
                <label>
                  <span className="label">Check-out time</span>
                  <input type="time" value={checkOutTime} onChange={(event) => setCheckOutTime(event.target.value)} className="input" />
                </label>
              </div>

              <div className="mt-3 space-y-2">
                {policies.map((policy, index) => (
                  <div key={index} className="flex gap-2">
                    <input
                      value={policy.key}
                      onChange={(event) => setPolicies((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, key: event.target.value } : row))}
                      placeholder="Policy key"
                      className="input"
                    />
                    <input
                      value={policy.value}
                      onChange={(event) => setPolicies((current) => current.map((row, rowIndex) => rowIndex === index ? { ...row, value: event.target.value } : row))}
                      placeholder="Value"
                      className="input"
                    />
                    <button
                      type="button"
                      onClick={() => setPolicies((current) => current.filter((_, rowIndex) => rowIndex !== index))}
                      className="btn-danger shrink-0"
                      aria-label="Remove policy"
                    >
                      <Icon name="trash" size={14} />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setPolicies((current) => [...current, { key: '', value: '' }])}
                  className="btn-secondary btn-sm"
                >
                  <Icon name="plus" size={13} />
                  Add policy
                </button>
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Room-type features</h3>
              <p className="muted mt-1">
                Feature values can be text or <code className="font-mono text-xs">true</code>/<code className="font-mono text-xs">false</code>.
              </p>
              <div className="mt-3 space-y-3">
                {hotelRoomTypes.length ? hotelRoomTypes.map((type) => {
                  const rows = features[type.type_name] ?? [];
                  return (
                    <div key={type.room_type_id} className="rounded-xl border border-ink-100 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-ink-900">{type.type_name}</p>
                        <button type="button" onClick={() => addFeature(type.type_name)} className="btn-ghost btn-sm">
                          <Icon name="plus" size={12} />
                          Add feature
                        </button>
                      </div>
                      {rows.length ? (
                        <div className="mt-2 space-y-2">
                          {rows.map((row, index) => (
                            <div key={index} className="flex gap-2">
                              <input
                                value={row.key}
                                onChange={(event) => updateFeature(type.type_name, index, 'key', event.target.value)}
                                placeholder="Feature (e.g. ac)"
                                className="input"
                              />
                              <input
                                value={row.value}
                                onChange={(event) => updateFeature(type.type_name, index, 'value', event.target.value)}
                                placeholder="Value (e.g. true / 43 inch)"
                                className="input"
                              />
                              <button
                                type="button"
                                onClick={() => removeFeature(type.type_name, index)}
                                className="btn-danger shrink-0"
                                aria-label="Remove feature"
                              >
                                <Icon name="trash" size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="muted mt-2">No features for this room type.</p>
                      )}
                    </div>
                  );
                }) : <p className="muted">This hotel has no room types yet.</p>}
              </div>
            </div>
          </div>
        )}

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

        <button type="button" onClick={() => void save()} disabled={saving || loading || !hotelId} className="btn-primary mt-5">
          {saving ? 'Saving…' : 'Save amenities'}
        </button>
      </section>

      <aside className="card-muted h-fit p-5 text-sm text-ink-700">
        <h3 className="font-semibold text-ink-900">What gets stored</h3>
        <p className="muted mt-2">
          Each hotel has one MongoDB document. Amenity chips are arrays; policies and room features are
          flexible key/value data. You never need to edit JSON by hand.
        </p>
        <dl className="mt-4 space-y-2">
          <div><dt className="font-semibold text-ink-800">General</dt><dd className="text-ink-500">Chips shown on the public hotel page.</dd></div>
          <div><dt className="font-semibold text-ink-800">Wellness</dt><dd className="text-ink-500">Pool, gym, spa, and similar facilities.</dd></div>
          <div><dt className="font-semibold text-ink-800">Policies</dt><dd className="text-ink-500">Pet policy, check-in/out times, and custom rules.</dd></div>
          <div><dt className="font-semibold text-ink-800">Room-type features</dt><dd className="text-ink-500">Per-category details such as AC, TV size, or balcony.</dd></div>
        </dl>
      </aside>
    </div>
  );
}
