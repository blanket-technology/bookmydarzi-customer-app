/**
 * Tailor - My Work queue.
 * GET /orders/my-orders  (backend filters by assigned tailor automatically)
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SPACING } from "../../constants/theme";
import { listMyOrders, type TailorOrder } from "../../src/services/tailorService";

const TEAL = "#0D9488";
const AMBER = "#D97706";
const VIOLET = "#7C3AED";
const GREEN = "#16A34A";
const SLATE = "#64748B";

const STATUS_META: Record<
  string,
  { label: string; color: string; icon: keyof typeof Ionicons.glyphMap }
> = {
  tailor_assigned:       { label: "Awaiting start",  color: TEAL,   icon: "hourglass-outline" },
  cloth_picked_up:       { label: "Cloth received",  color: VIOLET, icon: "shirt-outline" },
  stitching_in_progress: { label: "In progress",     color: AMBER,  icon: "construct-outline" },
  stitching_completed:   { label: "Completed",       color: GREEN,  icon: "checkmark-circle-outline" },
  out_for_delivery:      { label: "Out for delivery", color: "#0891B2", icon: "bicycle-outline" },
  delivered:             { label: "Delivered",        color: GREEN,  icon: "bag-check-outline" },
  cancelled:             { label: "Cancelled",        color: SLATE,  icon: "close-circle-outline" },
};

const STATUS_FILTERS = [
  { label: "All",         value: "" },
  { label: "To start",    value: "tailor_assigned" },
  { label: "In progress", value: "stitching_in_progress" },
  { label: "Completed",   value: "stitching_completed,out_for_delivery,delivered" },
];

// ─── Card ─────────────────────────────────────────────────────────────────────

function OrderCard({ order, onPress }: { order: TailorOrder; onPress: () => void }) {
  const statusKey = (order.Status ?? "").toLowerCase();
  const meta = STATUS_META[statusKey] ?? {
    label: statusKey.replace(/_/g, " "),
    color: SLATE,
    icon: "ellipse-outline" as keyof typeof Ionicons.glyphMap,
  };

  const serviceName = order.ServiceTitle ?? order.ServiceName ?? "Tailoring service";
  const urgency = order.UrgencyLevel;
  const isUrgent = urgency === "urgent";
  const isExpress = urgency === "express";
  const dateStr = order.CreatedAt
    ? new Date(order.CreatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short" })
    : "";
  const amount = order.FinalAmount ?? (order as any).TotalAmount;

  return (
    <TouchableOpacity style={card.root} onPress={onPress} activeOpacity={0.7}>
      {/* Status accent stripe */}
      <View style={[card.stripe, { backgroundColor: meta.color }]} />

      <View style={card.body}>
        {/* Top: order code + date */}
        <View style={card.topRow}>
          <Text style={card.code}>{order.OrderCode ?? `#${order.Id}`}</Text>
          <Text style={card.date}>{dateStr}</Text>
        </View>

        {/* Service name */}
        <Text style={card.service} numberOfLines={1}>{serviceName}</Text>

        {/* Status + urgency on same row */}
        <View style={card.tagRow}>
          <View style={[card.statusPill, { backgroundColor: meta.color + "18", borderColor: meta.color + "40" }]}>
            <Ionicons name={meta.icon} size={11} color={meta.color} />
            <Text style={[card.statusText, { color: meta.color }]}>{meta.label}</Text>
          </View>
          {(isUrgent || isExpress) ? (
            <Text style={[card.urgencyText, { color: isUrgent ? "#B91C1C" : "#C2410C" }]}>
              {isUrgent ? "Urgent" : "Express"}
            </Text>
          ) : null}
        </View>

        {/* Footer: amount + chevron */}
        <View style={card.footer}>
          <View style={{ flex: 1 }} />
          <View style={card.footerRight}>
            {amount != null ? (
              <Text style={card.amount}>₹{amount}</Text>
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

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load({ isRefresh: true });
  }, [load]);

  const onStatusChange = (s: string) => {
    setStatusFilter(s);
    load({ newStatus: s, nextPage: 1 });
  };

  const activeCount = orders.filter((o) => {
    const s = (o.Status ?? "").toLowerCase();
    return s === "tailor_assigned" || s === "stitching_in_progress";
  }).length;

  return (
    <View style={scr.root}>
      {/* Header - white extends through status bar */}
      <View style={[scr.header, { paddingTop: insets.top + 14 }]}>
        <Text style={scr.title}>My Work</Text>
        <Text style={scr.subtitle}>
          {total} order{total !== 1 ? "s" : ""} assigned
          {activeCount > 0 ? `  ·  ${activeCount} active` : ""}
        </Text>
      </View>

      {/* Filter chips */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={scr.filterScroll}
        contentContainerStyle={scr.filterRow}
      >
        {STATUS_FILTERS.map((item) => {
          const active = statusFilter === item.value;
          const primaryKey = item.value.split(",")[0];
          const chipColor = primaryKey ? (STATUS_META[primaryKey]?.color ?? TEAL) : TEAL;
          return (
            <TouchableOpacity
              key={item.value}
              style={[scr.chip, active && { backgroundColor: chipColor + "18", borderColor: chipColor }]}
              onPress={() => onStatusChange(item.value)}
            >
              <Text style={[scr.chipText, active && { color: chipColor, ...FONTS.semiBold }]}>
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Content */}
      {loading ? (
        <View style={scr.center}>
          <ActivityIndicator color={TEAL} />
        </View>
      ) : error ? (
        <View style={scr.center}>
          <Ionicons name="alert-circle-outline" size={32} color={COLORS.grayBorder} />
          <Text style={scr.errText}>{error}</Text>
          <TouchableOpacity style={scr.retryBtn} onPress={() => load()}>
            <Text style={scr.retryLabel}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={orders}
          keyExtractor={(o) => String(o.Id)}
          contentContainerStyle={[scr.list, orders.length === 0 && { flexGrow: 1 }]}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
          }
          onEndReached={() => {
            if (!loadingMore && orders.length < total) load({ nextPage: page + 1 });
          }}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={
            <View style={scr.empty}>
              <Ionicons name="cut-outline" size={28} color={COLORS.grayBorder} />
              <Text style={scr.emptyTitle}>
                {statusFilter ? "No orders match this filter" : "No orders assigned yet"}
              </Text>
              <Text style={scr.emptySub}>
                {statusFilter
                  ? "Try a different filter or check back later."
                  : "New orders will appear here once assigned to you."}
              </Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={TEAL} /> : null
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() =>
                router.push({ pathname: "/(tailor)/order-detail", params: { id: String(item.Id) } })
              }
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const scr = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F5F5" },

  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  title: { fontSize: 22, ...FONTS.bold, color: "#0F172A", letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: SLATE, marginTop: 2 },

  filterScroll: {
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
    flexGrow: 0,
  },
  filterRow: {
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
    alignItems: "center",
  },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  chipText: { fontSize: 12, color: SLATE, ...FONTS.medium },

  list: { padding: SPACING.md, paddingBottom: 32 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 10 },
  errText: { fontSize: 14, color: COLORS.gray, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: RADIUS.full,
  },
  retryLabel: { color: COLORS.white, ...FONTS.semiBold, fontSize: 14 },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 64,
    paddingHorizontal: 40,
  },
  emptyTitle: { fontSize: 16, ...FONTS.semiBold, color: "#0F172A", textAlign: "center" },
  emptySub: { fontSize: 13, color: SLATE, textAlign: "center", lineHeight: 19 },
});

const card = StyleSheet.create({
  root: {
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
  body: { flex: 1, padding: 14, gap: 5 },

  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  code: { fontSize: 11, ...FONTS.semiBold, color: SLATE, letterSpacing: 0.8, textTransform: "uppercase" },
  date: { fontSize: 11, color: COLORS.gray },

  service: { fontSize: 15, ...FONTS.semiBold, color: "#0F172A", lineHeight: 20 },

  tagRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    alignSelf: "flex-start",
  },
  statusText: { fontSize: 11, ...FONTS.semiBold },
  urgencyText: { fontSize: 11, ...FONTS.semiBold },

  footer: { flexDirection: "row", alignItems: "center", marginTop: 2 },
  footerRight: { flexDirection: "row", alignItems: "center", gap: 6 },
  amount: { fontSize: 14, ...FONTS.bold, color: "#0F172A" },
});
