'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { formatDateTime } from '@/lib/format';
import type { SimClock } from '@/types';

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

export function AdminClockPanel() {
  const [clock, setClock] = useState<SimClock | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [days, setDays] = useState('1');
  const [rate, setRate] = useState('60');
  const dirtyRef = useRef(false);

  const load = useCallback(async () => {
    try {
      const data = await api('/api/admin/clock') as SimClock;
      setClock(data);
      if (!dirtyRef.current) setRate(String(data.tick_minutes));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load the clock.');
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load(); }, 0);
    const poll = window.setInterval(() => { void load(); }, 3000);
    return () => {
      window.clearTimeout(timer);
      window.clearInterval(poll);
    };
  }, [load]);

  async function act(action: string, extra: Record<string, unknown> = {}, message = 'Clock updated.') {
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const data = await api('/api/admin/clock', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      }) as SimClock;
      setClock(data);
      setRate(String(data.tick_minutes));
      dirtyRef.current = false;
      setNotice(message);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update the clock.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <section className="relative overflow-hidden rounded-3xl bg-ink-950 p-7 text-white">
          <div className="absolute inset-0 opacity-20 [background-image:radial-gradient(circle_at_20%_20%,#38cba7,transparent_35%),radial-gradient(circle_at_80%_70%,#f5b027,transparent_30%)]" />
          <div className="relative">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold tracking-[0.18em] text-ink-200 uppercase">Virtual now</p>
              <span className={`badge ${clock?.is_running ? 'bg-brand-500/20 text-brand-200' : 'bg-white/10 text-ink-200'}`}>
                <span className={`size-1.5 rounded-full ${clock?.is_running ? 'bg-brand-300' : 'bg-ink-300'}`} />
                {clock?.is_running ? 'Running' : 'Paused'}
              </span>
            </div>
            <p className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              {clock ? formatDateTime(clock.virtual_now) : 'Loading…'}
            </p>
            <p className="mt-2 text-sm text-ink-200">
              {clock ? `${clock.tick_minutes} virtual minutes per real second` : 'Reading sim_clock…'}
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              <button
                type="button"
                disabled={busy || !clock}
                onClick={() => void act(clock?.is_running ? 'pause' : 'resume', {}, clock?.is_running ? 'Clock paused.' : 'Clock resumed.')}
                className="btn-primary bg-white text-ink-900 hover:bg-ink-100"
              >
                <Icon name={clock?.is_running ? 'clock' : 'refresh'} size={16} />
                {clock?.is_running ? 'Pause clock' : 'Resume clock'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void act('reset', {}, 'Virtual time reset to the real clock.')}
                className="btn-secondary border-white/20 bg-white/10 text-white hover:bg-white/15"
              >
                Reset to now
              </button>
            </div>
          </div>
        </section>

        <section className="card p-6">
          <h2 className="text-lg font-semibold">How this works</h2>
          <ul className="mt-3 space-y-3 text-sm text-ink-600">
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
              The clock is a single row in <code className="rounded bg-sand-100 px-1 py-0.5 font-mono text-xs">sim_clock</code>. The
              MariaDB event <code className="rounded bg-sand-100 px-1 py-0.5 font-mono text-xs">evt_clock_tick</code> advances it.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
              It starts paused so booking dates are stable. Resume it for a live demo or to drive the simulation engine.
            </li>
            <li className="flex gap-2.5">
              <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-brand-500" />
              Audit timestamps (when a booking was recorded) stay on the real wall clock; only business date logic uses virtual time.
            </li>
          </ul>
        </section>
      </div>

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

      <div className="grid gap-5 sm:grid-cols-2">
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act('fast-forward', { days: Number(days) }, `Virtual time moved by ${days} day(s).`);
          }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold">Fast-forward</h2>
          <p className="muted mt-1">Jump the calendar forward or backward without waiting for the event tick.</p>
          <label className="mt-4 block">
            <span className="label">Days</span>
            <input type="number" min="-3650" max="3650" value={days} onChange={(event) => setDays(event.target.value)} className="input" />
          </label>
          <button type="submit" disabled={busy} className="btn-primary mt-4 w-full">
            <Icon name="arrow-right" size={16} />
            Move time
          </button>
        </form>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void act('set-rate', { tick_minutes: Number(rate) }, `Tick rate set to ${rate} virtual minutes per second.`);
          }}
          className="card p-6"
        >
          <h2 className="text-lg font-semibold">Tick rate</h2>
          <p className="muted mt-1">How many virtual minutes pass for each real second while the clock is running.</p>
          <label className="mt-4 block">
            <span className="label">Virtual minutes / real second</span>
            <input type="number" min="1" max="10080" value={rate} onChange={(event) => { dirtyRef.current = true; setRate(event.target.value); }} className="input" />
          </label>
          <button type="submit" disabled={busy} className="btn-secondary mt-4 w-full">
            Save rate
          </button>
        </form>
      </div>
    </div>
  );
}
