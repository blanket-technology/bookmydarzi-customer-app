/**
 * Employee chat inbox — lists ALL customer orders (any status) with chat threads.
 * Shows order details, unread count, and last message preview. Tap → open order-chat.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import {
  getOrderChatUnreadCount,
  getOrderThread,
} from "../../src/services/chatService";
import { listAllOrdersForChat, type EmployeeOrder } from "../../src/services/employeeService";
import { wsService } from "../../src/services/wsService";

const TEAL = "#149694";

const STATUS_LABELS: Record<string, string> = {
  pending_payment: "Payment Pending",
  payment_failed: "Payment Failed",
  order_placed: "Order Placed",
  order_accepted: "Accepted",
  cloth_pickup_pending: "Pickup Pending",
  cloth_picked_up: "Cloth Picked",
  cloth_at_hub: "At Workshop",
  tailor_assigned: "Tailor Assigned",
  stitching_in_progress: "Stitching",
  stitching_completed: "Ready",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
  cancelled: "Cancelled",
};

const STATUS_COLOR: Record<string, string> = {
  pending_payment: "#F59E0B",
  payment_failed: "#DC2626",
  order_placed: "#3B82F6",
  order_accepted: "#8B5CF6",
  cloth_pickup_pending: "#F97316",
  cloth_picked_up: "#F97316",
  cloth_at_hub: "#8B5CF6",
  tailor_assigned: "#F59E0B",
  stitching_in_progress: "#EC4899",
  stitching_completed: "#10B981",
  out_for_delivery: "#3B82F6",
  delivered: "#065F46",
  cancelled: "#DC2626",
};

interface ChatOrderEntry {
  order: EmployeeOrder;
  unreadCount: number;
  lastMessage?: string;
  lastTime?: string;
}

function formatRelativeTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

function ChatRow({
  entry,
  onPress,
}: {
  entry: ChatOrderEntry;
  onPress: () => void;
}) {
  const { order, unreadCount, lastMessage, lastTime } = entry;
  const statusColor = STATUS_COLOR[order.status] ?? COLORS.gray;
  const statusLabel = STATUS_LABELS[order.status] ?? order.status.replace(/_/g, " ");
  const hasUnread = unreadCount > 0;

  return (
    <TouchableOpacity style={styles.row} onPress={onPress} activeOpacity={0.75}>
      {/* Left: avatar */}
      <View style={[styles.rowAvatar, hasUnread && styles.rowAvatarUnread]}>
        <Ionicons name="person-outline" size={20} color={hasUnread ? TEAL : COLORS.gray} />
      </View>

      {/* Center: info */}
      <View style={styles.rowCenter}>
        {/* Customer name + time */}
        <View style={styles.rowTopLine}>
          <Text style={[styles.rowName, hasUnread && styles.rowNameUnread]} numberOfLines={1}>
            {order.customer_name || "Customer"}
          </Text>
          {lastTime ? (
            <Text style={styles.rowTime}>{formatRelativeTime(lastTime)}</Text>
          ) : null}
        </View>

        {/* Order code + amount */}
        <View style={styles.orderMeta}>
          <View style={styles.metaChip}>
            <Ionicons name="receipt-outline" size={10} color={COLORS.gray} />
            <Text style={styles.metaChipText}>{order.order_code}</Text>
          </View>
          {order.total_amount != null && order.total_amount > 0 ? (
            <View style={styles.metaChip}>
              <Ionicons name="cash-outline" size={10} color={COLORS.gray} />
              <Text style={styles.metaChipText}>
                ₹{order.total_amount.toLocaleString("en-IN")}
              </Text>
            </View>
          ) : null}
          {order.address ? (
            <View style={[styles.metaChip, { flexShrink: 1 }]}>
              <Ionicons name="location-outline" size={10} color={COLORS.gray} />
              <Text style={[styles.metaChipText, { flexShrink: 1 }]} numberOfLines={1}>
                {order.address}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Last message preview + unread badge */}
        <View style={styles.rowBottomLine}>
          <Text style={[styles.rowPreview, hasUnread && styles.rowPreviewUnread]} numberOfLines={1}>
            {lastMessage || "Tap to open chat"}
          </Text>
          {hasUnread ? (
            <View style={styles.unreadBadge}>
              <Text style={styles.unreadText}>{unreadCount > 9 ? "9+" : unreadCount}</Text>
            </View>
          ) : null}
        </View>

        {/* Status chip */}
        <View style={[styles.statusChip, { backgroundColor: statusColor + "18" }]}>
          <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          <Text style={[styles.statusLabel, { color: statusColor }]}>{statusLabel}</Text>
        </View>
      </View>

      <Ionicons name="chevron-forward" size={16} color={COLORS.grayBorder} />
    </TouchableOpacity>
  );
}

export default function EmployeeChatInbox() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [allEntries, setAllEntries] = useState<ChatOrderEntry[]>([]);
  const [entries, setEntries] = useState<ChatOrderEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  // Filter entries client-side based on search
  useEffect(() => {
    const q = search.trim().toLowerCase();
    if (!q) {
      setEntries(allEntries);
      return;
    }
    setEntries(
      allEntries.filter(
        (e) =>
          e.order.customer_name?.toLowerCase().includes(q) ||
          e.order.order_code?.toLowerCase().includes(q) ||
          e.order.status?.toLowerCase().includes(q) ||
          e.lastMessage?.toLowerCase().includes(q),
      ),
    );
  }, [search, allEntries]);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      // Fetch ALL orders regardless of status or assignment (support chat)
      const [page1, page2] = await Promise.all([
        listAllOrdersForChat({ limit: 100, page: 1 }),
        listAllOrdersForChat({ limit: 100, page: 2 }),
      ]);
      const allOrders: EmployeeOrder[] = [
        ...page1.orders,
        ...(page1.total > 100 ? page2.orders : []),
      ];

      // Fetch unread count + last message for each order in parallel
      const enriched = await Promise.all(
        allOrders.map(async (order) => {
          try {
            const [thread, unread] = await Promise.all([
              getOrderThread(order.id, 1, 1),
              getOrderChatUnreadCount(order.id),
            ]);
            const lastMsg = thread.messages[thread.messages.length - 1];
            return {
              order,
              unreadCount: unread,
              lastMessage: lastMsg?.message,
              lastTime: lastMsg?.created_at,
            };
          } catch {
            return { order, unreadCount: 0 };
          }
        }),
      );

      // Sort: unread first, then by last message time, then by order created_at
      enriched.sort((a, b) => {
        if (b.unreadCount !== a.unreadCount) return b.unreadCount - a.unreadCount;
        if (a.lastTime && b.lastTime) return b.lastTime.localeCompare(a.lastTime);
        return b.order.created_at.localeCompare(a.order.created_at);
      });

      setAllEntries(enriched);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load chats");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(allEntries.length > 0); }, [load, allEntries.length]));

  // Real-time: bump unread count when a new message arrives for any order
  useEffect(() => {
    const unsub = wsService.on("CHAT_MESSAGE", (data: any) => {
      const msgOrderId = Number(data?.order_id);
      if (!msgOrderId) return;
      setAllEntries((prev) =>
        prev.map((e) =>
          e.order.id === msgOrderId
            ? {
                ...e,
                unreadCount: e.unreadCount + 1,
                lastMessage: String(data?.message ?? e.lastMessage ?? ""),
                lastTime: String(data?.created_at ?? e.lastTime ?? ""),
              }
            : e,
        ),
      );
    });
    return unsub;
  }, []);

  const openChat = (entry: ChatOrderEntry) => {
    router.push({
      pathname: "/(employee)/order-chat" as never,
      params: {
        orderId: String(entry.order.id),
        orderCode: entry.order.order_code,
        customerName: entry.order.customer_name ?? "Customer",
      },
    });
    // Optimistically clear unread
    setAllEntries((prev) =>
      prev.map((e) => (e.order.id === entry.order.id ? { ...e, unreadCount: 0 } : e)),
    );
  };

  const totalUnread = allEntries.reduce((sum, e) => sum + e.unreadCount, 0);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIcon}>
            <Ionicons name="chatbubbles-outline" size={20} color={TEAL} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Messages</Text>
            {totalUnread > 0 ? (
              <Text style={styles.headerSub}>{totalUnread} unread</Text>
            ) : (
              <Text style={styles.headerSub}>All customer chats</Text>
            )}
          </View>
        </View>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={15} color={COLORS.gray} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by customer, order, or message..."
          placeholderTextColor="#9CA3AF"
          value={search}
          onChangeText={setSearch}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 ? (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={16} color={COLORS.gray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading chats…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : entries.length === 0 ? (
        <View style={styles.center}>
          <View style={styles.emptyIcon}>
            <Ionicons name="chatbubbles-outline" size={36} color={TEAL} />
          </View>
          <Text style={styles.emptyTitle}>
            {search ? "No results found" : "No chats yet"}
          </Text>
          <Text style={styles.emptySub}>
            {search
              ? "Try a different search term."
              : "All orders with customer conversations will appear here."}
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => String(item.order.id)}
          renderItem={({ item }) => (
            <ChatRow entry={item} onPress={() => openChat(item)} />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={TEAL}
            />
          }
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  center: {
    flex: 1, alignItems: "center", justifyContent: "center",
    padding: SPACING.xl, gap: SPACING.sm,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  headerIcon: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.black },
  headerSub: { fontSize: 12, color: COLORS.gray, marginTop: 1 },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  searchInput: { flex: 1, fontSize: 13, color: COLORS.black, padding: 0 },

  list: { paddingVertical: SPACING.sm },
  separator: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.grayBorder, marginLeft: 82 },

  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    paddingHorizontal: SPACING.lg,
    paddingVertical: 14,
    backgroundColor: COLORS.white,
    gap: 12,
  },
  rowAvatar: {
    width: 50, height: 50, borderRadius: 25,
    backgroundColor: COLORS.offWhite,
    alignItems: "center", justifyContent: "center",
    borderWidth: 1.5, borderColor: COLORS.grayBorder,
    flexShrink: 0,
    marginTop: 2,
  },
  rowAvatarUnread: {
    backgroundColor: COLORS.primaryLight,
    borderColor: "rgba(20,150,148,0.3)",
  },
  rowCenter: { flex: 1, minWidth: 0, gap: 4 },
  rowTopLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowName: { fontSize: 14, fontWeight: "600", color: COLORS.black, flex: 1 },
  rowNameUnread: { fontWeight: "800" },
  rowTime: { fontSize: 11, color: COLORS.gray, flexShrink: 0, marginLeft: 4 },

  orderMeta: { flexDirection: "row", flexWrap: "wrap", gap: 6 },
  metaChip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7, paddingVertical: 2,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.grayBorder,
  },
  metaChipText: { fontSize: 10, color: COLORS.gray, fontWeight: "500" },

  rowBottomLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  rowPreview: { fontSize: 12, color: COLORS.gray, flex: 1 },
  rowPreviewUnread: { color: COLORS.black, fontWeight: "600" },
  unreadBadge: {
    minWidth: 20, height: 20, borderRadius: 10,
    backgroundColor: TEAL,
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 5, marginLeft: 8,
  },
  unreadText: { fontSize: 11, fontWeight: "700", color: COLORS.white },
  statusChip: {
    flexDirection: "row", alignItems: "center", gap: 4,
    alignSelf: "flex-start",
    paddingHorizontal: 8, paddingVertical: 2,
    borderRadius: RADIUS.full,
  },
  statusDot: { width: 5, height: 5, borderRadius: 2.5 },
  statusLabel: { fontSize: 10.5, fontWeight: "600" },

  loadingText: { fontSize: 14, color: COLORS.gray },
  errorText: { fontSize: 14, color: COLORS.error, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: TEAL, borderRadius: RADIUS.md,
  },
  retryText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: SPACING.sm,
    borderWidth: 1.5, borderColor: "rgba(20,150,148,0.15)",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: "center", lineHeight: 20, maxWidth: 280 },
});
