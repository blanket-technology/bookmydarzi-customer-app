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

export function formatRelativeTime(isoTimestamp: string): string {
  const diffMs = Date.now() - new Date(isoTimestamp).getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(isoTimestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
  });
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
