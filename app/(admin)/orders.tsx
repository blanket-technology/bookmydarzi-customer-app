import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
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
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { listOrders, type AdminOrder } from "../../src/services/adminService";

const TEAL = "#149694";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Placed", value: "order_placed" },
  { label: "Accepted", value: "order_accepted" },
  { label: "In Progress", value: "stitching_in_progress" },
  { label: "Out for Delivery", value: "out_for_delivery" },
  { label: "Delivered", value: "delivered" },
  { label: "Cancelled", value: "cancelled" },
];

const STATUS_COLORS: Record<string, string> = {
  order_placed: "#3B82F6",
  order_accepted: "#8B5CF6",
  tailor_assigned: "#F59E0B",
  cloth_pickup_pending: "#F97316",
  cloth_picked_up: "#F97316",
  stitching_in_progress: "#EC4899",
  stitching_completed: "#10B981",
  out_for_delivery: "#3B82F6",
  delivered: "#065F46",
  cancelled: "#B91C1C",
};

function StatusBadge({ status }: { status: string | null | undefined }) {
  const s = status ?? "";
  const color = STATUS_COLORS[s] ?? COLORS.gray;
  const label = s.replace(/_/g, " ");
  return (
    <View style={[styles.badge, { backgroundColor: color + "1A" }]}>
      <Text style={[styles.badgeText, { color }]}>{label}</Text>
    </View>
  );
}

function OrderCard({ order, onPress }: { order: AdminOrder; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardRow}>
        <Text style={styles.code}>{order.order_code}</Text>
        <StatusBadge status={order.status} />
      </View>
      {order.customer_name ? (
        <Text style={styles.customer}>{order.customer_name}</Text>
      ) : null}
      {order.customer_mobile ? (
        <Text style={styles.mobile}>{order.customer_mobile}</Text>
      ) : null}
      <View style={styles.cardFooter}>
        {order.total_amount != null ? (
          <Text style={styles.amount}>₹{order.total_amount.toFixed(0)}</Text>
        ) : null}
        {order.created_at ? (
          <Text style={styles.date}>
            {new Date(order.created_at).toLocaleDateString("en-IN", {
              day: "numeric",
              month: "short",
            })}
          </Text>
        ) : null}
        <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
      </View>
    </TouchableOpacity>
  );
}

export default function AdminOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [orders, setOrders] = useState<AdminOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(
    async (opts: { isRefresh?: boolean; nextPage?: number; newStatus?: string; newSearch?: string } = {}) => {
      const { isRefresh = false, nextPage = 1, newStatus = statusFilter, newSearch = search } = opts;
      const isFirst = nextPage === 1;

      if (isFirst && !isRefresh) setLoading(true);
      if (!isFirst) setLoadingMore(true);
      setError(null);

      try {
        const res = await listOrders({ page: nextPage, limit: 30, status: newStatus || undefined, search: newSearch || undefined });
        const raw = res.orders ?? [];
        if (isFirst) {
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
    },
    [statusFilter, search]
  );

  useEffect(() => { load(); }, []); // eslint-disable-line

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ isRefresh: true });
  }, [load]);

  const onStatusChange = (s: string) => {
    setStatusFilter(s);
    load({ newStatus: s, nextPage: 1 });
  };

  const onSearchSubmit = () => load({ newSearch: search, nextPage: 1 });

  const onEndReached = () => {
    if (!loadingMore && orders.length < total) {
      load({ nextPage: page + 1 });
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Orders</Text>
        <Text style={styles.subtitle}>{total} total</Text>
      </View>

      {/* Search */}
      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Ionicons name="search" size={16} color={COLORS.gray} style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search code, name or mobile..."
            placeholderTextColor={COLORS.gray}
            value={search}
            onChangeText={setSearch}
            onSubmitEditing={onSearchSubmit}
            returnKeyType="search"
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => { setSearch(""); load({ newSearch: "", nextPage: 1 }); }}>
              <Ionicons name="close-circle" size={16} color={COLORS.gray} />
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Status filter chips */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(i) => i.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterList}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={[styles.chip, statusFilter === item.value && styles.chipActive]}
            onPress={() => onStatusChange(item.value)}
          >
            <Text style={[styles.chipText, statusFilter === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        )}
      />

      {/* List */}
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
          onEndReached={onEndReached}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="bag-outline" size={48} color={COLORS.grayBorder} />
              <Text style={styles.emptyText}>No orders found</Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={TEAL} /> : null}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push({ pathname: "/(admin)/order-detail", params: { id: String(item.id) } })}
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
    paddingBottom: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  title: { fontSize: 20, ...FONTS.bold, color: COLORS.black },
  subtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  searchRow: { paddingHorizontal: SPACING.md, paddingVertical: 8, backgroundColor: COLORS.white },
  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  searchIcon: { marginRight: 6 },
  searchInput: { flex: 1, fontSize: 14, color: COLORS.black },
  filterList: { paddingHorizontal: SPACING.md, paddingVertical: 8, gap: 8, backgroundColor: COLORS.white },
  chip: {
    paddingHorizontal: 12, paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1, borderColor: COLORS.grayBorder,
  },
  chipActive: { backgroundColor: TEAL + "1A", borderColor: TEAL },
  chipText: { fontSize: 12, color: COLORS.gray, ...FONTS.medium },
  chipTextActive: { color: TEAL, ...FONTS.semiBold },
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
  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  code: { fontSize: 14, ...FONTS.bold, color: COLORS.black },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, ...FONTS.semiBold, textTransform: "capitalize" },
  customer: { fontSize: 13, color: COLORS.black, ...FONTS.medium },
  mobile: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  amount: { fontSize: 14, ...FONTS.bold, color: TEAL, flex: 1 },
  date: { fontSize: 12, color: COLORS.gray },
});
