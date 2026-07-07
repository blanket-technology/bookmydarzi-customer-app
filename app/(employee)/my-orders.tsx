/**
 * Employee "My Work" tab - orders currently assigned to this employee only.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { listEmployeeOrders, type EmployeeOrder } from "../../src/services/employeeService";

const TEAL = "#149694";

const STATUS_COLORS: Record<string, string> = {
  order_accepted: "#8B5CF6",
  cloth_pickup_pending: "#F97316",
  cloth_picked_up: "#F97316",
  cloth_at_hub: "#8B5CF6",
  tailor_assigned: "#F59E0B",
  stitching_in_progress: "#EC4899",
  stitching_completed: "#10B981",
  out_for_delivery: "#3B82F6",
};

const NEXT_ACTION: Record<string, string> = {
  order_accepted: "Schedule Pickup →",
  cloth_pickup_pending: "Confirm Pickup →",
  cloth_picked_up: "Mark Cloth at Hub →",
  cloth_at_hub: "Waiting for tailor…",
  tailor_assigned: "Schedule Pickup →",
  stitching_in_progress: "Tailor stitching…",
  stitching_completed: "Mark Out for Delivery →",
  out_for_delivery: "Mark Delivered →",
};

function WorkCard({ order, onPress }: { order: EmployeeOrder; onPress: () => void }) {
  const statusColor = STATUS_COLORS[order.status] ?? COLORS.gray;
  const nextAction = NEXT_ACTION[order.status];

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <Text style={styles.code}>{order.order_code}</Text>
        <View style={[styles.badge, { backgroundColor: statusColor + "1A" }]}>
          <Text style={[styles.badgeText, { color: statusColor }]}>
            {order.status.replace(/_/g, " ")}
          </Text>
        </View>
      </View>
      {order.customer_name ? <Text style={styles.customer}>{order.customer_name}</Text> : null}
      {order.address ? (
        <View style={styles.addressRow}>
          <Ionicons name="location-outline" size={13} color={COLORS.gray} />
          <Text style={styles.addressText} numberOfLines={1}>{order.address}</Text>
        </View>
      ) : null}
      {nextAction && (
        <View style={styles.nextRow}>
          <Ionicons name="arrow-forward-circle" size={14} color={TEAL} />
          <Text style={styles.nextText}>Next: {nextAction}</Text>
        </View>
      )}
    </TouchableOpacity>
  );
}

export default function MyOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [orders, setOrders] = useState<EmployeeOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await listEmployeeOrders({ page: 1, limit: 100 });
      // Filter to only my orders (assigned to me, non-terminal)
      const mine = (res.orders ?? []).filter(
        (o) => o.assigned_employee_id != null && !["delivered", "cancelled"].includes(o.status)
      );
      setOrders(mine);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => { setRefreshing(true); load(true); }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>My Work</Text>
        <Text style={styles.subtitle}>{orders.length} active</Text>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator size="large" color={TEAL} /></View>
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
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="briefcase-outline" size={48} color={COLORS.grayBorder} />
              <Text style={styles.emptyText}>No active orders assigned to you</Text>
            </View>
          }
          renderItem={({ item }) => (
            <WorkCard
              order={item}
              onPress={() => router.push({ pathname: "/(employee)/order-detail", params: { id: String(item.id) } })}
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
    paddingHorizontal: SPACING.md, paddingTop: SPACING.md, paddingBottom: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.grayBorder,
  },
  title: { fontSize: 20, ...FONTS.bold, color: COLORS.black },
  subtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  list: { padding: SPACING.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  errorText: { color: COLORS.error, fontSize: 14 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: TEAL, borderRadius: RADIUS.md },
  retryText: { color: COLORS.white, ...FONTS.semiBold },
  emptyText: { color: COLORS.gray, fontSize: 15, marginTop: 8, textAlign: "center" },
  card: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.card },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  code: { fontSize: 14, ...FONTS.bold, color: COLORS.black },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, ...FONTS.semiBold, textTransform: "capitalize" },
  customer: { fontSize: 13, color: COLORS.black, ...FONTS.medium },
  addressRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  addressText: { fontSize: 12, color: COLORS.gray, flex: 1 },
  nextRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8 },
  nextText: { fontSize: 12, color: TEAL, ...FONTS.semiBold },
});
