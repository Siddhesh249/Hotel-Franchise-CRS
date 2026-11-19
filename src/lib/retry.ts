/**
 * The booking procedures report an unexpected database error (for example a
 * deadlock victim or lock wait timeout) as the outcome 'ERROR' after rolling
 * back, so retrying the whole call is safe.
 */
export async function retryOnError<T extends { status: string }>(attempt: () => Promise<T>, tries = 3): Promise<T> {
  let result = await attempt();
  for (let n = 1; n < tries && result.status === 'ERROR'; n += 1) {
    await new Promise((resolve) => setTimeout(resolve, 50 * n));
    result = await attempt();
  }
  return result;
}
