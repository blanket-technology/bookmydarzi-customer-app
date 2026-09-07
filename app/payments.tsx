/**
 * Payments - a per-order payment history view, derived from the customer's
 * order list (no dedicated "list all payments" backend endpoint exists;
 * each order already carries its own payment status/method/amount via
 * customerOrderService, so this reuses that instead of adding a new API).
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import { ActivityIndicator, FlatList, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import EmptyState from "../src/components/common/EmptyState";
import ErrorState from "../src/components/common/ErrorState";
import { PaymentStatusBadge } from "../src/components/common/PaymentStatusBadge";
import ScreenHeader from "../src/components/common/ScreenHeader";
import {
    fetchActiveCustomerOrders,
    fetchCompletedCustomerOrders,
} from "../src/services/customerOrderService";
import type { CustomerOrderListItem } from "../src/types/customerOrders";
import { useAuthStore } from "../store/useAuthStore";

export default function PaymentsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [orders, setOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [active, completed] = await Promise.all([
        fetchActiveCustomerOrders({ limit: 100 }),
        fetchCompletedCustomerOrders({ limit: 100 }),
      ]);
      setOrders([...active.items, ...completed.items]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your payments");
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const renderItem = ({ item }: { item: CustomerOrderListItem }) => (
    <TouchableOpacity
      style={styles.card}
      activeOpacity={0.85}
      onPress={() => router.push({ pathname: "/order-details", params: { orderId: String(item.id) } })}
    >
      <View style={styles.cardTop}>
        <Text style={styles.bookingId} numberOfLines={1}>
          {item.bookingId}
        </Text>
        <PaymentStatusBadge paymentStatus={item.paymentStatus} paymentMethod={item.paymentMethod} />
      </View>
      <Text style={styles.serviceTitle} numberOfLines={1}>
        {item.serviceTitle}
        {item.serviceSubtitle ? ` · ${item.serviceSubtitle}` : ""}
      </Text>
      <View style={styles.cardBottom}>
        <Text style={styles.amount}>{item.amountPaidDisplay}</Text>
        <View style={styles.methodChip}>
          <Ionicons
            name={item.paymentMethod === "cod" ? "cash-outline" : "card-outline"}
            size={12}
            color={COLORS.gray}
          />
          <Text style={styles.methodChipText}>
            {item.paymentMethod === "cod" ? "Cash on Delivery" : "Online"}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.offWhite, paddingTop: insets.top }}>
      <ScreenHeader title="Payments" />

      {!isAuthenticated ? (
        <EmptyState
          icon="lock-closed-outline"
          title="Sign in to view payments"
          subtitle="Your payment history is tied to your account."
        />
      ) : loading ? (
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 32 }}
          renderItem={renderItem}
          ListEmptyComponent={
            <EmptyState
              icon="card-outline"
              title="No payments yet"
              subtitle="Payments for your orders will show up here."
            />
          }
        />
      )}
    </View>
  );
}

const styles = {
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  cardTop: { flexDirection: "row" as const, alignItems: "center" as const, justifyContent: "space-between" as const, gap: SPACING.sm },
  bookingId: { flex: 1, fontSize: 13, fontWeight: "700" as const, color: COLORS.black },
  serviceTitle: { fontSize: 13, color: COLORS.gray, marginTop: 4 },
  cardBottom: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    justifyContent: "space-between" as const,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
  },
  amount: { fontSize: 15, fontWeight: "800" as const, color: COLORS.primaryDark },
  methodChip: { flexDirection: "row" as const, alignItems: "center" as const, gap: 4 },
  methodChipText: { fontSize: 11, color: COLORS.gray, fontWeight: "600" as const },
};
