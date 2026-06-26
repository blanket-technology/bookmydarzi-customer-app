import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useAuthStore } from "../../store/useAuthStore";
import { listMyOrders, type TailorOrder } from "../../src/services/tailorService";

const TEAL = "#0c6c75";
const TEAL_LIGHT = "#1aa3b0";

const STATUS_FILTERS = [
  { label: "All", value: "" },
  { label: "Cloth Collected", value: "cloth_picked_up" },
  { label: "In Progress", value: "stitching_in_progress" },
  { label: "Completed", value: "stitching_completed" },
];

const STATUS_COLORS: Record<string, string> = {
  cloth_picked_up: "#0D9488",
  stitching_in_progress: "#8B5CF6",
  stitching_completed: "#16A34A",
};

const STATUS_LABELS: Record<string, string> = {
  cloth_picked_up: "Cloth Collected",
  stitching_in_progress: "In Progress",
  stitching_completed: "Done",
};

const STAGE_MAP: Record<string, number> = {
  cloth_picked_up: 0,
  stitching_in_progress: 1,
  stitching_completed: 2,
};

function StageBar({ status }: { status: string }) {
  const stage = STAGE_MAP[status] ?? -1;
  const color = STATUS_COLORS[status] ?? TEAL;
  const stages = ["Collected", "Stitching", "Done"];
  return (
    <View style={stageStyles.row}>
      {stages.map((label, i) => (
        <View key={i} style={stageStyles.stageItem}>
          <View style={[stageStyles.dot, i <= stage && { backgroundColor: color }]} />
          <Text style={[stageStyles.stageLabel, i <= stage && { color }]}>{label}</Text>
          {i < stages.length - 1 && (
            <View style={[stageStyles.line, i < stage && { backgroundColor: color }]} />
          )}
        </View>
      ))}
    </View>
  );
}

const stageStyles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", marginTop: 10 },
  stageItem: { flexDirection: "row", alignItems: "center", flex: 1 },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.grayBorder,
    marginRight: 4,
  },
  stageLabel: { fontSize: 10, color: COLORS.gray, ...FONTS.medium },
  line: {
    flex: 1,
    height: 2,
    backgroundColor: COLORS.grayBorder,
    marginHorizontal: 4,
    borderRadius: 1,
  },
});

function OrderCard({ order, onPress }: { order: TailorOrder; onPress: () => void }) {
  const status = (order.Status ?? "").toLowerCase();
  const color = STATUS_COLORS[status] ?? COLORS.gray;
  const label = STATUS_LABELS[status] ?? status.replace(/_/g, " ");
  const customerName = order.address?.full_name;
  const city = order.address?.city;

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.75}>
      <View style={[styles.cardAccent, { backgroundColor: color }]} />
      <View style={styles.cardBody}>
        <View style={styles.cardTop}>
          <Text style={styles.code}>{order.OrderCode ?? order.Id}</Text>
          <View style={[styles.badge, { backgroundColor: color + "18" }]}>
            <Text style={[styles.badgeText, { color }]}>{label}</Text>
          </View>
        </View>
        {customerName ? (
          <View style={styles.customerRow}>
            <Ionicons name="person-outline" size={13} color={COLORS.gray} />
            <Text style={styles.customer}>{customerName}{city ? ` · ${city}` : ""}</Text>
          </View>
        ) : null}
        <View style={styles.cardMeta}>
          {order.AmountDisplay ? (
            <Text style={styles.amount}>{order.AmountDisplay}</Text>
          ) : order.FinalAmount != null ? (
            <Text style={styles.amount}>₹{order.FinalAmount}</Text>
          ) : null}
          <Text style={styles.date}>
            {order.CreatedAt
              ? new Date(order.CreatedAt).toLocaleDateString("en-IN", {
                  day: "numeric",
                  month: "short",
                })
              : ""}
          </Text>
          <Ionicons name="chevron-forward" size={15} color={COLORS.grayBorder} />
        </View>
        <StageBar status={status} />
      </View>
    </TouchableOpacity>
  );
}

export default function TailorOrders() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const user = useAuthStore((s) => s.user);

  const [orders, setOrders] = useState<TailorOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const isFirstMount = useRef(true);

  const load = useCallback(
    async (opts: { isRefresh?: boolean; nextPage?: number; newStatus?: string } = {}) => {
      const { isRefresh = false, nextPage = 1, newStatus = statusFilter } = opts;
      const isFirst = nextPage === 1;
      if (isFirst && !isRefresh) setLoading(true);
      if (!isFirst) setLoadingMore(true);
      setError(null);
      try {
        const res = await listMyOrders({
          page: nextPage,
          limit: 30,
          status: newStatus || undefined,
        });
        const raw: TailorOrder[] = (res as any).orders ?? (Array.isArray(res) ? res : []);
        if (isFirst) {
          setOrders(raw);
        } else {
          setOrders((prev) => [...prev, ...raw]);
        }
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
    [statusFilter]
  );

  useEffect(() => {
    load();
  }, []); // eslint-disable-line

  useFocusEffect(
    useCallback(() => {
      if (isFirstMount.current) { isFirstMount.current = false; return; }
      load({ isRefresh: true });
    }, [load])
  );

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
    return s === "cloth_picked_up" || s === "stitching_in_progress";
  }).length;

  const doneCount = orders.filter((o) => (o.Status ?? "").toLowerCase() === "stitching_completed").length;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[TEAL, TEAL_LIGHT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <View>
          <Text style={styles.greeting}>
            Hello, {user?.name?.split(" ")[0] ?? "Tailor"}
          </Text>
          <Text style={styles.headerTitle}>My Work Orders</Text>
        </View>
        <View style={styles.headerStats}>
          <View style={styles.statPill}>
            <Text style={styles.statNum}>{activeCount}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          <View style={[styles.statPill, { backgroundColor: "rgba(255,255,255,0.12)" }]}>
            <Text style={styles.statNum}>{doneCount}</Text>
            <Text style={styles.statLabel}>Done</Text>
          </View>
        </View>
      </LinearGradient>

      <View style={styles.filterBar}>
        {STATUS_FILTERS.map((item) => (
          <TouchableOpacity
            key={item.value}
            style={[styles.chip, statusFilter === item.value && styles.chipActive]}
            onPress={() => onStatusChange(item.value)}
          >
            <Text style={[styles.chipText, statusFilter === item.value && styles.chipTextActive]}>
              {item.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={COLORS.grayBorder} />
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
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />
          }
          onEndReached={() => {
            if (!loadingMore && orders.length < total) load({ nextPage: page + 1 });
          }}
          onEndReachedThreshold={0.2}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="cut-outline" size={52} color={COLORS.grayBorder} />
              <Text style={styles.emptyTitle}>No orders yet</Text>
              <Text style={styles.emptyText}>Orders assigned to you will appear here</Text>
            </View>
          }
          ListFooterComponent={
            loadingMore ? <ActivityIndicator style={{ margin: 16 }} color={TEAL} /> : null
          }
          renderItem={({ item }) => (
            <OrderCard
              order={item}
              onPress={() =>
                router.push({
                  pathname: "/(tailor)/order-detail",
                  params: { id: String(item.Id) },
                })
              }
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  greeting: { fontSize: 12, color: "rgba(255,255,255,0.75)", ...FONTS.medium, marginBottom: 2 },
  headerTitle: { fontSize: 20, color: "#ffffff", ...FONTS.bold },
  headerStats: { flexDirection: "row", gap: 8 },
  statPill: {
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  statNum: { fontSize: 18, color: "#ffffff", ...FONTS.bold },
  statLabel: { fontSize: 10, color: "rgba(255,255,255,0.8)", ...FONTS.medium },
  filterBar: {
    flexDirection: "row",
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  chipActive: { backgroundColor: TEAL + "18", borderColor: TEAL },
  chipText: { fontSize: 11, color: COLORS.gray, ...FONTS.medium },
  chipTextActive: { color: TEAL, ...FONTS.semiBold },
  list: { padding: SPACING.md, paddingBottom: 32 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 10 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: "center" },
  retryBtn: {
    marginTop: 4,
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: RADIUS.md,
  },
  retryText: { color: COLORS.white, ...FONTS.semiBold },
  emptyTitle: { fontSize: 16, ...FONTS.semiBold, color: COLORS.black },
  emptyText: { color: COLORS.gray, fontSize: 13, textAlign: "center" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    flexDirection: "row",
    overflow: "hidden",
    ...SHADOW.card,
  },
  cardAccent: { width: 4 },
  cardBody: { flex: 1, padding: SPACING.md },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  code: { fontSize: 14, ...FONTS.bold, color: COLORS.black },
  badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: RADIUS.full },
  badgeText: { fontSize: 11, ...FONTS.semiBold, textTransform: "capitalize" },
  customerRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  customer: { fontSize: 13, color: COLORS.black, ...FONTS.medium },
  cardMeta: { flexDirection: "row", alignItems: "center", marginTop: 8, gap: 8 },
  amount: { fontSize: 13, ...FONTS.bold, color: TEAL, flex: 1 },
  date: { fontSize: 12, color: COLORS.gray },
});
