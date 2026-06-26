/**
 * Mock API helper — simulates network latency and optional errors.
 * When real backend is ready, replace mockRequest() with real HTTP calls.
 * All service files use this helper — only this file needs to change.
 */

const BASE_DELAY_MS = 400;
const JITTER_MS = 200;

/** Toggle to true to randomly simulate network errors (for testing error states) */
const SIMULATE_ERRORS = false;
const ERROR_RATE = 0.1; // 10% chance of error when SIMULATE_ERRORS is true

export function mockDelay(customMs?: number): Promise<void> {
  const delay = customMs ?? BASE_DELAY_MS + Math.random() * JITTER_MS;
  return new Promise((resolve) => setTimeout(resolve, delay));
}

export async function mockRequest<T>(
  fn: () => T,
  options?: { delay?: number; errorRate?: number }
): Promise<T> {
  await mockDelay(options?.delay);

  if (SIMULATE_ERRORS && Math.random() < (options?.errorRate ?? ERROR_RATE)) {
    throw new Error("Network error. Please check your connection and try again.");
  }

  return fn();
}
