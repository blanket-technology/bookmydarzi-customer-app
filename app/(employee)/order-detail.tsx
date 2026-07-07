/**
 * Employee order detail + action flow:
 *   order_placed  → Accept | Reject
 *   order_accepted → Go for Pickup → cloth_pickup_pending
 *   cloth_pickup_pending → Confirm Pickup → cloth_picked_up
 *   cloth_picked_up → [Take Measurements] → Mark Cloth at Hub → cloth_at_hub
 *   cloth_at_hub  → [Take Measurements] → Assign Tailor → WAITING (tailor stitches)
 *   stitching_completed → Mark Out for Delivery → out_for_delivery
 *   out_for_delivery → Mark Delivered (+ payment) → delivered
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import {
  acceptOrder,
  assignTailor,
  collectMeasurement,
  completeOrder,
  completeStitching,
  confirmPickup,
  getEmployeeOrder,
  listTailors,
  markClothAtHub,
  markOutForDelivery,
  rejectOrder,
  schedulePickup,
  type MeasurementInput,
  type TailorProfile,
} from "../../src/services/employeeService";

const TEAL = "#149694";

const STATUS_COLORS: Record<string, string> = {
  order_placed: "#3B82F6",
  order_accepted: "#8B5CF6",
  order_rejected: "#DC2626",
  tailor_assigned: "#F59E0B",
  cloth_pickup_pending: "#F97316",
  cloth_picked_up: "#F97316",
  cloth_at_hub: "#8B5CF6",
  stitching_in_progress: "#EC4899",
  stitching_completed: "#10B981",
  out_for_delivery: "#3B82F6",
  delivered: "#065F46",
  cancelled: "#B91C1C",
};

const WAITING_STATUSES: Record<string, string> = {
  order_rejected: "Order was rejected",
  delivered: "Order delivered successfully",
  cancelled: "Order has been cancelled",
  tailor_assigned: "Tailor assigned — waiting for stitching to begin",
  stitching_in_progress: "Stitching in progress",
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

const fmt = (v: number) => Number(v).toFixed(2).replace(/\.00$/, "");

function BillingRow({
  label,
  value,
  hint,
  valueStyle,
  badge,
  sub = false,
  total = false,
  mono = false,
}: {
  label: string;
  value: string;
  hint?: string;
  valueStyle?: object;
  badge?: string;
  sub?: boolean;
  total?: boolean;
  mono?: boolean;
}) {
  return (
    <View style={[styles.billingRow, total && styles.billingRowTotal]}>
      <View style={styles.billingLabelWrap}>
        <Text style={[styles.billingLabel, sub && styles.billingLabelSub, total && styles.billingLabelTotal]}>
          {label}
        </Text>
        {hint ? <Text style={styles.billingHint}>{hint}</Text> : null}
      </View>
      <View style={styles.billingValueWrap}>
        {badge ? (
          <View style={styles.billingBadge}>
            <Text style={styles.billingBadgeText}>{badge}</Text>
          </View>
        ) : null}
        <Text style={[styles.billingValue, total && styles.billingValueTotal, mono && styles.billingValueMono, valueStyle]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

// ─── Delivery Payment Modal ───────────────────────────────────────────────────

const MERCHANT_UPI = process.env.EXPO_PUBLIC_MERCHANT_UPI_ID ?? "bookmydarzi@upi";

function DeliveryPaymentModal({
  visible,
  amount,
  orderCode,
  onCashConfirm,
  onClose,
}: {
  visible: boolean;
  amount: number;
  orderCode: string;
  onCashConfirm: () => void;
  onClose: () => void;
}) {
  const [tab, setTab] = useState<"qr" | "cash">("qr");

  const upiLink =
    `upi://pay?pa=${encodeURIComponent(MERCHANT_UPI)}` +
    `&pn=${encodeURIComponent("BookMyDarzi")}` +
    `&tr=${encodeURIComponent(orderCode)}` +
    `&am=${amount.toFixed(2)}` +
    `&cu=INR` +
    `&tn=${encodeURIComponent(`Balance payment for order ${orderCode}`)}`;

  const qrImageUri =
    `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=12&data=` +
    encodeURIComponent(upiLink);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: 28 }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Collect Payment</Text>
              <Text style={styles.modalSubtitle}>Balance due: ₹{amount.toFixed(0)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <View style={styles.payTabRow}>
            <TouchableOpacity
              style={[styles.payTab, tab === "qr" && styles.payTabActive]}
              onPress={() => setTab("qr")}
            >
              <Ionicons name="qr-code-outline" size={16} color={tab === "qr" ? COLORS.primary : COLORS.gray} />
              <Text style={[styles.payTabText, tab === "qr" && styles.payTabTextActive]}>UPI QR</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.payTab, tab === "cash" && styles.payTabActive]}
              onPress={() => setTab("cash")}
            >
              <Ionicons name="cash-outline" size={16} color={tab === "cash" ? COLORS.primary : COLORS.gray} />
              <Text style={[styles.payTabText, tab === "cash" && styles.payTabTextActive]}>Cash</Text>
            </TouchableOpacity>
          </View>

          {tab === "qr" ? (
            <View style={styles.qrSection}>
              <Text style={styles.qrHint}>Ask the customer to scan this QR with any UPI app</Text>
              <View style={styles.qrBox}>
                <Image
                  source={{ uri: qrImageUri }}
                  style={styles.qrImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={styles.qrUpiId}>{MERCHANT_UPI}</Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={onCashConfirm}>
                <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>Payment Received - Mark Delivered</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.cashSection}>
              <View style={styles.cashAmountBox}>
                <Text style={styles.cashAmountLabel}>Collect from customer</Text>
                <Text style={styles.cashAmount}>₹{amount.toFixed(0)}</Text>
              </View>
              <Text style={styles.cashNote}>
                Confirm only after physically receiving cash from the customer.
              </Text>
              <TouchableOpacity style={styles.confirmBtn} onPress={onCashConfirm}>
                <Ionicons name="cash-outline" size={18} color={COLORS.white} />
                <Text style={styles.confirmBtnText}>Cash Received - Mark Delivered</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Tailor Selector Modal ────────────────────────────────────────────────────

function TailorSelectorModal({
  visible,
  tailors,
  loading,
  onSelect,
  onClose,
}: {
  visible: boolean;
  tailors: TailorProfile[];
  loading: boolean;
  onSelect: (id: number) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={[styles.modalSheet, { paddingBottom: 28 }]}>
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Assign Tailor</Text>
              <Text style={styles.modalSubtitle}>Select a tailor for this order</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>
          {loading ? (
            <View style={{ paddingVertical: 32, alignItems: "center" }}>
              <ActivityIndicator size="large" color={TEAL} />
            </View>
          ) : tailors.length === 0 ? (
            <View style={{ paddingVertical: 32, alignItems: "center", gap: 8 }}>
              <Ionicons name="person-outline" size={32} color={COLORS.gray} />
              <Text style={{ color: COLORS.gray, fontSize: 13 }}>No tailors available</Text>
            </View>
          ) : (
            <ScrollView style={{ maxHeight: 360 }}>
              {tailors.map((tailor) => {
                const name = tailor.user?.name ?? `Tailor #${tailor.Id}`;
                const sub = [tailor.Specialization, tailor.Location].filter(Boolean).join(" · ");
                const available = tailor.IsAvailable !== false;
                return (
                  <TouchableOpacity
                    key={tailor.Id}
                    style={[styles.tailorRow, !available && styles.tailorRowDisabled]}
                    onPress={() => available && onSelect(tailor.Id)}
                    disabled={!available}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tailorAvatar}>
                      <Text style={styles.tailorAvatarText}>{name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tailorName}>{name}</Text>
                      {sub ? <Text style={styles.tailorSub}>{sub}</Text> : null}
                    </View>
                    {!available ? (
                      <Text style={styles.tailorUnavail}>Unavailable</Text>
                    ) : (
                      <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
    </Modal>
  );
}

// ─── Measurement Modal ────────────────────────────────────────────────────────

const GENDERS = ["male", "female", "other"] as const;
const FIT_OPTIONS = ["slim", "regular", "loose"] as const;

function MeasurementModal({
  visible,
  saving,
  onSave,
  onClose,
  prefill,
}: {
  visible: boolean;
  saving: boolean;
  onSave: (data: MeasurementInput) => void;
  onClose: () => void;
  prefill?: any;
}) {
  const [profileName, setProfileName] = useState(prefill?.profile_name ?? "");
  const [gender, setGender] = useState<string>(prefill?.gender ?? "");
  const [fit, setFit] = useState<string>(prefill?.fit_preference ?? "");
  const [chest, setChest] = useState(prefill?.chest != null ? String(prefill.chest) : "");
  const [waist, setWaist] = useState(prefill?.waist != null ? String(prefill.waist) : "");
  const [hips, setHips] = useState(prefill?.hips != null ? String(prefill.hips) : "");
  const [shoulder, setShoulder] = useState(prefill?.shoulder != null ? String(prefill.shoulder) : "");
  const [neck, setNeck] = useState(prefill?.neck != null ? String(prefill.neck) : "");
  const [sleeve, setSleeve] = useState(prefill?.sleeve_length != null ? String(prefill.sleeve_length) : "");
  const [inseam, setInseam] = useState(prefill?.inseam != null ? String(prefill.inseam) : "");
  const [height, setHeight] = useState(prefill?.height != null ? String(prefill.height) : "");
  const [notes, setNotes] = useState(prefill?.notes ?? "");
  const insets = useSafeAreaInsets();

  const num = (s: string) => (s.trim() === "" ? undefined : Number(s));

  const handleSave = () => {
    if (!profileName.trim()) {
      Alert.alert("Required", "Please enter a profile name (e.g. customer name).");
      return;
    }
    onSave({
      profile_name: profileName.trim(),
      gender: gender || undefined,
      fit_preference: fit || undefined,
      chest: num(chest),
      waist: num(waist),
      hips: num(hips),
      shoulder: num(shoulder),
      neck: num(neck),
      sleeve_length: num(sleeve),
      inseam: num(inseam),
      height: num(height),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: COLORS.offWhite }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {/* Header */}
        <View style={[measStyles.header, { paddingTop: insets.top + 8 }]}>
          <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
            <Ionicons name="close" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={measStyles.headerTitle}>Record Measurements</Text>
          <View style={{ width: 30 }} />
        </View>

        <ScrollView contentContainerStyle={measStyles.scroll} keyboardShouldPersistTaps="handled">
          {/* Profile name */}
          <View style={measStyles.section}>
            <Text style={measStyles.sectionTitle}>Profile</Text>
            <View style={measStyles.field}>
              <Text style={measStyles.label}>Customer / Profile Name *</Text>
              <TextInput
                style={measStyles.input}
                value={profileName}
                onChangeText={setProfileName}
                placeholder="e.g. Ramesh Sharma"
                placeholderTextColor={COLORS.gray}
              />
            </View>

            <View style={measStyles.field}>
              <Text style={measStyles.label}>Gender</Text>
              <View style={measStyles.chipRow}>
                {GENDERS.map((g) => (
                  <TouchableOpacity
                    key={g}
                    style={[measStyles.chip, gender === g && measStyles.chipActive]}
                    onPress={() => setGender(gender === g ? "" : g)}
                  >
                    <Text style={[measStyles.chipText, gender === g && measStyles.chipTextActive]}>
                      {g.charAt(0).toUpperCase() + g.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={measStyles.field}>
              <Text style={measStyles.label}>Fit Preference</Text>
              <View style={measStyles.chipRow}>
                {FIT_OPTIONS.map((f) => (
                  <TouchableOpacity
                    key={f}
                    style={[measStyles.chip, fit === f && measStyles.chipActive]}
                    onPress={() => setFit(fit === f ? "" : f)}
                  >
                    <Text style={[measStyles.chipText, fit === f && measStyles.chipTextActive]}>
                      {f.charAt(0).toUpperCase() + f.slice(1)}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* Body measurements */}
          <View style={measStyles.section}>
            <Text style={measStyles.sectionTitle}>Body Measurements (inches)</Text>
            <View style={measStyles.grid}>
              {([
                ["Chest", chest, setChest],
                ["Waist", waist, setWaist],
                ["Hips", hips, setHips],
                ["Shoulder", shoulder, setShoulder],
                ["Neck", neck, setNeck],
                ["Sleeve Length", sleeve, setSleeve],
                ["Inseam", inseam, setInseam],
                ["Height", height, setHeight],
              ] as [string, string, (v: string) => void][]).map(([label, val, set]) => (
                <View key={label} style={measStyles.gridField}>
                  <Text style={measStyles.label}>{label}</Text>
                  <TextInput
                    style={measStyles.inputSmall}
                    value={val}
                    onChangeText={set}
                    keyboardType="decimal-pad"
                    placeholder='0"'
                    placeholderTextColor={COLORS.gray}
                  />
                </View>
              ))}
            </View>
          </View>

          {/* Notes */}
          <View style={measStyles.section}>
            <Text style={measStyles.sectionTitle}>Additional Notes</Text>
            <TextInput
              style={[measStyles.input, measStyles.inputMulti]}
              value={notes}
              onChangeText={setNotes}
              placeholder="Any special stitching instructions, preferences..."
              placeholderTextColor={COLORS.gray}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </View>

          <View style={{ height: 32 }} />
        </ScrollView>

        {/* Save button */}
        <View style={[measStyles.footer, { paddingBottom: insets.bottom + 8 }]}>
          <TouchableOpacity
            style={[measStyles.saveBtn, saving && { opacity: 0.6 }]}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle-outline" size={18} color={COLORS.white} />
                <Text style={measStyles.saveBtnText}>Save Measurements</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const measStyles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  headerTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.black },
  scroll: { padding: SPACING.md, gap: 12 },
  section: { backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.md, ...SHADOW.card },
  sectionTitle: {
    fontSize: 11,
    ...FONTS.semiBold,
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.8,
    marginBottom: 12,
  },
  field: { marginBottom: 12 },
  label: { fontSize: 12, color: COLORS.gray, ...FONTS.medium, marginBottom: 6 },
  input: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.black,
    backgroundColor: COLORS.white,
  },
  inputMulti: { minHeight: 80, paddingTop: 10 },
  chipRow: { flexDirection: "row", gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    backgroundColor: COLORS.grayLight,
  },
  chipActive: { backgroundColor: TEAL + "18", borderColor: TEAL },
  chipText: { fontSize: 13, color: COLORS.gray, ...FONTS.medium },
  chipTextActive: { color: TEAL, ...FONTS.semiBold },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  gridField: { width: "46%" },
  inputSmall: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    color: COLORS.black,
    backgroundColor: COLORS.white,
    textAlign: "center",
  },
  footer: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
  },
  saveBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
  },
  saveBtnText: { color: COLORS.white, fontSize: 15, ...FONTS.semiBold },
});

// ─── Main Screen ──────────────────────────────────────────────────────────────

export default function EmployeeOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<any>(null);
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [showTailorModal, setShowTailorModal] = useState(false);
  const [tailors, setTailors] = useState<TailorProfile[]>([]);
  const [loadingTailors, setLoadingTailors] = useState(false);
  const [showMeasModal, setShowMeasModal] = useState(false);
  const [savingMeas, setSavingMeas] = useState(false);

  const orderId = Number(id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEmployeeOrder(orderId);
      setDetail(data);
      setOrder(data?.order ?? data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    load();
  }, [load]);

  const status: string = (order?.Status ?? order?.status ?? "").toLowerCase();
  const statusColor = STATUS_COLORS[status] ?? COLORS.gray;
  const waitingMessage = WAITING_STATUSES[status];

  // ── Action runners ──────────────────────────────────────────────────────────

  const run = async (
    fn: () => Promise<any>,
    confirmMsg?: string,
    onSuccess?: (res: any) => void,
  ) => {
    const doIt = async () => {
      setActing(true);
      try {
        const res = await fn();
        if (res?.order) {
          setOrder(res.order);
        }
        const warning = res?.warning;
        if (onSuccess) {
          onSuccess(res);
          if (warning) Alert.alert("Note", warning);
        } else {
          if (warning) Alert.alert("Done", warning);
          load();
        }
      } catch (e: any) {
        Alert.alert("Error", e?.message ?? "Action failed");
      } finally {
        setActing(false);
      }
    };
    if (confirmMsg) {
      Alert.alert("Confirm", confirmMsg, [
        { text: "Cancel", style: "cancel" },
        { text: "Yes", onPress: doIt },
      ]);
    } else {
      doIt();
    }
  };

  const handleAccept = () =>
    run(() => acceptOrder(orderId), "Accept this order and add it to your queue?");

  const handleReject = () =>
    run(
      () => rejectOrder(orderId),
      "Reject this order? This cannot be undone.",
    );

  const handleGoForPickup = () => {
    const pickupType = (order?.PickupType ?? order?.pickup_type ?? "instant").toLowerCase();
    const slot = order?.PickupTimeSlot ?? order?.pickup_time_slot;
    const rawDate = order?.ScheduledPickupAt ?? order?.scheduled_pickup_at;
    const dateStr = rawDate
      ? new Date(rawDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })
      : null;
    const scheduleInfo = [dateStr, slot].filter(Boolean).join(" · ");
    const msg =
      pickupType === "scheduled"
        ? `Confirm go for pickup?\n\nScheduled: ${scheduleInfo || "time not specified"}\n\nContact the customer if timing needs adjustment.`
        : "Go for pickup now? Your team will head to the customer immediately.";
    run(() => schedulePickup(orderId, pickupType as "instant" | "scheduled"), msg);
  };

  const handleConfirmPickup = () =>
    run(() => confirmPickup(orderId), "Confirm cloth has been picked up from customer?");

  const handleMarkAtHub = () =>
    run(() => markClothAtHub(orderId), "Mark cloth as received at workshop?");

  const handleAssignTailor = () => {
    setLoadingTailors(true);
    setShowTailorModal(true);
    listTailors()
      .then(setTailors)
      .catch((e: any) => Alert.alert("Error", e?.message ?? "Failed to load tailors"))
      .finally(() => setLoadingTailors(false));
  };

  const handleTailorSelected = (tailorId: number) => {
    setShowTailorModal(false);
    run(() => assignTailor(orderId, tailorId), "Assign this tailor to the order?");
  };

  const handleSaveMeasurement = async (data: MeasurementInput) => {
    setSavingMeas(true);
    try {
      await collectMeasurement(orderId, data);
      setShowMeasModal(false);
      load();
      Alert.alert("Saved", "Measurements recorded successfully.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to save measurements");
    } finally {
      setSavingMeas(false);
    }
  };

  const handleCompleteStitching = () =>
    run(() => completeStitching(orderId), "Mark stitching as complete?");

  const handleDelivery = () =>
    run(() => markOutForDelivery(orderId), "Mark this order as out for delivery?");

  const onDelivered = () => {
    Alert.alert("Order Delivered", "The order has been marked as delivered successfully.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const handleComplete = () => {
    const remaining = Number(order?.RemainingAmount ?? order?.remaining_amount ?? 0);
    const balanceDue = Boolean(order?.BalanceDue ?? order?.balance_due);
    const payStatus = (order?.PaymentStatus ?? order?.payment_status ?? "").toLowerCase();
    const isCodPending = payStatus === "cod_pending";
    const needsCollection = remaining > 0 || balanceDue || isCodPending;
    if (needsCollection) {
      setShowDeliveryModal(true);
    } else {
      run(
        () => completeOrder(orderId),
        "Confirm this order has been delivered to the customer?",
        onDelivered,
      );
    }
  };

  const handleDeliveryConfirmed = () => {
    setShowDeliveryModal(false);
    run(() => completeOrder(orderId), undefined, onDelivered);
  };

  // ── Action config per status ─────────────────────────────────────────────────

  type ActionConfig = {
    label: string;
    icon: string;
    color: string;
    onPress: () => void;
    secondaryAction?: {
      label: string;
      icon: string;
      color: string;
      onPress: () => void;
    };
  };

  const ACTION_MAP: Record<string, ActionConfig> = {
    order_placed: {
      label: "Accept Order",
      icon: "checkmark-circle-outline",
      color: TEAL,
      onPress: handleAccept,
      secondaryAction: {
        label: "Reject",
        icon: "close-circle-outline",
        color: "#DC2626",
        onPress: handleReject,
      },
    },
    order_accepted: {
      label: "Go for Pickup",
      icon: "bicycle-outline",
      color: "#F59E0B",
      onPress: handleGoForPickup,
    },
    cloth_pickup_pending: {
      label: "Confirm Pickup",
      icon: "checkmark-done-outline",
      color: "#F97316",
      onPress: handleConfirmPickup,
    },
    cloth_picked_up: {
      label: "Mark Cloth at Hub",
      icon: "business-outline",
      color: "#8B5CF6",
      onPress: handleMarkAtHub,
    },
    cloth_at_hub: {
      label: "Assign Tailor",
      icon: "person-add-outline",
      color: "#8B5CF6",
      onPress: handleAssignTailor,
    },
    stitching_completed: {
      label: "Mark Out for Delivery",
      icon: "bicycle-outline",
      color: "#3B82F6",
      onPress: handleDelivery,
    },
    out_for_delivery: {
      label: "Mark Delivered",
      icon: "home-outline",
      color: COLORS.success,
      onPress: handleComplete,
    },
  };

  const action = ACTION_MAP[status];

  // ── Rich detail helpers ──────────────────────────────────────────────────────

  const delivery = detail?.delivery_address;
  const payment = detail?.payment;
  const pricing = detail?.pricing;
  const measurement = detail?.measurement;
  const service = detail?.service;
  const lineItems: any[] = detail?.line_items ?? [];
  const timeline: any[] = detail?.tracking_timeline ?? [];

  const customerMobile =
    delivery?.mobile ?? order?.customer?.mobile ?? order?.CustomerMobile;
  const customerAddress =
    delivery?.full_address ?? order?.DeliveryAddress ?? order?.delivery_address;

  // Scheduled pickup details
  const pickupType = (order?.PickupType ?? order?.pickup_type ?? "").toLowerCase();
  const isScheduled = pickupType === "scheduled";
  const pickupSlot = order?.PickupTimeSlot ?? order?.pickup_time_slot;
  const rawPickupDate = order?.ScheduledPickupAt ?? order?.scheduled_pickup_at;
  const pickupDateStr = rawPickupDate
    ? new Date(rawPickupDate).toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short", year: "numeric" })
    : null;

  // Whether employee should be able to add measurements
  const canTakeMeasurements = ["cloth_picked_up", "cloth_at_hub", "cloth_pickup_pending", "order_accepted"].includes(status);
  const hasMeasurement = !!measurement;

  const callCustomer = () => {
    if (!customerMobile) return;
    Linking.openURL(`tel:${customerMobile}`).catch(() =>
      Alert.alert("Error", "Could not open phone app")
    );
  };

  const openMaps = () => {
    if (!customerAddress) return;
    const q = encodeURIComponent(
      typeof customerAddress === "string" ? customerAddress : ""
    );
    Linking.openURL(
      `https://www.google.com/maps/search/?api=1&query=${q}`
    ).catch(() => Alert.alert("Error", "Could not open maps"));
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Detail</Text>
        <TouchableOpacity
          style={styles.chatHeaderBtn}
          onPress={() =>
            router.push({
              pathname: "/(employee)/order-chat" as never,
              params: {
                orderId: String(orderId),
                orderCode: order?.OrderCode ?? order?.order_code ?? String(orderId),
                customerName:
                  order?.delivery_address?.full_name ??
                  order?.customer_name ??
                  "Customer",
              },
            })
          }
          hitSlop={12}
        >
          <Ionicons name="chatbubble-ellipses-outline" size={22} color={TEAL} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
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
            {/* Status banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusColor + "1A" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {status.replace(/_/g, " ").toUpperCase()}
              </Text>
            </View>

            {/* Waiting state */}
            {waitingMessage ? (
              <View style={styles.waitingCard}>
                <Ionicons name="time-outline" size={18} color="#6B7280" />
                <Text style={styles.waitingText}>{waitingMessage}</Text>
              </View>
            ) : null}

            {/* Scheduled pickup callout — prominent when action needed */}
            {isScheduled && (status === "order_accepted" || status === "cloth_pickup_pending") ? (
              <View style={styles.scheduledCard}>
                <View style={styles.scheduledIconWrap}>
                  <Ionicons name="calendar-outline" size={18} color="#7C3AED" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.scheduledLabel}>Scheduled Pickup</Text>
                  {pickupDateStr ? (
                    <Text style={styles.scheduledValue}>{pickupDateStr}</Text>
                  ) : null}
                  {pickupSlot ? (
                    <Text style={styles.scheduledSlot}>{pickupSlot}</Text>
                  ) : null}
                  {!pickupDateStr && !pickupSlot ? (
                    <Text style={styles.scheduledSlot}>Customer has not specified a time — contact them to confirm.</Text>
                  ) : null}
                </View>
              </View>
            ) : null}

            {/* Measurement nudge — shown when cloth is collected but no measurements */}
            {canTakeMeasurements && !hasMeasurement ? (
              <TouchableOpacity style={styles.measNudge} onPress={() => setShowMeasModal(true)} activeOpacity={0.8}>
                <Ionicons name="alert-circle-outline" size={18} color="#D97706" />
                <Text style={styles.measNudgeText}>No measurements recorded — tap to add now</Text>
                <Ionicons name="chevron-forward" size={16} color="#D97706" />
              </TouchableOpacity>
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
                    : order?.created_at
                    ? new Date(order.created_at).toLocaleString("en-IN")
                    : null
                }
              />
              <Row
                label="Total"
                value={
                  order?.TotalAmount != null
                    ? `₹${order.TotalAmount}`
                    : order?.total_amount != null
                    ? `₹${order.total_amount}`
                    : null
                }
              />
              <Row label="Payment Status" value={order?.PaymentStatus ?? order?.payment_status} />
              <Row
                label="Pickup Type"
                value={isScheduled ? "Scheduled Pickup" : pickupType === "instant" ? "Instant Pickup" : null}
              />
              {isScheduled && pickupDateStr ? (
                <Row label="Scheduled Date" value={pickupDateStr} />
              ) : null}
              {pickupSlot ? (
                <Row label="Time Slot" value={pickupSlot} />
              ) : null}
              <Row label="Urgency" value={order?.UrgencyLevel ?? order?.urgency_level} />
            </View>

            {/* Service */}
            {service ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Service</Text>
                <Row label="Service" value={service.name} />
                <Row label="Base Price" value={service.base_price != null ? `₹${service.base_price}` : null} />
                <Row
                  label="Est. Delivery"
                  value={
                    service.estimated_delivery_days
                      ? `${service.estimated_delivery_days} days`
                      : null
                  }
                />
              </View>
            ) : null}

            {/* Customer */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer</Text>
              <Row label="Name" value={order?.customer?.name ?? delivery?.full_name ?? order?.CustomerName} />
              {customerMobile ? (
                <TouchableOpacity style={styles.linkRow} onPress={callCustomer} activeOpacity={0.7}>
                  <Text style={styles.rowLabel}>Mobile</Text>
                  <View style={styles.linkRowRight}>
                    <Text style={styles.linkRowValue}>{customerMobile}</Text>
                    <Ionicons name="call-outline" size={15} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>
              ) : null}
              {customerAddress ? (
                <TouchableOpacity style={styles.linkRow} onPress={openMaps} activeOpacity={0.7}>
                  <Text style={styles.rowLabel}>Address</Text>
                  <View style={styles.linkRowRight}>
                    <Text style={[styles.linkRowValue, styles.linkRowAddress]}>{customerAddress}</Text>
                    <Ionicons name="map-outline" size={15} color={COLORS.primary} />
                  </View>
                </TouchableOpacity>
              ) : null}
              <Row label="City" value={delivery?.city} />
              <Row label="Pincode" value={delivery?.pincode} />
            </View>

            {/* Measurement */}
            {measurement ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Measurement</Text>
                <Row label="Profile" value={measurement.profile_name} />
                <Row label="Gender" value={measurement.gender} />
                <Row label="Fit" value={measurement.fit_preference} />
                <Row label="Chest" value={measurement.chest != null ? `${measurement.chest}"` : null} />
                <Row label="Waist" value={measurement.waist != null ? `${measurement.waist}"` : null} />
                <Row label="Hips" value={measurement.hips != null ? `${measurement.hips}"` : null} />
                <Row label="Shoulder" value={measurement.shoulder != null ? `${measurement.shoulder}"` : null} />
                <Row label="Sleeve" value={measurement.sleeve_length != null ? `${measurement.sleeve_length}"` : null} />
              </View>
            ) : null}

            {/* Line items (family cart) */}
            {lineItems.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Order Items</Text>
                {lineItems.map((item: any, i: number) => (
                  <View key={i} style={styles.lineItem}>
                    <Text style={styles.lineItemName}>{item.person_name}</Text>
                    <Text style={styles.lineItemSub}>
                      {[item.service_name, item.category_name].filter(Boolean).join(" · ")}
                    </Text>
                    {item.price != null ? (
                      <Text style={styles.lineItemPrice}>₹{item.price}</Text>
                    ) : null}
                    {item.measurements?.length > 0 ? (
                      <View style={styles.lineItemMeasurements}>
                        {item.measurements.map((m: any, mi: number) => (
                          <Text key={mi} style={styles.lineItemMeasText}>
                            {m.measurement_name}: {m.measurement_value}
                          </Text>
                        ))}
                      </View>
                    ) : null}
                  </View>
                ))}
              </View>
            ) : null}

            {/* Billing breakdown */}
            {pricing ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Billing</Text>

                {/* Item breakdown */}
                <BillingRow label="Item Total" value={`₹${fmt(pricing.subtotal)}`} />
                {pricing.discount > 0 ? (
                  <BillingRow label="Discount" value={`−₹${fmt(pricing.discount)}`} valueStyle={styles.discountValue} />
                ) : null}
                {pricing.platform_fee > 0 ? (
                  <BillingRow label="Convenience Fee" value={`₹${fmt(pricing.platform_fee)}`} hint="Booking / platform charge" />
                ) : null}
                {pricing.gst_amount > 0 ? (
                  <>
                    <BillingRow label="GST" value={`₹${fmt(pricing.gst_amount)}`} />
                    {pricing.cgst_amount > 0 ? (
                      <BillingRow label="  CGST (2.5%)" value={`₹${fmt(pricing.cgst_amount)}`} sub />
                    ) : null}
                    {pricing.sgst_amount > 0 ? (
                      <BillingRow label="  SGST (2.5%)" value={`₹${fmt(pricing.sgst_amount)}`} sub />
                    ) : null}
                  </>
                ) : null}

                <View style={styles.billingDivider} />

                {/* Total */}
                <BillingRow label="Total Payable" value={`₹${fmt(pricing.final_amount)}`} total />

                <View style={styles.billingDivider} />

                {/* Payment split */}
                {pricing.advance_paid > 0 ? (
                  <BillingRow
                    label="Advance Paid"
                    value={`₹${fmt(pricing.advance_paid)}`}
                    hint={payment?.channel === "cod" ? "COD" : "Online"}
                    valueStyle={styles.paidValue}
                  />
                ) : null}
                {pricing.remaining_amount > 0 ? (
                  <BillingRow
                    label="Balance at Delivery"
                    value={`₹${fmt(pricing.remaining_amount)}`}
                    valueStyle={pricing.balance_due ? styles.dueValue : undefined}
                    badge={pricing.balance_due ? "PENDING" : undefined}
                  />
                ) : null}
                {pricing.remaining_amount === 0 && pricing.advance_paid > 0 ? (
                  <BillingRow label="Balance" value="Fully Paid" valueStyle={styles.paidValue} />
                ) : null}

                {/* Transaction info */}
                {payment?.transaction_id ? (
                  <>
                    <View style={styles.billingDivider} />
                    <BillingRow label="Payment Method" value={payment.method ?? payment.channel ?? "—"} />
                    <BillingRow label="Transaction ID" value={payment.transaction_id} mono />
                    {payment.status ? (
                      <BillingRow label="Payment Status" value={payment.status} />
                    ) : null}
                  </>
                ) : payment ? (
                  <>
                    <View style={styles.billingDivider} />
                    <BillingRow label="Payment Method" value={payment.method ?? payment.channel ?? "—"} />
                    {payment.status ? (
                      <BillingRow label="Payment Status" value={payment.status} />
                    ) : null}
                  </>
                ) : null}
              </View>
            ) : null}

            {/* Timeline */}
            {timeline.length > 0 ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Timeline</Text>
                {timeline.map((t: any, i: number) => (
                  <View key={i} style={styles.timelineRow}>
                    <View style={styles.timelineDot} />
                    <View style={{ flex: 1 }}>
                      <Text style={styles.timelineStatus}>
                        {(t.status ?? "").replace(/_/g, " ")}
                      </Text>
                      {t.timestamp ? (
                        <Text style={styles.timelineTime}>
                          {new Date(t.timestamp).toLocaleString("en-IN")}
                        </Text>
                      ) : null}
                    </View>
                  </View>
                ))}
              </View>
            ) : null}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Action buttons */}
          <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
            {/* Measurement secondary button — visible whenever cloth is accessible */}
            {canTakeMeasurements ? (
              <TouchableOpacity
                style={styles.measBtn}
                onPress={() => setShowMeasModal(true)}
                activeOpacity={0.8}
              >
                <Ionicons name="body-outline" size={15} color={TEAL} />
                <Text style={styles.measBtnText}>
                  {hasMeasurement ? "Update Measurements" : "Take Measurements"}
                </Text>
              </TouchableOpacity>
            ) : null}

            {action ? (
              action.secondaryAction ? (
                <View style={styles.actionRowDual}>
                  <TouchableOpacity
                    style={[styles.actionBtnHalf, { backgroundColor: action.secondaryAction.color }, acting && styles.disabledBtn]}
                    onPress={action.secondaryAction.onPress}
                    disabled={acting}
                  >
                    <Ionicons name={action.secondaryAction.icon as any} size={16} color={COLORS.white} />
                    <Text style={styles.actionBtnText}>{action.secondaryAction.label}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.actionBtnHalf, { backgroundColor: action.color }, acting && styles.disabledBtn]}
                    onPress={action.onPress}
                    disabled={acting}
                  >
                    {acting ? (
                      <ActivityIndicator size="small" color={COLORS.white} />
                    ) : (
                      <>
                        <Ionicons name={action.icon as any} size={16} color={COLORS.white} />
                        <Text style={styles.actionBtnText}>{action.label}</Text>
                      </>
                    )}
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity
                  style={[styles.actionBtn, { backgroundColor: action.color }, acting && styles.disabledBtn]}
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
              )
            ) : waitingMessage ? (
              <View style={styles.waitingBar}>
                <Ionicons name="hourglass-outline" size={18} color="#6B7280" />
                <Text style={styles.waitingBarText}>{waitingMessage}</Text>
              </View>
            ) : null}
          </View>
        </>
      )}

      {/* Measurement collection */}
      <MeasurementModal
        visible={showMeasModal}
        saving={savingMeas}
        onSave={handleSaveMeasurement}
        onClose={() => setShowMeasModal(false)}
        prefill={measurement}
      />

      {/* Tailor assignment */}
      <TailorSelectorModal
        visible={showTailorModal}
        tailors={tailors}
        loading={loadingTailors}
        onSelect={handleTailorSelected}
        onClose={() => setShowTailorModal(false)}
      />

      {/* Delivery payment collection */}
      <DeliveryPaymentModal
        visible={showDeliveryModal}
        amount={(() => {
          const remaining = Number(order?.RemainingAmount ?? order?.remaining_amount ?? 0);
          return remaining > 0
            ? remaining
            : Number(order?.FinalAmount ?? order?.final_amount ?? 0);
        })()}
        orderCode={order?.OrderCode ?? order?.order_code ?? `#${orderId}`}
        onCashConfirm={handleDeliveryConfirmed}
        onClose={() => setShowDeliveryModal(false)}
      />
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
  chatHeaderBtn: { width: 40, height: 40, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.black },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { color: COLORS.error, fontSize: 14, textAlign: "center", paddingHorizontal: 24 },
  retryBtn: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: RADIUS.md,
  },
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
  statusText: { fontSize: 13, ...FONTS.bold, letterSpacing: 0.5 },

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
  rowValue: {
    fontSize: 13,
    color: COLORS.black,
    ...FONTS.medium,
    flex: 2,
    textAlign: "right",
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  linkRowRight: {
    flex: 2,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 4,
  },
  linkRowValue: {
    fontSize: 13,
    color: COLORS.primary,
    ...FONTS.medium,
    textAlign: "right",
  },
  linkRowAddress: {
    flex: 1,
    flexShrink: 1,
  },

  lineItem: {
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  lineItemName: { fontSize: 13, ...FONTS.semiBold, color: COLORS.black },
  lineItemSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  lineItemPrice: { fontSize: 13, color: TEAL, ...FONTS.semiBold, marginTop: 2 },
  lineItemMeasurements: { marginTop: 4 },
  lineItemMeasText: { fontSize: 11, color: "#6B7280" },

  timelineRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 6,
  },
  timelineDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: TEAL,
    marginTop: 5,
  },
  timelineStatus: { fontSize: 13, ...FONTS.medium, color: COLORS.black, textTransform: "capitalize" },
  timelineTime: { fontSize: 11, color: COLORS.gray, marginTop: 2 },

  actionBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
  },
  actionRowDual: {
    flexDirection: "row",
    gap: 8,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    gap: 8,
  },
  actionBtnHalf: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    gap: 6,
  },
  disabledBtn: { opacity: 0.6 },
  actionBtnText: { color: COLORS.white, fontSize: 14, ...FONTS.semiBold },
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

  // Delivery payment modal
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  modalSheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: "75%",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  modalTitle: { fontSize: 16, ...FONTS.bold, color: COLORS.black },
  modalSubtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2 },
  payTabRow: {
    flexDirection: "row",
    margin: SPACING.md,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.md,
    padding: 4,
  },
  payTab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    borderRadius: RADIUS.sm,
  },
  payTabActive: { backgroundColor: COLORS.white, ...SHADOW.card },
  payTabText: { fontSize: 13, color: COLORS.gray, ...FONTS.medium },
  payTabTextActive: { color: COLORS.primary },
  qrSection: { alignItems: "center", paddingHorizontal: SPACING.md, gap: 12 },
  qrHint: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  qrBox: {
    width: 260,
    height: 260,
    borderRadius: 12,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  qrImage: { width: 260, height: 260 },
  qrUpiId: { fontSize: 12, color: COLORS.gray },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#16A34A",
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    width: "100%",
    marginTop: 4,
  },
  confirmBtnText: { color: COLORS.white, fontSize: 14, ...FONTS.semiBold },
  cashSection: { paddingHorizontal: SPACING.md, gap: 16 },
  cashAmountBox: {
    backgroundColor: "#F0FDF4",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#BBF7D0",
  },
  cashAmountLabel: { fontSize: 13, color: "#15803D" },
  cashAmount: { fontSize: 32, ...FONTS.bold, color: "#15803D", marginTop: 4 },
  cashNote: { fontSize: 13, color: COLORS.gray, textAlign: "center" },

  // Scheduled pickup callout
  scheduledCard: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#EDE9FE",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#C4B5FD",
  },
  scheduledIconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#7C3AED20",
    alignItems: "center",
    justifyContent: "center",
  },
  scheduledLabel: { fontSize: 11, ...FONTS.semiBold, color: "#5B21B6", textTransform: "uppercase", letterSpacing: 0.5 },
  scheduledValue: { fontSize: 15, ...FONTS.bold, color: "#4C1D95", marginTop: 2 },
  scheduledSlot: { fontSize: 13, color: "#6D28D9", marginTop: 2 },

  // Measurement nudge
  measNudge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FFFBEB",
    borderRadius: RADIUS.md,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  measNudgeText: { flex: 1, fontSize: 13, color: "#92400E", ...FONTS.medium },

  // Measurement button in action bar
  measBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1,
    borderColor: TEAL,
    borderRadius: RADIUS.md,
    paddingVertical: 10,
    marginBottom: 8,
  },
  measBtnText: { fontSize: 13, color: TEAL, ...FONTS.semiBold },

  // Billing breakdown
  billingRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    paddingVertical: 7,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayLight,
  },
  billingRowTotal: {
    paddingVertical: 10,
    borderBottomColor: "transparent",
  },
  billingLabelWrap: { flex: 1, gap: 1 },
  billingLabel: { fontSize: 13, color: COLORS.gray },
  billingLabelSub: { fontSize: 12, color: "#9CA3AF" },
  billingLabelTotal: { fontSize: 14, ...FONTS.bold, color: COLORS.black },
  billingHint: { fontSize: 10, color: "#9CA3AF" },
  billingValueWrap: { flexDirection: "row", alignItems: "center", gap: 6 },
  billingValue: { fontSize: 13, ...FONTS.medium, color: COLORS.black, textAlign: "right" },
  billingValueTotal: { fontSize: 15, ...FONTS.bold, color: COLORS.black },
  billingValueMono: { fontVariant: ["tabular-nums"] as any, fontSize: 11, color: COLORS.gray },
  billingBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: RADIUS.full,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  billingBadgeText: { fontSize: 9, ...FONTS.bold, color: "#92400E" },
  billingDivider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#CBD5E1",
    marginVertical: 4,
  },
  discountValue: { color: "#16A34A" },
  paidValue: { color: "#16A34A" },
  dueValue: { color: "#D97706", ...FONTS.bold },

  // Tailor selector modal
  tailorRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  tailorRowDisabled: { opacity: 0.45 },
  tailorAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: TEAL + "20",
    alignItems: "center",
    justifyContent: "center",
  },
  tailorAvatarText: { fontSize: 16, color: TEAL, fontWeight: "700" as const },
  tailorName: { fontSize: 14, color: COLORS.black, fontWeight: "600" as const },
  tailorSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  tailorUnavail: { fontSize: 11, color: COLORS.gray },
});
