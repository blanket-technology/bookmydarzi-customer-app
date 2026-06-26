import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { getTailorOrder, updateStitchingStatus, type TailorOrder } from "../../src/services/tailorService";

const TEAL = "#0c6c75";
const TEAL_LIGHT = "#1aa3b0";

const STATUS_COLORS: Record<string, string> = {
  tailor_assigned: "#F59E0B",
  cloth_pickup_pending: "#F97316",
  cloth_picked_up: "#0D9488",
  stitching_in_progress: "#8B5CF6",
  stitching_completed: "#16A34A",
  out_for_delivery: "#3B82F6",
  delivered: "#065F46",
};

const STATUS_LABELS: Record<string, string> = {
  tailor_assigned: "Tailor Assigned",
  cloth_pickup_pending: "Pickup Pending",
  cloth_picked_up: "Cloth Collected — Ready to Stitch",
  stitching_in_progress: "Stitching in Progress",
  stitching_completed: "Stitching Complete",
  out_for_delivery: "Out for Delivery",
  delivered: "Delivered",
};

const STAGES = [
  { key: "cloth_picked_up", label: "Cloth\nCollected", icon: "shirt-outline" as const },
  { key: "stitching_in_progress", label: "Stitching\nStarted", icon: "cut-outline" as const },
  { key: "stitching_completed", label: "Stitching\nDone", icon: "checkmark-circle-outline" as const },
];

const STAGE_ORDER = [
  "tailor_assigned",
  "cloth_pickup_pending",
  "cloth_picked_up",
  "stitching_in_progress",
  "stitching_completed",
  "out_for_delivery",
  "delivered",
];

function StageTracker({ status, color }: { status: string; color: string }) {
  const currentIdx = STAGE_ORDER.indexOf(status);
  return (
    <View style={trackerStyles.row}>
      {STAGES.map((stage, i) => {
        const stageIdx = STAGE_ORDER.indexOf(stage.key);
        const done = currentIdx >= stageIdx;
        const active = status === stage.key;
        return (
          <View key={stage.key} style={trackerStyles.stageWrap}>
            {i > 0 && (
              <View
                style={[
                  trackerStyles.connector,
                  done && currentIdx > STAGE_ORDER.indexOf(STAGES[i - 1].key) && {
                    backgroundColor: color,
                  },
                ]}
              />
            )}
            <View
              style={[
                trackerStyles.iconCircle,
                { borderColor: done ? color : COLORS.grayBorder },
                active && { backgroundColor: color },
                done && !active && { backgroundColor: color + "18" },
              ]}
            >
              <Ionicons
                name={stage.icon}
                size={16}
                color={active ? "#fff" : done ? color : COLORS.grayBorder}
              />
            </View>
            <Text style={[trackerStyles.stageLabel, done && { color }]}>{stage.label}</Text>
          </View>
        );
      })}
    </View>
  );
}

const trackerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.sm,
  },
  stageWrap: { alignItems: "center", flex: 1, position: "relative" },
  connector: {
    position: "absolute",
    top: 17,
    right: "50%",
    left: "-50%",
    height: 2,
    backgroundColor: COLORS.grayBorder,
    zIndex: 0,
  },
  iconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
    zIndex: 1,
    backgroundColor: "transparent",
  },
  stageLabel: {
    fontSize: 10,
    color: COLORS.gray,
    textAlign: "center",
    ...FONTS.medium,
    lineHeight: 14,
  },
});

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

function MeasCell({ label, value }: { label: string; value?: number | null }) {
  if (value == null) return null;
  return (
    <View style={styles.measCell}>
      <Text style={styles.measValue}>{value}"</Text>
      <Text style={styles.measLabel}>{label}</Text>
    </View>
  );
}

export default function TailorOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<TailorOrder | null>(null);
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

  useEffect(() => {
    load();
  }, [load]);

  const status = (order?.Status ?? "").toLowerCase();
  const statusColor = STATUS_COLORS[status] ?? TEAL;
  const statusLabel = STATUS_LABELS[status] ?? status.replace(/_/g, " ");

  // Extract customer info from address (OrderResponse shape)
  const customerName = order?.address?.full_name;
  const customerMobile = order?.address?.mobile;
  const addressParts = [
    order?.address?.address_line_1,
    order?.address?.address_line_2,
    order?.address?.city,
    order?.address?.pincode,
  ].filter(Boolean);
  const addressText = addressParts.length ? addressParts.join(", ") : null;

  const measurement = order?.measurement;

  const callCustomer = () => {
    if (!customerMobile) return;
    Linking.openURL(`tel:${customerMobile}`).catch(() =>
      Alert.alert("Error", "Could not open phone app")
    );
  };

  const runAction = (
    newStatus: "stitching_in_progress" | "stitching_completed",
    confirmMsg: string
  ) => {
    Alert.alert("Confirm Action", confirmMsg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        onPress: async () => {
          setActing(true);
          try {
            await updateStitchingStatus(orderId, newStatus);
            await load();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Action failed");
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  };

  type ActionDef = { label: string; icon: string; color: string; onPress: () => void };
  const ACTION_MAP: Record<string, ActionDef> = {
    cloth_picked_up: {
      label: "Start Stitching",
      icon: "cut-outline",
      color: "#8B5CF6",
      onPress: () =>
        runAction("stitching_in_progress", "Cloth is with you — start stitching for this order?"),
    },
    stitching_in_progress: {
      label: "Mark Stitching Done",
      icon: "checkmark-circle-outline",
      color: "#16A34A",
      onPress: () =>
        runAction("stitching_completed", "Mark stitching as completed? Employee will be notified to collect."),
    },
  };

  const action = ACTION_MAP[status];
  const isWaiting = ["tailor_assigned", "cloth_pickup_pending"].includes(status);
  const isDone = ["stitching_completed", "out_for_delivery", "delivered"].includes(status);

  const WAITING_MESSAGES: Record<string, string> = {
    tailor_assigned: "Cloth pickup from customer is being scheduled.",
    cloth_pickup_pending: "Employee is on the way to collect cloth from the customer.",
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <LinearGradient
        colors={[TEAL, TEAL_LIGHT]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.header}
      >
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCode}>{order?.OrderCode ?? "Order"}</Text>
          <Text style={styles.headerSub}>Order Detail</Text>
        </View>
        <View style={{ width: 40 }} />
      </LinearGradient>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={44} color={COLORS.grayBorder} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

            {/* Status + Stage Tracker */}
            <View style={styles.section}>
              <View style={[styles.statusRow, { backgroundColor: statusColor + "12" }]}>
                <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
                <Text style={[styles.statusText, { color: statusColor }]}>{statusLabel}</Text>
              </View>
              <View style={{ height: 18 }} />
              <StageTracker status={status} color={statusColor} />
            </View>

            {/* Waiting / Info banner */}
            {isWaiting ? (
              <View style={styles.infoBanner}>
                <Ionicons name="time-outline" size={18} color="#D97706" />
                <Text style={styles.infoBannerText}>
                  {WAITING_MESSAGES[status] ?? "Waiting for cloth to arrive."}
                </Text>
              </View>
            ) : null}

            {/* Measurements — top priority for tailors */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Measurements</Text>
              {measurement ? (
                <>
                  <View style={styles.measHeader}>
                    <Text style={styles.measProfileName}>
                      {measurement.profile_name ?? "Measurement Profile"}
                    </Text>
                    <View style={styles.measTags}>
                      {measurement.gender ? (
                        <View style={styles.measTag}>
                          <Text style={styles.measTagText}>{measurement.gender}</Text>
                        </View>
                      ) : null}
                      {measurement.fit_preference ? (
                        <View style={[styles.measTag, { backgroundColor: TEAL + "15", borderColor: TEAL + "30" }]}>
                          <Text style={[styles.measTagText, { color: TEAL }]}>
                            {measurement.fit_preference}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                  <View style={styles.measGrid}>
                    <MeasCell label="Chest" value={measurement.chest} />
                    <MeasCell label="Waist" value={measurement.waist} />
                    <MeasCell label="Hips" value={measurement.hips} />
                    <MeasCell label="Shoulder" value={measurement.shoulder} />
                    <MeasCell label="Neck" value={measurement.neck} />
                    <MeasCell label="Sleeve" value={measurement.sleeve_length} />
                    <MeasCell label="Inseam" value={measurement.inseam} />
                    <MeasCell label="Height" value={measurement.height} />
                  </View>
                  {measurement.notes ? (
                    <View style={styles.measNotes}>
                      <Ionicons name="document-text-outline" size={14} color={COLORS.gray} />
                      <Text style={styles.measNotesText}>{measurement.notes}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.noMeasWrap}>
                  <View style={styles.noMeasIcon}>
                    <Ionicons name="alert-circle-outline" size={24} color="#F59E0B" />
                  </View>
                  <Text style={styles.noMeasText}>
                    No measurements yet. Employee will update before cloth arrives.
                  </Text>
                </View>
              )}
            </View>

            {/* Customer */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer</Text>
              <InfoRow label="Name" value={customerName} />
              {customerMobile ? (
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Mobile</Text>
                  <TouchableOpacity onPress={callCustomer} style={styles.callBtn}>
                    <Ionicons name="call-outline" size={13} color={TEAL} />
                    <Text style={styles.callBtnText}>{customerMobile}</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
              <InfoRow label="Address" value={addressText} />
            </View>

            {/* Order Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Info</Text>
              <InfoRow label="Order Code" value={order?.OrderCode} />
              <InfoRow
                label="Amount"
                value={order?.AmountDisplay ?? (order?.FinalAmount != null ? `₹${order.FinalAmount}` : null)}
              />
              <InfoRow label="Service" value={order?.ServiceTitle ?? order?.ServiceName} />
              <InfoRow label="Category" value={order?.ServiceSubtitle} />
              <InfoRow label="Urgency" value={order?.UrgencyLevel} />
              {order?.ClothDetails ? <InfoRow label="Cloth" value={order.ClothDetails} /> : null}
              {order?.CustomizationNotes ? (
                <InfoRow label="Customization" value={order.CustomizationNotes} />
              ) : null}
              {order?.Description ? <InfoRow label="Notes" value={order.Description} /> : null}
            </View>

            {isDone ? (
              <View style={styles.doneCard}>
                <Ionicons name="checkmark-circle" size={20} color="#16A34A" />
                <Text style={styles.doneText}>
                  {status === "stitching_completed"
                    ? "Stitching complete — employee will collect and deliver."
                    : status === "out_for_delivery"
                    ? "Order is out for delivery."
                    : "Order delivered successfully."}
                </Text>
              </View>
            ) : null}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Action Bar */}
          {action ? (
            <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: action.color }, acting && styles.disabledBtn]}
                onPress={action.onPress}
                disabled={acting}
              >
                {acting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name={action.icon as any} size={18} color="#fff" />
                    <Text style={styles.actionBtnText}>{action.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : isWaiting ? (
            <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.waitingBar}>
                <Ionicons name="hourglass-outline" size={18} color="#D97706" />
                <Text style={styles.waitingBarText}>Waiting for cloth pickup</Text>
              </View>
            </View>
          ) : isDone && status === "stitching_completed" ? (
            <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
              <View style={[styles.waitingBar, { backgroundColor: "#D1FAE5" }]}>
                <Ionicons name="checkmark-circle" size={18} color="#16A34A" />
                <Text style={[styles.waitingBarText, { color: "#065F46" }]}>
                  Employee notified to collect
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
    paddingVertical: 14,
  },
  backBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerCenter: { alignItems: "center", flex: 1 },
  headerCode: { fontSize: 15, ...FONTS.bold, color: "#fff" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.7)", ...FONTS.medium },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: "center", paddingHorizontal: 24 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: RADIUS.md,
  },
  retryText: { color: COLORS.white, ...FONTS.semiBold },
  scroll: { padding: SPACING.md, gap: 12 },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  sectionTitle: {
    fontSize: 11,
    ...FONTS.semiBold,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
  },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: {
    fontSize: 13,
    ...FONTS.bold,
    textTransform: "capitalize",
    letterSpacing: 0.3,
    flex: 1,
  },
  infoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#FEF3C7",
    borderRadius: RADIUS.md,
    padding: 14,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  infoBannerText: { fontSize: 13, color: "#92400E", flex: 1, lineHeight: 18 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  infoLabel: { fontSize: 13, color: COLORS.gray, flex: 1 },
  infoValue: {
    fontSize: 13,
    color: COLORS.black,
    ...FONTS.medium,
    flex: 2,
    textAlign: "right",
  },
  callBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    flex: 2,
    justifyContent: "flex-end",
  },
  callBtnText: { fontSize: 13, color: TEAL, ...FONTS.semiBold },
  measHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  measProfileName: { fontSize: 14, ...FONTS.bold, color: COLORS.black },
  measTags: { flexDirection: "row", gap: 6 },
  measTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  measTagText: {
    fontSize: 11,
    color: COLORS.gray,
    ...FONTS.medium,
    textTransform: "capitalize",
  },
  measGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 4 },
  measCell: {
    width: "22%",
    backgroundColor: TEAL + "0D",
    borderRadius: RADIUS.md,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: TEAL + "25",
  },
  measValue: { fontSize: 16, ...FONTS.bold, color: TEAL },
  measLabel: { fontSize: 10, color: COLORS.gray, ...FONTS.medium, marginTop: 2 },
  measNotes: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayLight,
  },
  measNotesText: { fontSize: 13, color: COLORS.gray, flex: 1, lineHeight: 18 },
  noMeasWrap: { flexDirection: "row", alignItems: "center", gap: 12 },
  noMeasIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FEF3C7",
    alignItems: "center",
    justifyContent: "center",
  },
  noMeasText: { fontSize: 13, color: "#92400E", flex: 1, lineHeight: 18 },
  doneCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#D1FAE5",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#A7F3D0",
  },
  doneText: { fontSize: 13, color: "#065F46", flex: 1, lineHeight: 18, ...FONTS.medium },
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
    paddingVertical: 15,
    gap: 8,
  },
  disabledBtn: { opacity: 0.6 },
  actionBtnText: { color: "#fff", fontSize: 15, ...FONTS.semiBold },
  waitingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  waitingBarText: { fontSize: 14, color: "#92400E", ...FONTS.medium },
});
