/**
 * Customer Orders - Active / Completed / Cancelled tabs
 * GET /customer/orders/active | /completed | /cancelled
 */
import React, { useCallback, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  Pressable,
  ActivityIndicator,
  useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { useAppLanguage } from "../../src/i18n/useAppLanguage";
import { useAuthStore } from "../../store/useAuthStore";
import { useCustomerOrdersStore } from "../../src/store/useCustomerOrdersStore";
import CustomerOrderCard from "../../src/components/orders/CustomerOrderCard";
import OrderCardSkeleton from "../../src/components/skeletons/OrderCardSkeleton";
import { COLORS, RADIUS, SPACING } from "../../constants/theme";
import type { CustomerOrderListItem } from "../../src/types/customerOrders";

// Two tabs (Swiggy/Zomato/Uber pattern): current vs past. "history" merges
// completed + cancelled - the card's own status stripe/label distinguishes them.
type OrdersTab = "active" | "history";

export default function OrdersScreen() {
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width } = useWindowDimensions();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const contentWidth = Math.min(width, 560);

  const [tab, setTab] = useState<OrdersTab>("active");
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  const activeOrders = useCustomerOrdersStore((s) => s.activeOrders);
  const completedOrders = useCustomerOrdersStore((s) => s.completedOrders);
  const cancelledOrders = useCustomerOrdersStore((s) => s.cancelledOrders);
  const loading = useCustomerOrdersStore((s) => s.loading);
  const error = useCustomerOrdersStore((s) => s.error);
  const activeLastFetched = useCustomerOrdersStore((s) => s.activeLastFetched);
  const completedLastFetched = useCustomerOrdersStore((s) => s.completedLastFetched);
  const cancelledLastFetched = useCustomerOrdersStore((s) => s.cancelledLastFetched);
  const activeHasMore = useCustomerOrdersStore((s) => s.activeHasMore);
  const completedHasMore = useCustomerOrdersStore((s) => s.completedHasMore);
  const cancelledHasMore = useCustomerOrdersStore((s) => s.cancelledHasMore);
  const loadActive = useCustomerOrdersStore((s) => s.loadActive);
  const loadCompleted = useCustomerOrdersStore((s) => s.loadCompleted);
  const loadCancelled = useCustomerOrdersStore((s) => s.loadCancelled);
  const loadMoreActive = useCustomerOrdersStore((s) => s.loadMoreActive);
  const loadMoreCompleted = useCustomerOrdersStore((s) => s.loadMoreCompleted);
  const loadMoreCancelled = useCustomerOrdersStore((s) => s.loadMoreCancelled);

  const loadedTabs: Record<OrdersTab, boolean> = {
    active: activeLastFetched !== null,
    history: completedLastFetched !== null || cancelledLastFetched !== null,
  };

  // History = completed + cancelled, merged newest-first. Both lists are
  // already sorted individually; a stable merge on a date key keeps a single
  // chronological stream a customer can scan like Swiggy/Zomato "past orders".
  const historyOrders = useMemo(() => {
    const merged = [...completedOrders, ...cancelledOrders];
    return merged.sort((a, b) => {
      const da = new Date(a.scheduledLabel || a.cancelledAt || 0).getTime();
      const db = new Date(b.scheduledLabel || b.cancelledAt || 0).getTime();
      return db - da;
    });
  }, [completedOrders, cancelledOrders]);

  const currentOrders = tab === "active" ? activeOrders : historyOrders;
  const currentHasMore =
    tab === "active" ? activeHasMore : completedHasMore || cancelledHasMore;
  const tabCopy = useMemo(() => {
    if (tab === "active") {
      return { emptyTitle: t("orders.emptyActiveTitle"), emptySub: t("orders.emptyActiveSub") };
    }
    return { emptyTitle: t("orders.emptyCompletedTitle"), emptySub: t("orders.emptyCompletedSub") };
  }, [tab, t]);

  const loadTab = useCallback(
    async (target: OrdersTab, forceRefresh = false) => {
      if (!isAuthenticated) return;
      try {
        if (target === "active") {
          await loadActive(forceRefresh);
        } else {
          // History pulls both completed and cancelled.
          await Promise.all([loadCompleted(forceRefresh), loadCancelled(forceRefresh)]);
        }
      } finally {
        setRefreshing(false);
      }
    },
    [isAuthenticated, loadActive, loadCompleted, loadCancelled],
  );

  const handleLoadMore = useCallback(async () => {
    // Don't gate on the store's `loading` (initial-load/skeleton flag) - only
    // our own loadingMore prevents concurrent load-more calls. Gating on
    // `loading` could permanently block pagination if that flag is ever stuck.
    if (!currentHasMore || loadingMore) return;
    setLoadingMore(true);
    try {
      if (tab === "active") {
        await loadMoreActive();
      } else {
        // History: page whichever of completed/cancelled still has more.
        const jobs: Promise<void>[] = [];
        if (completedHasMore) jobs.push(loadMoreCompleted());
        if (cancelledHasMore) jobs.push(loadMoreCancelled());
        await Promise.all(jobs);
      }
    } finally {
      setLoadingMore(false);
    }
  }, [tab, currentHasMore, loadingMore, completedHasMore, cancelledHasMore, loadMoreActive, loadMoreCompleted, loadMoreCancelled]);

  // The store's own TTL cache decides whether this actually hits the
  // network - revisiting the tab within the cache window renders the
  // already-loaded data instantly instead of refetching + showing a
  // skeleton every time (previously this screen kept its lists in local
  // state, which was wiped on every unmount, e.g. navigating to Order
  // Details and back).
  useFocusEffect(
    useCallback(() => {
      loadTab(tab);
    }, [tab, loadTab]),
  );

  const handleRefresh = () => {
    setRefreshing(true);
    loadTab(tab, true);
  };

  const handleSummaryPress = useCallback(
    (orderId: number) => {
      router.push({
        pathname: "/order-details" as never,
        params: { orderId: String(orderId) },
      });
    },
    [router],
  );

  const handlePayNow = useCallback(
    (orderId: number) => {
      router.push({
        pathname: "/order-details" as never,
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
        onPayNow={handlePayNow}
      />
    ),
    [handleSummaryPress, handlePayNow],
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
        {/* Top-right counter removed (Bug Report cycle 1, item 11.1). Keep the
            spacer so the title stays balanced in the header row. */}
        <View style={styles.headerSpacer} />
      </View>

      <View
        style={[
          styles.tabBar,
          { maxWidth: contentWidth - SPACING.lg * 2, alignSelf: "center" },
        ]}
      >
        {(["active", "history"] as OrdersTab[]).map((key) => {
          const selected = tab === key;
          const label = key === "active" ? t("orders.active") : "History";
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
              {/* Count badge removed - the number (e.g. "Active 53") was noise. */}
              <Text style={[styles.tabText, selected && styles.tabTextActive]}>{label}</Text>
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
          initialNumToRender={6}
          maxToRenderPerBatch={6}
          windowSize={7}
          ListFooterComponent={
            loadingMore ? (
              <View style={styles.loadMoreFooter}>
                <ActivityIndicator size="small" color={COLORS.primary} />
              </View>
            ) : currentHasMore && currentOrders.length > 0 ? (
              <TouchableOpacity
                style={styles.loadMoreBtn}
                onPress={handleLoadMore}
                activeOpacity={0.85}
              >
                <Text style={styles.loadMoreBtnText}>{t("orders.loadMore")}</Text>
                <Ionicons name="chevron-down" size={16} color={COLORS.primaryDark} />
              </TouchableOpacity>
            ) : null
          }
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.sm,
    backgroundColor: "#F5F7FA",
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "800",
    color: "#1F2937",
    letterSpacing: -0.3,
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
    gap: 6,
    marginHorizontal: SPACING.md,
    marginTop: SPACING.xs,
    marginBottom: SPACING.md,
    backgroundColor: "#E9ECF0",
    borderRadius: 14,
    padding: 5,
    width: "100%",
  },
  tabBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 11,
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
  loadMoreFooter: {
    paddingVertical: SPACING.md,
    alignItems: "center",
  },
  loadMoreBtn: {
    alignSelf: "center",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    marginTop: SPACING.md,
    marginBottom: SPACING.sm,
    paddingHorizontal: 22,
    paddingVertical: 11,
    borderRadius: RADIUS.full,
    borderWidth: 1.5,
    borderColor: COLORS.primaryDark,
    backgroundColor: "#F0FDFC",
  },
  loadMoreBtnText: {
    fontSize: 13.5,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  listPad: {
    paddingHorizontal: SPACING.md,
    paddingTop: 4,
    paddingBottom: SPACING.lg,
  },
  listEmpty: { flexGrow: 1 },
  centerState: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  stateTitle: {
    fontSize: 16,
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
    paddingHorizontal: 22,
    paddingVertical: 11,
    marginTop: SPACING.md,
  },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: COLORS.white },
  guestWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  guestTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  guestSub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
});
