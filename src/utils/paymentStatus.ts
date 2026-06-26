/**
 * Payment display helpers — maps API payment/order fields to UI labels.
 */

export type PaymentDisplayStatus = "paid" | "pending" | "failed" | "cod" | "processing";

const SUCCESS_STATUSES = new Set(["paid", "completed", "success"]);
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
