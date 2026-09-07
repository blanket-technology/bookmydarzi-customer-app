import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../../constants/theme";
import { fetchOrderTrackingPayload } from "../../../services/apiOrderService";
import type { OrderTrackingPayload } from "../../../types/api";
import OrderTimelineItem from "../OrderTimelineItem";

export interface OrderTimelineProps {
  orderId: number;
  /**
   * Pass a payload you already fetched (e.g. from the order-details screen's
   * own load) to skip this component's own fetch entirely - avoids a
   * duplicate network call when the parent already has the data.
   */
  payload?: OrderTrackingPayload | null;
  /** Called whenever this component's own fetch succeeds, so a parent can cache it. */
  onLoaded?: (payload: OrderTrackingPayload) => void;
}

const OrderTimeline = memo(({ orderId, payload, onLoaded }: OrderTimelineProps) => {
  const [data, setData] = useState<OrderTrackingPayload | null>(payload ?? null);
  const [loading, setLoading] = useState(!payload);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId <= 0) {
      setError("Invalid order.");
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const result = await fetchOrderTrackingPayload(orderId);
      setData(result);
      onLoaded?.(result);
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't load tracking. Pull to retry.",
      );
    } finally {
      setLoading(false);
    }
  }, [orderId, onLoaded]);

  useEffect(() => {
    if (payload) {
      setData(payload);
      setLoading(false);
      setError(null);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, payload]);

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="alert-circle-outline" size={22} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (!data || data.timeline.length === 0) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="time-outline" size={22} color={COLORS.gray} />
        <Text style={styles.emptyText}>No tracking updates yet.</Text>
      </View>
    );
  }

  return (
    <View style={styles.wrap}>
      {data.display_eta ? (
        <View style={styles.etaRow}>
          <Ionicons name="calendar-outline" size={16} color={COLORS.primaryDark} />
          <Text style={styles.etaText}>{data.display_eta}</Text>
        </View>
      ) : null}
      <View style={styles.list}>
        {data.timeline.map((stage, i) => (
          <OrderTimelineItem
            key={`${stage.status}-${i}`}
            stage={stage}
            isLast={i === data.timeline.length - 1}
          />
        ))}
      </View>
    </View>
  );
});

OrderTimeline.displayName = "OrderTimeline";
export default OrderTimeline;

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  etaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginBottom: SPACING.md,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.md,
  },
  etaText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  list: {
    paddingTop: SPACING.xs,
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  errorText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.error,
    textAlign: "center",
  },
  emptyText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.gray,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  retryText: {
    ...TYPOGRAPHY.label.md,
    color: COLORS.white,
    textTransform: "none",
    letterSpacing: 0,
  },
});
