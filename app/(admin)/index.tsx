import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { getDashboardStats, type DashboardStats } from "../../src/services/adminService";
import { formatPrice } from "../../src/utils/formatters";
import { useAuthStore } from "../../store/useAuthStore";

const TEAL = "#149694";

function StatCard({
  label,
  value,
  icon,
  color = TEAL,
  sub,
}: {
  label: string;
  value: string | number;
  icon: string;
  color?: string;
  sub?: string;
}) {
  return (
    <View style={styles.card}>
      <View style={[styles.cardIcon, { backgroundColor: color + "1A" }]}>
        <Ionicons name={icon as any} size={20} color={color} />
      </View>
      <Text style={styles.cardValue}>{value}</Text>
      <Text style={styles.cardLabel}>{label}</Text>
      {sub ? <Text style={styles.cardSub}>{sub}</Text> : null}
    </View>
  );
}

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionTitle}>{title}</Text>;
}

// Roles permitted to call /admin/* - see the note in (admin)/orders.tsx.
const ADMIN_ROLES = new Set(["admin", "superadmin", "employee"]);

export default function AdminDashboard() {
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const canLoad = !!user?.role && ADMIN_ROLES.has(user.role);

  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    try {
      if (!isRefresh) setLoading(true);
      setError(null);
      const data = await getDashboardStats();
      setStats(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load dashboard");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Only fetch once the role is known and qualifies - avoids a 403 when a
  // non-admin briefly mounts this screen during the post-login redirect race.
  useEffect(() => {
    if (canLoad) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    load(true);
  }, [load]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Admin Portal</Text>
          <Text style={styles.name}>{user?.name ?? "Admin"}</Text>
        </View>
        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Ionicons name="log-out-outline" size={20} color={COLORS.gray} />
        </TouchableOpacity>
      </View>

      {loading && !stats ? (
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
        <ScrollView
          contentContainerStyle={styles.scroll}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={TEAL} />}
          showsVerticalScrollIndicator={false}
        >
          <SectionHeader title="Users" />
          <View style={styles.row}>
            <StatCard label="Total Users" value={stats?.users.total ?? 0} icon="people" color={TEAL} />
            <StatCard label="Active" value={stats?.users.active ?? 0} icon="person-check" color={COLORS.success} />
          </View>

          <SectionHeader title="Orders" />
          <View style={styles.row}>
            <StatCard label="Total" value={stats?.orders.total ?? 0} icon="bag" color={TEAL} />
            <StatCard label="Today" value={stats?.orders.today ?? 0} icon="today" color="#8B5CF6" />
          </View>
          <View style={styles.row}>
            <StatCard label="Pending" value={stats?.orders.pending ?? 0} icon="time" color="#F59E0B" />
            <StatCard label="Needs Tailor" value={stats?.orders.pending_assignment ?? 0} icon="cut" color="#EF4444" />
          </View>
          <View style={styles.row}>
            <StatCard label="Pickup Due" value={stats?.orders.pending_pickup ?? 0} icon="bag-handle" color="#F97316" />
            <StatCard label="Out for Delivery" value={stats?.orders.out_for_delivery ?? 0} icon="bicycle" color="#3B82F6" />
          </View>
          <View style={styles.row}>
            <StatCard label="Delivered" value={stats?.orders.delivered ?? 0} icon="checkmark-circle" color={COLORS.success} />
            <StatCard label="Cancelled" value={stats?.orders.cancelled ?? 0} icon="close-circle" color={COLORS.error} />
          </View>

          <SectionHeader title="Tailors" />
          <View style={styles.row}>
            <StatCard label="Active" value={stats?.tailors.active ?? 0} icon="cut" color={TEAL} />
            <StatCard label="Available" value={stats?.tailors.available ?? 0} icon="checkmark-done" color={COLORS.success} />
            <StatCard label="Busy" value={stats?.tailors.busy ?? 0} icon="hourglass" color="#F59E0B" />
          </View>

          <SectionHeader title="Revenue" />
          <View style={styles.row}>
            <StatCard label="Total" value={formatPrice(stats?.revenue.total ?? 0)} icon="cash" color={TEAL} />
            <StatCard label="Today" value={formatPrice(stats?.revenue.today ?? 0)} icon="today" color="#8B5CF6" />
          </View>
          <View style={styles.row}>
            <StatCard label="This Week" value={formatPrice(stats?.revenue.this_week ?? 0)} icon="calendar" color="#3B82F6" />
            <StatCard label="This Month" value={formatPrice(stats?.revenue.this_month ?? 0)} icon="calendar-outline" color="#F97316" />
          </View>
          <View style={styles.row}>
            <StatCard label="Online" value={formatPrice(stats?.revenue.online ?? 0)} icon="card" color={TEAL} />
            <StatCard label="COD" value={formatPrice(stats?.revenue.cod ?? 0)} icon="cash-outline" color="#10B981" />
          </View>

          <View style={{ height: 24 }} />
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  greeting: { fontSize: 12, color: COLORS.gray, ...FONTS.medium },
  name: { fontSize: 18, color: COLORS.black, ...FONTS.bold, marginTop: 2 },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    alignItems: "center", justifyContent: "center",
  },
  scroll: { padding: SPACING.md, gap: 8 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: "center" },
  retryBtn: {
    paddingHorizontal: 20, paddingVertical: 10,
    backgroundColor: TEAL, borderRadius: RADIUS.md,
  },
  retryText: { color: COLORS.white, ...FONTS.semiBold, fontSize: 14 },
  sectionTitle: {
    fontSize: 13,
    ...FONTS.semiBold,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginTop: 8,
    marginBottom: 4,
  },
  row: { flexDirection: "row", gap: 8, marginBottom: 4 },
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: "center",
    ...SHADOW.card,
  },
  cardIcon: {
    width: 36, height: 36, borderRadius: 10,
    alignItems: "center", justifyContent: "center",
    marginBottom: 8,
  },
  cardValue: { fontSize: 20, ...FONTS.bold, color: COLORS.black },
  cardLabel: { fontSize: 11, color: COLORS.gray, ...FONTS.medium, marginTop: 2, textAlign: "center" },
  cardSub: { fontSize: 10, color: COLORS.gray, marginTop: 2 },
});
