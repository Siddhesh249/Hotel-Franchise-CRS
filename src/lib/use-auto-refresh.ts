import { useEffect, useRef } from 'react';

/**
 * Calls `callback` every `intervalMs` while the tab is visible, and again when
 * the tab regains focus. Screens that show shared data (the front desk, a
 * guest's bookings) use it so they never sit on a stale snapshot.
 */
export function useAutoRefresh(callback: () => void, intervalMs: number) {
  const latest = useRef(callback);
  useEffect(() => {
    latest.current = callback;
  });

  useEffect(() => {
    const run = () => {
      if (document.visibilityState === 'visible') latest.current();
    };
    const timer = window.setInterval(run, intervalMs);
    document.addEventListener('visibilitychange', run);
    window.addEventListener('focus', run);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', run);
      window.removeEventListener('focus', run);
    };
  }, [intervalMs]);
}
