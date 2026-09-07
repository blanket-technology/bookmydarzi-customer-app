/**
 * Step 2 of the support flow: pick the specific issue for the order chosen
 * in support-order-picker.tsx, scoped to that order's current status.
 * Chat only opens after this - the AI's first framing already knows both.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useState } from "react";
import { Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { getIssueOptionsForStatus } from "../src/constants/supportIssues";
import ErrorState from "../src/components/common/ErrorState";
import ScreenHeader from "../src/components/common/ScreenHeader";
import SkeletonBox from "../src/components/skeletons/SkeletonBox";
import { fetchApiOrderById } from "../src/services/apiOrderService";
import type { ApiOrder } from "../src/types/api";

export default function SupportIssuePickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId } = useLocalSearchParams<{ orderId: string }>();
  const [order, setOrder] = useState<ApiOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    setLoading(true);
    setError(null);
    fetchApiOrderById(Number(orderId))
      .then(setOrder)
      .catch((e) => setError(e instanceof Error ? e.message : "Could not load this order"))
      .finally(() => setLoading(false));
  }, [orderId]);

  const selectIssue = (issueKey: string) => {
    router.push({
      pathname: "/support-chat" as never,
      params: { orderId, issueCategory: issueKey },
    });
  };

  const options = order ? getIssueOptionsForStatus(order.status) : [];

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.offWhite, paddingTop: insets.top }}>
      <ScreenHeader title="What's the issue?" />

      {loading ? (
        <View style={{ padding: SPACING.lg }}>
          <SkeletonBox height={52} borderRadius={RADIUS.md} style={{ marginBottom: SPACING.lg }} />
          {[0, 1, 2, 3].map((i) => (
            <SkeletonBox key={i} height={56} borderRadius={RADIUS.md} style={{ marginBottom: SPACING.sm }} />
          ))}
        </View>
      ) : error || !order ? (
        <ErrorState
          message={error ?? "Order not found"}
          onRetry={() => router.back()}
        />
      ) : (
        <View style={{ padding: SPACING.lg }}>
          <View style={styles.orderChip}>
            <Ionicons name="receipt-outline" size={16} color={COLORS.primaryDark} />
            <Text style={styles.orderChipText} numberOfLines={1}>
              {order.orderNumber ?? `Order #${order.id}`}
              {order.serviceTitle ? ` · ${order.serviceTitle}` : ""}
            </Text>
          </View>

          {options.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.optionRow}
              onPress={() => selectIssue(opt.key)}
              activeOpacity={0.85}
            >
              <View style={styles.optionIconBox}>
                <Ionicons name={opt.icon} size={18} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.optionLabel}>{opt.label}</Text>
              <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = {
  orderChip: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    backgroundColor: "#e6f7f7",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: "#b2e2e2",
  },
  orderChipText: { flex: 1, fontSize: 13, fontWeight: "700" as const, color: COLORS.primaryDark },
  optionRow: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  optionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#e6f7f7",
    alignItems: "center" as const,
    justifyContent: "center" as const,
  },
  optionLabel: { flex: 1, fontSize: 14, fontWeight: "600" as const, color: COLORS.black },
};
