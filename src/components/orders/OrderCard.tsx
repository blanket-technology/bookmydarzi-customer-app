import { Ionicons } from "@expo/vector-icons";
import React, { memo, useState } from "react";
import {
    ActivityIndicator,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";
import { fetchOrderTrackingPayload } from "../../services/apiOrderService";
import {
    getPaymentByOrderId,
    isValidOrderId,
} from "../../services/paymentService";
import {
    orderDisplayValue,
    type ApiOrder,
    type ApiPayment,
    type OrderTimelineStage,
} from "../../types/api";

interface Props {
  item: ApiOrder;
  index: number;
  onCancel: (id: number) => void;
}

const OrderCard = memo(({ item, index, onCancel }: Props) => {
  const [expanded, setExpanded] = useState(false);
  const [tracking, setTracking] = useState<OrderTimelineStage[]>([]);
  const [trackingLoading, setTrackingLoading] = useState(false);
  const [trackingLoaded, setTrackingLoaded] = useState(false);
  const [paymentInfo, setPaymentInfo] = useState<ApiPayment | null>(null);
  const [paymentLoading, setPaymentLoading] = useState(false);
  const [paymentLoaded, setPaymentLoaded] = useState(false);

  const showCancel = item.canCancel === true;

  const loadPaymentDetails = async () => {
    if (paymentLoaded || !isValidOrderId(item.id)) return;
    setPaymentLoading(true);
    try {
      const payment = await getPaymentByOrderId(item.id);
      setPaymentInfo(payment);
    } catch {
      setPaymentInfo(null);
    } finally {
      setPaymentLoading(false);
      setPaymentLoaded(true);
    }
  };

  const loadTracking = async () => {
    if (trackingLoaded || !isValidOrderId(item.id)) return;
    setTrackingLoading(true);
    try {
      const payload = await fetchOrderTrackingPayload(item.id);
      setTracking(payload.timeline);
    } catch {
      setTracking([]);
    } finally {
      setTrackingLoading(false);
      setTrackingLoaded(true);
    }
  };

  const toggleExpanded = async () => {
    const next = !expanded;
    setExpanded(next);
    if (next) {
      await Promise.all([loadTracking(), loadPaymentDetails()]);
    }
  };

  const listPaymentLabel = orderDisplayValue(item.paymentStatusLabel);
  const detailPaymentLabel = orderDisplayValue(
    paymentInfo?.statusLabel ?? null,
  );
  const detailAmountDisplay = orderDisplayValue(
    paymentInfo?.amountDisplay ?? null,
  );

  return (
    <Animated.View
      entering={FadeInDown.delay(index * 50).duration(400)}
      style={styles.wrap}
    >
      <View style={styles.body}>
        <View style={styles.topRow}>
          <Text style={styles.orderNumber} numberOfLines={1}>
            {orderDisplayValue(item.orderNumber)}
          </Text>
          <View style={styles.statusBadge}>
            <Text style={styles.statusBadgeText} numberOfLines={1}>
              {orderDisplayValue(item.statusLabel)}
            </Text>
          </View>
        </View>

        <Text style={styles.serviceTitle} numberOfLines={2}>
          {orderDisplayValue(item.serviceTitle)}
        </Text>

        <Text style={styles.serviceSubtitle} numberOfLines={1}>
          {orderDisplayValue(item.serviceSubtitle)}
        </Text>

        <Text style={styles.deliveryLabel} numberOfLines={2}>
          {orderDisplayValue(item.deliveryLabel)}
        </Text>

        <Text style={styles.paymentStatusLabel} numberOfLines={1}>
          {listPaymentLabel}
        </Text>

        <Text style={styles.amountDisplay} numberOfLines={1}>
          {orderDisplayValue(item.amountDisplay)}
        </Text>

        <TouchableOpacity style={styles.trackToggle} onPress={toggleExpanded}>
          <Ionicons
            name="git-branch-outline"
            size={16}
            color={COLORS.primaryDark}
          />
          <Text style={styles.trackToggleText}>
            {expanded ? "Hide tracking" : "View tracking"}
          </Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-down"}
            size={16}
            color={COLORS.primaryDark}
          />
        </TouchableOpacity>

        {expanded && (
          <View style={styles.paymentSection}>
            <Text style={styles.sectionTitle}>Payment</Text>
            {paymentLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : paymentInfo ? (
              <>
                <View style={styles.detailBadge}>
                  <Text style={styles.detailBadgeText}>
                    {detailPaymentLabel}
                  </Text>
                </View>
                {paymentInfo.transaction_id ? (
                  <Text style={styles.paymentMeta}>
                    Ref: {paymentInfo.transaction_id}
                  </Text>
                ) : null}
                {detailAmountDisplay !== "-" ? (
                  <Text style={styles.paymentMeta}>
                    Amount: {detailAmountDisplay}
                  </Text>
                ) : null}
                {paymentInfo.payment_method ? (
                  <Text style={styles.paymentMeta}>
                    Method: {paymentInfo.payment_method}
                  </Text>
                ) : null}
              </>
            ) : (
              <Text style={styles.sectionEmpty}>-</Text>
            )}
          </View>
        )}

        {expanded && (
          <View style={styles.timeline}>
            {trackingLoading ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : tracking.length === 0 ? (
              <Text style={styles.sectionEmpty}>-</Text>
            ) : (
              tracking.map((stage, i) => (
                <View key={`${stage.status}-${i}`} style={styles.timelineItem}>
                  <View style={styles.timelineDotCol}>
                    <View
                      style={[
                        styles.timelineDot,
                        stage.completed && styles.timelineDotActive,
                      ]}
                    />
                    {i < tracking.length - 1 && (
                      <View style={styles.timelineLine} />
                    )}
                  </View>
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineStatus}>{stage.title}</Text>
                    {stage.description ? (
                      <Text style={styles.timelineNote}>
                        {stage.description}
                      </Text>
                    ) : null}
                    <Text style={styles.timelineTime}>
                      {orderDisplayValue(stage.timestamp)}
                    </Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        {showCancel ? (
          <TouchableOpacity
            style={styles.cancelBtn}
            onPress={() => onCancel(item.id)}
          >
            <Text style={styles.cancelText}>Cancel Order</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
});

OrderCard.displayName = "OrderCard";
export default OrderCard;

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    marginBottom: SPACING.md,
    overflow: "hidden",
    ...SHADOW.card,
  },
  body: {
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  orderNumber: {
    flex: 1,
    fontSize: 17,
    fontWeight: "700",
    color: COLORS.black,
    letterSpacing: 0.2,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: COLORS.primaryLight,
    maxWidth: "52%",
  },
  statusBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
    flexShrink: 1,
  },
  serviceTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
    lineHeight: 24,
    marginBottom: SPACING.xs,
  },
  serviceSubtitle: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  deliveryLabel: {
    fontSize: 14,
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  paymentStatusLabel: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray,
    lineHeight: 20,
    marginBottom: SPACING.md,
  },
  amountDisplay: {
    fontSize: 22,
    fontWeight: "800",
    color: COLORS.primaryDark,
    letterSpacing: 0.3,
    marginBottom: SPACING.xs,
  },
  trackToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
  },
  trackToggleText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
  paymentSection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    gap: SPACING.sm,
  },
  sectionTitle: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  detailBadge: {
    alignSelf: "flex-start",
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
    backgroundColor: COLORS.grayLight,
  },
  detailBadgeText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  paymentMeta: { fontSize: 12, color: COLORS.gray },
  sectionEmpty: { fontSize: 13, color: COLORS.gray },
  timeline: { marginTop: SPACING.md, paddingLeft: 4 },
  timelineItem: { flexDirection: "row", marginBottom: SPACING.md },
  timelineDotCol: { width: 16, alignItems: "center", marginRight: SPACING.sm },
  timelineDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: COLORS.grayBorder,
  },
  timelineDotActive: { backgroundColor: COLORS.primaryDark },
  timelineLine: {
    flex: 1,
    width: 2,
    backgroundColor: COLORS.grayBorder,
    marginTop: 2,
    minHeight: 24,
  },
  timelineContent: { flex: 1 },
  timelineStatus: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  timelineNote: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  timelineTime: { fontSize: 11, color: COLORS.gray, marginTop: 4 },
  cancelBtn: {
    marginTop: SPACING.md,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    alignItems: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: COLORS.error },
});
