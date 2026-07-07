/**
 * Tailor Order Queue — unassigned cloth_at_hub orders any tailor can claim.
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
import { listQueueOrders, type TailorOrder } from "../../src/services/tailorService";

const INDIGO = "#4F46E5";
const TEAL = "#0D9488";

function QueueCard({ order, onPress }: { order: TailorOrder; onPress: () => void }) {
  const serviceLabel =
    [order.ServiceTitle, order.ServiceSubtitle].filter(Boolean).join(" · ") ||
    order.ServiceName ||
    "Stitching Order";

  return (
    <TouchableOpacity style={styles.card} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.cardTop}>
        <Text style={styles.code}>{order.OrderCode ?? `#${order.Id}`}</Text>
        <View style={styles.hubBadge}>
          <Ionicons name="business-outline" size={11} color={TEAL} />
          <Text style={styles.hubBadgeText}>At Workshop</Text>
        </View>
      </View>

      <Text style={styles.service} numberOfLines={1}>{serviceLabel}</Text>

      {order.measurement?.gender ? (
        <Text style={styles.meta}>Gender: {order.measurement.gender}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.date}>
          {order.CreatedAt
            ? new Date(order.CreatedAt).toLocaleDateString("en-IN", {
                day: "numeric",
                month: "short",
              })
            : ""}
        </Text>
        <View style={styles.claimHint}>
          <Ionicons name="hand-left-outline" size={13} color={INDIGO} />
          <Text style={styles.claimHintText}>Tap to Claim</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

export default function TailorQueue() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [orders, setOrders] = useState<TailorOrder[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      const res = await listQueueOrders({ page: 1, limit: 50 });
      const raw: TailorOrder[] = (res as any).orders ?? [];
      setOrders(raw);
      setTotal((res as any).total ?? raw.length);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load queue");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.title}>Order Queue</Text>
        <Text style={styles.subtitle}>{total} waiting for tailor</Text>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={INDIGO} />
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
          keyExtractor={(o) => String(o.Id)}
          contentContainerStyle={styles.list}
          ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={INDIGO} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="checkmark-circle-outline" size={48} color={COLORS.grayBorder} />
              <Text style={styles.emptyText}>No orders waiting — all caught up!</Text>
            </View>
          }
          renderItem={({ item }) => (
            <QueueCard
              order={item}
              onPress={() =>
                router.push({
                  pathname: "/(tailor)/order-detail",
                  params: { id: String(item.Id), fromQueue: "1" },
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
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.md,
    paddingBottom: 8,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  title: { fontSize: 20, ...FONTS.bold, color: COLORS.black },
  subtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  list: { padding: SPACING.md },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 12 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: INDIGO,
    borderRadius: RADIUS.md,
  },
  retryText: { color: COLORS.white, ...FONTS.semiBold },
  emptyText: { color: COLORS.gray, fontSize: 15, marginTop: 8, textAlign: "center" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  cardTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 6,
  },
  code: { fontSize: 14, ...FONTS.bold, color: COLORS.black },
  hubBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TEAL + "1A",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
  },
  hubBadgeText: { fontSize: 11, ...FONTS.semiBold, color: TEAL },
  service: { fontSize: 13, color: COLORS.black, ...FONTS.medium, marginBottom: 2 },
  meta: { fontSize: 12, color: COLORS.gray },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 10,
  },
  date: { fontSize: 12, color: COLORS.gray },
  claimHint: { flexDirection: "row", alignItems: "center", gap: 4 },
  claimHintText: { fontSize: 12, color: INDIGO, ...FONTS.semiBold },
});
