import { Ionicons } from "@expo/vector-icons";
import React, { memo, useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../../constants/theme";
import { getOrderStatusMeta } from "../../../constants/orderStatus";
import { orderDisplayValue } from "../../../types/api";

export interface PickupInfoCardProps {
  pickupType: string | null | undefined;
  pickupTimeSlot: string | null | undefined;
  scheduledPickupAt: string | null | undefined;
  /** Current order status - determines which pickup state to show. */
  status: string | null | undefined;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" });
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", hour12: true });
}

function useCountdown(targetIso: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!targetIso) return;
    const id = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(id);
  }, [targetIso]);

  if (!targetIso) return null;
  const target = new Date(targetIso).getTime();
  if (Number.isNaN(target)) return null;
  const diffMs = target - now;
  if (diffMs <= 0) return "Any moment now";

  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 60) return `In ${diffMin} min${diffMin === 1 ? "" : "s"}`;
  const diffHr = Math.floor(diffMin / 60);
  const remMin = diffMin % 60;
  if (diffHr < 24) return `In ${diffHr}h ${remMin}m`;
  const diffDays = Math.floor(diffHr / 24);
  return `In ${diffDays} day${diffDays === 1 ? "" : "s"}`;
}

/**
 * Read-only display of pickup type/date/time/countdown. Pickup type/slot is
 * captured server-side at checkout - this component never lets the customer
 * set or change it (no backend endpoint exists for customer-initiated
 * pickup scheduling; only employees schedule pickup, see
 * app/(employee)/order-detail.tsx).
 */
const PickupInfoCard = memo(
  ({ pickupType, pickupTimeSlot, scheduledPickupAt, status }: PickupInfoCardProps) => {
    const meta = getOrderStatusMeta(status);
    const isScheduled = (pickupType ?? "").toLowerCase() === "scheduled";
    const countdown = useCountdown(
      meta.status === "pickup_scheduled" || meta.status === "pickup_pending"
        ? scheduledPickupAt
        : null,
    );

    // Nothing pickup-relevant to show yet, or pickup has already completed -
    // this card is for the "pickup is coming up" window only.
    const relevantStatuses = new Set([
      "order_accepted",
      "searching_tailor",
      "broadcasted",
      "tailor_assigned",
      "pickup_scheduled",
      "pickup_pending",
    ]);
    if (!relevantStatuses.has(meta.status)) return null;

    return (
      <View style={styles.card}>
        <View style={styles.headerRow}>
          <Ionicons
            name={isScheduled ? "calendar-outline" : "bicycle-outline"}
            size={18}
            color={COLORS.primaryDark}
          />
          <Text style={styles.headerText}>
            {isScheduled ? "Scheduled Pickup" : "Instant Pickup"}
          </Text>
        </View>

        {isScheduled && scheduledPickupAt ? (
          <View style={styles.row}>
            <Text style={styles.label}>Date</Text>
            <Text style={styles.value}>{formatDate(scheduledPickupAt)}</Text>
          </View>
        ) : null}

        {isScheduled && scheduledPickupAt ? (
          <View style={styles.row}>
            <Text style={styles.label}>Time</Text>
            <Text style={styles.value}>
              {orderDisplayValue(pickupTimeSlot) !== "-"
                ? orderDisplayValue(pickupTimeSlot)
                : formatTime(scheduledPickupAt)}
            </Text>
          </View>
        ) : null}

        {!isScheduled ? (
          <Text style={styles.description}>
            Our team will arrive shortly to collect your fabric.
          </Text>
        ) : null}

        {countdown ? (
          <View style={styles.countdownPill}>
            <Ionicons name="time-outline" size={13} color={COLORS.primaryDark} />
            <Text style={styles.countdownText}>{countdown}</Text>
          </View>
        ) : null}

        <View style={styles.stateRow}>
          <Ionicons
            name={meta.icon}
            size={14}
            color="#D97706"
          />
          <Text style={styles.stateText}>{meta.customerLabel}</Text>
        </View>
      </View>
    );
  },
);

PickupInfoCard.displayName = "PickupInfoCard";
export default PickupInfoCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    gap: SPACING.sm,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  headerText: {
    ...TYPOGRAPHY.heading.h3,
    color: COLORS.black,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  label: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.gray,
  },
  value: {
    ...TYPOGRAPHY.body.md,
    fontWeight: "700",
    color: COLORS.black,
  },
  description: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.gray,
  },
  countdownPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    alignSelf: "flex-start",
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
  },
  countdownText: {
    ...TYPOGRAPHY.label.sm,
    color: COLORS.primaryDark,
    textTransform: "none",
    letterSpacing: 0,
  },
  stateRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
  },
  stateText: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.gray,
  },
});
