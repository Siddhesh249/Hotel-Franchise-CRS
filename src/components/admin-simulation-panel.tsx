'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';

type Archetype = {
  name: string;
  roomTypePreference: string;
  stayNights: number[];
  numGuests: number;
  cancelProbability: number;
};

type Simulation = {
  running: boolean;
  bookings_per_virtual_hour: number;
  archetypes: Archetype[];
  last_error: string | null;
};

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

export function AdminSimulationPanel() {
  const [sim, setSim] = useState<Simulation | null>(null);
  const [json, setJson] = useState('[]');
  const [rate, setRate] = useState('2');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const dirtyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/admin/simulation') as Simulation;
      setSim(data);
      if (!dirtyRef.current) {
        setJson(JSON.stringify(data.archetypes, null, 2));
        setRate(String(data.bookings_per_virtual_hour));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the simulation engine.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 4000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [load]);

  async function action(name: string, extra: Record<string, unknown> = {}, message = 'Simulation updated.') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await api('/api/admin/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: name, ...extra }),
      });
      if (data && typeof data === 'object' && 'running' in data) {
        const next = data as Simulation;
        setSim(next);
        setJson(JSON.stringify(next.archetypes, null, 2));
        setRate(String(next.bookings_per_virtual_hour));
        dirtyRef.current = false;
      }
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'The simulation action failed.');
    } finally {
      setBusy(false);
    }
  }

  async function spawn(name: string) {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await api('/api/admin/simulation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'spawn-one', archetype_name: name }),
      }) as { booking_id: number; status: string; archetype: string };
      setNotice(`Spawned a “${data.archetype}” booking #${data.booking_id} with status ${data.status}.`);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to spawn a booking.');
    } finally {
      setBusy(false);
    }
  }

  async function saveArchetypes() {
    let parsed: unknown;
    try {
      parsed = JSON.parse(json);
    } catch {
      setError('Archetypes must be valid JSON.');
      return;
    }
    await action('set-archetypes', { archetypes: parsed }, 'Archetypes saved.');
  }

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-white">
        <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,#38cba7,transparent_35%),radial-gradient(circle_at_80%_70%,#f5b027,transparent_30%)]" />
        <div className="relative flex flex-wrap items-end justify-between gap-5">
          <div>
            <p className="text-xs font-bold tracking-[0.18em] text-ink-200 uppercase">Simulation engine</p>
            <h2 className="mt-2 text-2xl font-semibold text-white">
              {sim?.running ? 'Running synthetic traffic' : 'Engine stopped'}
            </h2>
            <p className="mt-2 max-w-xl text-sm text-ink-200">
              Synthetic guests call the same <code className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">sp_create_booking</code> and
              <code className="ml-1 rounded bg-white/10 px-1.5 py-0.5 font-mono text-xs">sp_cancel_booking</code> procedures as real guests.
              The engine follows virtual time — resume the clock on <b>Virtual clock</b> if it is paused.
            </p>
            {sim?.last_error && (
              <p className="mt-3 rounded-lg border border-rose-400/40 bg-rose-500/15 px-3 py-2 text-xs text-rose-100">
                Last cycle error: {sim.last_error}
              </p>
            )}
          </div>
          <button
            type="button"
            disabled={busy || !sim}
            onClick={() => void action(sim?.running ? 'stop' : 'start', {}, sim?.running ? 'Simulation stopped.' : 'Simulation started.')}
            className="btn-primary bg-white text-ink-900 hover:bg-ink-100"
          >
            <Icon name={sim?.running ? 'x' : 'sparkles'} size={16} />
            {sim?.running ? 'Stop simulation' : 'Start simulation'}
          </button>
        </div>
      </section>

      {notice && (
        <div className="flex gap-2 rounded-xl border border-brand-200 bg-brand-50 p-3 text-sm text-brand-900">
          <Icon name="check" size={16} className="mt-0.5 shrink-0" />
          <p>{notice}</p>
        </div>
      )}
      {error && (
        <div className="flex gap-2 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">
          <Icon name="alert" size={16} className="mt-0.5 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1fr_340px]">
        <section className="card p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">Client archetypes</h2>
              <p className="muted mt-1">Each archetype describes the kind of synthetic guest the engine creates.</p>
            </div>
            <button
              type="button"
              disabled={busy}
              onClick={() => void action('restore-defaults', {}, 'Default archetypes restored.')}
              className="btn-ghost btn-sm"
            >
              Restore defaults
            </button>
          </div>
          <label className="mt-4 block">
            <span className="label">Archetypes JSON</span>
            <textarea
              value={json}
              onChange={(event) => {
                dirtyRef.current = true;
                setJson(event.target.value);
              }}
              spellCheck={false}
              className="input min-h-72 font-mono text-xs"
            />
          </label>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" disabled={busy} onClick={() => void saveArchetypes()} className="btn-primary">
              Save archetypes
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                try {
                  setJson(JSON.stringify(JSON.parse(json), null, 2));
                  setError('');
                } catch {
                  setError('That is not valid JSON.');
                }
              }}
            >
              Format JSON
            </button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <form
              onSubmit={(event) => {
                event.preventDefault();
                void action('set-spawn-rate', { bookings_per_virtual_hour: Number(rate) }, `Spawn rate set to ${rate} per virtual hour.`);
              }}
              className="rounded-xl border border-ink-100 p-4"
            >
              <label>
                <span className="label">Bookings per virtual hour</span>
                <input type="number" min="0" max="1000" value={rate} onChange={(event) => { dirtyRef.current = true; setRate(event.target.value); }} className="input" />
              </label>
              <button type="submit" disabled={busy} className="btn-secondary mt-3 w-full">Save rate</button>
            </form>
            <div className="rounded-xl border border-ink-100 p-4">
              <p className="label">Spawn one booking now</p>
              <div className="flex flex-wrap gap-2">
                {(sim?.archetypes ?? []).map((archetype) => (
                  <button
                    key={archetype.name}
                    type="button"
                    disabled={busy}
                    onClick={() => void spawn(archetype.name)}
                    className="btn-secondary btn-sm"
                  >
                    <Icon name="plus" size={13} />
                    {archetype.name}
                  </button>
                ))}
                {!sim?.archetypes?.length && <p className="muted">No archetypes configured.</p>}
              </div>
            </div>
          </div>
        </section>

        <aside className="space-y-5">
          <section className="card p-5">
            <h2 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Archetype fields</h2>
            <ul className="mt-3 space-y-2 text-sm text-ink-600">
              <li><code className="font-mono text-xs text-ink-900">name</code> — unique label</li>
              <li><code className="font-mono text-xs text-ink-900">roomTypePreference</code> — e.g. Standard</li>
              <li><code className="font-mono text-xs text-ink-900">stayNights</code> — array of 1–30</li>
              <li><code className="font-mono text-xs text-ink-900">numGuests</code> — 1–20</li>
              <li><code className="font-mono text-xs text-ink-900">cancelProbability</code> — 0 to 1</li>
            </ul>
          </section>

          <section className="card-muted p-5">
            <h2 className="text-sm font-bold tracking-[0.14em] text-ink-500 uppercase">Danger zone</h2>
            <p className="muted mt-2">
              Cancels every active synthetic booking, then deletes all synthetic guests. Real guest data is never touched.
            </p>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Cancel and delete all synthetic bookings and guests?')) {
                  void action('clear-synthetic', {}, 'Synthetic data cleared.');
                }
              }}
              className="btn-danger mt-4 w-full"
            >
              <Icon name="trash" size={16} />
              Clear synthetic data
            </button>
          </section>
        </aside>
      </div>
    </div>
  );
}
