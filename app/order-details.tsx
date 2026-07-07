/**
 * Full order details - GET /customer/orders/{order_id}/details
 * Binds to: order, service, pricing, payment, delivery_address, measurement, tracking_timeline
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import OrderScreenSection from "../src/components/orders/OrderScreenSection";
import { getPaymentStatusVisual } from "../src/utils/paymentStatus";
import {
  fetchCustomerOrderDetails,
  fetchOrderRating,
  submitOrderRating,
} from "../src/services/customerOrderService";
import {
  PaymentAlreadyCompletedError,
  confirmRazorpayPayment,
  parsePositiveId,
  resolveBalancePaymentSessionForOrder,
} from "../src/services/paymentService";
import { wsService } from "../src/services/wsService";
import { downloadAndShareInvoice } from "../src/services/invoiceService";
import {
  PaymentCancelledError,
  openRazorpayCheckout,
} from "../src/utils/razorpayCheckout";
import { useAuthStore } from "../store/useAuthStore";
import type {
  CustomerOrderDetailsPayload,
  OrderDetailsTimelineItem,
} from "../src/types/customerOrders";
import { cardShadow } from "../src/utils/cardShadow";
import {
  STATUS_ICON_STYLES,
  formatCustomerOrderStatusLabel,
  getCustomerOrderStatusTone,
  isCompletedCustomerOrderStatus,
} from "../src/utils/customerOrderStatus";
import {
  DETAILS_NA,
  detailsDateTime,
  detailsMeasurement,
  detailsMoney,
  detailsText,
  getDetailsPaidAmount,
  getDetailsStatusHeadline,
} from "../src/utils/orderDetailsDisplay";

// Module-level cache: survives component unmount/remount within the app session.
// Key format: "<orderId>:<status>" — prevents the same popup from repeating.
const _shownPopups = new Set<string>();

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View
      style={styles.infoRow}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={5}>
        {value}
      </Text>
    </View>
  );
}

function RowDivider() {
  return <View style={styles.infoDivider} />;
}

function BillRow({
  label,
  value,
  bold,
  discount,
}: {
  label: string;
  value: string;
  bold?: boolean;
  discount?: boolean;
}) {
  return (
    <View
      style={styles.billRow}
      accessible
      accessibilityLabel={`${label}: ${value}`}
    >
      <Text style={[styles.billLabel, bold && styles.billLabelBold]}>
        {label}
      </Text>
      <Text
        style={[
          styles.billValue,
          bold && styles.billValueBold,
          discount && styles.billDiscount,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

function PaymentStatusBadge({ status }: { status: string | null | undefined }) {
  const visual = getPaymentStatusVisual(status);
  return (
    <View style={[detailBadgeStyles.badge, { backgroundColor: visual.bg }]}>
      <View style={[detailBadgeStyles.dot, { backgroundColor: visual.color }]} />
      <Text style={[detailBadgeStyles.text, { color: visual.color }]}>{visual.label}</Text>
    </View>
  );
}

const detailBadgeStyles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    alignSelf: "flex-start",
  },
  dot: { width: 6, height: 6, borderRadius: 3 },
  text: { fontSize: 12, fontWeight: "700" },
});

function DetailsStatusHero({
  payload,
}: {
  payload: CustomerOrderDetailsPayload;
}) {
  const status = payload.order.status ?? "";
  const tone = getCustomerOrderStatusTone(status);
  const iconStyle = STATUS_ICON_STYLES[tone];
  const statusBadge = payload.order.customer_status ?? formatCustomerOrderStatusLabel(status);
  const headline = getDetailsStatusHeadline(payload);
  const orderCode = detailsText(payload.order.order_code);
  const urgency = detailsText(payload.order.urgency_level);
  const amount = getDetailsPaidAmount(payload);

  const payNorm = (payload.payment.payment_status ?? "").toLowerCase().replace(/[^a-z]/g, "");
  let amountLabel = "Amount paid";
  if (payNorm === "fullypaid" || payNorm === "paid" || payNorm === "success") {
    amountLabel = "Total paid";
  } else if (payNorm === "advancepaid" || payNorm === "partiallypaid") {
    amountLabel = "Advance paid";
  } else if (payNorm === "balancepending" || payNorm === "balancedue") {
    amountLabel = "Advance paid";
  } else if (
    payNorm === "advancepending" || payNorm === "initiated" ||
    payNorm === "pending" || payNorm === "failed" || payNorm === "paymentfailed"
  ) {
    amountLabel = "Amount due";
  }

  return (
    <View
      style={[styles.heroCard, cardShadow]}
      accessible
      accessibilityLabel={`${headline}. Status: ${statusBadge}. Order ${orderCode}. ${amountLabel} ${amount}.`}
    >
      <View style={styles.heroTop}>
        <View style={[styles.iconBox, { backgroundColor: iconStyle.bg }]}>
          <Ionicons name={iconStyle.iconName} size={22} color={iconStyle.icon} />
        </View>
        <View style={styles.heroText}>
          <View style={styles.badgeRow}>
            <View style={[styles.statusBadge, { backgroundColor: iconStyle.bg }]}>
              <Text style={[styles.statusBadgeText, { color: iconStyle.icon }]}>
                {statusBadge}
              </Text>
            </View>
            {urgency !== DETAILS_NA ? (
              <View style={styles.urgencyBadge}>
                <Text style={styles.urgencyText}>{urgency}</Text>
              </View>
            ) : null}
          </View>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.metaLine}>
            <Text style={styles.metaKey}>Order  </Text>
            {orderCode}
          </Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>{amountLabel}</Text>
        <Text style={styles.amountValue}>{amount}</Text>
      </View>
    </View>
  );
}

function TrackingTimeline({
  items,
  orderStatus,
}: {
  items: OrderDetailsTimelineItem[];
  /** Overall order status - determines whether the final timeline step renders as done. */
  orderStatus: string;
}) {
  if (!items.length) {
    return <Text style={styles.naText}>{DETAILS_NA}</Text>;
  }

  // The last timeline entry only gets a checkmark once the order itself has
  // reached a completed state - not just because it's the last row rendered.
  const orderIsCompleted = isCompletedCustomerOrderStatus(orderStatus);

  return (
    <View style={styles.timelineWrap}>
      {items.map((item, index) => {
        const isLast = index === items.length - 1;
        const isDone = !isLast || orderIsCompleted;
        const status = detailsText(item.status);
        const time = detailsDateTime(item.timestamp);

        return (
          <View
            key={`${status}-${index}`}
            style={styles.timelineRow}
            accessible
            accessibilityLabel={`${status}, ${time}${isDone ? ", completed" : ""}`}
          >
            <View style={styles.timelineTrack}>
              <View
                style={[
                  styles.timelineDot,
                  isDone && styles.timelineDotDone,
                  isLast && !isDone && styles.timelineDotActive,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={10} color={COLORS.white} />
                ) : null}
              </View>
              {!isLast ? (
                <View style={[styles.timelineLine, isDone && styles.timelineLineDone]} />
              ) : null}
            </View>
            <View style={styles.timelineContent}>
              <Text
                style={[
                  styles.timelineStatus,
                  isLast && styles.timelineStatusActive,
                ]}
              >
                {status}
              </Text>
              <Text style={styles.timelineTime}>{time}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
}

type StatusCardConfig = {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor: string;
  bg: string;
  border: string;
  message: string;
};

function StatusContextCard({ payload }: { payload: CustomerOrderDetailsPayload }) {
  const status = (payload.order.status ?? "").toLowerCase();
  const pickupType = (payload.order.pickup_type ?? "instant").toLowerCase();

  const configs: Partial<Record<string, StatusCardConfig>> = {
    order_accepted: {
      icon: "checkmark-circle",
      iconColor: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      message:
        pickupType === "scheduled"
          ? "Your order is confirmed! Our team will call you to schedule a convenient cloth pickup time."
          : "Your order is confirmed! Our team will head to your location shortly to collect your cloth.",
    },
    cloth_pickup_pending: {
      icon: "bicycle",
      iconColor: "#F59E0B",
      bg: "#FFFBEB",
      border: "#FDE68A",
      message:
        pickupType === "scheduled"
          ? "Our team will contact you to arrange a convenient pickup time. Please keep your phone reachable."
          : "Our team is on the way to pick up your cloth. Please be available at your delivery address.",
    },
    cloth_picked_up: {
      icon: "checkmark-done-circle",
      iconColor: "#0D9488",
      bg: "#F0FDFA",
      border: "#99F6E4",
      message: "Your cloth has been collected and is on its way to our workshop.",
    },
    cloth_at_hub: {
      icon: "business",
      iconColor: "#7C3AED",
      bg: "#F5F3FF",
      border: "#DDD6FE",
      message: "Your cloth has arrived at our workshop. Stitching will begin shortly.",
    },
    stitching_in_progress: {
      icon: "cut",
      iconColor: "#EC4899",
      bg: "#FDF2F8",
      border: "#FBCFE8",
      message: "Your garment is being carefully stitched by your tailor.",
    },
    stitching_completed: {
      icon: "ribbon",
      iconColor: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      message: "Stitching is complete! Your garment will be out for delivery soon.",
    },
    out_for_delivery: {
      icon: "bicycle",
      iconColor: "#3B82F6",
      bg: "#EFF6FF",
      border: "#BFDBFE",
      message: "Your order is out for delivery. Please be available to receive it.",
    },
    delivered: {
      icon: "home",
      iconColor: "#16A34A",
      bg: "#F0FDF4",
      border: "#BBF7D0",
      message: "Your order has been delivered. We hope you love your new garment!",
    },
  };

  const config = configs[status];
  if (!config) return null;

  return (
    <View
      style={[
        statusCardStyles.card,
        { backgroundColor: config.bg, borderColor: config.border },
      ]}
    >
      <Ionicons name={config.icon} size={20} color={config.iconColor} />
      <Text style={[statusCardStyles.text, { color: config.iconColor }]}>
        {config.message}
      </Text>
    </View>
  );
}

const statusCardStyles = StyleSheet.create({
  card: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    marginBottom: 12,
  },
  text: {
    flex: 1,
    fontSize: 13,
    fontWeight: "600",
    lineHeight: 19,
  },
});

export default function OrderDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(width, 560);

  const orderId = parsePositiveId(
    useLocalSearchParams<{ orderId?: string }>().orderId,
  );

  const user = useAuthStore((s) => s.user);
  const [payload, setPayload] = useState<CustomerOrderDetailsPayload | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<null | "invoice" | "balance">(null);

  // Rating state
  const [ratingValue, setRatingValue] = useState(0);
  const [ratingComment, setRatingComment] = useState("");
  const [alreadyRated, setAlreadyRated] = useState(false);
  const [existingRating, setExistingRating] = useState(0);
  const [ratingBusy, setRatingBusy] = useState(false);

  const showStatusPopup = React.useCallback(
    (status: string, orderCode: string | null) => {
      const code = orderCode ?? `#${orderId}`;
      if (status === "order_accepted") {
        Alert.alert(
          "Order Accepted!",
          `Great news! Your order ${code} has been accepted. Our team will arrange cloth pickup from your location shortly.`,
          [{ text: "Got it", style: "default" }],
        );
      } else if (status === "delivered") {
        Alert.alert(
          "Order Delivered!",
          `Your order ${code} has been delivered. We hope you love your new garment! Thank you for choosing us.`,
          [{ text: "Thanks!", style: "default" }],
        );
      }
    },
    [orderId],
  );

  const load = useCallback(async () => {
    if (orderId === null) {
      setError("Invalid order reference.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await fetchCustomerOrderDetails(orderId);
      setPayload(data);
      // Fetch existing rating when delivered
      if ((data.order.status ?? "").toLowerCase() === "delivered") {
        try {
          const ratingInfo = await fetchOrderRating(orderId);
          if (ratingInfo.already_rated) {
            setAlreadyRated(true);
            setExistingRating(ratingInfo.rating);
            setRatingValue(ratingInfo.rating);
          }
        } catch {
          // non-critical
        }
      }
      // Show a one-time popup per order+status combination (module-level cache persists across remounts)
      const status = (data.order.status ?? "").toLowerCase();
      const cacheKey = `${orderId}:${status}`;
      if (
        (status === "order_accepted" || status === "delivered") &&
        !_shownPopups.has(cacheKey)
      ) {
        _shownPopups.add(cacheKey);
        setTimeout(() => showStatusPopup(status, data.order.order_code), 400);
      }
    } catch (err) {
      setPayload(null);
      setError(
        err instanceof Error ? err.message : "Could not load booking details.",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, showStatusPopup]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  // Re-fetch when the backend pushes an ORDER_STATUS_UPDATED event for this order
  React.useEffect(() => {
    if (orderId === null) return;
    return wsService.on("ORDER_STATUS_UPDATED", (data) => {
      const updatedId = data.order_id ?? data.orderId ?? data.id;
      // null/undefined updatedId means "all orders updated" — refresh anyway
      if (updatedId == null || Number(updatedId) === orderId) {
        load();
      }
    });
  }, [orderId, load]);

  // Normalize "Advance Paid" / "advance_paid" / "balance pending" → "advancepaid" etc.
  const paymentStatus = (payload?.payment.payment_status ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const isBalanceDue =
    !paymentStatus.includes("refund") &&
    !paymentStatus.includes("fullypaid") &&
    (paymentStatus.includes("balancedue") ||
      paymentStatus.includes("advancepaid") ||
      paymentStatus.includes("balancepending") ||
      paymentStatus.includes("partiallypaid") ||
      (paymentStatus.includes("advance") && !paymentStatus.includes("fully")));

  const isAdvancePending =
    !isBalanceDue &&
    (paymentStatus === "advancepending" ||
      paymentStatus === "initiated" ||
      paymentStatus === "paymentfailed" ||
      paymentStatus === "failed");

  // Backend issues invoices only once the order is placed - not while it is
  // pending payment, payment-failed, or cancelled.
  const orderStatusKey = (payload?.order.status ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const invoiceAvailable =
    !!payload &&
    !["pendingpayment", "paymentfailed", "cancelled"].includes(orderStatusKey);

  const handleDownloadInvoice = async () => {
    if (orderId === null || busy) return;
    setBusy("invoice");
    try {
      await downloadAndShareInvoice(orderId, payload?.order.order_code ?? null);
    } catch (err) {
      Alert.alert(
        "Invoice",
        err instanceof Error ? err.message : "Could not download the invoice.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handlePayAdvance = () => {
    if (orderId === null) return;
    const amountRupees = Number(
      payload?.payment.amount ?? payload?.pricing.final_amount ?? 0,
    );
    router.push({
      pathname: "/payment" as never,
      params: {
        orderId: String(orderId),
        amount: String(amountRupees),
        customerName: user?.name ?? "",
        email: user?.email ?? "",
        phone: user?.phone_number ?? "",
      },
    });
  };

  const handlePayBalance = async () => {
    if (orderId === null || busy) return;
    setBusy("balance");
    try {
      const { session } = await resolveBalancePaymentSessionForOrder(orderId);
      const result = await openRazorpayCheckout({
        key: session.razorpay_key,
        amount: session.amount,
        currency: session.currency,
        order_id: session.razorpay_order_id,
        description: "Remaining balance payment",
        prefill: {
          name: user?.name,
          email: user?.email,
          contact: user?.phone_number,
        },
      });
      await confirmRazorpayPayment(session.payment_id, orderId, result);
      Alert.alert("Payment successful", "Your remaining balance has been paid.");
      await load();
    } catch (err) {
      if (err instanceof PaymentCancelledError) {
        setBusy(null);
        return;
      }
      if (err instanceof PaymentAlreadyCompletedError) {
        Alert.alert("Already paid", "This order is already fully paid.");
        await load();
        setBusy(null);
        return;
      }
      Alert.alert(
        "Payment failed",
        err instanceof Error ? err.message : "Could not complete the payment.",
      );
    } finally {
      setBusy(null);
    }
  };

  const handleSubmitRating = async () => {
    if (orderId === null || ratingValue < 1 || ratingBusy || alreadyRated) return;
    setRatingBusy(true);
    try {
      await submitOrderRating(orderId, ratingValue, ratingComment.trim() || undefined);
      setAlreadyRated(true);
      setExistingRating(ratingValue);
      Alert.alert("Thank you!", "Your rating has been submitted.");
    } catch (err) {
      Alert.alert("Error", err instanceof Error ? err.message : "Could not submit rating.");
    } finally {
      setRatingBusy(false);
    }
  };

  const isDelivered = (payload?.order.status ?? "").toLowerCase() === "delivered";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking details</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading details...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load details</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={load}
            accessibilityRole="button"
            accessibilityLabel="Retry loading booking details"
          >
            <Ionicons name="refresh-outline" size={16} color={COLORS.white} />
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : payload ? (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: insets.bottom + SPACING.xl,
              maxWidth: contentMaxWidth,
              alignSelf: "center",
              width: "100%",
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <DetailsStatusHero payload={payload} />

          <StatusContextCard payload={payload} />

          <OrderScreenSection title="Service">
            <Text style={styles.serviceTitle}>
              {detailsText(payload.service.service_name)}
            </Text>
            {payload.service.category_name ? (
              <Text style={styles.serviceSubtitle}>
                {detailsText(payload.service.category_name)}
              </Text>
            ) : null}
            <InfoRow
              label="Base price"
              value={detailsMoney(payload.service.base_price)}
            />
            {payload.order.pickup_type ? (
              <>
                <RowDivider />
                <InfoRow
                  label="Pickup preference"
                  value={
                    payload.order.pickup_type.toLowerCase() === "scheduled"
                      ? "Scheduled pickup"
                      : "Instant pickup"
                  }
                />
                {payload.order.pickup_time_slot ? (
                  <>
                    <RowDivider />
                    <InfoRow label="Pickup slot" value={payload.order.pickup_time_slot} />
                  </>
                ) : null}
                {payload.order.scheduled_pickup_at ? (
                  <>
                    <RowDivider />
                    <InfoRow
                      label="Scheduled for"
                      value={new Date(payload.order.scheduled_pickup_at).toLocaleString("en-IN", {
                        dateStyle: "medium",
                        timeStyle: "short",
                      })}
                    />
                  </>
                ) : null}
              </>
            ) : null}
          </OrderScreenSection>

          <OrderScreenSection title="Pricing">
            <BillRow
              label="Base amount"
              value={detailsMoney(payload.pricing.base_amount)}
            />
            <RowDivider />
            <BillRow
              label="Discount"
              value={detailsMoney(payload.pricing.discount_amount)}
              discount
            />
            <RowDivider />
            <BillRow
              label="GST"
              value={detailsMoney(payload.pricing.gst_amount)}
            />
            <RowDivider />
            <BillRow
              label="Final amount"
              value={detailsMoney(payload.pricing.final_amount)}
              bold
            />
          </OrderScreenSection>

          <OrderScreenSection title="Payment">
            <View style={styles.payStatusRow}>
              <Text style={styles.infoLabel}>Status</Text>
              <PaymentStatusBadge status={payload.payment.payment_status} />
            </View>
            <RowDivider />
            <InfoRow
              label="Amount paid"
              value={detailsMoney(payload.payment.amount)}
            />
            {isBalanceDue && payload.pricing.final_amount != null &&
             payload.payment.amount != null ? (
              <>
                <RowDivider />
                <InfoRow
                  label="Remaining balance"
                  value={detailsMoney(
                    Number(payload.pricing.final_amount) - Number(payload.payment.amount),
                  )}
                />
              </>
            ) : null}
            <RowDivider />
            <InfoRow
              label="Method"
              value={detailsText(payload.payment.payment_method)}
            />
            {payload.payment.transaction_id ? (
              <>
                <RowDivider />
                <InfoRow
                  label="Transaction ID"
                  value={detailsText(payload.payment.transaction_id)}
                />
              </>
            ) : null}
          </OrderScreenSection>

          <OrderScreenSection title="Delivery Address">
            <InfoRow
              label="Name"
              value={detailsText(payload.delivery_address.name)}
            />
            <RowDivider />
            <InfoRow
              label="Mobile"
              value={detailsText(payload.delivery_address.mobile)}
            />
            <RowDivider />
            <InfoRow
              label="Address"
              value={detailsText(payload.delivery_address.address_line_1)}
            />
            {(payload.delivery_address.city || payload.delivery_address.state || payload.delivery_address.pincode) ? (
              <>
                <RowDivider />
                <InfoRow
                  label="Location"
                  value={[
                    payload.delivery_address.city,
                    payload.delivery_address.state,
                    payload.delivery_address.pincode,
                  ]
                    .filter(Boolean)
                    .join(", ")}
                />
              </>
            ) : null}
          </OrderScreenSection>

          <OrderScreenSection title="Measurement">
            <InfoRow
              label="Profile"
              value={detailsText(payload.measurement.profile_name)}
            />
            <RowDivider />
            <InfoRow
              label="Gender"
              value={detailsText(payload.measurement.gender)}
            />
            <RowDivider />
            <InfoRow label="Fit" value={detailsText(payload.measurement.fit)} />
            <RowDivider />
            <InfoRow
              label="Chest"
              value={detailsMeasurement(payload.measurement.chest)}
            />
            <RowDivider />
            <InfoRow
              label="Waist"
              value={detailsMeasurement(payload.measurement.waist)}
            />
          </OrderScreenSection>

          <OrderScreenSection title="Order tracking">
            <TrackingTimeline
              items={payload.tracking_timeline}
              orderStatus={payload.order.status ?? ""}
            />
          </OrderScreenSection>

          {isDelivered ? (
            <OrderScreenSection title="Rate your experience">
              {alreadyRated ? (
                <View style={ratingStyles.doneWrap}>
                  <Ionicons name="star" size={22} color="#F59E0B" />
                  <Text style={ratingStyles.doneText}>
                    You rated this order {existingRating} star{existingRating !== 1 ? "s" : ""}. Thank you!
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={ratingStyles.prompt}>How was your experience?</Text>
                  <View style={ratingStyles.starsRow}>
                    {[1, 2, 3, 4, 5].map((star) => (
                      <TouchableOpacity
                        key={star}
                        onPress={() => setRatingValue(star)}
                        hitSlop={8}
                        accessibilityLabel={`Rate ${star} star${star !== 1 ? "s" : ""}`}
                      >
                        <Ionicons
                          name={star <= ratingValue ? "star" : "star-outline"}
                          size={32}
                          color={star <= ratingValue ? "#F59E0B" : "#D1D5DB"}
                        />
                      </TouchableOpacity>
                    ))}
                  </View>
                  {ratingValue > 0 ? (
                    <TextInput
                      style={ratingStyles.commentInput}
                      placeholder="Add a comment (optional)"
                      placeholderTextColor="#9CA3AF"
                      value={ratingComment}
                      onChangeText={setRatingComment}
                      multiline
                      maxLength={500}
                      numberOfLines={3}
                    />
                  ) : null}
                  <TouchableOpacity
                    style={[
                      ratingStyles.submitBtn,
                      (ratingValue < 1 || ratingBusy) && ratingStyles.submitDisabled,
                    ]}
                    onPress={handleSubmitRating}
                    disabled={ratingValue < 1 || ratingBusy}
                    accessibilityRole="button"
                    accessibilityLabel="Submit rating"
                  >
                    {ratingBusy ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={ratingStyles.submitText}>Submit rating</Text>
                    )}
                  </TouchableOpacity>
                </>
              )}
            </OrderScreenSection>
          ) : null}

          <OrderScreenSection title="Actions">
            {isAdvancePending ? (
              <TouchableOpacity
                style={[styles.actionPrimary, busy !== null && styles.actionDisabled]}
                onPress={handlePayAdvance}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="Pay now"
              >
                <Ionicons name="card-outline" size={18} color={COLORS.white} />
                <Text style={styles.actionPrimaryText}>Pay now</Text>
              </TouchableOpacity>
            ) : null}

            {isBalanceDue ? (
              <TouchableOpacity
                style={[styles.actionPrimary, busy !== null && styles.actionDisabled]}
                onPress={handlePayBalance}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="Pay remaining balance"
              >
                {busy === "balance" ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <Ionicons name="card-outline" size={18} color={COLORS.white} />
                )}
                <Text style={styles.actionPrimaryText}>Pay remaining balance</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.actionSecondary, busy !== null && styles.actionDisabled]}
              onPress={() =>
                router.push({
                  pathname: "/chat" as never,
                  params: { orderId: String(orderId) },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Chat with support"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primaryDark} />
              <Text style={styles.actionSecondaryText}>Chat</Text>
            </TouchableOpacity>

            {invoiceAvailable ? (
              <TouchableOpacity
                style={[styles.actionSecondary, busy !== null && styles.actionDisabled]}
                onPress={handleDownloadInvoice}
                disabled={busy !== null}
                accessibilityRole="button"
                accessibilityLabel="Download invoice"
              >
                {busy === "invoice" ? (
                  <ActivityIndicator size="small" color={COLORS.primaryDark} />
                ) : (
                  <Ionicons name="download-outline" size={18} color={COLORS.primaryDark} />
                )}
                <Text style={styles.actionSecondaryText}>Download invoice</Text>
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity
              style={[styles.actionSecondary, busy !== null && styles.actionDisabled]}
              onPress={() =>
                router.push({
                  pathname: "/support" as never,
                  params: { orderId: String(orderId) },
                })
              }
              accessibilityRole="button"
              accessibilityLabel="Get help with this order"
            >
              <Ionicons name="help-buoy-outline" size={18} color={COLORS.primaryDark} />
              <Text style={styles.actionSecondaryText}>Get help</Text>
            </TouchableOpacity>
          </OrderScreenSection>
        </ScrollView>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FA" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: "#F5F7FA",
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EAED",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black },
  scroll: { padding: SPACING.lg, paddingTop: SPACING.sm },
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E8EAED",
    overflow: "hidden",
  },
  heroTop: {
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
  heroText: { flex: 1, minWidth: 0 },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 6,
  },
  statusBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "capitalize",
  },
  urgencyBadge: {
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: "#F3F4F6",
  },
  urgencyText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#6B7280",
    textTransform: "capitalize",
  },
  headline: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 22,
    marginBottom: 6,
  },
  metaLine: {
    fontSize: 12,
    color: "#6B7280",
    lineHeight: 18,
  },
  metaKey: { fontWeight: "600", color: "#9CA3AF" },
  payStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginHorizontal: 14,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  amountLabel: { fontSize: 13, color: "#6B7280" },
  amountValue: { fontSize: 15, fontWeight: "700", color: "#1F2937" },
  serviceTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
    marginBottom: 4,
  },
  serviceSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 7,
  },
  infoLabel: {
    flex: 0.9,
    fontSize: 13,
    color: "#6B7280",
  },
  infoValue: {
    flex: 1.3,
    fontSize: 13,
    fontWeight: "600",
    color: "#1F2937",
    textAlign: "right",
  },
  infoDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginVertical: 2,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  billLabel: { fontSize: 13, color: "#6B7280", flex: 1 },
  billLabelBold: { fontWeight: "700", color: "#1F2937", fontSize: 14 },
  billValue: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  billValueBold: { fontSize: 15, fontWeight: "800" },
  billDiscount: { color: "#16A34A" },
  timelineWrap: { paddingTop: 4 },
  timelineRow: {
    flexDirection: "row",
    minHeight: 56,
  },
  timelineTrack: {
    width: 28,
    alignItems: "center",
  },
  timelineDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#E5E7EB",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: COLORS.white,
  },
  timelineDotDone: {
    backgroundColor: "#22A06B",
  },
  timelineDotActive: {
    backgroundColor: COLORS.primaryDark,
    width: 24,
    height: 24,
    borderRadius: 12,
  },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#E5E7EB",
    marginVertical: 2,
  },
  timelineLineDone: {
    backgroundColor: "#22A06B",
  },
  timelineContent: {
    flex: 1,
    paddingBottom: 14,
    paddingLeft: 4,
  },
  timelineStatus: {
    fontSize: 14,
    fontWeight: "600",
    color: "#6B7280",
    marginBottom: 2,
  },
  timelineStatusActive: {
    color: "#1F2937",
    fontWeight: "700",
  },
  timelineTime: {
    fontSize: 12,
    color: "#9CA3AF",
  },
  naText: { fontSize: 13, color: "#6B7280" },
  actionPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    marginBottom: SPACING.sm,
    ...SHADOW.card,
  },
  actionPrimaryText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  actionSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingVertical: 13,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.primaryLight,
  },
  actionSecondaryText: { fontSize: 14, fontWeight: "600", color: COLORS.primaryDark },
  actionDisabled: { opacity: 0.55 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  loadingText: { fontSize: 14, color: COLORS.gray },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  errorTitle: { fontSize: 16, fontWeight: "700", color: "#1F2937" },
  errorSub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 24,
    paddingVertical: 11,
    marginTop: SPACING.sm,
  },
  retryText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
});

const ratingStyles = StyleSheet.create({
  prompt: { fontSize: 14, color: COLORS.gray, marginBottom: 12 },
  starsRow: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 14,
  },
  commentInput: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md,
    padding: 12,
    fontSize: 14,
    color: COLORS.black,
    minHeight: 72,
    textAlignVertical: "top",
    marginBottom: 14,
  },
  submitBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingVertical: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
  doneWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 8,
  },
  doneText: { fontSize: 14, fontWeight: "600", color: "#92400E", flex: 1 },
});
