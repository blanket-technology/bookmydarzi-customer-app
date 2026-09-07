import {
    getOrderStatusMeta,
    isOrderStatusCompleted,
    normalizeOrderStatus,
    type StatusVisualTone,
} from "../constants/orderStatus";

/**
 * @deprecated Use `isOrderStatusCompleted` from `src/constants/orderStatus`
 * directly. Kept as a thin re-export so existing call sites keep working
 * during the migration - matches the backend's own "Completed" tab
 * semantics: only COMPLETED counts, DELIVERED is still considered active.
 */
export function isCompletedCustomerOrderStatus(
  status: string | null | undefined,
): boolean {
  return isOrderStatusCompleted(status);
}

export function formatCustomerOrderStatusLabel(
  label: string | null | undefined,
): string {
  const raw = (label ?? "").trim();
  if (!raw || raw === "-") return raw || "-";
  return raw
    .replace(/_/g, " ")
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

export function getBookingHeadline(
  status: string | null | undefined,
  statusLabel: string | null | undefined,
): string {
  if (isCompletedCustomerOrderStatus(status)) {
    return "Booking completed";
  }
  const formatted = formatCustomerOrderStatusLabel(statusLabel);
  if (formatted && formatted !== "-") return formatted;
  return "Booking active";
}

export type { StatusVisualTone };

/**
 * @deprecated Use `getOrderStatusMeta(status).tone` from
 * `src/constants/orderStatus` directly - that mapping is curated per status
 * rather than inferred from substring matches, and is the single source of
 * truth other screens should share.
 */
export function getCustomerOrderStatusTone(
  status: string | null | undefined,
) {
  return getOrderStatusMeta(status).tone;
}

export const STATUS_ICON_STYLES: Record<
  StatusVisualTone,
  { bg: string; icon: string; iconName: "checkmark" | "time-outline" | "ellipse-outline" }
> = {
  success: { bg: "#E8F8EF", icon: "#22A06B", iconName: "checkmark" },
  warning: { bg: "#FEF6E7", icon: "#D97706", iconName: "time-outline" },
  neutral: { bg: "#E8F4F6", icon: "#0c6c75", iconName: "ellipse-outline" },
  error: { bg: "#FEECEC", icon: "#DC2626", iconName: "time-outline" },
  info: { bg: "#E8F4F6", icon: "#0c6c75", iconName: "ellipse-outline" },
};

/** Green accent for text links - matches reference */
export const BOOKING_LINK_GREEN = "#1F8A4C";

export interface StatusNarrative {
  headline: string;
  detail: string;
  nextStep: string | null;
}

/**
 * @deprecated Use `getOrderStatusMeta` from `src/constants/orderStatus`
 * directly (its `title`/`description`/`nextStep` fields are this same data,
 * kept in sync with the current 20-status backend state machine). This
 * wrapper exists only so existing call sites keep compiling during the
 * migration - remove once every caller has switched over.
 */
export function getOrderStatusNarrative(status: string | null | undefined): StatusNarrative {
  const meta = getOrderStatusMeta(status);
  return {
    headline: meta.title,
    detail: meta.description,
    nextStep: meta.nextStep,
  };
}

// Re-exported so old imports of `normalizeOrderStatus`-shaped helpers from
// this file keep working; new code should import from constants/orderStatus.
export { normalizeOrderStatus };
