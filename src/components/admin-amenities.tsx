'use client';

import { useEffect, useState } from 'react';
import { Alert } from '@/components/ui';
import { api } from '@/lib/client-api';

type Pair = { key: string; value: string };
type Doc = {
  amenities?: { general?: unknown; wellness?: unknown; policies?: Record<string, unknown> };
  room_type_features?: Record<string, Record<string, unknown>>;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const list = (value: unknown) => (Array.isArray(value) ? value.map(String).join(', ') : '');
const toPairs = (value: unknown): Pair[] => (isRecord(value) ? Object.entries(value).map(([key, v]) => ({ key, value: String(v) })) : []);

/** "true"/"false" and plain numbers become real booleans/numbers; everything else stays text. */
function parseValue(value: string): string | number | boolean {
  const text = value.trim();
  if (text === 'true') return true;
  if (text === 'false') return false;
  return text !== '' && !Number.isNaN(Number(text)) ? Number(text) : text;
}
const toObject = (pairs: Pair[]) =>
  Object.fromEntries(pairs.filter((pair) => pair.key.trim()).map((pair) => [pair.key.trim(), parseValue(pair.value)]));
const toList = (text: string) => [...new Set(text.split(',').map((item) => item.trim().toLowerCase()).filter(Boolean))];

function PairEditor({ title, pairs, onChange }: { title: string; pairs: Pair[]; onChange: (pairs: Pair[]) => void }) {
  const update = (index: number, patch: Partial<Pair>) => onChange(pairs.map((pair, i) => (i === index ? { ...pair, ...patch } : pair)));
  return (
    <div>
      <p className="label">{title}</p>
      <div className="space-y-2">
        {pairs.map((pair, index) => (
          <div key={index} className="flex gap-2">
            <input value={pair.key} onChange={(e) => update(index, { key: e.target.value })} placeholder="name" aria-label="Key" className="input" />
            <input value={pair.value} onChange={(e) => update(index, { value: e.target.value })} placeholder="value" aria-label="Value" className="input" />
            <button type="button" className="btn-secondary btn-sm" onClick={() => onChange(pairs.filter((_, i) => i !== index))} aria-label="Remove">×</button>
          </div>
        ))}
        <button type="button" className="btn-secondary btn-sm" onClick={() => onChange([...pairs, { key: '', value: '' }])}>Add</button>
      </div>
    </div>
  );
}

export function AdminAmenitiesEditor({
  hotels,
  roomTypes,
}: {
  hotels: Array<{ hotel_id: number; hotel_name: string }>;
  roomTypes: Array<{ hotel_id: number; type_name: string }>;
}) {
  const [hotelId, setHotelId] = useState(String(hotels[0]?.hotel_id ?? ''));
  const [loaded, setLoaded] = useState<string | null>(null);
  const [general, setGeneral] = useState('');
  const [wellness, setWellness] = useState('');
  const [policies, setPolicies] = useState<Pair[]>([]);
  const [features, setFeatures] = useState<Record<string, Pair[]>>({});
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!hotelId) return;
    let cancelled = false;
    api<Doc>(`/api/admin/hotels/${hotelId}/features`)
      .then((doc) => {
        if (cancelled) return;
        setGeneral(list(doc.amenities?.general));
        setWellness(list(doc.amenities?.wellness));
        setPolicies(toPairs(doc.amenities?.policies));
        setFeatures(Object.fromEntries(Object.entries(doc.room_type_features ?? {}).map(([name, value]) => [name, toPairs(value)])));
        setError('');
        setLoaded(hotelId);
      })
      .catch((err: Error) => !cancelled && setError(err.message));
    return () => { cancelled = true; };
  }, [hotelId]);

  async function save() {
    setSaving(true);
    setError('');
    setNotice('');
    try {
      await api(`/api/admin/hotels/${hotelId}/features`, {
        method: 'PUT',
        body: {
          amenities: { general: toList(general), wellness: toList(wellness), policies: toObject(policies) },
          room_type_features: Object.fromEntries(
            Object.entries(features).map(([name, pairs]) => [name, toObject(pairs)]).filter(([, value]) => Object.keys(value as object).length),
          ),
        },
      });
      setNotice('Saved to MongoDB.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save.');
    } finally {
      setSaving(false);
    }
  }

  const types = roomTypes.filter((type) => String(type.hotel_id) === hotelId).map((type) => type.type_name);
  const ready = loaded === hotelId;

  return (
    <div className="space-y-4">
      <p className="muted max-w-3xl">
        Amenities live in MongoDB as one document per hotel. Lists are comma separated; policies and room features are
        free-form name/value pairs, so each hotel can describe itself differently.
      </p>
      <select value={hotelId} onChange={(e) => { setHotelId(e.target.value); setLoaded(null); setNotice(''); }} aria-label="Hotel" className="input w-72">
        {hotels.map((hotel) => <option key={hotel.hotel_id} value={hotel.hotel_id}>{hotel.hotel_name}</option>)}
      </select>
      {error && <Alert tone="error">{error}</Alert>}
      {notice && <Alert>{notice}</Alert>}

      {ready ? (
        <div className="card animate-fade space-y-5 p-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <label><span className="label">General amenities</span><input value={general} onChange={(e) => setGeneral(e.target.value)} placeholder="free wifi, parking" className="input" /></label>
            <label><span className="label">Wellness</span><input value={wellness} onChange={(e) => setWellness(e.target.value)} placeholder="gym, pool" className="input" /></label>
          </div>
          <PairEditor title="Policies" pairs={policies} onChange={setPolicies} />
          {types.map((name) => (
            <PairEditor key={name} title={`${name} room features`} pairs={features[name] ?? []} onChange={(pairs) => setFeatures((current) => ({ ...current, [name]: pairs }))} />
          ))}
          <button type="button" className="btn-primary" disabled={saving} onClick={() => void save()}>{saving ? 'Saving…' : 'Save amenities'}</button>
        </div>
      ) : !error && <div className="skeleton h-48" />}
    </div>
  );
}
