import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SHADOW } from "../../../constants/theme";
import { ORDER_DISPLAY_FALLBACK } from "../../types/api";
import {
  BOOKING_LINK_GREEN,
  getBookingHeadline,
  getCustomerOrderStatusTone,
  STATUS_ICON_STYLES,
} from "../../utils/customerOrderStatus";

export type BookingCompactCardProps = {
  status: string;
  statusLabel: string;
  bookingId: string;
  scheduledLabel: string;
  amountPaidDisplay: string;
  serviceLine?: string;
  onSummaryPress?: () => void;
  onPayNow?: () => void;
  showRatingPlaceholder?: boolean;
  rating?: number;
  summaryLinkLabel?: string;
};

const TONE_STRIPE: Record<string, string> = {
  pending: "#F59E0B",
  confirmed: "#3B82F6",
  in_progress: "#8B5CF6",
  completed: "#10B981",
  cancelled: "#EF4444",
  default: "#9CA3AF",
};

const TONE_BADGE_BG: Record<string, string> = {
  pending: "#FEF3C7",
  confirmed: "#DBEAFE",
  in_progress: "#EDE9FE",
  completed: "#D1FAE5",
  cancelled: "#FEE2E2",
  default: "#F3F4F6",
};

const TONE_BADGE_TEXT: Record<string, string> = {
  pending: "#B45309",
  confirmed: "#1D4ED8",
  in_progress: "#6D28D9",
  completed: "#059669",
  cancelled: "#DC2626",
  default: "#6B7280",
};

function getStatusToneKey(status: string): string {
  const s = status.trim().toLowerCase().replace(/\s+/g, "_");
  if (s.includes("cancel")) return "cancelled";
  if (s.includes("complet") || s.includes("deliver") || s.includes("done")) return "completed";
  if (s.includes("progress")) return "in_progress";
  if (s.includes("confirm")) return "confirmed";
  if (s.includes("pending")) return "pending";
  return "default";
}

function StatusBadge({ statusLabel, toneKey }: { statusLabel: string; toneKey: string }) {
  return (
    <View style={[styles.badge, { backgroundColor: TONE_BADGE_BG[toneKey] ?? TONE_BADGE_BG.default }]}>
      <Text style={[styles.badgeText, { color: TONE_BADGE_TEXT[toneKey] ?? TONE_BADGE_TEXT.default }]}>
        {statusLabel}
      </Text>
    </View>
  );
}

function RatingRow({ rating }: { rating?: number }) {
  const filled = typeof rating === "number" ? Math.round(rating) : 0;
  return (
    <View style={styles.starsRow} accessibilityRole="text"
      accessibilityLabel={typeof rating === "number" ? `Rated ${rating} out of 5` : "Not yet rated"}>
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons key={i} name={i < filled ? "star" : "star-outline"}
          size={15} color={i < filled ? "#F59E0B" : "#D1D5DB"} />
      ))}
    </View>
  );
}

function BookingCompactCard({
  status,
  statusLabel,
  bookingId,
  scheduledLabel,
  amountPaidDisplay,
  serviceLine,
  onSummaryPress,
  onPayNow,
  showRatingPlaceholder = true,
  rating,
  summaryLinkLabel = "View details",
}: BookingCompactCardProps) {
  const tone = getCustomerOrderStatusTone(status);
  const iconStyle = STATUS_ICON_STYLES[tone];
  const headline = getBookingHeadline(status, statusLabel);
  const toneKey = getStatusToneKey(status);
  const stripeColor = TONE_STRIPE[toneKey] ?? TONE_STRIPE.default;

  const scheduled =
    scheduledLabel && scheduledLabel !== ORDER_DISPLAY_FALLBACK
      ? scheduledLabel.startsWith("Scheduled") ? scheduledLabel : `Scheduled ${scheduledLabel}`
      : null;

  const amount =
    amountPaidDisplay && amountPaidDisplay !== ORDER_DISPLAY_FALLBACK
      ? amountPaidDisplay : "-";

  const bookingIdLabel = bookingId?.trim() ? `#${bookingId.trim()}` : "-";

  return (
    <View style={styles.card} accessible accessibilityRole="summary"
      accessibilityLabel={`${headline}. Booking ${bookingIdLabel}. Amount paid ${amount}.`}>
      {/* Left status stripe */}
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      <View style={styles.inner}>
        {/* Top row: icon + headline + badge */}
        <View style={styles.topRow}>
          <View style={[styles.iconBox, { backgroundColor: iconStyle.bg }]}>
            <Ionicons name={iconStyle.iconName} size={18} color={iconStyle.icon} />
          </View>
          <View style={styles.headlineWrap}>
            <Text style={styles.headline} numberOfLines={1}>{headline}</Text>
            {serviceLine ? (
              <Text style={styles.serviceLine} numberOfLines={1}>{serviceLine}</Text>
            ) : null}
          </View>
          <StatusBadge statusLabel={statusLabel} toneKey={toneKey} />
        </View>

        {/* Meta row */}
        <View style={styles.metaRow}>
          <View style={styles.metaItem}>
            <Ionicons name="pricetag-outline" size={11} color={COLORS.gray} />
            <Text style={styles.metaText}>{bookingIdLabel}</Text>
          </View>
          {scheduled ? (
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={11} color={COLORS.gray} />
              <Text style={styles.metaText} numberOfLines={1}>{scheduled}</Text>
            </View>
          ) : null}
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Bottom row: amount + actions */}
        <View style={styles.bottomRow}>
          <View>
            <Text style={styles.amountLabel}>Amount paid</Text>
            <Text style={styles.amountValue}>{amount}</Text>
          </View>

          <View style={styles.rightFooter}>
            {onPayNow ? (
              <Pressable
                onPress={onPayNow}
                style={({ pressed }) => [styles.payNowBtn, pressed && styles.linkPressed]}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel="Pay now"
              >
                <Ionicons name="card-outline" size={13} color="#fff" />
                <Text style={styles.payNowText}>Pay Now</Text>
              </Pressable>
            ) : null}
            {onSummaryPress ? (
              <>
                {showRatingPlaceholder && !onPayNow && rating != null && rating > 0 ? (
                  <RatingRow rating={rating} />
                ) : null}
                <Pressable onPress={onSummaryPress} style={({ pressed }) => [styles.linkBtn, pressed && styles.linkPressed]}
                  hitSlop={8} accessibilityRole="button" accessibilityLabel={summaryLinkLabel}>
                  <Text style={styles.linkText}>{summaryLinkLabel}</Text>
                  <Ionicons name="chevron-forward" size={14} color={BOOKING_LINK_GREEN} />
                </Pressable>
              </>
            ) : null}
          </View>
        </View>
      </View>
    </View>
  );
}

export default memo(BookingCompactCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 18,
    marginBottom: 14,
    flexDirection: "row",
    overflow: "hidden",
    ...SHADOW.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ECEEF2",
  },
  stripe: {
    width: 4,
    borderTopLeftRadius: 18,
    borderBottomLeftRadius: 18,
  },
  inner: {
    flex: 1,
    padding: 14,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginBottom: 10,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  headlineWrap: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 19,
  },
  serviceLine: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
  },
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 8,
    paddingVertical: 3,
    alignSelf: "flex-start",
    flexShrink: 0,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
  metaRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 10,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  metaText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginBottom: 10,
  },
  bottomRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  amountLabel: {
    fontSize: 10,
    color: "#9CA3AF",
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 2,
  },
  amountValue: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  rightFooter: {
    alignItems: "flex-end",
    gap: 6,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkPressed: { opacity: 0.6 },
  linkText: {
    fontSize: 12,
    fontWeight: "700",
    color: BOOKING_LINK_GREEN,
  },
  payNowBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#DC2626",
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: 4,
  },
  payNowText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
});
