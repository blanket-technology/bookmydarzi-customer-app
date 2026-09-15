/**
 * Single source of truth for order status metadata across the app.
 *
 * Backend state machine (app/constants/order_status.py, BookMyDarzi backend):
 *
 *   PENDING_PAYMENT (online only) → ORDER_PLACED → ORDER_ACCEPTED
 *     → SEARCHING_TAILOR → BROADCASTED → TAILOR_ASSIGNED
 *     → PICKUP_SCHEDULED (optional) → PICKUP_PENDING → PICKED_UP
 *     → CLOTH_RECEIVED_BY_TAILOR
 *     → STITCHING_STARTED → IN_PROGRESS → FINAL_CHECK → READY_FOR_DISPATCH
 *     → OUT_FOR_DELIVERY → DELIVERED → COMPLETED
 *
 *   Terminal side-branches: ORDER_REJECTED, CANCELLED, PAYMENT_FAILED.
 *
 * Removed statuses (no longer emitted by the backend, must never be matched
 * against): CUSTOMER_VERIFIED, CLOTH_AT_HUB, MEASUREMENT_UPDATED,
 * TAILOR_ACCEPTED. Do not add these back - if a screen needs to display an
 * "in between" state that used to map to one of these, use SEARCHING_TAILOR
 * or BROADCASTED (both intentionally hidden from customers via
 * customerFacing: false below) instead.
 *
 * Every screen must import from this file rather than hardcoding status
 * strings, color maps, or labels. See ORDER_STATUS_SEQUENCE for the
 * canonical ordering used to build progress bars / timelines.
 */
import type { Ionicons } from "@expo/vector-icons";

export type IoniconName = keyof typeof Ionicons.glyphMap;

/** Every status string the backend can emit. */
export type OrderStatus =
  | "pending_payment"
  | "payment_failed"
  | "order_placed"
  | "order_accepted"
  | "order_rejected"
  | "searching_tailor"
  | "broadcasted"
  | "tailor_assigned"
  | "pickup_scheduled"
  | "pickup_pending"
  | "picked_up"
  | "cloth_received_by_tailor"
  | "stitching_started"
  | "in_progress"
  | "final_check"
  | "ready_for_dispatch"
  | "out_for_delivery"
  | "delivered"
  | "completed"
  | "cancelled"
  | "return_pending"
  | "return_scheduled"
  | "return_in_transit"
  | "returned";

export type StatusVisualTone = "success" | "warning" | "neutral" | "error" | "info";

export interface OrderStatusMeta {
  status: OrderStatus;
  /** Internal/admin-facing title (may reveal ops detail). */
  title: string;
  /** One-line explanation shown under the title. */
  description: string;
  /** What happens next, shown as a hint - null when there's nothing to add (terminal states). */
  nextStep: string | null;
  tone: StatusVisualTone;
  icon: IoniconName;
  /**
   * Position in ORDER_STATUS_SEQUENCE for progress-bar math. Statuses that
   * share a customer-visible milestone (e.g. searching_tailor/broadcasted
   * both map to "finding your tailor") share a progress value too.
   */
  progress: number;
  /** False for statuses that are internal ops machinery and must never be shown to a customer verbatim. */
  customerFacing: boolean;
  /** Customer-safe label - used whenever customerFacing is false, and as the default label otherwise. */
  customerLabel: string;
  /** Label shown on employee-facing screens (may reference ops detail customers don't see). */
  employeeLabel: string;
  /** Label shown on tailor-facing screens. */
  tailorLabel: string;
  /** True once the order can no longer progress (delivered/completed/cancelled/rejected/payment_failed is NOT terminal - it's recoverable via retry). */
  terminal: boolean;
}

/**
 * Canonical forward order of the main flow, used to compute timeline
 * "completed" flags client-side when the backend's own per-item completed/
 * current flags aren't available (e.g. optimistic UI before a refetch).
 * Side-branch statuses (order_rejected, cancelled, payment_failed) are
 * intentionally excluded - they're not positions on this line.
 */
export const ORDER_STATUS_SEQUENCE: OrderStatus[] = [
  "pending_payment",
  "order_placed",
  "order_accepted",
  "searching_tailor",
  "broadcasted",
  "tailor_assigned",
  "pickup_scheduled",
  "pickup_pending",
  "picked_up",
  "cloth_received_by_tailor",
  "stitching_started",
  "in_progress",
  "final_check",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
  "completed",
];

export const ORDER_STATUS_META: Record<OrderStatus, OrderStatusMeta> = {
  pending_payment: {
    status: "pending_payment",
    title: "Awaiting payment",
    description: "Complete the payment to confirm your booking.",
    nextStep: "Once payment is received, we'll confirm your order immediately.",
    tone: "warning",
    icon: "card-outline",
    progress: 0,
    customerFacing: true,
    customerLabel: "Pending Payment",
    employeeLabel: "Pending Payment",
    tailorLabel: "Pending Payment",
    terminal: false,
  },
  payment_failed: {
    status: "payment_failed",
    title: "Payment didn't go through",
    description: "Your payment could not be processed. No amount has been charged.",
    nextStep: "Tap Retry Payment to try again with the same or a different method.",
    tone: "error",
    icon: "close-circle-outline",
    progress: 0,
    customerFacing: true,
    customerLabel: "Payment Failed",
    employeeLabel: "Payment Failed",
    tailorLabel: "Payment Failed",
    terminal: false,
  },
  order_placed: {
    status: "order_placed",
    title: "Order received",
    description: "We've got your booking and our team is reviewing it now.",
    nextStep: "You'll hear from us shortly to confirm your order.",
    tone: "info",
    icon: "receipt-outline",
    progress: 1,
    customerFacing: true,
    customerLabel: "Order Placed",
    employeeLabel: "Order Placed",
    tailorLabel: "Order Placed",
    terminal: false,
  },
  order_accepted: {
    status: "order_accepted",
    title: "Order confirmed",
    description: "Your booking is confirmed. We're finding the right tailor and arranging pickup.",
    nextStep: "Pickup and tailor assignment happen next - both may proceed in parallel.",
    tone: "info",
    icon: "checkmark-circle-outline",
    progress: 2,
    customerFacing: true,
    customerLabel: "Order Confirmed",
    employeeLabel: "Accepted",
    tailorLabel: "Order Confirmed",
    terminal: false,
  },
  order_rejected: {
    status: "order_rejected",
    title: "Unable to process this order",
    description: "We couldn't accept your order at this time. You won't be charged.",
    nextStep: "Please contact support if you'd like more information.",
    tone: "error",
    icon: "close-circle-outline",
    progress: 0,
    customerFacing: true,
    customerLabel: "Order Rejected",
    employeeLabel: "Rejected",
    tailorLabel: "Order Rejected",
    terminal: true,
  },
  searching_tailor: {
    status: "searching_tailor",
    title: "Finding your tailor",
    description: "We're matching your order with a nearby, available tailor.",
    nextStep: "We'll notify you the moment a tailor accepts.",
    tone: "info",
    icon: "search-outline",
    progress: 3,
    customerFacing: false,
    customerLabel: "Assigning Tailor",
    employeeLabel: "Searching Tailor",
    tailorLabel: "Searching Tailor",
    terminal: false,
  },
  broadcasted: {
    status: "broadcasted",
    title: "Reaching out to tailors",
    description: "Nearby tailors have been notified about your order.",
    nextStep: "We'll notify you the moment a tailor accepts.",
    tone: "info",
    icon: "radio-outline",
    progress: 3,
    customerFacing: false,
    customerLabel: "Assigning Tailor",
    employeeLabel: "Broadcasted",
    tailorLabel: "Broadcasted",
    terminal: false,
  },
  tailor_assigned: {
    status: "tailor_assigned",
    title: "Tailor assigned",
    description: "A skilled tailor has been assigned to your order.",
    nextStep: "Stitching begins once your fabric reaches the tailor.",
    tone: "success",
    icon: "person-outline",
    progress: 4,
    customerFacing: true,
    customerLabel: "Tailor Assigned",
    employeeLabel: "Tailor Assigned",
    tailorLabel: "Assigned To You",
    terminal: false,
  },
  pickup_scheduled: {
    status: "pickup_scheduled",
    title: "Pickup scheduled",
    description: "Your fabric pickup has been scheduled for your chosen time.",
    nextStep: "Our team will arrive at the scheduled pickup window.",
    tone: "warning",
    icon: "calendar-outline",
    progress: 5,
    customerFacing: true,
    customerLabel: "Pickup Scheduled",
    employeeLabel: "Pickup Scheduled",
    tailorLabel: "Pickup Scheduled",
    terminal: false,
  },
  pickup_pending: {
    status: "pickup_pending",
    title: "Pickup on the way",
    description: "A BookMyDarzi team member is on their way to collect your fabric.",
    nextStep: "Keep your fabric ready - they'll collect it shortly.",
    tone: "warning",
    icon: "bicycle-outline",
    progress: 6,
    customerFacing: true,
    customerLabel: "Pickup Pending",
    employeeLabel: "Pickup Pending",
    tailorLabel: "Pickup Pending",
    terminal: false,
  },
  picked_up: {
    status: "picked_up",
    title: "Fabric collected",
    description: "We've picked up your fabric. It's on its way to your tailor.",
    nextStep: "Your tailor will begin work once the fabric arrives.",
    tone: "success",
    icon: "cube-outline",
    progress: 7,
    customerFacing: true,
    customerLabel: "Pickup Completed",
    employeeLabel: "Picked Up",
    tailorLabel: "Picked Up",
    terminal: false,
  },
  cloth_received_by_tailor: {
    status: "cloth_received_by_tailor",
    title: "Fabric with your tailor",
    description: "Your tailor has received the fabric and is preparing to start.",
    nextStep: "Stitching will begin shortly.",
    tone: "success",
    icon: "shirt-outline",
    progress: 8,
    customerFacing: false,
    customerLabel: "Pickup Completed",
    employeeLabel: "Handed to Tailor",
    tailorLabel: "Cloth Received",
    terminal: false,
  },
  stitching_started: {
    status: "stitching_started",
    title: "Stitching started",
    description: "Your tailor has started working on your garment.",
    nextStep: "We'll share progress photos as work continues.",
    tone: "info",
    icon: "cut-outline",
    progress: 9,
    customerFacing: true,
    customerLabel: "Stitching Started",
    employeeLabel: "Stitching Started",
    tailorLabel: "Stitching Started",
    terminal: false,
  },
  in_progress: {
    status: "in_progress",
    title: "Being stitched right now",
    description: "Your garment is on the worktable, being stitched to your exact measurements.",
    nextStep: "We'll notify you the moment stitching is complete.",
    tone: "info",
    icon: "hammer-outline",
    progress: 10,
    customerFacing: true,
    customerLabel: "Stitching In Progress",
    employeeLabel: "In Progress",
    tailorLabel: "In Progress",
    terminal: false,
  },
  final_check: {
    status: "final_check",
    title: "Final quality check",
    description: "Your garment is undergoing a final quality check.",
    nextStep: "It'll be marked ready for dispatch shortly.",
    tone: "info",
    icon: "search-circle-outline",
    progress: 11,
    customerFacing: true,
    customerLabel: "Final Check",
    employeeLabel: "Final Check",
    tailorLabel: "Final Check",
    terminal: false,
  },
  ready_for_dispatch: {
    status: "ready_for_dispatch",
    title: "Ready for dispatch",
    description: "Your garment is ready and passed quality check. It's being prepared for delivery.",
    nextStep: "Delivery is being arranged. Expect it at your door soon.",
    tone: "success",
    icon: "checkmark-done-outline",
    progress: 12,
    customerFacing: true,
    customerLabel: "Ready For Dispatch",
    employeeLabel: "Ready For Dispatch",
    tailorLabel: "Ready For Dispatch",
    terminal: false,
  },
  out_for_delivery: {
    status: "out_for_delivery",
    title: "On its way to you",
    description: "Your garment has left for delivery and is heading to your address.",
    nextStep: "Keep your phone handy - the delivery agent may call before arriving.",
    tone: "warning",
    icon: "bicycle-outline",
    progress: 13,
    customerFacing: true,
    customerLabel: "Out For Delivery",
    employeeLabel: "Out For Delivery",
    tailorLabel: "Out For Delivery",
    terminal: false,
  },
  delivered: {
    status: "delivered",
    title: "Delivered",
    description: "Your order has been delivered. We hope it fits perfectly.",
    nextStep: "Your order will be marked complete shortly.",
    tone: "success",
    icon: "checkmark-circle",
    progress: 14,
    customerFacing: true,
    customerLabel: "Delivered",
    employeeLabel: "Delivered",
    tailorLabel: "Delivered",
    terminal: false,
  },
  completed: {
    status: "completed",
    title: "Order completed",
    description: "This order is complete. Thank you for choosing BookMyDarzi!",
    nextStep: "Love the fit? Leave a review. Need changes? Contact support within 7 days.",
    tone: "success",
    icon: "ribbon-outline",
    progress: 15,
    customerFacing: true,
    customerLabel: "Completed",
    employeeLabel: "Completed",
    tailorLabel: "Completed",
    terminal: true,
  },
  cancelled: {
    status: "cancelled",
    title: "Order cancelled",
    description: "This order has been cancelled.",
    nextStep: "If a payment was made, it will be refunded per our cancellation policy.",
    tone: "error",
    icon: "ban-outline",
    progress: 0,
    customerFacing: true,
    customerLabel: "Cancelled",
    employeeLabel: "Cancelled",
    tailorLabel: "Cancelled",
    // See lib/orderStatus.ts (website)'s identical note: an order cancelled
    // after the tailor already had custody continues into return_pending/...
    // rather than stopping here, but "cancelled, nothing more happens" is
    // still the end state for most cancelled orders.
    terminal: true,
  },
  return_pending: {
    status: "return_pending",
    title: "Return pending",
    description: "This order was cancelled after your fabric/garment reached the tailor, so it needs to be returned to you.",
    nextStep: "We're arranging pickup from the tailor to bring it back to you.",
    tone: "warning",
    icon: "return-up-back-outline",
    progress: 0,
    customerFacing: true,
    customerLabel: "Return Pending",
    employeeLabel: "Return Pending",
    tailorLabel: "Return Pending",
    terminal: false,
  },
  return_scheduled: {
    status: "return_scheduled",
    title: "Return pickup scheduled",
    description: "A pickup has been scheduled to collect your item from the tailor for return.",
    nextStep: "It'll be on its way to you once collected.",
    tone: "warning",
    icon: "calendar-outline",
    progress: 0,
    customerFacing: true,
    customerLabel: "Return Scheduled",
    employeeLabel: "Return Scheduled",
    tailorLabel: "Return Scheduled",
    terminal: false,
  },
  return_in_transit: {
    status: "return_in_transit",
    title: "Return in transit",
    description: "Your item has been collected from the tailor and is on its way back to you.",
    nextStep: "Keep your phone handy - our team may call before arriving.",
    tone: "info",
    icon: "bicycle-outline",
    progress: 0,
    customerFacing: true,
    customerLabel: "Return In Transit",
    employeeLabel: "Return In Transit",
    tailorLabel: "Return In Transit",
    terminal: false,
  },
  returned: {
    status: "returned",
    title: "Item returned",
    description: "Your item has been returned to you.",
    nextStep: "If a payment was made, any refund follows our cancellation policy.",
    tone: "success",
    icon: "checkmark-done-outline",
    progress: 0,
    customerFacing: true,
    customerLabel: "Returned",
    employeeLabel: "Returned",
    tailorLabel: "Returned",
    terminal: true,
  },
};

const ALL_STATUSES = new Set<string>(Object.keys(ORDER_STATUS_META));

/**
 * Normalize any raw backend status string into a known OrderStatus.
 * Falls back to "order_placed" for unrecognized values (never throws) so a
 * single unexpected string can never crash a screen - logs a warning in dev
 * so the gap gets noticed and fixed rather than silently swallowed forever.
 */
export function normalizeOrderStatus(raw: string | null | undefined): OrderStatus {
  const s = (raw ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (ALL_STATUSES.has(s)) return s as OrderStatus;
  if (__DEV__ && s) {
    // eslint-disable-next-line no-console
    console.warn(`[orderStatus] Unrecognized order status "${raw}" - falling back to order_placed.`);
  }
  return "order_placed";
}

export function getOrderStatusMeta(raw: string | null | undefined): OrderStatusMeta {
  return ORDER_STATUS_META[normalizeOrderStatus(raw)];
}

/** True when the order has left the "in flight" flow (any of the 4 terminal outcomes). */
export function isOrderStatusTerminal(raw: string | null | undefined): boolean {
  return getOrderStatusMeta(raw).terminal;
}

/** Matches the backend's "Completed" tab semantics: only COMPLETED counts, DELIVERED is still active. */
export function isOrderStatusCompleted(raw: string | null | undefined): boolean {
  return normalizeOrderStatus(raw) === "completed";
}

export function isOrderStatusCancelled(raw: string | null | undefined): boolean {
  const s = normalizeOrderStatus(raw);
  return s === "cancelled" || s === "order_rejected";
}

/** 0-100 progress percentage for progress bars, based on ORDER_STATUS_SEQUENCE position. */
export function getOrderStatusProgressPercent(raw: string | null | undefined): number {
  const meta = getOrderStatusMeta(raw);
  if (meta.status === "cancelled" || meta.status === "order_rejected") return 0;
  const maxProgress = ORDER_STATUS_META.completed.progress;
  return Math.round((meta.progress / maxProgress) * 100);
}

export const STATUS_TONE_COLORS: Record<StatusVisualTone, { bg: string; fg: string }> = {
  success: { bg: "#E8F8EF", fg: "#22A06B" },
  warning: { bg: "#FEF6E7", fg: "#D97706" },
  error: { bg: "#FEECEC", fg: "#DC2626" },
  info: { bg: "#E8F4F6", fg: "#0c6c75" },
  neutral: { bg: "#F1F1F1", fg: "#6B7280" },
};

/** Which statuses may still be self-cancelled by the customer from this screen.
 * Prefer the backend's `CanCancel` field on the order response when present -
 * this set is a client-side fallback only for contexts where that field
 * isn't available (matches backend's OrderStatus.CANCELLABLE_BY_CUSTOMER). */
export const CUSTOMER_CANCELLABLE_STATUSES = new Set<OrderStatus>([
  "pending_payment",
  "order_placed",
  "order_accepted",
  "searching_tailor",
  "broadcasted",
  "pickup_scheduled",
  "pickup_pending",
  "picked_up",
]);

/** Mirrors the backend's actual RESCHEDULABLE_FROM
 * (app/services/orders/admin_reschedule_service.py) - a pickup can only be
 * MOVED once one has already been scheduled, which only happens after a
 * Bridge/employee has been assigned and made the first scheduling call
 * (employee_order_service.schedule_pickup_employee_order). Before that
 * there's no ScheduledPickupAt yet to reschedule - the backend hard-rejects
 * every other status with a 400. Deliberately narrower than the
 * cancellable set above. */
export const RESCHEDULABLE_STATUSES = new Set<OrderStatus>([
  "pickup_scheduled",
  "pickup_pending",
]);

/** Statuses during which a tailor may upload progress photos (matches backend's _PHOTO_UPLOAD_STAGES). */
export const PHOTO_UPLOAD_STAGES = new Set<OrderStatus>([
  "stitching_started",
  "in_progress",
  "final_check",
]);

/** Statuses for which the progress-photo gallery should be shown to a customer at all. */
export const PHOTO_VISIBLE_STAGES = new Set<OrderStatus>([
  "cloth_received_by_tailor",
  "stitching_started",
  "in_progress",
  "final_check",
  "ready_for_dispatch",
  "out_for_delivery",
  "delivered",
  "completed",
]);
