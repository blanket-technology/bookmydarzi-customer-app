import * as Sentry from "@sentry/react-native";

// Crash reporting is optional, not a hard dependency - if EXPO_PUBLIC_SENTRY_DSN
// isn't set (e.g. a fresh clone before the DSN is provisioned), the app must
// keep working exactly as before rather than crashing on a missing config
// value. init() is a no-op in that case.
const DSN = process.env.EXPO_PUBLIC_SENTRY_DSN;

let initialized = false;

export function initSentry(): void {
  if (initialized || !DSN) return;
  initialized = true;

  Sentry.init({
    dsn: DSN,
    // Errors only, no performance/session-replay sampling - this app has no
    // need for tracing overhead, just visibility into crashes that would
    // otherwise only surface as a bad app-store review.
    tracesSampleRate: 0,
    enableAutoSessionTracking: true,
    environment: process.env.EXPO_PUBLIC_APP_ENV ?? "production",
  });
}

export function captureException(error: unknown, context?: Record<string, unknown>): void {
  if (!DSN) return;
  Sentry.captureException(error, context ? { extra: context } : undefined);
}
