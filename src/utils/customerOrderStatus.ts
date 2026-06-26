/** Raw statuses treated as completed (Completed tab only). */
const COMPLETED_STATUSES = new Set([
  "completed",
  "delivered",
  "done",
  "finished",
  "closed",
]);

export function isCompletedCustomerOrderStatus(
  status: string | null | undefined,
): boolean {
  const normalized = (status ?? "").trim().toLowerCase().replace(/\s+/g, "_");
  if (!normalized) return false;
  return COMPLETED_STATUSES.has(normalized);
}

export function formatCustomerOrderStatusLabel(
  label: string | null | undefined,
): string {
  const raw = (label ?? "").trim();
  if (!raw || raw === "—") return raw || "—";
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
  if (formatted && formatted !== "—") return formatted;
  return "Booking active";
}

export type StatusVisualTone = "success" | "warning" | "neutral" | "error";

export function getCustomerOrderStatusTone(
  status: string | null | undefined,
): StatusVisualTone {
  const s = (status ?? "").toLowerCase();
  if (isCompletedCustomerOrderStatus(s) && !s.includes("cancel")) return "success";
  if (s.includes("cancel")) return "error";
  if (
    s.includes("pending") ||
    s.includes("scheduled") ||
    s.includes("assigned") ||
    s.includes("confirmed") ||
    s.includes("progress")
  ) {
    return "warning";
  }
  return "neutral";
}

export const STATUS_ICON_STYLES: Record<
  StatusVisualTone,
  { bg: string; icon: string; iconName: "checkmark" | "time-outline" | "ellipse-outline" }
> = {
  success: { bg: "#E8F8EF", icon: "#22A06B", iconName: "checkmark" },
  warning: { bg: "#FEF6E7", icon: "#D97706", iconName: "time-outline" },
  neutral: { bg: "#E8F4F6", icon: "#0c6c75", iconName: "ellipse-outline" },
  error: { bg: "#FEECEC", icon: "#DC2626", iconName: "time-outline" },
};

/** Green accent for text links — matches reference */
export const BOOKING_LINK_GREEN = "#1F8A4C";
