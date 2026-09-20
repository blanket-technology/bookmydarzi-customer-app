import { getBookingHeadline } from "./customerOrderStatus";
import type { CustomerOrderDetailsPayload } from "../types/customerOrders";
import { SUMMARY_NA, summaryDateTime, summaryMoney, summaryText } from "./orderSummaryDisplay";

export { SUMMARY_NA as DETAILS_NA };

export const detailsText = summaryText;
export const detailsMoney = summaryMoney;
export const detailsDateTime = summaryDateTime;

export function detailsMeasurement(
  value: number | string | null | undefined,
): string {
  if (value == null || value === "") return SUMMARY_NA;
  if (typeof value === "number" && Number.isFinite(value)) {
    return `${value}`;
  }
  const trimmed = String(value).trim();
  return trimmed || SUMMARY_NA;
}

export function getDetailsStatusHeadline(payload: CustomerOrderDetailsPayload): string {
  return getBookingHeadline(payload.order.status ?? "");
}

export function getDetailsPaidAmount(payload: CustomerOrderDetailsPayload): string {
  return summaryMoney(payload.payment.amount ?? payload.pricing.final_amount);
}
