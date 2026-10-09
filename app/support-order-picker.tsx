/**
 * Order picker, reached only via the "Order Related" category on the
 * support entry screen. Zomato/Swiggy-style - the customer never lands in
 * a blank chat box without order context once they've said it's order-related.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter, useFocusEffect } from "expo-router";
import React, { useCallback, useMemo, useState } from "react";
import { FlatList, TextInput, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import CustomerOrderCard from "../src/components/orders/CustomerOrderCard";
import EmptyState from "../src/components/common/EmptyState";
import ErrorState from "../src/components/common/ErrorState";
import ScreenHeader from "../src/components/common/ScreenHeader";
import OrderCardSkeleton from "../src/components/skeletons/OrderCardSkeleton";
import {
    fetchActiveCustomerOrders,
    fetchCompletedCustomerOrders,
} from "../src/services/customerOrderService";
import type { CustomerOrderListItem } from "../src/types/customerOrders";

// Search only adds value once there's enough history to scroll through -
// below this, showing a search bar is just visual noise.
const SEARCH_THRESHOLD = 6;

export default function SupportOrderPickerScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [orders, setOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [active, completed] = await Promise.all([
        fetchActiveCustomerOrders({ limit: 100 }),
        fetchCompletedCustomerOrders({ limit: 100 }),
      ]);
      // Most-recent-first is good enough here - both lists are already
      // small (a customer's own order history), no server-side sort param
      // exists for this combined view.
      setOrders([...active.items, ...completed.items]);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your orders");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return orders;
    return orders.filter(
      (o) =>
        o.bookingId?.toLowerCase().includes(q) ||
        o.serviceTitle?.toLowerCase().includes(q) ||
        o.serviceSubtitle?.toLowerCase().includes(q),
    );
  }, [orders, query]);

  const selectOrder = (orderId: number) => {
    router.push({
      pathname: "/support-issue-picker" as never,
      params: { orderId: String(orderId) },
    });
  };

  return (
    <View style={{ flex: 1, backgroundColor: COLORS.offWhite, paddingTop: insets.top }}>
      <ScreenHeader title="Select an order" />

      {!loading && orders.length >= SEARCH_THRESHOLD && (
        <View style={styles.searchWrap}>
          <Ionicons name="search-outline" size={16} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by order or service..."
            placeholderTextColor={COLORS.gray}
          />
          {query.length > 0 && (
            <TouchableOpacity onPress={() => setQuery("")} hitSlop={8}>
              <Ionicons name="close-circle" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {loading ? (
        <View style={{ padding: SPACING.lg }}>
          <OrderCardSkeleton />
          <OrderCardSkeleton />
          <OrderCardSkeleton />
        </View>
      ) : error ? (
        <ErrorState message={error} onRetry={load} />
      ) : (
        <FlatList
          data={filteredOrders}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 32 }}
          renderItem={({ item, index }) => (
            <CustomerOrderCard item={item} index={index} onSummaryPress={selectOrder} />
          )}
          ListEmptyComponent={
            query ? (
              <EmptyState
                icon="search-outline"
                title="No matching orders"
                subtitle="Try a different order number or service name."
              />
            ) : (
              <EmptyState
                icon="receipt-outline"
                title="No orders yet"
                subtitle="Once you place an order, you'll be able to get help with it here."
              />
            )
          }
        />
      )}
    </View>
  );
}

const styles = {
  searchWrap: {
    flexDirection: "row" as const,
    alignItems: "center" as const,
    gap: 8,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.black, padding: 0 },
};
