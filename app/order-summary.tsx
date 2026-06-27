/**
 * Order booking summary — GET /customer/orders/{order_id}/summary
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
import { COLORS, SPACING } from "../constants/theme";
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
  getSummaryAmountPaid,
  getSummaryPlacedLabel,
  getSummaryScheduledLabel,
  getSummaryStatusHeadline,
  summaryDateOnly,
  summaryMoney,
  summaryText,
} from "../src/utils/orderSummaryDisplay";

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
    <View style={styles.billRow}>
      <Text style={[styles.billLabel, bold && styles.billLabelBold]}>{label}</Text>
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

function SummaryStatusHero({ payload }: { payload: CustomerOrderSummaryPayload }) {
  const status = payload.order.status ?? "";
  const tone = getCustomerOrderStatusTone(status);
  const iconStyle = STATUS_ICON_STYLES[tone];
  const statusBadge = formatCustomerOrderStatusLabel(status);
  const headline = getSummaryStatusHeadline(payload);
  const bookingId = summaryText(payload.order.order_code);
  const placed = getSummaryPlacedLabel(payload);
  const schedule = getSummaryScheduledLabel(payload);
  const amount = getSummaryAmountPaid(payload);

  return (
    <View style={[styles.heroCard, cardShadow]}>
      <View style={styles.heroTop}>
        <View style={[styles.iconBox, { backgroundColor: iconStyle.bg }]}>
          <Ionicons name={iconStyle.iconName} size={20} color={iconStyle.icon} />
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
          <Text style={styles.metaLine}>Booking id: {bookingId}</Text>
          <Text style={styles.metaLine}>Placed: {placed}</Text>
          <Text style={styles.metaLine}>{schedule}</Text>
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
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Booking summary</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
          <Text style={styles.loadingText}>Loading summary...</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={44} color={COLORS.error} />
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : payload ? (
        <ScrollView
          contentContainerStyle={[
            styles.scroll,
            {
              paddingBottom: insets.bottom + 88,
              maxWidth: contentMaxWidth,
              alignSelf: "center",
              width: "100%",
            },
          ]}
          showsVerticalScrollIndicator={false}
        >
          <SummaryStatusHero payload={payload} />

          <OrderScreenSection title="Service">
            <Text style={styles.serviceTitle}>
              {summaryText(payload.service.service_name)}
            </Text>
            {payload.service.category_name ? (
              <Text style={styles.serviceSubtitle}>
                {summaryText(payload.service.category_name)}
              </Text>
            ) : null}
            <InfoRow
              label="Quantity"
              value={
                payload.service.quantity != null
                  ? String(payload.service.quantity)
                  : SUMMARY_NA
              }
            />
          </OrderScreenSection>

          <OrderScreenSection title="Billing">
            <BillRow label="Item total" value={summaryMoney(payload.billing.item_total)} />
            <View style={styles.billDivider} />
            <BillRow label="Discount" value={summaryMoney(payload.billing.discount)} discount />
            <View style={styles.billDivider} />
            <BillRow label="CGST" value={summaryMoney(payload.billing.cgst_amount)} />
            <View style={styles.billDivider} />
            <BillRow label="SGST" value={summaryMoney(payload.billing.sgst_amount)} />
            <View style={styles.billDivider} />
            <BillRow label="Convenience fee" value={summaryMoney(payload.billing.service_fee)} />
            <View style={styles.billDivider} />
            <BillRow
              label="Total amount"
              value={summaryMoney(payload.billing.total_amount)}
              bold
            />
          </OrderScreenSection>

          <OrderScreenSection title="Payment">
            <InfoRow
              label="Payment method"
              value={summaryText(payload.payment.payment_method)}
            />
            <View style={styles.infoDivider} />
            <InfoRow
              label="Payment status"
              value={summaryText(payload.payment.payment_status)}
            />
            <View style={styles.infoDivider} />
            <InfoRow
              label="Transaction id"
              value={summaryText(payload.payment.transaction_id)}
            />
          </OrderScreenSection>

          <OrderScreenSection title="Delivery address">
            <InfoRow label="Name" value={summaryText(payload.delivery_address.name)} />
            <View style={styles.infoDivider} />
            <InfoRow label="Mobile" value={summaryText(payload.delivery_address.mobile)} />
            <View style={styles.infoDivider} />
            <InfoRow
              label="Address"
              value={summaryText(payload.delivery_address.full_address)}
            />
          </OrderScreenSection>

          {needsPayment ? (
            <Pressable
              style={({ pressed }) => [styles.payNowCta, pressed && { opacity: 0.88 }]}
              onPress={handlePayNow}
            >
              <Ionicons name="card-outline" size={18} color={COLORS.white} />
              <Text style={styles.payNowCtaText}>Pay now</Text>
            </Pressable>
          ) : null}

          <Pressable
            style={({ pressed }) => [styles.footerCta, pressed && { opacity: 0.88 }]}
            onPress={navigateToDetails}
          >
            <Text style={styles.footerCtaText}>View booking details</Text>
            <Ionicons name="chevron-forward" size={18} color={COLORS.white} />
          </Pressable>
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
  badgeRow: { marginBottom: 6 },
  statusBadge: {
    alignSelf: "flex-start",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusBadgeText: {
    fontSize: 11,
    fontWeight: "700",
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
  billDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#ECEEF2",
    marginVertical: 8,
  },
  billLabel: { fontSize: 13, color: "#6B7280", flex: 1 },
  billLabelBold: { fontWeight: "700", color: "#1F2937" },
  billValue: { fontSize: 13, fontWeight: "600", color: "#1F2937" },
  billValueBold: { fontSize: 15, fontWeight: "800" },
  billDiscount: { color: "#16A34A" },
  payNowCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: SPACING.sm,
  },
  payNowCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
  footerCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    backgroundColor: BOOKING_LINK_GREEN,
    borderRadius: 14,
    paddingVertical: 14,
    marginTop: SPACING.sm,
  },
  footerCtaText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
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
