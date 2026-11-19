import type { HotelFeatures } from '@/types';

const label = (key: string) => key.replace(/_/g, ' ');
const show = (value: unknown) => (typeof value === 'boolean' ? (value ? 'yes' : 'no') : String(value));

/** Amenity lists and policies from the hotel's MongoDB document. */
export function Amenities({ features }: { features: HotelFeatures | null }) {
  const general = features?.amenities?.general ?? [];
  const wellness = features?.amenities?.wellness ?? [];
  const policies = Object.entries(features?.amenities?.policies ?? {});
  if (!general.length && !wellness.length && !policies.length) {
    return <p className="muted">No amenity details have been published for this hotel.</p>;
  }
  return (
    <div className="space-y-4 text-sm">
      {[['General', general], ['Wellness', wellness]].map(([title, items]) =>
        (items as string[]).length ? (
          <div key={title as string}>
            <p className="eyebrow">{title as string}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              {(items as string[]).map((item) => <span key={item} className="badge-slate capitalize">{item}</span>)}
            </div>
          </div>
        ) : null,
      )}
      {policies.length > 0 && (
        <div>
          <p className="eyebrow">Policies</p>
          <dl className="mt-1.5 space-y-1">
            {policies.map(([key, value]) => (
              <div key={key} className="flex justify-between gap-3">
                <dt className="text-ink-600 capitalize">{label(key)}</dt>
                <dd className="text-ink-900 capitalize">{show(value)}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}

/** Per-room-type features (also from MongoDB), as small badges. */
export function RoomFeatures({ features }: { features?: Record<string, unknown> }) {
  const entries = Object.entries(features ?? {});
  if (!entries.length) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {entries.map(([key, value]) => (
        <span key={key} className="badge-slate capitalize">
          {typeof value === 'boolean' ? label(key) : `${label(key)}: ${show(value)}`}
        </span>
      ))}
    </div>
  );
}
