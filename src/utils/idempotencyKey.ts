/**
 * One key per checkout/order-creation *attempt* - callers must generate it
 * once before the request and reuse the same value across the request
 * wrapper's own network-failure retries, so a retry after a lost response is
 * recognized server-side as the same attempt instead of creating a duplicate.
 */
export function generateIdempotencyKey(): string {
  const rand = Math.random().toString(36).slice(2, 12);
  return `${Date.now().toString(36)}-${rand}`;
}
