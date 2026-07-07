/**
 * Order booking summary - GET /customer/orders/{order_id}/summary
 * Binds to nested payload: order, dates, service, billing, payment, delivery_address
 */
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/useAuthStore";
import { useFocusEffect } from "@react-navigation/native";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import { fetchCustomerOrderSummary } from "../src/services/customerOrderService";
import { parsePositiveId } from "../src/services/paymentService";
import type { CustomerOrderSummaryPayload } from "../src/types/customerOrders";
import OrderScreenSection from "../src/components/orders/OrderScreenSection";
import { cardShadow } from "../src/utils/cardShadow";
import {
  BOOKING_LINK_GREEN,
  STATUS_ICON_STYLES,
  formatCustomerOrderStatusLabel,
  getCustomerOrderStatusTone,
} from "../src/utils/customerOrderStatus";
import {
  SUMMARY_NA,
  getSummaryPlacedLabel,
  getSummaryScheduledLabel,
  getSummaryStatusHeadline,
  summaryMoney,
  summaryText,
} from "../src/utils/orderSummaryDisplay";
import { getPaymentStatusVisual } from "../src/utils/paymentStatus";

// ─── Shared primitives ────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue} numberOfLines={4}>
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
  highlight,
}: {
  label: string;
  value: string;
  bold?: boolean;
  discount?: boolean;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.billRow, highlight && styles.billRowHighlight]}>
      <Text style={[styles.billLabel, bold && styles.billLabelBold]}>{label}</Text>
      <Text
        style={[
          styles.billValue,
          bold && styles.billValueBold,
          discount && styles.billDiscount,
          highlight && styles.billValueHighlight,
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
    <View style={[styles.payBadge, { backgroundColor: visual.bg }]}>
      <View style={[styles.payBadgeDot, { backgroundColor: visual.color }]} />
      <Text style={[styles.payBadgeText, { color: visual.color }]}>{visual.label}</Text>
    </View>
  );
}

// ─── Hero card ────────────────────────────────────────────────────────────────

function SummaryStatusHero({ payload }: { payload: CustomerOrderSummaryPayload }) {
  const status = payload.order.status ?? "";
  const tone = getCustomerOrderStatusTone(status);
  const iconStyle = STATUS_ICON_STYLES[tone];
  const statusBadge = formatCustomerOrderStatusLabel(status);
  const headline = getSummaryStatusHeadline(payload);
  const bookingId = summaryText(payload.order.order_code);
  const placed = getSummaryPlacedLabel(payload);
  const schedule = getSummaryScheduledLabel(payload);

  // Context-aware amount row
  const payStatus = (payload.payment.payment_status ?? "").toLowerCase().replace(/[^a-z]/g, "");
  let amountLabel = "Amount paid";
  let amountValue = summaryMoney(payload.billing.total_amount);
  if (payStatus === "fullypaid" || payStatus === "paid" || payStatus === "success") {
    amountLabel = "Total paid";
  } else if (payStatus === "advancepaid" || payStatus === "partiallypaid") {
    amountLabel = "Advance paid";
  } else if (payStatus === "balancepending" || payStatus === "balancedue") {
    amountLabel = "Advance paid";
  } else if (
    payStatus === "advancepending" ||
    payStatus === "initiated" ||
    payStatus === "pending" ||
    payStatus === "failed" ||
    payStatus === "paymentfailed"
  ) {
    amountLabel = "Amount due";
  }

  return (
    <View style={[styles.heroCard, cardShadow]}>
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
          </View>
          <Text style={styles.headline}>{headline}</Text>
          <Text style={styles.metaLine}>
            <Text style={styles.metaKey}>Booking ID  </Text>
            {bookingId}
          </Text>
          <Text style={styles.metaLine}>
            <Text style={styles.metaKey}>Placed  </Text>
            {placed}
          </Text>
          <Text style={styles.metaLine}>{schedule}</Text>
        </View>
      </View>

      <View style={styles.divider} />

      <View style={styles.amountRow}>
        <Text style={styles.amountLabel}>{amountLabel}</Text>
        <Text style={styles.amountValue}>{amountValue}</Text>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function OrderSummaryScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const contentMaxWidth = Math.min(width, 560);
  const user = useAuthStore((s) => s.user);

  const orderId = parsePositiveId(useLocalSearchParams<{ orderId?: string }>().orderId);

  const [payload, setPayload] = useState<CustomerOrderSummaryPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (orderId === null) {
      setError("Invalid order reference.");
      setLoading(false);
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const data = await fetchCustomerOrderSummary(orderId);
      setPayload(data);
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : "Could not load booking summary.");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const navigateToDetails = () => {
    if (orderId === null) return;
    router.push({
      pathname: "/order-details" as never,
      params: { orderId: String(orderId) },
    });
  };

  const paymentStatusKey = (payload?.payment.payment_status ?? "")
    .toLowerCase()
    .replace(/[^a-z]/g, "");
  const needsPayment =
    paymentStatusKey === "advancepending" ||
    paymentStatusKey === "initiated" ||
    paymentStatusKey === "paymentfailed" ||
    paymentStatusKey === "failed";

  const handlePayNow = () => {
    if (orderId === null || !payload) return;
    const amountRupees = Number(payload.billing.total_amount ?? 0);
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

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking Summary</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading summary…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <View style={styles.errorIconWrap}>
            <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
          </View>
          <Text style={styles.errorTitle}>Couldn't load summary</Text>
          <Text style={styles.errorSub}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Ionicons name="refresh-outline" size={16} color={COLORS.white} />
            <Text style={styles.retryText}>Try again</Text>
          </TouchableOpacity>
        </View>
      ) : payload ? (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: insets.bottom + 100,
              maxWidth: contentMaxWidth,
              alignSelf: "center",
              width: "100%",
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SummaryStatusHero payload={payload} />

          {/* Service */}
          <OrderScreenSection title="Service">
            <Text style={styles.serviceTitle}>
              {summaryText(payload.service.service_name)}
            </Text>
            {payload.service.category_name ? (
              <Text style={styles.serviceSubtitle}>
                {summaryText(payload.service.category_name)}
              </Text>
            ) : null}
            {payload.service.quantity != null ? (
              <>
                <RowDivider />
                <InfoRow label="Quantity" value={String(payload.service.quantity)} />
              </>
            ) : null}
          </OrderScreenSection>

          {/* Billing */}
          <OrderScreenSection title="Price Breakdown">
            <BillRow label="Item total" value={summaryMoney(payload.billing.item_total)} />
            {Number(payload.billing.service_fee) > 0 ? (
              <>
                <View style={styles.billDivider} />
                <BillRow label="Convenience fee" value={summaryMoney(payload.billing.service_fee)} />
              </>
            ) : null}
            {Number(payload.billing.cgst_amount) > 0 || Number(payload.billing.sgst_amount) > 0 ? (
              <>
                <View style={styles.billDivider} />
                <BillRow label="CGST (2.5%)" value={summaryMoney(payload.billing.cgst_amount)} />
                <View style={styles.billDivider} />
                <BillRow label="SGST (2.5%)" value={summaryMoney(payload.billing.sgst_amount)} />
              </>
            ) : Number(payload.billing.gst_amount) > 0 ? (
              <>
                <View style={styles.billDivider} />
                <BillRow label="GST (5%)" value={summaryMoney(payload.billing.gst_amount)} />
              </>
            ) : null}
            {Number(payload.billing.discount) > 0 ? (
              <>
                <View style={styles.billDivider} />
                <BillRow
                  label="Discount"
                  value={`- ${summaryMoney(payload.billing.discount)}`}
                  discount
                />
              </>
            ) : null}
            <View style={styles.billDividerBold} />
            <BillRow
              label="Total amount"
              value={summaryMoney(payload.billing.total_amount)}
              bold
              highlight
            />
          </OrderScreenSection>

          {/* Payment */}
          <OrderScreenSection title="Payment">
            <View style={styles.paymentStatusRow}>
              <Text style={styles.infoLabel}>Payment status</Text>
              <PaymentStatusBadge status={payload.payment.payment_status} />
            </View>
            <RowDivider />
            <InfoRow
              label="Method"
              value={summaryText(payload.payment.payment_method)}
            />
            {payload.payment.transaction_id ? (
              <>
                <RowDivider />
                <InfoRow
                  label="Transaction ID"
                  value={summaryText(payload.payment.transaction_id)}
                />
              </>
            ) : null}
          </OrderScreenSection>

          {/* Delivery address */}
          <OrderScreenSection title="Delivery Address">
            <InfoRow label="Name" value={summaryText(payload.delivery_address.name)} />
            <RowDivider />
            <InfoRow label="Mobile" value={summaryText(payload.delivery_address.mobile)} />
            <RowDivider />
            <InfoRow
              label="Address"
              value={summaryText(payload.delivery_address.full_address)}
            />
          </OrderScreenSection>

          {/* CTAs */}
          {needsPayment ? (
            <Pressable
              style={({ pressed }) => [styles.payNowCta, pressed && { opacity: 0.88 }]}
              onPress={handlePayNow}
            >
              <Ionicons name="card-outline" size={18} color={COLORS.white} />
              <Text style={styles.payNowCtaText}>Pay Now</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.footerCta, pressed && { opacity: 0.88 }]}
            onPress={navigateToDetails}
          >
            <Text style={styles.footerCtaText}>View Full Booking Details</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
          </Pressable>
        </ScrollView>
      ) : null}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F7FA" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black },

  scroll: { padding: SPACING.lg, paddingTop: SPACING.md },

  // Hero
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 12,
    gap: 12,
  },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  heroText: { flex: 1, minWidth: 0 },
  badgeRow: { marginBottom: 6 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  headline: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 22,
    marginBottom: 6,
  },
  metaLine: { fontSize: 12, color: "#6B7280", lineHeight: 18 },
  metaKey: { fontWeight: "600", color: "#9CA3AF" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginHorizontal: SPACING.md,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
  },
  amountLabel: { fontSize: 13, color: "#6B7280" },
  amountValue: { fontSize: 16, fontWeight: "800", color: "#1F2937" },

  // Service
  serviceTitle: { fontSize: 15, fontWeight: "700", color: "#1F2937", marginBottom: 2 },
  serviceSubtitle: { fontSize: 13, color: "#6B7280", marginBottom: 4 },

  // Info rows
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: 12,
    paddingVertical: 7,
  },
  infoLabel: { flex: 0.9, fontSize: 13, color: "#6B7280" },
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

  // Bill rows
  billRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    gap: 12,
  },
  billRowHighlight: {
    backgroundColor: "#F0FDF4",
    borderRadius: RADIUS.sm,
    paddingHorizontal: 8,
    marginHorizontal: -8,
  },
  billDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginVertical: 2,
  },
  billDividerBold: {
    height: 1,
    backgroundColor: "#D1D5DB",
    marginVertical: 6,
  },
  billLabel: { fontSize: 13, color: "#6B7280", flex: 1 },
  billLabelBold: { fontWeight: "700", color: "#1F2937", fontSize: 14 },
  billValue: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  billValueBold: { fontSize: 15, fontWeight: "800", color: "#1F2937" },
  billValueHighlight: { color: COLORS.primaryDark },
  billDiscount: { color: "#16A34A" },

  // Payment status badge
  paymentStatusRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 7,
  },
  payBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  payBadgeDot: { width: 6, height: 6, borderRadius: 3 },
  payBadgeText: { fontSize: 12, fontWeight: "700" },

  // CTAs
  payNowCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    marginTop: SPACING.sm,
    ...SHADOW.card,
  },
  payNowCtaText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  footerCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: BOOKING_LINK_GREEN,
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    marginTop: SPACING.sm,
  },
  footerCtaText: { fontSize: 15, fontWeight: "700", color: COLORS.white },

  // States
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  errorIconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  loadingText: { fontSize: 14, color: COLORS.gray },
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
