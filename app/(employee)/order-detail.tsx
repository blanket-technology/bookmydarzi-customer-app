/**
 * Employee order detail + full action flow.
 * Correct status transitions:
 *   order_placed → accept → order_accepted
 *   order_accepted → assign-tailor (picker modal) → tailor_assigned
 *   tailor_assigned → schedule-pickup → cloth_pickup_pending
 *   cloth_pickup_pending → pickup → cloth_picked_up
 *   cloth_picked_up → start-stitching → stitching_in_progress
 *   stitching_in_progress → complete-stitching → stitching_completed
 *   stitching_completed → delivery → out_for_delivery
 *   out_for_delivery → complete → delivered
 */
import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Image,
  Linking,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
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
  markOutForDelivery,
  schedulePickup,
  startStitching,
  type TailorProfile,
} from "../../src/services/employeeService";

const TEAL = "#149694";

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

// Statuses where employee waits for the tailor to act
const WAITING_STATUSES: Record<string, string> = {
  cloth_picked_up: "Cloth collected — tailor will start stitching soon",
  stitching_in_progress: "Tailor is stitching — you'll be notified when done",
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

// ─── Tailor Picker Modal ───────────────────────────────────────────────────────

function TailorPickerModal({
  visible,
  onClose,
  onSelect,
}: {
  visible: boolean;
  onClose: () => void;
  onSelect: (tailor: TailorProfile) => void;
}) {
  const [tailors, setTailors] = useState<TailorProfile[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    setLoading(true);
    setError(null);
    listTailors()
      .then((res) => setTailors(Array.isArray(res) ? res : []))
      .catch((e) => setError(e?.message ?? "Failed to load tailors"))
      .finally(() => setLoading(false));
  }, [visible]);

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalOverlay}>
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select Tailor</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={22} color={COLORS.black} />
            </TouchableOpacity>
          </View>

          {loading ? (
            <ActivityIndicator size="large" color={TEAL} style={{ margin: 32 }} />
          ) : error ? (
            <View style={styles.center}>
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : tailors.length === 0 ? (
            <View style={styles.center}>
              <Text style={styles.emptyText}>No tailors available</Text>
            </View>
          ) : (
            <FlatList
              data={tailors}
              keyExtractor={(t) => String(t.Id)}
              contentContainerStyle={{ padding: SPACING.md }}
              ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
              renderItem={({ item }) => {
                const name =
                  item.user?.name ??
                  `Tailor #${item.Id}`;
                const sub = [item.Specialization, item.Location]
                  .filter(Boolean)
                  .join(" · ");
                const available = item.IsAvailable !== false;
                return (
                  <TouchableOpacity
                    style={[styles.tailorCard, !available && styles.tailorCardDisabled]}
                    onPress={() => available && onSelect(item)}
                    activeOpacity={0.7}
                  >
                    <View style={styles.tailorAvatar}>
                      <Text style={styles.tailorAvatarText}>
                        {name.charAt(0).toUpperCase()}
                      </Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.tailorName}>{name}</Text>
                      {sub ? <Text style={styles.tailorSub}>{sub}</Text> : null}
                      {item.Rating ? (
                        <Text style={styles.tailorSub}>★ {item.Rating.toFixed(1)}</Text>
                      ) : null}
                    </View>
                    {!available && (
                      <View style={styles.unavailableBadge}>
                        <Text style={styles.unavailableText}>Busy</Text>
                      </View>
                    )}
                    {available && (
                      <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
                    )}
                  </TouchableOpacity>
                );
              }}
            />
          )}
        </View>
      </View>
    </Modal>
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
          {/* Header */}
          <View style={styles.modalHeader}>
            <View>
              <Text style={styles.modalTitle}>Collect Payment</Text>
              <Text style={styles.modalSubtitle}>Balance due: ₹{amount.toFixed(0)}</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          {/* Tab switcher */}
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
                <Text style={styles.confirmBtnText}>Payment Received — Mark Delivered</Text>
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
                <Text style={styles.confirmBtnText}>Cash Received — Mark Delivered</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

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
  const [showTailorPicker, setShowTailorPicker] = useState(false);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);

  const orderId = Number(id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getEmployeeOrder(orderId);
      // Response shape: { order, service, measurement, delivery_address, payment, ... }
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
        // Instantly reflect new status from the action response
        if (res?.order) {
          setOrder(res.order);
        }
        const warning = res?.warning;
        if (onSuccess) {
          onSuccess(res);
          if (warning) Alert.alert("Note", warning);
        } else {
          if (warning) Alert.alert("Done", warning);
          load(); // background refresh for full detail
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

  const handleAssignTailor = () => setShowTailorPicker(true);

  const onTailorSelected = (tailor: TailorProfile) => {
    setShowTailorPicker(false);
    const name = tailor.user?.name ?? `Tailor #${tailor.Id}`;
    run(
      () => assignTailor(orderId, tailor.Id),
      `Assign ${name} to this order?`
    );
  };

  const handleSchedulePickup = () =>
    run(() => schedulePickup(orderId), "Schedule cloth pickup from the customer?");

  const handleConfirmPickup = () =>
    run(() => confirmPickup(orderId), "Confirm cloth has been picked up from customer?");

  const handleStartStitching = () =>
    run(() => startStitching(orderId), "Mark stitching as started?");

  const handleCompleteStitching = () =>
    run(() => completeStitching(orderId), "Mark stitching as completed?");

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
  };

  const ACTION_MAP: Record<string, ActionConfig> = {
    order_placed: {
      label: "Accept Order",
      icon: "checkmark-circle-outline",
      color: TEAL,
      onPress: handleAccept,
    },
    order_accepted: {
      label: "Assign Tailor",
      icon: "person-add-outline",
      color: "#8B5CF6",
      onPress: handleAssignTailor,
    },
    tailor_assigned: {
      label: "Schedule Pickup",
      icon: "bag-handle-outline",
      color: "#F59E0B",
      onPress: handleSchedulePickup,
    },
    cloth_pickup_pending: {
      label: "Confirm Pickup",
      icon: "checkmark-done-outline",
      color: "#F97316",
      onPress: handleConfirmPickup,
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
  const tailorName = order?.tailor?.name ?? detail?.tailor?.name;

  const customerMobile =
    delivery?.mobile ?? order?.customer?.mobile ?? order?.CustomerMobile;
  const customerAddress =
    delivery?.full_address ?? order?.DeliveryAddress ?? order?.delivery_address;

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
        <View style={{ width: 40 }} />
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

            {/* Tailor */}
            {tailorName ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Assigned Tailor</Text>
                <Row label="Name" value={tailorName} />
                <Row label="Location" value={order?.tailor?.location} />
              </View>
            ) : null}

            {/* Payment */}
            {payment ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Payment</Text>
                <Row label="Method" value={payment.method} />
                <Row label="Channel" value={payment.channel} />
                <Row label="Amount" value={payment.amount != null ? `₹${payment.amount}` : null} />
                <Row label="Status" value={payment.status} />
                <Row label="Transaction" value={payment.transaction_id} />
              </View>
            ) : null}

            {/* Pricing */}
            {pricing ? (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Pricing</Text>
                <Row label="Subtotal" value={pricing.subtotal != null ? `₹${pricing.subtotal}` : null} />
                <Row label="Discount" value={pricing.discount != null ? `-₹${pricing.discount}` : null} />
                <Row label="Final" value={pricing.final_amount != null ? `₹${pricing.final_amount}` : null} />
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

          {/* Action button */}
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
          ) : waitingMessage ? (
            <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
              <View style={styles.waitingBar}>
                <Ionicons name="hourglass-outline" size={18} color="#6B7280" />
                <Text style={styles.waitingBarText}>Waiting for tailor update</Text>
              </View>
            </View>
          ) : null}
        </>
      )}

      {/* Tailor picker */}
      <TailorPickerModal
        visible={showTailorPicker}
        onClose={() => setShowTailorPicker(false)}
        onSelect={onTailorSelected}
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

  // Tailor picker modal
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

  // Delivery payment modal
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
  payTabActive: {
    backgroundColor: COLORS.white,
    ...SHADOW.card,
  },
  payTabText: { fontSize: 13, color: COLORS.gray, ...FONTS.medium },
  payTabTextActive: { color: COLORS.primary, ...FONTS.semiBold },
  qrSection: { alignItems: "center", paddingHorizontal: SPACING.md, gap: 12 },
  qrHint: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  qrBox: {
    width: 280,
    height: 280,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.card,
    padding: 8,
  },
  qrImage: { width: 260, height: 260 },
  qrUpiId: { fontSize: 12, color: COLORS.gray, letterSpacing: 0.3 },
  cashSection: { paddingHorizontal: SPACING.md, gap: 16 },
  cashAmountBox: {
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    alignItems: "center",
    gap: 4,
  },
  cashAmountLabel: { fontSize: 13, color: COLORS.gray },
  cashAmount: { fontSize: 36, ...FONTS.bold, color: COLORS.black },
  cashNote: { fontSize: 13, color: COLORS.gray, textAlign: "center", lineHeight: 19 },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.success,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    paddingHorizontal: SPACING.lg,
    marginTop: 4,
  },
  confirmBtnText: { color: COLORS.white, fontSize: 14, ...FONTS.bold },

  tailorCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: 12,
    gap: 12,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  tailorCardDisabled: { opacity: 0.5 },
  tailorAvatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: TEAL + "1A",
    alignItems: "center",
    justifyContent: "center",
  },
  tailorAvatarText: { fontSize: 18, color: TEAL, ...FONTS.bold },
  tailorName: { fontSize: 14, ...FONTS.semiBold, color: COLORS.black },
  tailorSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  unavailableBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: "#FEE2E2",
    borderRadius: RADIUS.full,
  },
  unavailableText: { fontSize: 11, color: "#B91C1C", ...FONTS.semiBold },
  emptyText: { color: COLORS.gray, fontSize: 14 },
});
