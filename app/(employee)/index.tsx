/**
 * Employee order queue - shows unassigned orders + orders claimed by this employee.
 * Employees can accept new orders directly from this screen.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import {
  acceptOrder,
  listEmployeeOrders,
  type EmployeeOrder,
} from "../../src/services/employeeService";
import { wsService } from "../../src/services/wsService";
import { useAuthStore } from "../../store/useAuthStore";
import {
  getOrderStatusMeta,
  normalizeOrderStatus,
  STATUS_TONE_COLORS,
} from "../../src/constants/orderStatus";

const TEAL = "#149694";

function QueueCard({
  order,
  myUserId,
  onPress,
  onAccept,
  accepting,
}: {
  order: EmployeeOrder;
  myUserId: string;
  onPress: () => void;
  onAccept: () => void;
  accepting: boolean;
}) {
  const isUnassigned = order.assigned_employee_id == null;
  const meta = getOrderStatusMeta(normalizeOrderStatus(order.status));
  const statusColor = STATUS_TONE_COLORS[meta.tone].fg;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <Text style={styles.code}>{order.order_code}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + "1A" }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {meta.employeeLabel}
          </Text>
        </View>
      </View>

      {order.customer_name ? (
        <Text style={styles.customer}>{order.customer_name}</Text>
      ) : null}
      {order.customer_mobile ? (
        <Text style={styles.mobile}>{order.customer_mobile}</Text>
      ) : null}
      {order.address ? (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={13} color={COLORS.gray} />
          <Text style={styles.addressText} numberOfLines={1}>{order.address}</Text>
        </View>
      ) : null}

      <View style={styles.cardFooter}>
        {order.total_amount != null ? (
          <Text style={styles.amount}>₹{order.total_amount.toFixed(0)}</Text>
        ) : null}
        <Text style={styles.date}>
          {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
        </Text>
        {isUnassigned ? (
          <TouchableOpacity
            style={[styles.acceptBtn, accepting && styles.acceptBtnDisabled]}
            onPress={(e) => { e.stopPropagation(); onAccept(); }}
            disabled={accepting}
          >
            {accepting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.acceptBtnText}>Accept</Text>
            )}
          </TouchableOpacity>
        ) : (
          <View style={styles.mineTag}>
            <Text style={styles.mineTagText}>Mine</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

export default function EmployeeQueue() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [orders, setOrders] = useState<EmployeeOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<number | null>(null);

  const load = useCallback(async (opts: { isRefresh?: boolean; nextPage?: number } = {}) => {
    const { isRefresh = false, nextPage = 1 } = opts;
    if (nextPage === 1 && !isRefresh) setLoading(true);
    if (nextPage > 1) setLoadingMore(true);
    setError(null);

    try {
      const res = await listEmployeeOrders({ page: nextPage, limit: 30 });
      const raw = res.orders ?? [];
      if (nextPage === 1) {
        setOrders(raw);
      } else {
        setOrders((prev) => [...prev, ...raw]);
      }
      setTotal(res.total ?? 0);
      setPage(nextPage);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load orders");
    } finally {
      setLoading(false);
      setLoadingMore(false);
      setRefreshing(false);
    }
  }, []);

  const isFirstMount = useRef(true);
  useEffect(() => { load(); }, [load]);

  // A pickup broadcast (Rapido-style FCFS) pushes new order_placed orders to
  // nearby online employees. Refresh the queue in real time when one arrives
  // so the offer shows up without a manual pull - mirrors the tailor
  // broadcasts screen's BROADCAST_OFFER listener. Non-breaking: it only
  // triggers a reload of the same queue.
  useEffect(() => {
    const unsub = wsService.on("PICKUP_BROADCAST_OFFER", () => load({ isRefresh: true }));
    return () => unsub();
  }, [load]);

  // Reload when navigating back from order-detail
  useFocusEffect(useCallback(() => {
    if (isFirstMount.current) { isFirstMount.current = false; return; }
    load({ isRefresh: true });
  }, [load]));

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ isRefresh: true });
  }, [load]);

  const handleAccept = async (orderId: number) => {
    setAcceptingId(orderId);
    try {
      await acceptOrder(orderId);
      load({ isRefresh: true });
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to accept order");
    } finally {
      setAcceptingId(null);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Order Queue</Text>
        <Text style={styles.subtitle}>{total} orders</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
          onEndReached={() => { if (!loadingMore && orders.length < total) load({ nextPage: page + 1 }); }}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="list-outline" size={48} color={COLORS.grayBorder} />
              <Text style={styles.emptyText}>No orders in queue</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={TEAL} /> : null}
          renderItem={({ item }) => (
            <QueueCard
              order={item}
              myUserId={user?.id ?? ""}
              onPress={() => router.push({ pathname: "/(employee)/order-detail", params: { id: String(item.id) } })}
              onAccept={() => handleAccept(item.id)}
              accepting={acceptingId === item.id}
            />
          )}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  title: { fontSize: 20, ...FONTS.bold, color: COLORS.black },
  subtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  list: { padding: SPACING.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: "center" },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: TEAL, borderRadius: RADIUS.md },
  retryText: { color: COLORS.white, ...FONTS.semiBold },
  emptyText: { color: COLORS.gray, fontSize: 15, marginTop: 8 },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  code: { fontSize: 14, ...FONTS.bold, color: COLORS.black },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, ...FONTS.semiBold, textTransform: "capitalize" },
  customer: { fontSize: 13, color: COLORS.black, ...FONTS.medium },
  mobile: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  addressText: { fontSize: 12, color: COLORS.gray, flex: 1 },
  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 8 },
  amount: { fontSize: 14, ...FONTS.bold, color: TEAL, flex: 1 },
  date: { fontSize: 12, color: COLORS.gray },
  acceptBtn: {
    paddingHorizontal: 14, paddingVertical: 7,
    backgroundColor: TEAL, borderRadius: RADIUS.full,
    minWidth: 72, alignItems: "center",
  },
  acceptBtnDisabled: { opacity: 0.6 },
  acceptBtnText: { color: COLORS.white, fontSize: 12, ...FONTS.bold },
  mineTag: {
    paddingHorizontal: 10, paddingVertical: 5,
    backgroundColor: COLORS.successLight, borderRadius: RADIUS.full,
  },
  mineTagText: { color: COLORS.success, fontSize: 12, ...FONTS.semiBold },
});
