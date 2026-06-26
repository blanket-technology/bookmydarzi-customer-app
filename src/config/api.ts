/**
 * Single source of truth for API origin (host + port, no trailing slash).
 * Override at build/runtime with EXPO_PUBLIC_API_URL in .env
 */
export const API_BASE_URL = "http://192.168.1.43:8000";

/** Path prefix for all v1 REST endpoints */
export const API_V1_PATH = "/api/v1";

/** Resolved origin — env wins over default */
export function resolveApiOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL?.trim();
  const raw = fromEnv || API_BASE_URL;
  return raw.replace(/\/+$/, "");
}

/** Full v1 base URL, e.g. http://192.168.1.17:8000/api/v1 */
export function getApiV1BaseUrl(): string {
  return `${resolveApiOrigin()}${API_V1_PATH}`;
}

/** Build `{origin}/api/v1/{endpoint}` from a relative path */
export function buildApiV1Url(endpoint: string): string {
  let ep = endpoint.trim().replace(/\/+/g, "/");
  if (!ep.startsWith("/")) ep = `/${ep}`;
  ep = ep.replace(/^\/api\/v1(?=\/|$)/i, "");
  if (!ep.startsWith("/")) ep = `/${ep}`;
  return `${resolveApiOrigin()}${API_V1_PATH}${ep}`;
}

console.log("API_BASE_URL:", API_BASE_URL);
