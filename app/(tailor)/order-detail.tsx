/**
 * Tailor order detail + stitching action buttons.
 * tailor_assigned       → "Start Stitching"     → stitching_in_progress
 * stitching_in_progress → "Mark Stitching Done" → stitching_completed
 * stitching_completed   → "Waiting for delivery" (employee picks up next)
 * Shows only: order code, service, measurements. No customer contact or payment info.
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import {
  getTailorOrder,
  updateStitchingStatus,
} from "../../src/services/tailorService";

const TEAL = "#149694";
const AMBER = "#D97706";
const GREEN = "#16A34A";

const STATUS_META: Record<string, { label: string; color: string }> = {
  tailor_assigned:       { label: "Awaiting Start",    color: TEAL },
  stitching_in_progress: { label: "In Progress",       color: AMBER },
  stitching_completed:   { label: "Stitching Done",    color: GREEN },
  out_for_delivery:      { label: "Out for Delivery",  color: "#7C3AED" },
  delivered:             { label: "Delivered",          color: "#065F46" },
};

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function MeasRow({ label, value }: { label: string; value?: number | null }) {
  if (value == null) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}"</Text>
    </View>
  );
}

export default function TailorOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);

  const orderId = Number(id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTailorOrder(orderId);
      setOrder(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const status = (order?.Status ?? order?.status ?? "").toLowerCase();
  const statusMeta = STATUS_META[status] ?? { label: status.replace(/_/g, " "), color: COLORS.gray };
  const statusColor = statusMeta.color;

  const measurement = order?.measurement ?? order?.Measurement;

  const runAction = (newStatus: "stitching_in_progress" | "stitching_completed", confirmMsg: string) => {
    Alert.alert("Confirm", confirmMsg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Yes",
        onPress: async () => {
          setActing(true);
          try {
            await updateStitchingStatus(orderId, newStatus);
            load();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Action failed");
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  };

  type ActionConfig = {
    label: string;
    icon: string;
    color: string;
    onPress: () => void;
  };

  const getAction = (): ActionConfig | null => {
    if (status === "tailor_assigned") {
      return {
        label: "Start Stitching",
        icon: "cut-outline",
        color: TEAL,
        onPress: () =>
          runAction("stitching_in_progress", "Mark this order as stitching in progress?"),
      };
    }
    if (status === "stitching_in_progress") {
      return {
        label: "Mark Stitching Done",
        icon: "checkmark-circle-outline",
        color: GREEN,
        onPress: () =>
          runAction("stitching_completed", "Mark stitching as completed for this order?"),
      };
    }
    return null;
  };

  const action = getAction();
  const isWaiting = status === "stitching_completed" || status === "out_for_delivery" || status === "delivered";

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Detail</Text>
        <View style={{ width: 40 }} />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={INDIGO} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Status */}
            <View style={[styles.statusBanner, { backgroundColor: statusColor + "1A" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusMeta.label}
              </Text>
            </View>

            {/* Assignment banner */}
            {status === "tailor_assigned" ? (
              <View style={styles.claimedBanner}>
                <Ionicons name="checkmark-circle-outline" size={16} color="#16A34A" />
                <Text style={styles.claimedText}>
                  You've been assigned this order — start stitching when ready
                </Text>
              </View>
            ) : null}

            {/* Order info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Info</Text>
              <Row label="Order Code" value={order?.OrderCode ?? order?.order_code} />
              <Row
                label="Created"
                value={
                  order?.CreatedAt
                    ? new Date(order.CreatedAt).toLocaleString("en-IN")
                    : null
                }
              />
            </View>

            {/* Service */}
            {(order?.service?.name ?? order?.ServiceName) ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Service</Text>
                <Row label="Service" value={order?.service?.name ?? order?.ServiceName} />
                <Row
                  label="Category"
                  value={order?.service?.category ?? order?.category?.name}
                />
                <Row label="Notes" value={order?.SpecialInstructions ?? order?.notes} />
              </View>
            ) : null}

            {/* Measurement - the key data for tailors */}
            {measurement ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Measurements</Text>
                <Row label="Profile" value={measurement.profile_name} />
                <Row label="Gender" value={measurement.gender} />
                <Row label="Fit" value={measurement.fit_preference ?? measurement.fit} />
                <MeasRow label="Chest" value={measurement.chest} />
                <MeasRow label="Waist" value={measurement.waist} />
                <MeasRow label="Hips" value={measurement.hips} />
                <MeasRow label="Shoulder" value={measurement.shoulder} />
                <MeasRow label="Neck" value={measurement.neck} />
                <MeasRow label="Sleeve" value={measurement.sleeve_length} />
                <MeasRow label="Inseam" value={measurement.inseam} />
                <MeasRow label="Height" value={measurement.height} />
                <Row label="Notes" value={measurement.notes} />
              </View>
            ) : (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Measurements</Text>
                <View style={styles.noMeasWrap}>
                  <Ionicons name="alert-circle-outline" size={20} color="#F59E0B" />
                  <Text style={styles.noMeasText}>
                    No measurements recorded yet. Ask employee to update.
                  </Text>
                </View>
              </View>
            )}

            {/* Waiting state */}
            {isWaiting ? (
              <View style={styles.waitingCard}>
                <Ionicons name="hourglass-outline" size={18} color="#6B7280" />
                <Text style={styles.waitingText}>
                  {status === "stitching_completed"
                    ? "Stitching complete — waiting for employee to deliver"
                    : status === "out_for_delivery"
                    ? "Order is out for delivery"
                    : "Order delivered successfully"}
                </Text>
              </View>
            ) : null}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom action */}
          {action ? (
            <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity
                style={[
                  styles.actionBtn,
                  { backgroundColor: action.color },
                  acting && styles.disabledBtn,
                ]}
                onPress={action.onPress}
                disabled={acting}
              >
                {acting ? (
                  <ActivityIndicator size="small" color={COLORS.white} />
                ) : (
                  <>
                    <Ionicons name={action.icon as any} size={18} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>{action.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : isWaiting ? (
            <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.waitingBar}>
                <Ionicons name="hourglass-outline" size={18} color="#6B7280" />
                <Text style={styles.waitingBarText}>
                  {status === "stitching_completed" ? "Waiting for delivery" : "Completed"}
                </Text>
              </View>
            </View>
          ) : null}
        </>
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
    paddingVertical: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: "center", paddingHorizontal: 24 },
  retryBtn: { paddingHorizontal: 20, paddingVertical: 10, backgroundColor: TEAL, borderRadius: RADIUS.md },
  retryText: { color: COLORS.white, ...FONTS.semiBold },
  scroll: { padding: SPACING.md, gap: 12 },
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    borderRadius: RADIUS.md,
    gap: 8,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { fontSize: 13, ...FONTS.bold, letterSpacing: 0.3 },
  unclaimedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: TEAL + "12",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: TEAL + "30",
  },
  unclaimedText: { fontSize: 13, color: TEAL, flex: 1 },
  claimedBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDF4",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  claimedText: { fontSize: 13, color: "#15803D", flex: 1 },
  section: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.card },
  sectionTitle: {
    fontSize: 11,
    ...FONTS.semiBold,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  rowLabel: { fontSize: 13, color: COLORS.gray, flex: 1 },
  rowValue: { fontSize: 13, color: COLORS.black, ...FONTS.medium, flex: 2, textAlign: "right" },
  actionRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  linkBtn: { flexDirection: "row", alignItems: "center", gap: 4, flex: 2, justifyContent: "flex-end" },
  linkBtnText: { fontSize: 13, color: TEAL, ...FONTS.semiBold, textAlign: "right", flex: 1 },
  noMeasWrap: { flexDirection: "row", alignItems: "center", gap: 8 },
  noMeasText: { fontSize: 13, color: "#92400E", flex: 1 },
  waitingCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F9FAFB",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  waitingText: { fontSize: 13, color: "#6B7280", flex: 1 },
  actionBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    gap: 8,
  },
  disabledBtn: { opacity: 0.6 },
  actionBtnText: { color: COLORS.white, fontSize: 15, ...FONTS.semiBold },
  waitingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  waitingBarText: { fontSize: 14, color: "#6B7280", ...FONTS.medium },
});
