import { Mixpanel } from "mixpanel-react-native";

// Analytics is optional, not a hard dependency - same pattern as
// sentryService.ts's DSN: if EXPO_PUBLIC_MIXPANEL_TOKEN isn't set (no
// Mixpanel project provisioned yet), every call here is a silent no-op
// rather than the app breaking or throwing on a missing config value.
const TOKEN = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;

let mixpanel: Mixpanel | null = null;
let initPromise: Promise<void> | null = null;

export function initMixpanel(): void {
  if (!TOKEN || initPromise) return;
  initPromise = Mixpanel.init(TOKEN, /* trackAutomaticEvents */ false)
    .then((instance) => {
      mixpanel = instance;
    })
    .catch(() => {
      // Analytics failing to init must never affect the app - swallow and
      // stay a no-op for the rest of the session, same as track() below.
      mixpanel = null;
    });
}

function track(eventName: string, properties?: Record<string, unknown>): void {
  if (!mixpanel) return;
  try {
    mixpanel.track(eventName, properties);
  } catch {
    // Never let an analytics call disrupt the calling flow (checkout,
    // broadcast accept, etc.) - identical reasoning to captureException's
    // fire-and-forget shape in sentryService.ts.
  }
}

// ---------------------------------------------------------------------------
// This batch's 8 events - tied specifically to the tailor-reliability,
// order-completion, and inspection-window funnels this round of work
// shipped, not a general instrumentation pass. See the tailor-reliability
// planning doc for the full event list and rationale.
// ---------------------------------------------------------------------------

export function trackOrderPlaced(properties: {
  order_id: number;
  service_id?: number;
  payment_method?: string;
  final_amount?: number;
}): void {
  track("order_placed", properties);
}

export function trackOrderDelivered(properties: { order_id: number }): void {
  track("order_delivered", properties);
}

export function trackIssueReported(properties: { order_id: number }): void {
  track("issue_reported", properties);
}

export function trackOrderCompleted(properties: { order_id: number }): void {
  track("order_completed", properties);
}

export function trackTailorApplicationSubmitted(properties: { application_id?: number }): void {
  track("tailor_application_submitted", properties);
}
