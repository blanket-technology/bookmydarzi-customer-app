import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SHADOW } from "../../../constants/theme";
import { ORDER_DISPLAY_FALLBACK } from "../../types/api";
import { getOrderStatusMeta, normalizeOrderStatus } from "../../constants/orderStatus";
import StatusBadge from "./StatusBadge";
import { ordinalDateOnly } from "../../utils/orderSummaryDisplay";
import { PAYMENT_ACTION_LABELS } from "../../types/payment";
import {
    BOOKING_LINK_GREEN,
    STATUS_ICON_STYLES,
} from "../../utils/customerOrderStatus";

export type BookingCompactCardProps = {
  status: string;
  statusLabel: string;
  /** Absolute service image URL for the card thumbnail. */
  thumbnail?: string | null;
  bookingId: string;
  scheduledLabel: string;
  /** Backend expected_delivery_date (ISO YYYY-MM-DD) - shown as an ETA chip. */
  expectedDeliveryDate?: string | null;
  amountPaidDisplay: string;
  /** Order total in rupees - shown regardless of payment state. */
  orderAmount?: number;
  /** Raw backend payment_status (fully_paid | advance_paid | balance_due | payment_pending | cod_pending | payment_failed | refunded | paid). */
  paymentStatus?: string;
  /** Raw backend payment_method ("online" | "cod") - preferred over inferring from paymentStatus when present. */
  paymentMethod?: string | null;
  pickupType?: string | null;
  pickupTimeSlot?: string | null;
  scheduledPickupAt?: string | null;
  /** Primary line - the specific item/subcategory booked, e.g. "Shirt". */
  serviceName?: string;
  /** Secondary line - the broader category, e.g. "Mens Clothing". */
  categoryName?: string;
  onSummaryPress?: () => void;
  onPayNow?: () => void;
  showRatingPlaceholder?: boolean;
  rating?: number;
  summaryLinkLabel?: string;
};

/**
 * Left border stripe / status-badge color, keyed on the exact normalized
 * status rather than substring guesses:
 *   red    - payment blocked (pending_payment, payment_failed) or the order
 *            didn't go ahead (cancelled, order_rejected)
 *   orange - anywhere in the active fulfillment flow (order_placed through
 *            out_for_delivery)
 *   green  - delivered / completed
 */
const RED_STATUSES = new Set(["pending_payment", "payment_failed", "cancelled", "order_rejected"]);
// inspection_window still reads as "Delivered" to the customer (see
// orderStatus.ts) so it's green too. Every other repair-loop status
// (in_repair, the 3 repair-pickup legs, repair_completed, the 3
// repair-delivery legs) is deliberately left out - something is actively
// happening (garment in transit, mid-repair, awaiting delivery), so they
// stay orange/active rather than reading as fully done. repair_completed
// specifically used to be green when it meant "repair done, nothing left
// to do" - now that a real Bridge delivery leg follows it, it's not done
// yet either.
const GREEN_STATUSES = new Set(["delivered", "completed", "inspection_window"]);

function getStripeColor(status: string): string {
  if (RED_STATUSES.has(status)) return "#DC2626";
  if (GREEN_STATUSES.has(status)) return "#10B981";
  return "#F59E0B";
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
  expectedDeliveryDate,
  amountPaidDisplay,
  orderAmount,
  paymentStatus,
  paymentMethod,
  pickupType,
  pickupTimeSlot,
  scheduledPickupAt,
  serviceName,
  categoryName,
  thumbnail,
  onSummaryPress,
  onPayNow,
  showRatingPlaceholder = true,
  rating,
  summaryLinkLabel = "View details",
}: BookingCompactCardProps) {
  const normalizedStatus = normalizeOrderStatus(status);
  const meta = getOrderStatusMeta(normalizedStatus);
  const iconStyle = STATUS_ICON_STYLES[meta.tone];
  const stripeColor = getStripeColor(normalizedStatus);

  // What did I book - the specific item is the headline, category the
  // subtitle. Falls back to a generic label if the service name is missing
  // (e.g. legacy orders), never leaves the heading blank.
  const headline = serviceName?.trim() || "Booking";

  const statusLower = status.toLowerCase();
  const isPaymentFailed = statusLower === "payment_failed";
  const isPaymentPending = statusLower === "pending_payment";
  const isPaymentAction = (isPaymentFailed || isPaymentPending) && !!onPayNow;
  const payBtnLabel = isPaymentFailed
    ? PAYMENT_ACTION_LABELS.retryPayment
    : PAYMENT_ACTION_LABELS.payNow;

  const scheduled =
    scheduledLabel && scheduledLabel !== ORDER_DISPLAY_FALLBACK
      ? ordinalDateOnly(scheduledLabel)
      : null;

  // Expected-delivery ETA. Hidden for delivered/completed (already arrived)
  // and cancelled orders (no delivery), where it would be misleading.
  const showEta =
    !GREEN_STATUSES.has(normalizedStatus) && !RED_STATUSES.has(normalizedStatus);
  const expectedDelivery =
    showEta && expectedDeliveryDate && expectedDeliveryDate !== ORDER_DISPLAY_FALLBACK
      ? ordinalDateOnly(expectedDeliveryDate)
      : null;

  // Payment method - prefer the backend's actual payment_method field;
  // only fall back to inferring from payment_status (e.g. "cod_pending")
  // when the backend hasn't sent a method yet (no payment row exists,
  // legacy data, etc).
  const paymentMethodLower = (paymentMethod ?? "").toLowerCase();
  const paymentStatusLower = (paymentStatus ?? "").toLowerCase().replace(/[^a-z]/g, "");
  const isCod =
    paymentMethodLower === "cod" ||
    (!paymentMethodLower &&
      (paymentStatusLower === "codpending" || paymentStatusLower === "cod"));
  // isCod is still used below to decide the amount label (Order Amount vs
  // Amount Paid). Payment method is no longer displayed on the list card.

  // A cancelled / rejected order must NOT claim "Amount Paid": a COD order
  // that never reached delivery had no money change hands, so labelling its
  // total as "Amount Paid" is wrong. Show it as the order's value instead.
  // (A genuinely prepaid order that was later cancelled is handled by the
  // refund flow / order details, not this list card.)
  const isCancelled = RED_STATUSES.has(normalizedStatus);

  // For pending/failed online payment we show the TOTAL order amount, not "₹0"
  // paid (Bug Report cycle 1, item 10.1) - the customer needs to see what the
  // order is worth / what they'll owe. COD is likewise the order total (nothing
  // is paid before delivery). Only a genuinely-paid online order shows the
  // amount actually paid.
  const orderTotalDisplay =
    orderAmount != null && orderAmount > 0
      ? `₹${Math.round(orderAmount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`
      : null;
  const showsOrderTotal = isCod || isPaymentPending || isPaymentFailed || isCancelled;
  const amountLabel = showsOrderTotal ? "Order Amount" : "Amount Paid";
  const amount =
    showsOrderTotal
      ? orderTotalDisplay ?? "-"
      : orderTotalDisplay
        ? orderTotalDisplay
        : amountPaidDisplay && amountPaidDisplay !== ORDER_DISPLAY_FALLBACK
          ? amountPaidDisplay
          : "-";

  // Show "Order ID: ORD-..." rather than "#ORD-..." - the code already carries
  // its own ORD- prefix, so a leading # read oddly.
  const bookingIdLabel = bookingId?.trim() ? `Order ID: ${bookingId.trim()}` : "-";

  return (
    <View
      style={styles.card}
      accessible
      accessibilityRole="summary"
      accessibilityLabel={`${headline}. ${bookingIdLabel}. ${amountLabel} ${amount}.`}
    >
      <View style={[styles.stripe, { backgroundColor: stripeColor }]} />

      {/* Whole body is tappable → details (Blinkit/Zepto style). */}
      <Pressable
        onPress={onSummaryPress}
        style={({ pressed }) => [styles.body, pressed && onSummaryPress && styles.bodyPressed]}
        accessibilityRole="button"
        accessibilityLabel={summaryLinkLabel}
      >
        {/* Header: thumbnail + name/category + rating */}
        <View style={styles.header}>
          {thumbnail ? (
            <Image
              source={{ uri: thumbnail }}
              style={styles.thumb}
              contentFit="cover"
              cachePolicy="memory-disk"
              transition={120}
            />
          ) : (
            <View style={[styles.thumb, styles.thumbFallback, { backgroundColor: iconStyle.bg }]}>
              <Ionicons name={iconStyle.iconName} size={24} color={iconStyle.icon} />
            </View>
          )}

          <View style={styles.headlineWrap}>
            <Text style={styles.headline} numberOfLines={1}>{headline}</Text>
            {categoryName ? (
              <Text style={styles.serviceLine} numberOfLines={1}>{categoryName}</Text>
            ) : null}
            <View style={styles.metaRow}>
              <Text style={[styles.metaText, styles.metaTextShrink]} numberOfLines={1}>{bookingIdLabel}</Text>
              {scheduled ? (
                <>
                  <Text style={styles.metaDot}>·</Text>
                  {/* Bug fix: the date previously shared the row with an
                      unbounded Order ID label and got its own numberOfLines=1
                      clipped when the two together overflowed - the date is
                      short/fixed-format, so it must never be the one that
                      shrinks; the Order ID (styles.metaTextShrink, above)
                      gives way instead. */}
                  <Text style={[styles.metaText, styles.metaTextFixed]} numberOfLines={1}>{scheduled}</Text>
                </>
              ) : null}
            </View>
            {/* The "Active" tab merges every in-progress state (order
                placed, tailor assigned, stitching, out for delivery, etc)
                into one list - without a status badge here, a customer
                can't tell two of their own orders apart at a glance without
                tapping into each one. */}
            <StatusBadge status={status} size="sm" style={styles.statusBadgeMargin} />
          </View>

          {showRatingPlaceholder && !onPayNow && rating != null && rating > 0 ? (
            <RatingRow rating={rating} />
          ) : null}
        </View>

        {expectedDelivery ? (
          <View style={styles.etaRow}>
            <Ionicons name="cube-outline" size={13} color="#0c6c75" />
            <Text style={styles.etaText}>
              Expected delivery by <Text style={styles.etaDate}>{expectedDelivery}</Text>
            </Text>
          </View>
        ) : null}

        <View style={styles.divider} />

        {/* Footer: amount (left) / View details (right). Payment method is not
            shown on the list - the amount label already conveys the state, and
            method (COD/Online) is a detail for the order page, not the list. */}
        <View style={styles.footer}>
          <View style={styles.footerLeft}>
            <View style={styles.amountWrap}>
              <Text style={styles.amountLabel}>{amountLabel}</Text>
              <Text style={styles.amountValue}>{amount}</Text>
            </View>
          </View>

          {!isPaymentAction && onPayNow ? (
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
          ) : onSummaryPress ? (
            <View style={styles.viewDetails}>
              <Text style={styles.linkText}>{summaryLinkLabel}</Text>
              <Ionicons name="chevron-forward" size={15} color={BOOKING_LINK_GREEN} />
            </View>
          ) : null}
        </View>
      </Pressable>

      {/* Full-width payment CTA - shown for payment_failed and pending_payment */}
      {isPaymentAction ? (
        <Pressable
          onPress={onPayNow}
          style={({ pressed }) => [
            styles.payStrip,
            isPaymentFailed ? styles.payStripFailed : styles.payStripPending,
            pressed && styles.payStripPressed,
          ]}
          accessibilityRole="button"
          accessibilityLabel={payBtnLabel}
        >
          <Ionicons name="card-outline" size={14} color="#fff" />
          <Text style={styles.payStripText}>{payBtnLabel}</Text>
          <Ionicons name="arrow-forward" size={14} color="rgba(255,255,255,0.7)" />
        </Pressable>
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
    flexDirection: "row",
    overflow: "hidden",
    ...SHADOW.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#ECEEF2",
  },
  stripe: {
    width: 4,
  },
  body: {
    flex: 1,
    padding: 12,
  },
  bodyPressed: { opacity: 0.7 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  thumb: {
    width: 52,
    height: 52,
    borderRadius: 12,
    backgroundColor: "#F1F4F4",
  },
  thumbFallback: {
    alignItems: "center",
    justifyContent: "center",
  },
  headlineWrap: {
    flex: 1,
    minWidth: 0,
  },
  headline: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 19,
  },
  serviceLine: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 1,
  },
  statusBadgeMargin: {
    marginTop: 6,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: 3,
  },
  metaText: {
    fontSize: 11,
    color: "#9CA3AF",
    fontWeight: "500",
  },
  metaTextShrink: {
    flexShrink: 1,
  },
  metaTextFixed: {
    flexShrink: 0,
  },
  metaDot: { fontSize: 11, color: "#C4CACA" },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 10,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: "#F0FAFB",
  },
  etaText: { fontSize: 12, color: "#4B5563", flex: 1 },
  etaDate: { fontWeight: "700", color: "#0c6c75" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginVertical: 10,
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  footerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flexShrink: 1,
  },
  amountWrap: { minWidth: 0 },
  amountLabel: {
    fontSize: 9,
    color: "#9CA3AF",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  amountValue: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  starsRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkPressed: { opacity: 0.6 },
  viewDetails: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  linkText: {
    fontSize: 12.5,
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
    paddingVertical: 7,
  },
  payNowText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#fff",
  },
  payStrip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingVertical: 10,
  },
  payStripPending: {
    backgroundColor: "#D97706",
  },
  payStripFailed: {
    backgroundColor: "#DC2626",
  },
  payStripPressed: {
    opacity: 0.85,
  },
  payStripText: {
    fontSize: 13,
    fontWeight: "700",
    color: "#fff",
  },
});
