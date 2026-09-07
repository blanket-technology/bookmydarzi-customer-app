/**
 * Order booking summary - GET /customer/orders/{order_id}/summary
 * Binds to nested payload: order, dates, service, billing, payment, delivery_address
 */
import React, { useCallback, useRef, useState } from "react";
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
} from "../src/utils/customerOrderStatus";
import { getOrderStatusMeta } from "../src/constants/orderStatus";
import ScreenHeader from "../src/components/common/ScreenHeader";
import {
  getSummaryPlacedLabel,
  getSummaryScheduledLabel,
  summaryMoney,
  summaryText,
} from "../src/utils/orderSummaryDisplay";
import { getPaymentStatusVisual } from "../src/utils/paymentStatus";
import { COD_STATUS_LABELS, PAYMENT_ACTION_LABELS, PAYMENT_METHOD_META } from "../src/types/payment";

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

/**
 * Booking Overview hero - answers, in order: what did I book, how much is
 * it, what's happening now, what should I do next. Status text/description
 * always come from the centralized ORDER_STATUS_META (src/constants/orderStatus.ts)
 * rather than any local copy, so this stays in sync with every other screen
 * automatically as statuses are added/changed.
 */
function SummaryStatusHero({ payload }: { payload: CustomerOrderSummaryPayload }) {
  const meta = getOrderStatusMeta(payload.order.status);
  const iconStyle = STATUS_ICON_STYLES[meta.tone];

  const bookingId = summaryText(payload.order.order_code);
  const placed = getSummaryPlacedLabel(payload);
  const schedule = getSummaryScheduledLabel(payload);

  // "What did I book" - service identity. Future-proof for multi-service
  // orders: category + quantity are composed from whatever parts exist,
  // so a payload with only one of the two still reads cleanly, and this
  // same composition works unchanged if the backend later returns more
  // service lines (each would just render its own hero-style block).
  const serviceName = payload.service.service_name?.trim() || "Your Booking";
  const subtitleParts = [
    payload.service.category_name?.trim() || null,
    payload.service.quantity != null ? `Qty ${payload.service.quantity}` : null,
  ].filter(Boolean);
  const serviceSubtitle = subtitleParts.join(" • ");

  // "How much is it" - order total is always the prominent figure. Online
  // orders always collect the full amount in one charge (see compute_billing
  // in billing_breakdown.py) - there is no advance/remaining split for them,
  // so the secondary line only ever needs to cover COD's genuine
  // pay-on-delivery balance or a plain method + status line.
  const orderAmount = summaryMoney(payload.billing.total_amount);
  const remainingAmount = payload.billing.remaining_amount;
  const paymentMethod = (payload.payment.payment_method ?? "").toLowerCase();
  const paymentVisual = getPaymentStatusVisual(payload.payment.payment_status);
  const isCod = paymentMethod === "cod";

  let paymentSummaryLines: string[];
  if (isCod) {
    paymentSummaryLines = [
      remainingAmount === 0 ? COD_STATUS_LABELS.collected : COD_STATUS_LABELS.pending,
    ];
  } else {
    paymentSummaryLines = [paymentVisual.label];
  }

  return (
    <View style={[styles.heroCard, cardShadow]}>
      {/* Status badge - small, top */}
      <View style={styles.heroTop}>
        <View style={[styles.iconBox, { backgroundColor: iconStyle.bg }]}>
          <Ionicons name={iconStyle.iconName} size={22} color={iconStyle.icon} />
        </View>
        <View style={styles.heroText}>
          <View style={[styles.statusBadge, { backgroundColor: iconStyle.bg }]}>
            <Text style={[styles.statusBadgeText, { color: iconStyle.icon }]}>
              {meta.customerLabel}
            </Text>
          </View>

          {/* What did I book */}
          <Text style={styles.headline} numberOfLines={2}>
            {serviceName}
          </Text>
          {serviceSubtitle ? (
            <Text style={styles.heroSubtitle} numberOfLines={1}>
              {serviceSubtitle}
            </Text>
          ) : null}
        </View>
      </View>

      <View style={styles.divider} />

      {/* How much is it */}
      <View style={styles.priceBlock}>
        <View style={styles.priceRow}>
          <Text style={styles.priceLabel}>Order Amount</Text>
          <Text style={styles.priceValue}>{orderAmount}</Text>
        </View>
        {paymentSummaryLines.map((line) => (
          <Text key={line} style={styles.paymentSummaryLine}>
            {line}
          </Text>
        ))}
      </View>

      <View style={styles.divider} />

      {/* Compact metadata */}
      <View style={styles.metaBlock}>
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

      {/* What's happening now / what to do next - centralized copy */}
      <View style={[styles.helperBanner, { backgroundColor: iconStyle.bg }]}>
        <Ionicons name="information-circle-outline" size={15} color={iconStyle.icon} />
        <Text style={[styles.helperText, { color: iconStyle.icon }]}>{meta.description}</Text>
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

  const navigatingToPayment = useRef(false);

  const handlePayNow = () => {
    if (orderId === null || !payload || navigatingToPayment.current) return;
    navigatingToPayment.current = true;
    // Use advance_amount (the ₹99 booking fee), not the full order total.
    const amountRupees = Number(payload.billing.advance_amount ?? payload.billing.total_amount ?? 0);
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
    // Reset shortly after navigation so returning to this screen (e.g. user
    // backs out of /payment) doesn't leave the button permanently disabled.
    setTimeout(() => { navigatingToPayment.current = false; }, 1000);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader title="Booking Summary" />

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
          <Text style={styles.errorTitle}>Couldn&apos;t load summary</Text>
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
              value={
                payload.payment.payment_method === "online" ||
                payload.payment.payment_method === "cod"
                  ? PAYMENT_METHOD_META[payload.payment.payment_method].displayLabel
                  : summaryText(payload.payment.payment_method)
              }
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
              <Text style={styles.payNowCtaText}>
                {paymentStatusKey === "paymentfailed" || paymentStatusKey === "failed"
                  ? PAYMENT_ACTION_LABELS.retryPayment
                  : PAYMENT_ACTION_LABELS.payNow}
              </Text>
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

  scroll: { padding: SPACING.lg, paddingTop: SPACING.md, gap: SPACING.md },

  // Hero
  heroCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
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
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginBottom: 8,
  },
  statusBadgeText: { fontSize: 11, fontWeight: "700", textTransform: "capitalize" },
  headline: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1F2937",
    lineHeight: 24,
    letterSpacing: -0.2,
  },
  heroSubtitle: {
    fontSize: 13,
    color: "#6B7280",
    marginTop: 3,
  },
  metaLine: { fontSize: 12, color: "#6B7280", lineHeight: 18 },
  metaKey: { fontWeight: "600", color: "#9CA3AF" },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginHorizontal: SPACING.md,
  },

  // Price block - most visible monetary value on the card
  priceBlock: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 12,
    gap: 4,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  priceLabel: { fontSize: 13, color: "#6B7280", fontWeight: "600" },
  priceValue: { fontSize: 22, fontWeight: "800", color: "#1F2937", letterSpacing: -0.3 },
  paymentSummaryLine: { fontSize: 12.5, color: "#6B7280", lineHeight: 18 },

  // Compact metadata block
  metaBlock: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 3,
  },

  // Context-aware helper banner - copy sourced from ORDER_STATUS_META.description
  helperBanner: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginHorizontal: SPACING.md,
    marginBottom: SPACING.md,
    marginTop: 2,
    padding: 10,
    borderRadius: RADIUS.md,
  },
  helperText: { flex: 1, fontSize: 12.5, lineHeight: 17, fontWeight: "600" },

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
