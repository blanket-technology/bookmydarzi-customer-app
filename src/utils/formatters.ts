import type { Order, Booking } from "../types";

export function formatPrice(amount: number): string {
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)}L`;
  if (amount >= 1000) return `₹${(amount / 1000).toFixed(1)}K`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

/** Exact amount with thousands separators, never compacted - use for order
 * totals, billing breakdowns, and anywhere the precise figure matters.
 * Prefer this over raw `${amount}` interpolation or ad-hoc .toFixed() calls. */
export function formatCurrency(amount: number | string | null | undefined): string {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  if (n == null || Number.isNaN(n)) return "₹0";
  return `₹${n.toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
}

/** "Just now" / "5m ago" / "3h ago" / "2d ago" / "12 Jan" (7+ days). The
 * single source for this pattern - previously reimplemented in
 * notifications.tsx with a silent drift (a stray `year: "numeric"` on the
 * 7+ day fallback, so the exact same week-old timestamp showed a year on
 * that one screen and nowhere else that used this same "relative time"
 * concept). Guards against an empty/invalid ISO string the same way that
 * duplicate did, folded back in here rather than lost in the consolidation. */
export function formatRelativeTime(isoTimestamp: string | null | undefined): string {
  if (!isoTimestamp) return "";
  const d = new Date(isoTimestamp);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
}

/** "12 Jan" - short absolute date, no year/weekday. Use for a compact date
 * reference (a chat date separator, a pinned-order card) where "how long
 * ago" isn't the point, just "which date". */
export function formatShortDate(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/** "Mon, 12 Jan" - short absolute date with weekday. Use where knowing the
 * day-of-week matters (e.g. a scheduled pickup date). */
export function formatShortDateWithWeekday(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

/** "3:42 PM" - 12-hour clock time, no date. */
export function formatShortTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

/** "Today" / "Yesterday" / "12 Jan" - a chat-style date separator label.
 * Matches the (employee)/order-chat.tsx format so date-separator copy is
 * consistent across both chat surfaces. */
export function formatDateSeparatorLabel(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return formatShortDate(iso);
}

export function formatOrderStatus(status: Order["status"]): string {
  const labels: Record<Order["status"], string> = {
    pending: "Pending",
    in_progress: "In Progress",
    ready: "Ready for Pickup",
    delivered: "Delivered",
    cancelled: "Cancelled",
  };
  return labels[status] ?? status;
}

/** Safe label for API order/tracking status strings */
export function formatApiOrderStatus(status: string | undefined | null): string {
  if (!status) return "Unknown";
  const key = status.toLowerCase().replace(/\s+/g, "_");
  const labels: Record<string, string> = {
    pending: "Pending",
    pending_payment: "Payment Pending",
    confirmed: "Confirmed",
    accepted: "Accepted",
    processing: "Processing",
    in_progress: "In Progress",
    ready: "Ready",
    ready_for_delivery: "Ready for Delivery",
    out_for_delivery: "Out for Delivery",
    delivered: "Delivered",
    completed: "Completed",
    cancelled: "Cancelled",
    canceled: "Cancelled",
    paid: "Paid",
    failed: "Failed",
  };
  return labels[key] ?? status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export function formatBookingStatus(status: Booking["status"]): string {
  const labels: Record<Booking["status"], string> = {
    confirmed: "Confirmed",
    pending: "Pending",
    cancelled: "Cancelled",
    completed: "Completed",
  };
  return labels[status] ?? status;
}

export function truncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return `${text.slice(0, maxLength - 3)}...`;
}
