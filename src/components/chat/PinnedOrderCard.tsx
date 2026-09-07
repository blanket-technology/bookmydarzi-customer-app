import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { fetchApiOrderById } from "../../services/apiOrderService";
import { getIssueLabel } from "../../constants/supportIssues";
import type { ApiOrder } from "../../types/api";

interface Props {
  orderId: number;
  issueCategory?: string | null;
  /** Shown as a small action on the right - lets the customer switch which
   * order this conversation is about without leaving the chat. */
  onChangeOrder?: () => void;
}

function formatDate(iso?: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

/**
 * Persistent order-reference card pinned above the message list, matching
 * Zomato/Swiggy's support chat pattern - the customer and any agent joining
 * later never have to ask "which order is this about", it's always visible.
 * Compact by default (title + status), expands on tap to show the full
 * field set (payment status, pickup/delivery dates, selected issue).
 */
export function PinnedOrderCard({ orderId, issueCategory, onChangeOrder }: Props) {
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchApiOrderById(orderId)
      .then((o) => {
        if (!cancelled) setOrder(o);
      })
      .catch(() => {
        // Non-fatal - the chat itself doesn't depend on this card loading.
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  if (loading) {
    return (
      <View style={[styles.root, styles.loadingRoot]}>
        <ActivityIndicator size="small" color="#0a8c8c" />
      </View>
    );
  }

  if (!order) return null;

  const pickupDate = formatDate(order.scheduledPickupAt);
  const deliveryDate = formatDate(order.expected_delivery_date);
  const issueLabel = issueCategory ? getIssueLabel(issueCategory) : null;

  return (
    <View style={styles.root}>
      <Pressable style={styles.headerRow} onPress={() => setExpanded((e) => !e)}>
        <View style={styles.iconBox}>
          <Ionicons name="receipt-outline" size={16} color="#0a8c8c" />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {order.orderNumber ?? `Order #${order.id}`}
            {order.serviceTitle ? ` · ${order.serviceTitle}` : ""}
          </Text>
          <Text style={styles.sub} numberOfLines={1}>
            {order.statusLabel ?? order.status}
            {order.amountDisplay ? ` · ${order.amountDisplay}` : ""}
          </Text>
        </View>
        <Ionicons name={expanded ? "chevron-up" : "chevron-down"} size={16} color="#0a8c8c" />
      </Pressable>

      {expanded && (
        <View style={styles.details}>
          <DetailRow label="Order ID" value={order.orderNumber ?? `#${order.id}`} />
          {order.serviceTitle ? <DetailRow label="Service" value={order.serviceTitle} /> : null}
          <DetailRow label="Status" value={order.statusLabel ?? order.status} />
          {order.paymentStatusLabel ? (
            <DetailRow label="Payment" value={order.paymentStatusLabel} />
          ) : null}
          {order.amountDisplay ? <DetailRow label="Amount" value={order.amountDisplay} /> : null}
          {pickupDate ? <DetailRow label="Pickup" value={pickupDate} /> : null}
          {deliveryDate ? <DetailRow label="Expected delivery" value={deliveryDate} /> : null}
          {issueLabel ? <DetailRow label="Issue" value={issueLabel} /> : null}

          {onChangeOrder && (
            <Pressable style={styles.changeOrderBtn} onPress={onChangeOrder} hitSlop={6}>
              <Ionicons name="swap-horizontal-outline" size={13} color="#0a8c8c" />
              <Text style={styles.changeOrderText}>Change Order</Text>
            </Pressable>
          )}
        </View>
      )}
    </View>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: "#e6f7f7",
    borderWidth: 1,
    borderColor: "#b2e2e2",
    overflow: "hidden",
  },
  loadingRoot: { justifyContent: "center", height: 44, flexDirection: "row", alignItems: "center" },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  iconBox: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 13, fontWeight: "700", color: "#0a3d3d" },
  sub: { fontSize: 11, color: "#0a8c8c", marginTop: 1, fontWeight: "600" },
  details: {
    paddingHorizontal: 12,
    paddingBottom: 10,
    paddingTop: 2,
    borderTopWidth: 1,
    borderTopColor: "#b2e2e2",
    gap: 4,
  },
  detailRow: { flexDirection: "row", justifyContent: "space-between", gap: 8, paddingTop: 6 },
  detailLabel: { fontSize: 11, color: "#5c8a8a", fontWeight: "600" },
  detailValue: { fontSize: 11, color: "#0a3d3d", fontWeight: "700", flexShrink: 1, textAlign: "right" },
  changeOrderBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    marginTop: 8,
    paddingVertical: 7,
    borderRadius: 8,
    backgroundColor: "#fff",
  },
  changeOrderText: { fontSize: 11, fontWeight: "700", color: "#0a8c8c" },
});
