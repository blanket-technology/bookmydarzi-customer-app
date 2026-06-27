import * as SecureStore from "expo-secure-store";

import {
  API_BASE_URL,
  API_V1_PATH,
  resolveApiOrigin,
  getApiV1BaseUrl,
} from "../src/config/api";
import { useToastStore } from "../src/store/useToastStore";

// Re-export config — single source of truth for API origin
export {
  API_BASE_URL,
  API_V1_PATH,
  resolveApiOrigin,
  buildApiV1Url,
  getApiV1BaseUrl,
} from "../src/config/api";

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Path prefix included in every `request()` / `authRequest()` URL */
export const API_V1_PREFIX = API_V1_PATH;

/** Resolved API origin used for all requests (no trailing slash). */
export const API_HOST = resolveApiOrigin();

console.log("API resolved origin:", API_HOST);

/** Request timeout in milliseconds */
const TIMEOUT_MS = 40_000;

/** Max automatic retries on transient network/timeout errors */
const MAX_RETRIES = 2;

/** Runtime connectivity snapshot — for audits and dev logs */
export function getApiConnectivityConfig() {
  return {
    apiHost: API_HOST,
    apiBaseUrl: getApiV1BaseUrl(),
    envApiUrl: process.env.EXPO_PUBLIC_API_URL ?? "(not set)",
    timeoutMs: TIMEOUT_MS,
    defaultBaseUrl: API_BASE_URL,
  };
}

let _apiConfigLogged = false;

function logApiConfigOnce(): void {
  if (_apiConfigLogged) return;
  _apiConfigLogged = true;
  const cfg = getApiConnectivityConfig();
  console.log(
    "[API:config] Runtime connectivity configuration:",
    JSON.stringify(cfg),
  );
}

function truncateForLog(value: unknown, max = 600): string {
  try {
    const text = typeof value === "string" ? value : JSON.stringify(value);
    if (!text) return "(empty)";
    return text.length > max ? `${text.slice(0, max)}…` : text;
  } catch {
    return "(unserializable)";
  }
}

function headersForLog(
  headers: Record<string, string>,
): Record<string, string> {
  const out: Record<string, string> = { ...headers };
  if (out.Authorization) {
    out.Authorization = `Bearer ${maskToken(out.Authorization.replace(/^Bearer\s+/i, ""))}`;
  }
  return out;
}

/**
 * Ensures base URL always ends with `/api/v1` (no duplicate or missing prefix).
 */
export function normalizeApiBaseUrl(url: string): string {
  const trimmed = url.trim().replace(/\/+$/, "");
  if (/\/api\/v1$/i.test(trimmed)) return trimmed;
  if (/\/api$/i.test(trimmed)) return `${trimmed}/v1`;
  return `${trimmed}${API_V1_PREFIX}`;
}

/**
 * Endpoint relative to `/api/v1` — strips accidental `/api/v1` from the path segment.
 */
export function resolveApiEndpoint(endpoint: string): string {
  let ep = endpoint.trim().replace(/\/+/g, "/");
  if (!ep.startsWith("/")) ep = `/${ep}`;
  ep = ep.replace(/^\/api\/v1(?=\/|$)/i, "");
  if (!ep.startsWith("/")) ep = `/${ep}`;
  return ep || "/";
}

/** Full request URL: `{origin}/api/v1/{endpoint}` */
export function buildApiUrl(baseUrl: string, endpoint: string): string {
  return `${normalizeApiBaseUrl(baseUrl)}${resolveApiEndpoint(endpoint)}`;
}

/** Dev-friendly path shown in logs, e.g. `/api/v1/payments/order/89` */
export function formatApiV1Path(endpoint: string): string {
  return `${API_V1_PREFIX}${resolveApiEndpoint(endpoint)}`;
}

/**
 * Full v1 base URL for all REST calls: `{API_BASE_URL}/api/v1`
 */
export const API_V1_BASE_URL = normalizeApiBaseUrl(getApiV1BaseUrl());

/**
 * Base URL for auth APIs (signup, login, logout, refresh, profile)
 */
export const AUTH_BASE_URL = API_V1_BASE_URL;

if (__DEV__) {
  console.log(
    "[API:init] API_HOST=%s API_V1_BASE_URL=%s env=%s default=%s",
    API_HOST,
    API_V1_BASE_URL,
    process.env.EXPO_PUBLIC_API_URL ?? "(not set)",
    API_BASE_URL,
  );
}

/** Single source of truth for SecureStore keys */
export const STORAGE_KEYS = {
  ACCESS_TOKEN: "auth_access_token",
  REFRESH_TOKEN: "auth_refresh_token",
} as const;

// ---------------------------------------------------------------------------
// Global logout callback
// Registered by useAuthStore after it mounts so the API layer can trigger
// a forced logout when a refresh token is expired/invalid.
// ---------------------------------------------------------------------------
type LogoutCallback = () => Promise<void>;
type TokenUpdateCallback = (accessToken: string, refreshToken: string) => void;

let _onForceLogout: LogoutCallback | null = null;
let _onTokenUpdate: TokenUpdateCallback | null = null;
let _isLoggingOut = false;

export function registerLogoutCallback(cb: LogoutCallback): void {
  _onForceLogout = cb;
}

export function registerTokenUpdateCallback(cb: TokenUpdateCallback): void {
  _onTokenUpdate = cb;
}

export function getIsLoggingOut(): boolean {
  return _isLoggingOut;
}

export function setLoggingOut(value: boolean): void {
  _isLoggingOut = value;
}

/** Mask token for dev logs — never log full JWT */
export function maskToken(token: string | null | undefined): string {
  if (!token) return "(none)";
  if (token.length <= 12) return "***";
  return `${token.slice(0, 8)}…${token.slice(-4)}`;
}

async function forceLogout(): Promise<void> {
  if (_onForceLogout) {
    try {
      await _onForceLogout();
    } catch {
      // best-effort
    }
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "PATCH" | "DELETE";
  body?: Record<string, unknown>;
  /** Skip attaching the Authorization header (e.g. login, register) */
  skipAuth?: boolean;
  /** Internal flag — marks a request as already retried after a 401 */
  _retry?: boolean;
  /**
   * When true, HTTP 404 returns `null` instead of throwing.
   * Use for lookups where "not found" is normal (e.g. no payment row for an order yet).
   */
  allowNotFound?: boolean;
}

// ---------------------------------------------------------------------------
// Token helpers
// ---------------------------------------------------------------------------

/** Read the current access token from SecureStore */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.ACCESS_TOKEN);
  } catch {
    return null;
  }
}

/** Read the current refresh token from SecureStore */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(STORAGE_KEYS.REFRESH_TOKEN);
  } catch {
    return null;
  }
}

/** Persist both tokens after a successful login / refresh */
export async function saveTokens(
  accessToken: string,
  refreshToken: string,
): Promise<void> {
  if (!accessToken) {
    console.warn("[API] saveTokens called with empty accessToken — skipping");
    return;
  }
  const refresh = refreshToken || accessToken;
  await Promise.all([
    SecureStore.setItemAsync(STORAGE_KEYS.ACCESS_TOKEN, accessToken),
    SecureStore.setItemAsync(STORAGE_KEYS.REFRESH_TOKEN, refresh),
  ]);

  if (_onTokenUpdate) {
    try {
      _onTokenUpdate(accessToken, refresh);
    } catch {
      // best-effort — keep SecureStore as source of truth for requests
    }
  }

  if (__DEV__) {
    console.log(
      `[API] saveTokens ✓ access=${maskToken(accessToken)} refresh=${maskToken(refresh)}`,
    );
  }
}

/** Wipe both tokens on logout or refresh failure */
export async function clearTokens(): Promise<void> {
  await Promise.all([
    SecureStore.deleteItemAsync(STORAGE_KEYS.ACCESS_TOKEN).catch(() => {}),
    SecureStore.deleteItemAsync(STORAGE_KEYS.REFRESH_TOKEN).catch(() => {}),
  ]);
}

// ---------------------------------------------------------------------------
// Refresh token queue
// Prevents multiple simultaneous refresh calls when several requests 401
// ---------------------------------------------------------------------------

let isRefreshing = false;

type QueueEntry = {
  resolve: (newToken: string) => void;
  reject: (err: unknown) => void;
};

let refreshQueue: QueueEntry[] = [];

function flushQueue(error: unknown, newToken: string | null): void {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(newToken as string);
  });
  refreshQueue = [];
}

// ---------------------------------------------------------------------------
// Silent token refresh
// ---------------------------------------------------------------------------

async function doRefresh(): Promise<string> {
  const refreshUrl = `${AUTH_BASE_URL}/auth/refresh`;
  const refreshToken = await getRefreshToken();
  const accessToken = await getAccessToken();

  console.log(
    `[API:refresh:start]\n` +
      `  apiHost: ${API_HOST}\n` +
      `  url: ${refreshUrl}\n` +
      `  accessToken: ${maskToken(accessToken)}\n` +
      `  refreshToken: ${maskToken(refreshToken)}\n` +
      `  refreshTokenPresent: ${Boolean(refreshToken)}`,
  );

  if (!refreshToken) {
    console.warn("[API:refresh:error] no refresh token in SecureStore");
    throw new Error("Session expired. Please log in again.");
  }

  const payload = { refresh_token: refreshToken };
  const startedAt = Date.now();

  let response: Response;
  try {
    response = await fetchWithTimeout(refreshUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.warn(
      `[API:refresh:error] network failure after ${Date.now() - startedAt}ms: ${raw}`,
    );
    throw new Error(
      "Network error during token refresh. Please check your connection.",
    );
  }

  const data = await response.json().catch(() => ({}));
  const elapsedMs = Date.now() - startedAt;

  console.log(
    `[API:refresh:response] status=${response.status} in ${elapsedMs}ms\n` +
      `  body: ${truncateForLog(data)}`,
  );

  if (response.status === 404) {
    console.error("[API:refresh:error] POST /auth/refresh not found (404)");
    throw new Error(
      "Token refresh endpoint not found (404). Please contact support.",
    );
  }

  if (response.status === 401 || response.status === 403) {
    const serverMsg =
      typeof (data as { message?: string })?.message === "string"
        ? (data as { message: string }).message
        : "";
    console.warn(
      `[API:refresh:error] refresh rejected (${response.status})` +
        (serverMsg ? `: ${serverMsg}` : ""),
    );
    throw new Error("Session expired. Please log in again.");
  }

  if (response.status === 422) {
    console.error(
      "[API:refresh:error] 422 validation:",
      truncateForLog((data as { detail?: unknown })?.detail ?? data),
    );
    throw new Error("Token refresh request was rejected. Please log in again.");
  }

  if (!response.ok) {
    console.warn(
      `[API:refresh:error] unexpected status ${response.status}:`,
      truncateForLog(data),
    );
    throw new Error("Session expired. Please log in again.");
  }

  // Extract new tokens — handle all common response shapes
  const newAccessToken: string =
    data?.access_token ??
    data?.token ??
    data?.accessToken ??
    data?.data?.access_token ??
    data?.data?.token ??
    "";

  const newRefreshToken: string =
    data?.refresh_token ??
    data?.refreshToken ??
    data?.data?.refresh_token ??
    refreshToken; // keep old refresh token if backend doesn't return a new one

  if (!newAccessToken) {
    console.error(
      "[API:refresh:error] no access_token in 200 response:",
      truncateForLog(data),
    );
    throw new Error("Session expired. Please log in again.");
  }

  await saveTokens(newAccessToken, newRefreshToken);
  console.log(
    `[API:refresh:success] access=${maskToken(newAccessToken)} refresh=${maskToken(newRefreshToken)}`,
  );
  return newAccessToken;
}

// ---------------------------------------------------------------------------
// Fetch with timeout
// ---------------------------------------------------------------------------

function fetchWithTimeout(
  url: string,
  options: RequestInit,
): Promise<Response> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error("Request timed out. Please try again.")),
      TIMEOUT_MS,
    );

    fetch(url, options)
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

// ---------------------------------------------------------------------------
// Core request() function — uses API_V1_BASE_URL (`${API_BASE_URL}/api/v1`)
// ---------------------------------------------------------------------------

/**
 * Central fetch wrapper for all non-auth APIs.
 */
export async function request<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  return _fetch<T>(API_V1_BASE_URL, endpoint, options);
}

/**
 * Auth-specific fetch wrapper.
 * Uses AUTH_BASE_URL for signup, login, logout, refresh, profile.
 */
export async function authRequest<T = unknown>(
  endpoint: string,
  options: RequestOptions = {},
): Promise<T> {
  return _fetch<T>(AUTH_BASE_URL, endpoint, options);
}

// ---------------------------------------------------------------------------
// Internal _fetch() — shared by both request() and authRequest()
// ---------------------------------------------------------------------------
async function _fetch<T = unknown>(
  baseUrl: string,
  endpoint: string,
  options: RequestOptions = {},
  _retryCount = 0,
): Promise<T> {
  const {
    method = "GET",
    body,
    skipAuth = false,
    _retry = false,
    allowNotFound = false,
  } = options;
  const resolvedPath = resolveApiEndpoint(endpoint);
  const apiPath = formatApiV1Path(resolvedPath);
  const url = buildApiUrl(baseUrl, resolvedPath);
  const startedAt = Date.now();
  logApiConfigOnce();

  // ── Build headers ──────────────────────────────────────────────────────
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  if (!skipAuth) {
    const token = await getAccessToken();
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
  }

  console.log(
    `[API:req:start] ${method} ${apiPath}\n` +
      `  url: ${url}\n` +
      `  headers: ${JSON.stringify(headersForLog(headers))}\n` +
      `  body: ${body ? truncateForLog(body, 300) : "(none)"}`,
  );

  // ── Fire the request ───────────────────────────────────────────────────
  let response: Response;
  try {
    response = await fetchWithTimeout(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (networkError: unknown) {
    const elapsedMs = Date.now() - startedAt;
    const raw =
      networkError instanceof Error
        ? networkError.message
        : String(networkError);

    const isTimeout = raw.includes("timed out");
    const isNetworkFail =
      raw.includes("Network request failed") ||
      raw.includes("Network Error") ||
      raw.includes("Cannot reach");
    const isRetryable = isTimeout || isNetworkFail;

    console.error(
      `[API:req:error] ${method} ${apiPath} after ${elapsedMs}ms ` +
        `(attempt ${_retryCount + 1}/${MAX_RETRIES + 1})\n` +
        `  url: ${url}\n` +
        `  type: ${isTimeout ? "timeout" : "network"}\n` +
        `  message: ${raw}`,
    );

    if (isRetryable && _retryCount < MAX_RETRIES) {
      if (_retryCount === 0) {
        useToastStore
          .getState()
          .show("Connecting to server… please wait", "info");
      }
      const delay = _retryCount === 0 ? 2500 : 5000;
      await new Promise((r) => setTimeout(r, delay));
      return _fetch<T>(baseUrl, endpoint, options, _retryCount + 1);
    }

    const msg = isTimeout
      ? "Server took too long to respond. Please try again."
      : "Unable to connect. Please check your internet connection.";
    throw new Error(msg);
  }

  const elapsedMs = Date.now() - startedAt;
  console.log(
    `[API:req:response] ${response.status} ${method} ${apiPath} in ${elapsedMs}ms\n` +
      `  url: ${url}`,
  );

  // ── 401 — attempt silent token refresh ────────────────────────────────
  if (response.status === 401 && !_retry && !skipAuth && !_isLoggingOut) {
    const existingToken = await getAccessToken();
    if (!existingToken) {
      // No token at all — user is not logged in, don't force-logout
      throw new Error("Authentication required. Please log in.");
    }

    // If a refresh is already in flight, queue this request and wait for the
    // new token. This prevents multiple simultaneous refresh calls when several
    // requests 401 at the same time.
    if (isRefreshing) {
      await new Promise<string>((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      });
      return _fetch<T>(baseUrl, resolvedPath, { ...options, _retry: true });
    }

    isRefreshing = true;
    try {
      const newToken = await doRefresh();
      flushQueue(null, newToken);
      return _fetch<T>(baseUrl, resolvedPath, { ...options, _retry: true });
    } catch (refreshError) {
      flushQueue(refreshError, null);
      const errMsg = refreshError instanceof Error ? refreshError.message : "";
      // Only force-logout if it's a genuine auth failure, not a network/config error
      const isAuthFailure =
        errMsg.includes("Session expired") ||
        errMsg.includes("Please log in") ||
        errMsg.includes("rejected");
      if (isAuthFailure) {
        await clearTokens();
        console.error(
          `[API] Token refresh failed — forcing logout (${errMsg})`,
        );
        await forceLogout();
        throw new Error("Session expired. Please log in again.");
      } else {
        // Network error or config error — don't logout, just propagate
        console.warn("[API] Token refresh failed (non-auth reason):", errMsg);
        throw refreshError;
      }
    } finally {
      isRefreshing = false;
    }
  }

  // ── Parse response body ────────────────────────────────────────────────
  const data = await response.json().catch(() => ({}));
  console.log(
    `[API:req:body] ${method} ${apiPath} ${response.status}\n` +
      `  ${truncateForLog(data)}`,
  );

  // ── Non-2xx error handling ─────────────────────────────────────────────
  if (!response.ok) {
    if (response.status === 404 && allowNotFound) {
      if (__DEV__) {
        console.log(`[API] 404 (no resource yet): ${method} ${apiPath}`);
      }
      return null as T;
    }

    // FastAPI returns validation errors as { detail: [ { loc, msg, type }, ... ] }
    // We need to handle both string and array shapes of `detail`.
    let message: string;
    const detail = (data as any)?.detail;

    if (Array.isArray(detail)) {
      // 422 Unprocessable Entity — log full detail for debugging
      if (__DEV__) {
        console.error(
          `[API] 422 Validation Error on ${method} ${apiPath}:\n` +
            JSON.stringify(detail, null, 2),
        );
      }
      // Join all validation messages into a readable string
      message = detail
        .map((e: any) => {
          const field = Array.isArray(e?.loc) ? e.loc.slice(1).join(".") : "";
          const msg = e?.msg ?? "Invalid value";
          return field ? `${field}: ${msg}` : msg;
        })
        .join("\n");
    } else {
      message =
        (typeof detail === "string" ? detail : undefined) ??
        (data as any)?.message ??
        (data as any)?.error ??
        `Request failed (${response.status})`;
    }

    // Log specific status codes with full response body
    if (response.status === 422) {
      // Already logged above
    } else if (response.status === 403) {
      console.error(`[API] 403 Forbidden: ${method} ${apiPath}`);
    } else if (response.status === 404) {
      console.error(
        `[API] 404 Not Found: ${method} ${apiPath} — check your API routes`,
      );
    } else if (response.status >= 500) {
      console.error(
        `[API] Server error ${response.status}: ${method} ${apiPath}`,
        JSON.stringify(data),
      );
    }

    throw new Error(message);
  }

  return data as T;
}
