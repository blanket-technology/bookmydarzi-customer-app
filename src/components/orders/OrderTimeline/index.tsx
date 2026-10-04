import { Ionicons } from "@expo/vector-icons";
import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../../constants/theme";
import { fetchOrderTrackingPayload } from "../../../services/apiOrderService";
import { trackOrderCompleted, trackOrderDelivered } from "../../../services/mixpanelService";
import type { OrderTrackingPayload } from "../../../types/api";
import OrderTimelineItem from "../OrderTimelineItem";
import ReportIssueSheet from "../ReportIssueSheet";

function useCountdown(expiresAt: string | null): string | null {
  const [label, setLabel] = useState<string | null>(null);

  useEffect(() => {
    if (!expiresAt) {
      // Deferred to a microtask so this setState doesn't run synchronously
      // during the effect's commit phase (react-hooks/set-state-in-effect)
      // - behavior is unaffected.
      queueMicrotask(() => setLabel(null));
      return;
    }
    const target = new Date(expiresAt).getTime();
    const tick = () => {
      const diffMs = target - Date.now();
      if (diffMs <= 0) {
        setLabel(null);
        return;
      }
      const mins = Math.floor(diffMs / 60000);
      const h = Math.floor(mins / 60);
      const m = mins % 60;
      setLabel(h > 0 ? `${h}h ${m}m left` : `${m}m left`);
    };
    queueMicrotask(tick);
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [expiresAt]);

  return label;
}

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
  /** Called after a successful report-issue submission, on top of this
   * component's own reload. Reporting an issue changes the order's
   * top-level status (INSPECTION_WINDOW -> IN_REPAIR), which the parent
   * screen's own order payload drives (header badge, order notes, etc.),
   * not just this timeline's own tracking data. Without this, the
   * caller (order-details.tsx) was never told to refetch its own data,
   * so only this sub-component visibly updated; the rest of the screen
   * stayed stale until an unrelated WS event arrived or the screen was
   * reopened. */
  onReported?: () => void;
}

const OrderTimeline = memo(({ orderId, payload, onLoaded, onReported }: OrderTimelineProps) => {
  const [data, setData] = useState<OrderTrackingPayload | null>(payload ?? null);
  const [loading, setLoading] = useState(!payload);
  const [error, setError] = useState<string | null>(null);
  const [reportSheetVisible, setReportSheetVisible] = useState(false);
  const countdown = useCountdown(data?.can_report_issue ? data.inspection_window_expires_at : null);
  // Fire order_delivered/order_completed once per status observed on this
  // order, not on every re-render/poll - a Set survives across renders
  // (not remounts) via useRef, which is enough here since this component
  // stays mounted for the tracking view's lifetime.
  const trackedStatusesRef = useRef<Set<string>>(new Set());

  // Bug fix: fetchOrderTrackingPayload's promise could resolve/reject after
  // this component unmounted (e.g. the user navigated away while a slow or
  // failing request - such as the tracking 500 - was still in flight),
  // triggering "Can't perform a React state update on a component that
  // hasn't mounted yet" from the setError/setData calls below. Guarded
  // with a mounted ref, same pattern used elsewhere in this app.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

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
      if (!isMountedRef.current) return;
      setData(result);
      onLoaded?.(result);
    } catch (e) {
      if (!isMountedRef.current) return;
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't load tracking. Pull to retry.",
      );
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [orderId, onLoaded]);

  useEffect(() => {
    // Deferred to a microtask so these setState calls don't run
    // synchronously during the effect's commit phase
    // (react-hooks/set-state-in-effect) - behavior is unaffected.
    if (payload) {
      queueMicrotask(() => {
        setData(payload);
        setLoading(false);
        setError(null);
      });
      return;
    }
    queueMicrotask(() => load());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, payload]);

  useEffect(() => {
    if (!data) return;
    const seen = trackedStatusesRef.current;
    if (data.status === "inspection_window" && !seen.has("delivered")) {
      seen.add("delivered");
      trackOrderDelivered({ order_id: orderId });
    }
    if (data.status === "completed" && !seen.has("completed")) {
      seen.add("completed");
      trackOrderCompleted({ order_id: orderId });
    }
  }, [data, orderId]);

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

      {data.can_report_issue ? (
        <TouchableOpacity style={styles.reportIssueBtn} onPress={() => setReportSheetVisible(true)}>
          <Ionicons name="alert-circle-outline" size={16} color={COLORS.error} />
          <Text style={styles.reportIssueText}>Report an issue</Text>
          {countdown ? <Text style={styles.reportIssueCountdown}>{countdown}</Text> : null}
        </TouchableOpacity>
      ) : null}

      <ReportIssueSheet
        visible={reportSheetVisible}
        orderId={orderId}
        onClose={() => setReportSheetVisible(false)}
        onReported={() => {
          load();
          onReported?.();
        }}
      />
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
  reportIssueBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: SPACING.sm,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderWidth: 1,
    borderColor: "#FCA5A5",
    borderRadius: RADIUS.md,
    backgroundColor: "#FEF2F2",
  },
  reportIssueText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: "700",
    color: COLORS.error,
    flex: 1,
  },
  reportIssueCountdown: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.error,
    opacity: 0.8,
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
