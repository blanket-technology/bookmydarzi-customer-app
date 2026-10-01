import type { Ionicons } from "@expo/vector-icons";

/**
 * Issue categories offered on the issue picker before a support chat opens
 * (Zomato/Swiggy-style "select order -> select issue -> chat" flow). Free-
 * text keys, not an enum on the backend (ChatSession.IssueCategory is a
 * plain nullable string) - keep this list in sync with the mirror map in
 * app/services/chat_v2/ai_dispatcher.py's _ISSUE_CATEGORY_LABELS if you add
 * or rename a category.
 */
export type SupportIssueKey =
  | "pickup_not_scheduled"
  | "pickup_delayed"
  | "reschedule_pickup"
  | "cancel_order"
  | "stitching_update"
  | "upload_reference"
  | "measurement_concern"
  | "tailoring_concern"
  | "delivery_delayed"
  | "delivery_address_issue"
  | "alteration_required"
  | "wrong_stitching"
  | "wrong_garment"
  | "missing_item"
  | "refund_issue"
  | "payment_issue"
  | "other";

export interface SupportIssueOption {
  key: SupportIssueKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const ALL_ISSUES: Record<SupportIssueKey, SupportIssueOption> = {
  pickup_not_scheduled: { key: "pickup_not_scheduled", label: "Pickup not scheduled", icon: "calendar-outline" },
  pickup_delayed: { key: "pickup_delayed", label: "Pickup delayed", icon: "time-outline" },
  reschedule_pickup: { key: "reschedule_pickup", label: "Need to reschedule", icon: "calendar-clear-outline" },
  cancel_order: { key: "cancel_order", label: "Cancel order", icon: "close-circle-outline" },
  stitching_update: { key: "stitching_update", label: "Need stitching update", icon: "cut-outline" },
  upload_reference: { key: "upload_reference", label: "Upload additional reference", icon: "image-outline" },
  measurement_concern: { key: "measurement_concern", label: "Measurement concern", icon: "resize-outline" },
  tailoring_concern: { key: "tailoring_concern", label: "Tailoring concern", icon: "shirt-outline" },
  delivery_delayed: { key: "delivery_delayed", label: "Delivery delayed", icon: "bicycle-outline" },
  delivery_address_issue: { key: "delivery_address_issue", label: "Delivery address issue", icon: "location-outline" },
  alteration_required: { key: "alteration_required", label: "Alteration required", icon: "cut-outline" },
  wrong_stitching: { key: "wrong_stitching", label: "Wrong stitching", icon: "alert-circle-outline" },
  wrong_garment: { key: "wrong_garment", label: "Wrong garment", icon: "shirt-outline" },
  missing_item: { key: "missing_item", label: "Missing item", icon: "cube-outline" },
  refund_issue: { key: "refund_issue", label: "Refund issue", icon: "cash-outline" },
  payment_issue: { key: "payment_issue", label: "Payment issue", icon: "card-outline" },
  other: { key: "other", label: "Something else", icon: "chatbubble-ellipses-outline" },
};

type OrderStageBucket = "before_pickup" | "after_pickup" | "ready_or_out" | "delivered" | "closed";

const PRE_PICKUP_STATUSES = new Set([
  "pending_payment", "order_placed", "order_accepted", "searching_tailor",
  "broadcasted", "tailor_assigned", "pickup_scheduled", "pickup_pending",
]);
const AFTER_PICKUP_STATUSES = new Set([
  "picked_up", "cloth_received_by_tailor", "stitching_started", "in_progress", "final_check",
]);
const READY_OR_OUT_STATUSES = new Set(["ready_for_dispatch", "out_for_delivery"]);
// inspection_window/in_repair/repair_completed are all part of the
// post-delivery loop - without these an order sitting in that loop would
// fall through to the default "before_pickup" bucket below and show
// support options like "pickup not scheduled"/"cancel order" for an order
// that's actually already been delivered.
const DELIVERED_STATUSES = new Set([
  "delivered",
  "completed",
  "inspection_window",
  "in_repair",
  "repair_pickup_pending",
  "repair_pickup_scheduled",
  "repair_pickup_in_transit",
  "at_tailor_for_repair",
  "repair_completed",
  "repair_delivery_pending",
  "repair_delivery_scheduled",
  "repair_delivery_in_transit",
]);
const CLOSED_STATUSES = new Set(["cancelled", "order_rejected"]);

function bucketForStatus(status: string): OrderStageBucket {
  const s = status.toLowerCase();
  if (CLOSED_STATUSES.has(s)) return "closed";
  if (DELIVERED_STATUSES.has(s)) return "delivered";
  if (READY_OR_OUT_STATUSES.has(s)) return "ready_or_out";
  if (AFTER_PICKUP_STATUSES.has(s)) return "after_pickup";
  return "before_pickup";
}

const BUCKET_ISSUES: Record<OrderStageBucket, SupportIssueKey[]> = {
  before_pickup: ["pickup_not_scheduled", "pickup_delayed", "reschedule_pickup", "cancel_order", "payment_issue", "other"],
  after_pickup: ["stitching_update", "upload_reference", "measurement_concern", "tailoring_concern", "other"],
  ready_or_out: ["delivery_delayed", "delivery_address_issue", "payment_issue", "other"],
  delivered: ["alteration_required", "wrong_stitching", "wrong_garment", "missing_item", "refund_issue", "payment_issue", "other"],
  // A closed order can still need help (e.g. a refund never arrived) -
  // reuse the delivered set rather than inventing a 6th bucket for a rare
  // path; "other" always covers whatever doesn't fit.
  closed: ["refund_issue", "payment_issue", "other"],
};

/**
 * Returns the issue options relevant to an order's current status - the
 * customer only ever sees choices that make sense for that stage (e.g.
 * "Wrong garment" only appears once something has actually been delivered).
 */
export function getIssueOptionsForStatus(status: string): SupportIssueOption[] {
  const bucket = bucketForStatus(status);
  return BUCKET_ISSUES[bucket].map((k) => ALL_ISSUES[k]);
}

/** Label for a previously-selected issue key (e.g. for the pinned order
 * card) - falls back to a title-cased version of unknown/legacy keys. */
export function getIssueLabel(key: string): string {
  const known = ALL_ISSUES[key as SupportIssueKey];
  if (known) return known.label;
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// ── Non-order support categories (entry screen) ────────────────────────────

export type SupportCategoryKey =
  | "order"
  | "payment"
  | "account"
  | "bug_report"
  | "feedback"
  | "other";

export interface SupportCategoryOption {
  key: SupportCategoryKey;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  /** True only for "Order Related" - every other category skips the order
   * picker entirely and opens chat directly. */
  requiresOrder: boolean;
}

export const SUPPORT_CATEGORIES: SupportCategoryOption[] = [
  { key: "order", label: "Order Related", icon: "cube-outline", requiresOrder: true },
  { key: "payment", label: "Payment", icon: "card-outline", requiresOrder: false },
  { key: "account", label: "Account & Login", icon: "person-outline", requiresOrder: false },
  { key: "bug_report", label: "Report a Bug", icon: "bug-outline", requiresOrder: false },
  { key: "feedback", label: "Feedback & Suggestions", icon: "chatbubble-ellipses-outline", requiresOrder: false },
  { key: "other", label: "Other", icon: "help-circle-outline", requiresOrder: false },
];
