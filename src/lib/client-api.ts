/** fetch wrapper for the admin screens: JSON in/out, throws Error(message) on failure, redirects to login on 401. */
export async function api<T = unknown>(url: string, options?: { method?: string; body?: unknown }): Promise<T> {
  const response = await fetch(url, {
    method: options?.method,
    headers: options?.body !== undefined ? { 'Content-Type': 'application/json' } : undefined,
    body: options?.body !== undefined ? JSON.stringify(options.body) : undefined,
    cache: 'no-store',
  });
  if (response.status === 401) {
    // A full navigation is intended: it drops stale client state along with the expired session.
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign(`/login?callbackUrl=${encodeURIComponent(window.location.pathname)}`);
    throw new Error('Sign in is required.');
  }
  const data = await response.json().catch(() => null);
  if (!response.ok) throw new Error(data?.error?.message ?? 'Request failed');
  return data as T;
}
