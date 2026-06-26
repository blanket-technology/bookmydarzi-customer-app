/**
 * Customer Orders — Active / Completed tabs
 * GET /customer/orders/active | /completed
 */
import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAppLanguage } from "../../src/i18n/useAppLanguage";
import { useAuthStore } from "../../store/useAuthStore";
import {
  fetchActiveCustomerOrders,
  fetchCompletedCustomerOrders,
} from "../../src/services/customerOrderService";
import CustomerOrderCard from "../../src/components/orders/CustomerOrderCard";
import OrderCardSkeleton from "../../src/components/skeletons/OrderCardSkeleton";
import { COLORS, RADIUS, SPACING } from "../../constants/theme";
import type { CustomerOrderListItem } from "../../src/types/customerOrders";

type OrdersTab = "active" | "completed";

export default function OrdersScreen() {
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const contentWidth = Math.min(width, 560);

  const [tab, setTab] = useState<OrdersTab>("active");
  const [activeOrders, setActiveOrders] = useState<CustomerOrderListItem[]>([]);
  const [completedOrders, setCompletedOrders] = useState<CustomerOrderListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadedTabs, setLoadedTabs] = useState<Record<OrdersTab, boolean>>({
    active: false,
    completed: false,
  });

  const currentOrders = tab === "active" ? activeOrders : completedOrders;
  const tabCopy =
    tab === "active"
      ? {
          emptyTitle: t("orders.emptyActiveTitle"),
          emptySub: t("orders.emptyActiveSub"),
        }
      : {
          emptyTitle: t("orders.emptyCompletedTitle"),
          emptySub: t("orders.emptyCompletedSub"),
        };
  const headerCount = currentOrders.length;

  const loadTab = useCallback(
    async (target: OrdersTab, silent = false) => {
      if (!isAuthenticated) return;
      if (!silent) setLoading(true);
      setError(null);
      try {
        const data =
          target === "active"
            ? await fetchActiveCustomerOrders()
            : await fetchCompletedCustomerOrders();
        if (target === "active") setActiveOrders(data);
        else setCompletedOrders(data);
        setLoadedTabs((prev) => ({ ...prev, [target]: true }));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load orders");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [isAuthenticated],
  );

  useFocusEffect(
    useCallback(() => {
      const hasCache = tab === "active" ? activeOrders.length > 0 : completedOrders.length > 0;
      loadTab(tab, hasCache);
    }, [tab, activeOrders.length, completedOrders.length, loadTab]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadTab(tab, true);
  };

  const handleSummaryPress = useCallback(
    (orderId: number) => {
      router.push({
        pathname: "/order-summary" as never,
        params: { orderId: String(orderId) },
      });
    },
    [router],
  );

  const renderOrder = useCallback(
    ({ item, index }: { item: CustomerOrderListItem; index: number }) => (
      <CustomerOrderCard
        item={item}
        index={index}
        onSummaryPress={handleSummaryPress}
      />
    ),
    [handleSummaryPress],
  );

  if (!isAuthenticated) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={[styles.header, { maxWidth: contentWidth, alignSelf: "center", width: "100%" }]}>
          <Text style={styles.headerTitle}>{t("orders.myBookings")}</Text>
        </View>
        <View style={styles.guestWrap}>
          <Ionicons name="lock-closed-outline" size={48} color={COLORS.grayBorder} />
          <Text style={styles.guestTitle}>{t("orders.loginTitle")}</Text>
          <Text style={styles.guestSub}>{t("orders.loginSub")}</Text>
          <TouchableOpacity
            style={styles.primaryBtn}
            onPress={() => router.push("/(auth)/login")}
          >
            <Text style={styles.primaryBtnText}>{t("common.login")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const showSkeleton = loading && !loadedTabs[tab] && currentOrders.length === 0;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={[styles.header, { maxWidth: contentWidth, alignSelf: "center", width: "100%" }]}>
        <Text style={styles.headerTitle}>{t("orders.myBookings")}</Text>
        {loadedTabs[tab] && headerCount > 0 ? (
          <View style={styles.headerBadge}>
            <Text style={styles.headerBadgeText}>{headerCount}</Text>
          </View>
        ) : (
          <View style={styles.headerSpacer} />
        )}
      </View>

      <View
        style={[
          styles.tabBar,
          { maxWidth: contentWidth - SPACING.lg * 2, alignSelf: "center" },
        ]}
      >
        {(["active", "completed"] as OrdersTab[]).map((key) => {
          const selected = tab === key;
          const count = key === "active" ? activeOrders.length : completedOrders.length;
          return (
            <Pressable
              key={key}
              style={[styles.tabBtn, selected ? styles.tabBtnActive : styles.tabBtnInactive]}
              onPress={() => setTab(key)}
              android_ripple={
                selected
                  ? undefined
                  : { color: "rgba(0,0,0,0.06)" }
              }
            >
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>
                {key === "active" ? t("orders.active") : t("orders.completed")}
              </Text>
              {loadedTabs[key] && count > 0 ? (
                <View style={[styles.tabCount, selected && styles.tabCountActive]}>
                  <Text style={[styles.tabCountText, selected && styles.tabCountTextActive]}>
                    {count}
                  </Text>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>

      {showSkeleton ? (
        <View
          style={[
            styles.listPad,
            { maxWidth: contentWidth, alignSelf: "center", width: "100%" },
          ]}
        >
          {[1, 2, 3].map((i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </View>
      ) : error ? (
        <View style={styles.centerState}>
          <Ionicons name="alert-circle-outline" size={44} color={COLORS.error} />
          <Text style={styles.stateTitle}>{t("common.somethingWrong")}</Text>
          <Text style={styles.stateSub}>{error}</Text>
          <TouchableOpacity style={styles.primaryBtn} onPress={() => loadTab(tab)}>
            <Text style={styles.primaryBtnText}>{t("common.retry")}</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={currentOrders}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderOrder}
          contentContainerStyle={[
            styles.listPad,
            {
              maxWidth: contentWidth,
              alignSelf: "center",
              width: "100%",
            },
            currentOrders.length === 0 && styles.listEmpty,
          ]}
          ListEmptyComponent={
            <View style={styles.centerState}>
              <View style={styles.emptyIcon}>
                <Ionicons name="calendar-outline" size={40} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.stateTitle}>{tabCopy.emptyTitle}</Text>
              <Text style={styles.stateSub}>{tabCopy.emptySub}</Text>
              {tab === "active" ? (
                <TouchableOpacity
                  style={styles.primaryBtn}
                  onPress={() => router.push("/(tabs)")}
                >
                  <Text style={styles.primaryBtnText}>{t("common.browseServices")}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={COLORS.primary}
            />
          }
          showsVerticalScrollIndicator={false}
          initialNumToRender={5}
          maxToRenderPerBatch={6}
          windowSize={7}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7FA",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: "#F5F7FA",
  },
  headerTitle: {
    fontSize: 26,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.4,
  },
  headerBadge: {
    minWidth: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  headerBadgeText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  headerSpacer: {
    width: 32,
  },
  tabBar: {
    flexDirection: "row",
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.md,
    backgroundColor: "#E9ECF0",
    borderRadius: 12,
    padding: 4,
    width: "100%",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: 10,
  },
  tabBtnInactive: {
    backgroundColor: "transparent",
  },
  tabBtnActive: {
    backgroundColor: COLORS.white,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#DDE1E6",
  },
  tabText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#9CA3AF",
  },
  tabTextActive: {
    color: COLORS.primaryDark,
    fontWeight: "700",
  },
  tabCount: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 6,
  },
  tabCountActive: {
    backgroundColor: COLORS.primaryLight,
  },
  tabCountText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#6B7280",
  },
  tabCountTextActive: {
    color: COLORS.primaryDark,
  },
  listPad: {
    paddingHorizontal: SPACING.lg,
    paddingTop: 4,
    paddingBottom: SPACING.xl + 8,
  },
  listEmpty: { flexGrow: 1 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.sm,
    minHeight: 340,
  },
  emptyIcon: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  stateTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
  },
  stateSub: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 21,
    maxWidth: 300,
  },
  primaryBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 28,
    paddingVertical: 12,
    marginTop: SPACING.md,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  guestWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  guestTitle: { fontSize: 18, fontWeight: "700", color: COLORS.black },
  guestSub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
});
