import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS } from "../../../constants/theme";
import { ORDER_DISPLAY_FALLBACK } from "../../types/api";
import { cardShadow } from "../../utils/cardShadow";
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
  showRatingPlaceholder?: boolean;
  /** Optional real rating (0–5). When omitted, shows an all-outline placeholder. */
  rating?: number;
  summaryLinkLabel?: string;
};

function RatingPlaceholder({ rating }: { rating?: number }) {
  const filled = typeof rating === "number" ? Math.round(rating) : 0;
  return (
    <View
      style={styles.starsRow}
      accessible
      accessibilityRole="text"
      accessibilityLabel={
        typeof rating === "number"
          ? `Rated ${rating} out of 5`
          : "Not yet rated"
      }
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Ionicons
          key={i}
          name={i < filled ? "star" : "star-outline"}
          size={18}
          color={i < filled ? "#F5A623" : "#D1D5DB"}
        />
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
  showRatingPlaceholder = true,
  rating,
  summaryLinkLabel = "Booking summary",
}: BookingCompactCardProps) {
  const tone = getCustomerOrderStatusTone(status);
  const iconStyle = STATUS_ICON_STYLES[tone];
  const headline = getBookingHeadline(status, statusLabel);

  const scheduled =
    scheduledLabel && scheduledLabel !== ORDER_DISPLAY_FALLBACK
      ? scheduledLabel.startsWith("Scheduled")
        ? scheduledLabel
        : `Scheduled ${scheduledLabel}`
      : "Scheduled —";

  const amount =
    amountPaidDisplay && amountPaidDisplay !== ORDER_DISPLAY_FALLBACK
      ? amountPaidDisplay
      : "—";

  const bookingIdLabel = bookingId?.trim() ? bookingId.trim() : "—";

  return (
    <View
      style={[styles.card, cardShadow]}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${headline}. Booking ${bookingIdLabel}. ${scheduled}. Amount paid ${amount}.`}
    >
      <View style={styles.sectionTop}>
        <View style={[styles.iconBox, { backgroundColor: iconStyle.bg }]}>
          <Ionicons
            name={iconStyle.iconName}
            size={20}
            color={iconStyle.icon}
          />
        </View>
        <View style={styles.topText}>
          <Text style={styles.headline} numberOfLines={2}>
            {headline}
          </Text>
          <Text style={styles.metaLine} numberOfLines={1}>
            Booking id: {bookingIdLabel}
          </Text>
          <Text style={styles.metaLine} numberOfLines={2}>
            {scheduled}
          </Text>
          {serviceLine ? (
            <Text style={styles.serviceLine} numberOfLines={1}>
              {serviceLine}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.sectionRow}>
        <Text style={styles.rowLabel}>Amount paid</Text>
        <Text style={styles.rowValue}>{amount}</Text>
      </View>

      {onSummaryPress ? (
        <>
          <View style={styles.divider} />
          <View style={styles.sectionFooter}>
            {showRatingPlaceholder ? (
              <RatingPlaceholder rating={rating} />
            ) : (
              <View style={styles.footerSpacer} />
            )}
            <Pressable
              onPress={onSummaryPress}
              style={({ pressed }) => [
                styles.linkBtn,
                pressed && styles.linkPressed,
              ]}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={summaryLinkLabel}
            >
              <Text style={styles.linkText}>{summaryLinkLabel}</Text>
              <Ionicons
                name="chevron-forward"
                size={16}
                color={BOOKING_LINK_GREEN}
              />
            </Pressable>
          </View>
        </>
      ) : null}
    </View>
  );
}

export default memo(BookingCompactCard);

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    marginBottom: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EAED",
    overflow: "hidden",
  },
  sectionTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 12,
    gap: 12,
  },
  iconBox: {
    width: 40,
    height: 40,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  topText: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 20,
    marginBottom: 4,
  },
  metaLine: {
    fontSize: 12,
    fontWeight: "400",
    color: "#6B7280",
    lineHeight: 17,
  },
  serviceLine: {
    fontSize: 12,
    fontWeight: "500",
    color: "#9CA3AF",
    marginTop: 4,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginHorizontal: 14,
  },
  sectionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
    gap: 12,
  },
  rowLabel: {
    fontSize: 13,
    fontWeight: "400",
    color: "#6B7280",
  },
  rowValue: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
  },
  sectionFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
  },
  footerSpacer: {
    flex: 1,
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
    paddingVertical: 4,
    paddingLeft: 8,
  },
  linkPressed: {
    opacity: 0.65,
  },
  linkText: {
    fontSize: 13,
    fontWeight: "600",
    color: BOOKING_LINK_GREEN,
  },
});
