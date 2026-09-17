/**
 * Payment display helpers - maps API payment/order fields to UI labels.
 */

export type PaymentStatusVisual = {
  label: string;
  color: string;
  bg: string;
};

export function getPaymentStatusVisual(
  status: string | null | undefined,
): PaymentStatusVisual {
  const norm = (status ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (norm === "fullypaid" || norm === "paid" || norm === "success" || norm === "completed") {
    return { label: "Fully Paid", color: "#065F46", bg: "#D1FAE5" };
  }
  // Legacy status strings from before the full-upfront-payment change - the
  // amount actually collected under either was the full order total, not a
  // partial advance, so they're labeled the same as "Paid" rather than
  // resurrecting advance/partial terminology.
  if (norm === "advancepaid" || norm === "partiallypaid") {
    return { label: "Paid", color: "#065F46", bg: "#D1FAE5" };
  }
  if (norm === "balancepending" || norm === "balancedue") {
    return { label: "Balance Due", color: "#92400E", bg: "#FEF3C7" };
  }
  if (norm === "advancepending" || norm === "initiated" || norm === "pending") {
    return { label: "Payment Pending", color: "#92400E", bg: "#FEF3C7" };
  }
  if (norm === "failed" || norm === "paymentfailed" || norm === "advancefailed") {
    return { label: "Payment Failed", color: "#B91C1C", bg: "#FEE2E2" };
  }
  if (norm === "refunded") {
    return { label: "Refunded", color: "#4B5563", bg: "#F3F4F6" };
  }
  if (norm === "codpending" || norm === "cod" || norm === "payondelivery") {
    return { label: "Pay on Delivery", color: "#0c6c75", bg: "#e0f7f8" };
  }
  const label = (status ?? "")
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase())
    .trim() || "Pending";
  return { label, color: "#92400E", bg: "#FEF3C7" };
}

/** True when an order still needs an online payment action from the
 * customer (advance/initiated/failed) - i.e. show a "Pay Now" CTA.
 * Uses the same normalization as getPaymentStatusVisual() above so the
 * two never drift (previously order-summary.tsx re-implemented this
 * normalize-and-match logic inline). */
export function needsPayment(status: string | null | undefined): boolean {
  const norm = (status ?? "").toLowerCase().replace(/[^a-z]/g, "");
  return (
    norm === "advancepending" ||
    norm === "initiated" ||
    norm === "paymentfailed" ||
    norm === "failed"
  );
}

export type PaymentDisplayStatus = "paid" | "pending" | "failed" | "cod" | "processing";

const SUCCESS_STATUSES = new Set(["paid", "completed", "success", "advance_paid", "fully_paid"]);
const FAILED_STATUSES = new Set(["failed", "cancelled", "refunded"]);
const PROCESSING_STATUSES = new Set([
  "processing",
  "in_progress",
  "initiated",
  "created",
  "authorized",
]);

export function isPaymentSuccess(status: string | undefined | null): boolean {
  return SUCCESS_STATUSES.has((status ?? "").toLowerCase());
}

export function isPaymentFailed(status: string | undefined | null): boolean {
  return FAILED_STATUSES.has((status ?? "").toLowerCase());
}

export function isPaymentProcessing(status: string | undefined | null): boolean {
  return PROCESSING_STATUSES.has((status ?? "").toLowerCase());
}

export function isPaymentTerminal(status: string | undefined | null): boolean {
  const s = (status ?? "").toLowerCase();
  return isPaymentSuccess(s) || isPaymentFailed(s);
}

/** Resolve badge state from order/payment API fields */
export function resolvePaymentDisplay(
  paymentStatus?: string | null,
  paymentMethod?: string | null
): PaymentDisplayStatus {
  const method = (paymentMethod ?? "").toLowerCase();
  const status = (paymentStatus ?? "pending").toLowerCase();

  if (method === "cod") return "cod";
  if (isPaymentSuccess(status)) return "paid";
  if (isPaymentFailed(status)) return "failed";
  if (isPaymentProcessing(status)) return "processing";
  return "pending";
}

export function getPaymentStatusLabel(display: PaymentDisplayStatus): string {
  const labels: Record<PaymentDisplayStatus, string> = {
    paid: "Paid",
    pending: "Payment Pending",
    failed: "Payment Failed",
    cod: "Cash on Delivery",
    processing: "Processing",
  };
  return labels[display];
}

export function getPaymentStatusColors(display: PaymentDisplayStatus): {
  color: string;
  bg: string;
} {
  switch (display) {
    case "paid":
      return { color: "#065F46", bg: "#D1FAE5" };
    case "cod":
      return { color: "#0c6c75", bg: "#e0f7f8" };
    case "processing":
      return { color: "#7C3AED", bg: "#EDE9FE" };
    case "failed":
      return { color: "#B91C1C", bg: "#FEE2E2" };
    default:
      return { color: "#B45309", bg: "#FEF3C7" };
  }
}
