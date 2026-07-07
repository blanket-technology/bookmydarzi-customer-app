/**
 * Tailor — My Work queue.
 * GET /orders/my-orders  (backend filters by assigned tailor automatically)
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
import { COLORS, FONTS, RADIUS, SPACING } from "../../constants/theme";
import { listMyOrders, type TailorOrder } from "../../src/services/tailorService";

// ─── Status config ────────────────────────────────────────────────────────────

const TEAL = "#149694";
const AMBER = "#D97706";
const VIOLET = "#7C3AED";
const GREEN = "#16A34A";
const SLATE = "#64748B";

const STATUS_META: Record<string, { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }> = {
  tailor_assigned:       { label: "Awaiting Start",   color: TEAL,   icon: "hourglass-outline" },
  cloth_picked_up:       { label: "Cloth Received",   color: VIOLET, icon: "shirt-outline" },
  stitching_in_progress: { label: "In Progress",      color: AMBER,  icon: "construct-outline" },
  stitching_completed:   { label: "Completed",        color: GREEN,  icon: "checkmark-circle-outline" },
};

const STATUS_FILTERS = [
  { label: "All",             value: "" },
  { label: "Awaiting Start",  value: "tailor_assigned" },
  { label: "In Progress",     value: "stitching_in_progress" },
  { label: "Completed",       value: "stitching_completed" },
];

// ─── Card ─────────────────────────────────────────────────────────────────────

function OrderCard({ order, onPress }: { order: TailorOrder; onPress: () => void }) {
  const statusKey = (order.Status ?? "").toLowerCase();
  const meta = STATUS_META[statusKey] ?? { label: statusKey.replace(/_/g, " "), color: SLATE, icon: "ellipse-outline" as keyof typeof Ionicons.glyphMap };

  const serviceName = order.ServiceTitle ?? order.ServiceName ?? "Tailoring Service";
  const customerName = order.customer?.name ?? order.CustomerName;
  const urgency = order.UrgencyLevel;
  const dateStr = order.CreatedAt
    ? new Date(order.CreatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";
  const amount = order.FinalAmount ?? (order as any).TotalAmount;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.72}>
      {/* Left status stripe */}
      <View style={[styles.stripe, { backgroundColor: meta.color }]} />

      <View style={styles.cardBody}>
        {/* Top row: order code + date */}
        <View style={styles.cardRow}>
          <Text style={styles.orderCode}>{order.OrderCode ?? `#${order.Id}`}</Text>
          <Text style={styles.dateText}>{dateStr}</Text>
        </View>

        {/* Service */}
        <Text style={styles.serviceName} numberOfLines={1}>{serviceName}</Text>

        {/* Tags row: status + urgency */}
        <View style={styles.tagsRow}>
          <View style={[styles.statusBadge, { backgroundColor: meta.color + "18", borderColor: meta.color + "40" }]}>
            <Ionicons name={meta.icon} size={11} color={meta.color} />
            <Text style={[styles.statusBadgeText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {urgency && urgency !== "standard" ? (
            <View style={styles.urgencyBadge}>
              <Text style={styles.urgencyText}>{urgency.charAt(0).toUpperCase() + urgency.slice(1)}</Text>
            </View>
          ) : null}
        </View>

        {/* Footer: customer name + amount + chevron */}
        <View style={styles.cardFooter}>
          {customerName ? (
            <View style={styles.customerChip}>
              <Ionicons name="person-outline" size={11} color={COLORS.gray} />
              <Text style={styles.customerText} numberOfLines={1}>{customerName}</Text>
            </View>
          ) : <View style={{ flex: 1 }} />}

          <View style={styles.footerRight}>
            {amount != null ? (
              <Text style={styles.amountText}>₹{amount}</Text>
            ) : null}
            <Ionicons name="chevron-forward" size={15} color={COLORS.grayBorder} />
          </View>
        </View>
      </View>
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TailorOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [orders, setOrders] = useState<TailorOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");

  const load = useCallback(
    async (opts: { isRefresh?: boolean; nextPage?: number; newStatus?: string } = {}) => {
      const { isRefresh = false, nextPage = 1, newStatus = statusFilter } = opts;
      const isFirst = nextPage === 1;
      if (isFirst && !isRefresh) setLoading(true);
      if (!isFirst) setLoadingMore(true);
      setError(null);
      try {
        const res = await listMyOrders({ page: nextPage, limit: 30, status: newStatus || undefined });
        const raw: TailorOrder[] = (res as any).orders ?? (Array.isArray(res) ? res : []);
        if (isFirst) setOrders(raw);
        else setOrders((prev) => [...prev, ...raw]);
        setTotal((res as any).total ?? raw.length);
        setPage(nextPage);
      } catch (e: any) {
        setError(e?.message ?? "Failed to load orders");
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [statusFilter],
  );

  useEffect(() => { load(); }, []); // eslint-disable-line

  const onRefresh = useCallback(() => { setRefreshing(true); load({ isRefresh: true }); }, [load]);
  const onStatusChange = (s: string) => { setStatusFilter(s); load({ newStatus: s, nextPage: 1 }); };

  const activeCount = orders.filter((o) => {
    const s = o.Status?.toLowerCase() ?? "";
    return s === "tailor_assigned" || s === "stitching_in_progress";
  }).length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>My Work</Text>
          <Text style={styles.subtitle}>
            {total} order{total !== 1 ? "s" : ""} assigned
            {activeCount > 0 ? ` · ${activeCount} active` : ""}
          </Text>
        </View>
      </View>

      {/* Filter chips */}
      <FlatList
        horizontal
        data={STATUS_FILTERS}
        keyExtractor={(i) => i.value}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filterRow}
        renderItem={({ item }) => {
          const isActive = statusFilter === item.value;
          const chipMeta = item.value ? STATUS_META[item.value] : null;
          const chipColor = chipMeta?.color ?? TEAL;
          return (
            <TouchableOpacity
              style={[styles.chip, isActive && { backgroundColor: chipColor + "18", borderColor: chipColor }]}
              onPress={() => onStatusChange(item.value)}
            >
              <Text style={[styles.chipText, isActive && { color: chipColor, ...FONTS.semiBold }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        }}
      />

      {/* Content */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={40} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => load()}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.Id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
          onEndReached={() => { if (!loadingMore && orders.length < total) load({ nextPage: page + 1 }); }}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={
            <View style={styles.center}>
              <View style={styles.emptyIcon}>
                <Ionicons name="cut-outline" size={28} color={TEAL} />
              </View>
              <Text style={styles.emptyTitle}>No orders here</Text>
              <Text style={styles.emptySubtitle}>
                {statusFilter ? "No orders match this filter." : "You have no assigned orders yet."}
              </Text>
            </View>
          }
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={TEAL} /> : null}
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() => router.push({ pathname: "/(tailor)/order-detail", params: { id: String(item.Id) } })}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F1F5F9" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  title: { fontSize: 22, ...FONTS.bold, color: COLORS.black, letterSpacing: -0.3 },
  subtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2, ...FONTS.regular },

  filterRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  chipText: { fontSize: 12, color: COLORS.gray, ...FONTS.medium },

  list: { padding: SPACING.md, paddingBottom: 32 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 40, gap: 10 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: "center", ...FONTS.medium },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: RADIUS.full,
  },
  retryText: { color: COLORS.white, ...FONTS.semiBold, fontSize: 14 },
  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#149694" + "14",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  emptyTitle: { fontSize: 16, ...FONTS.semiBold, color: COLORS.black },
  emptySubtitle: { fontSize: 13, color: COLORS.gray, textAlign: "center" },

  // Card
  card: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 8,
    elevation: 3,
  },
  stripe: { width: 4 },
  cardBody: { flex: 1, padding: 14, gap: 6 },

  cardRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  orderCode: { fontSize: 13, ...FONTS.bold, color: COLORS.black, letterSpacing: 0.2 },
  dateText: { fontSize: 11, color: COLORS.gray, ...FONTS.regular },

  serviceName: { fontSize: 15, ...FONTS.semiBold, color: "#1E293B", lineHeight: 20 },

  tagsRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
  },
  statusBadgeText: { fontSize: 11, ...FONTS.semiBold },
  urgencyBadge: {
    paddingHorizontal: 7,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  urgencyText: { fontSize: 11, color: "#92400E", ...FONTS.semiBold },

  cardFooter: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  customerChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  customerText: { fontSize: 12, color: COLORS.gray, ...FONTS.regular, flex: 1 },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  amountText: { fontSize: 14, ...FONTS.bold, color: "#1E293B" },
});
