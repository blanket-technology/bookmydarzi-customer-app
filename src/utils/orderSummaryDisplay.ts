import {
  formatCustomerOrderStatusLabel,
  getBookingHeadline,
  isCompletedCustomerOrderStatus,
} from "./customerOrderStatus";
import type { CustomerOrderSummaryPayload } from "../types/customerOrders";

export const SUMMARY_NA = "N/A";

export function summaryText(value: string | null | undefined): string {
  const trimmed = (value ?? "").trim();
  return trimmed || SUMMARY_NA;
}

export function summaryMoney(value: number | string | null | undefined): string {
  if (value == null || value === "") return SUMMARY_NA;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return SUMMARY_NA;
    if (trimmed.startsWith("₹")) return trimmed;
    const parsed = Number(trimmed.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(parsed)) {
      return `₹${parsed.toLocaleString("en-IN")}`;
    }
    return trimmed;
  }
  if (!Number.isFinite(value)) return SUMMARY_NA;
  return `₹${value.toLocaleString("en-IN")}`;
}

export function summaryDateTime(value: string | null | undefined): string {
  if (!value?.trim()) return SUMMARY_NA;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.trim();
  return parsed.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export function summaryDateOnly(value: string | null | undefined): string {
  if (!value?.trim()) return SUMMARY_NA;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value.trim();
  return parsed.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function getSummaryStatusHeadline(payload: CustomerOrderSummaryPayload): string {
  const status = payload.order.status ?? "";
  const label = formatCustomerOrderStatusLabel(status);
  return getBookingHeadline(status, label);
}

export function getSummaryScheduledLabel(payload: CustomerOrderSummaryPayload): string {
  const completed = isCompletedCustomerOrderStatus(payload.order.status);
  if (completed) {
    const delivered =
      payload.dates.delivered_at ?? payload.order.completed_at ?? null;
    if (delivered) return `Delivered ${summaryDateTime(delivered)}`;
    return "Delivered -";
  }
  const expected = payload.dates.expected_delivery_date;
  if (expected) return `Expected ${summaryDateOnly(expected)}`;
  return "Expected delivery -";
}

export function getSummaryPlacedLabel(payload: CustomerOrderSummaryPayload): string {
  const placed = payload.dates.order_placed_at;
  if (!placed) return SUMMARY_NA;
  return summaryDateTime(placed);
}

export function getSummaryAmountPaid(payload: CustomerOrderSummaryPayload): string {
  return summaryMoney(payload.billing.total_amount);
}
