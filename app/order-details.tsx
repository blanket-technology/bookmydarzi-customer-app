/**
 * Full order details — GET /customer/orders/{order_id}/details
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
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import OrderScreenSection from "../src/components/orders/OrderScreenSection";
import { fetchCustomerOrderDetails } from "../src/services/customerOrderService";
import {
  PaymentAlreadyCompletedError,
  confirmRazorpayPayment,
  parsePositiveId,
  resolveBalancePaymentSessionForOrder,
} from "../src/services/paymentService";
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

function DetailsStatusHero({
  payload,
}: {
  payload: CustomerOrderDetailsPayload;
}) {
  const status = payload.order.status ?? "";
  const tone = getCustomerOrderStatusTone(status);
  const iconStyle = STATUS_ICON_STYLES[tone];
  const statusBadge = formatCustomerOrderStatusLabel(status);
  const headline = getDetailsStatusHeadline(payload);
  const orderCode = detailsText(payload.order.order_code);
  const urgency = detailsText(payload.order.urgency_level);
  const amount = getDetailsPaidAmount(payload);

  return (
    <View
      style={[styles.heroCard, cardShadow]}
      accessible
      accessibilityLabel={`${headline}. Status: ${statusBadge}. Order ${orderCode}. Amount paid ${amount}.`}
    >
      <View style={styles.heroTop}>
        <View style={[styles.iconBox, { backgroundColor: iconStyle.bg }]}>
          <Ionicons
            name={iconStyle.iconName}
            size={20}
            color={iconStyle.icon}
          />
        </View>
        <View style={styles.heroText}>
          <View style={styles.badgeRow}>
            <View
              style={[styles.statusBadge, { backgroundColor: iconStyle.bg }]}
            >
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
          <Text style={styles.metaLine}>Order: {orderCode}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>Amount paid</Text>
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
  /** Overall order status — determines whether the final timeline step renders as done. */
  orderStatus: string;
}) {
  if (!items.length) {
    return <Text style={styles.naText}>{DETAILS_NA}</Text>;
  }

  // The last timeline entry only gets a checkmark once the order itself has
  // reached a completed state — not just because it's the last row rendered.
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
                  isLast && styles.timelineDotActive,
                ]}
              >
                {isDone ? (
                  <Ionicons name="checkmark" size={12} color={COLORS.white} />
                ) : null}
              </View>
              {!isLast ? <View style={styles.timelineLine} /> : null}
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
    } catch (err) {
      setPayload(null);
      setError(
        err instanceof Error ? err.message : "Could not load booking details.",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

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

  // Backend issues invoices only once the order is placed — not while it is
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
          <Ionicons
            name="alert-circle-outline"
            size={44}
            color={COLORS.error}
          />
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity
            style={styles.retryBtn}
            onPress={load}
            accessibilityRole="button"
            accessibilityLabel="Retry loading booking details"
          >
            <Text style={styles.retryText}>Retry</Text>
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
            <InfoRow
              label="Amount"
              value={detailsMoney(payload.payment.amount)}
            />
            <RowDivider />
            <InfoRow
              label="Payment method"
              value={detailsText(payload.payment.payment_method)}
            />
            <RowDivider />
            <InfoRow
              label="Payment status"
              value={detailsText(payload.payment.payment_status)}
            />
            <RowDivider />
            <InfoRow
              label="Transaction id"
              value={detailsText(payload.payment.transaction_id)}
            />
          </OrderScreenSection>

          <OrderScreenSection title="Delivery address">
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
            <RowDivider />
            <InfoRow
              label="City"
              value={detailsText(payload.delivery_address.city)}
            />
            <RowDivider />
            <InfoRow
              label="State"
              value={detailsText(payload.delivery_address.state)}
            />
            <RowDivider />
            <InfoRow
              label="Pincode"
              value={detailsText(payload.delivery_address.pincode)}
            />
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
              accessibilityLabel="Chat with tailor"
            >
              <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.primaryDark} />
              <Text style={styles.actionSecondaryText}>Chat with tailor</Text>
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
    borderRadius: 16,
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
    lineHeight: 17,
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
    paddingVertical: 4,
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
    marginVertical: 8,
  },
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 2,
    gap: 12,
  },
  billLabel: { fontSize: 13, color: "#6B7280", flex: 1 },
  billLabelBold: { fontWeight: "700", color: "#1F2937" },
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
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    marginBottom: SPACING.sm,
  },
  actionPrimaryText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  actionSecondary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
    paddingVertical: 13,
    marginBottom: SPACING.sm,
  },
  actionSecondaryText: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },
  actionDisabled: { opacity: 0.6 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  loadingText: { fontSize: 14, color: COLORS.gray },
  errorTitle: { fontSize: 14, color: COLORS.error, textAlign: "center" },
  retryBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: SPACING.sm,
  },
  retryText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
});
