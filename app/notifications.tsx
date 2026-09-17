/**
 * Notifications feed - GET /api/v1/notifications
 * Lists the signed-in user's in-app notifications with read/mark-all-read.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import ErrorState from "../src/components/common/ErrorState";
import ScreenHeader from "../src/components/common/ScreenHeader";
import EmptyState from "../src/components/common/EmptyState";
import NotificationSkeleton from "../src/components/skeletons/NotificationSkeleton";
import { useNotificationStore } from "../src/store/useNotificationStore";
import { useAuthStore } from "../store/useAuthStore";
import type { AppNotification } from "../src/types/engagement";

function iconForType(type: string): keyof typeof Ionicons.glyphMap {
  switch (type) {
    case "order":
    case "order_update":
      return "bag-check-outline";
    case "payment":
      return "card-outline";
    case "chat":
      return "chatbubble-ellipses-outline";
    case "support":
      return "help-buoy-outline";
    case "promo":
      return "pricetag-outline";
    default:
      return "notifications-outline";
  }
}

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const diffMs = Date.now() - d.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.round(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,
    fetchNotifications,
    markRead,
    markAllRead,
  } = useNotificationStore();

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) fetchNotifications();
    }, [isAuthenticated, fetchNotifications]),
  );

  const handlePress = (n: AppNotification) => {
    if (!n.is_read) markRead(n.id).catch(() => {});
    const data = (n.data ?? {}) as Record<string, unknown>;
    const orderId = data.order_id ?? data.orderId;
    // "chat" notifications are always chat_v2 support conversations (see
    // app/services/chat_v2/handoff_service.py) - route by order_id, not a
    // session_uuid, matching app/_layout.tsx's push-tap resolver so both
    // paths land on the same conversation. Tailor chat (app/chat.tsx) has
    // no notification type of its own and is only ever reached from an
    // order's own screen.
    if (n.type === "chat") {
      router.push(
        orderId != null
          ? { pathname: "/support-chat" as never, params: { orderId: String(orderId) } }
          : ("/support-chat" as never),
      );
    } else if ((n.type === "order" || n.type === "order_update" || n.type === "payment") && orderId != null) {
      router.push({
        pathname: "/order-details" as never,
        params: { orderId: String(orderId) },
      });
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => (
    <TouchableOpacity
      style={[styles.item, !item.is_read && styles.itemUnread]}
      onPress={() => handlePress(item)}
      activeOpacity={0.8}
    >
      <View style={[styles.iconBox, !item.is_read && styles.iconBoxUnread]}>
        <Ionicons
          name={iconForType(item.type)}
          size={18}
          color={item.is_read ? COLORS.gray : COLORS.primaryDark}
        />
      </View>
      <View style={styles.itemContent}>
        <Text style={styles.itemTitle} numberOfLines={1}>
          {item.title}
        </Text>
        <Text style={styles.itemBody} numberOfLines={2}>
          {item.body}
        </Text>
        <Text style={styles.itemTime}>{formatTime(item.created_at)}</Text>
      </View>
      {!item.is_read ? <View style={styles.dot} /> : null}
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader
        title="Notifications"
        right={
          unreadCount > 0 ? (
            <TouchableOpacity onPress={() => markAllRead().catch(() => {})} hitSlop={8} style={{ width: 56 }}>
              <Text style={styles.markAll}>Mark all</Text>
            </TouchableOpacity>
          ) : undefined
        }
      />

      {loading && notifications.length === 0 ? (
        <NotificationSkeleton />
      ) : error && notifications.length === 0 ? (
        <ErrorState message={error} onRetry={() => fetchNotifications(true)} />
      ) : notifications.length === 0 ? (
        <EmptyState
          icon="notifications-off-outline"
          title="No notifications yet"
          subtitle="Updates about your orders and payments will show up here."
        />
      ) : (
        <FlatList
          data={notifications}
          keyExtractor={(n) => String(n.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => fetchNotifications(true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  markAll: { fontSize: 13, fontWeight: "700", color: COLORS.primaryDark, width: 56, textAlign: "right" },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  itemUnread: { borderColor: COLORS.primaryLight, backgroundColor: "#F7FEFE" },
  iconBox: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  iconBoxUnread: { backgroundColor: COLORS.primaryLight },
  itemContent: { flex: 1 },
  itemTitle: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  itemBody: { fontSize: 13, color: COLORS.gray, marginTop: 2, lineHeight: 18 },
  itemTime: { fontSize: 11, color: COLORS.gray, marginTop: 6 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.primary,
    marginTop: 4,
  },
});
