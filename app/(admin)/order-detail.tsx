import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import { formatCurrency } from "../../src/utils/formatters";
import {
  cancelOrder,
  getOrderDetail,
  updateOrderStatus,
} from "../../src/services/adminService";
import {
  getOrderStatusMeta,
  normalizeOrderStatus,
  isOrderStatusTerminal,
  STATUS_TONE_COLORS,
} from "../../src/constants/orderStatus";
import ScreenHeader from "../../src/components/common/ScreenHeader";
import { useAuthStore } from "../../store/useAuthStore";

// Roles permitted to call /admin/* - see the note in (admin)/orders.tsx.
const ADMIN_ROLES = new Set(["admin", "superadmin", "employee"]);

const TEAL = "#149694";

function Row({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function CancelModal({
  visible,
  onClose,
  onConfirm,
  loading,
}: {
  visible: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState("");
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={styles.overlay}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <View style={styles.modal}>
          <Text style={styles.modalTitle}>Cancel Order</Text>
          <Text style={styles.modalSub}>
            This will cancel the order and auto-refund any successful payment.
          </Text>
          <TextInput
            style={styles.reasonInput}
            placeholder="Enter reason (min 5 chars)..."
            placeholderTextColor={COLORS.gray}
            value={reason}
            onChangeText={setReason}
            multiline
            numberOfLines={3}
          />
          <View style={styles.modalButtons}>
            <TouchableOpacity style={styles.modalCancel} onPress={onClose}>
              <Text style={styles.modalCancelText}>Back</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalConfirm, (reason.length < 5 || loading) && styles.disabledBtn]}
              onPress={() => reason.length >= 5 && onConfirm(reason)}
              disabled={reason.length < 5 || loading}
            >
              {loading ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <Text style={styles.modalConfirmText}>Cancel Order</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

export default function AdminOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const role = useAuthStore((s) => s.user?.role);
  const canLoad = !!role && ADMIN_ROLES.has(role);

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cancelModal, setCancelModal] = useState(false);
  const [cancelling, setCancelling] = useState(false);

  const orderId = Number(id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getOrderDetail(orderId);
      setOrder(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  // Only fetch once the role is known and qualifies - avoids a 403 when a
  // non-admin briefly mounts this screen during the post-login redirect race.
  useEffect(() => {
    if (canLoad) load();
    else setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [canLoad, load]);

  const handleCancel = async (reason: string) => {
    try {
      setCancelling(true);
      await cancelOrder(orderId, reason);
      setCancelModal(false);
      Alert.alert("Order Cancelled", "The order has been cancelled successfully.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to cancel order");
    } finally {
      setCancelling(false);
    }
  };

  const status = normalizeOrderStatus(order?.Status ?? order?.status ?? "");
  const statusMeta = getOrderStatusMeta(status);
  const isTerminal = isOrderStatusTerminal(status);
  const statusColor = STATUS_TONE_COLORS[statusMeta.tone].fg;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader title="Order Detail" />

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
          <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
            {/* Status Banner */}
            <View style={[styles.statusBanner, { backgroundColor: statusColor + "1A" }]}>
              <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
              <Text style={[styles.statusText, { color: statusColor }]}>
                {statusMeta.title.toUpperCase()}
              </Text>
            </View>

            {/* Order Info */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Order Info</Text>
              <Row label="Order Code" value={order?.OrderCode ?? order?.order_code} />
              <Row label="Created" value={order?.CreatedAt ? new Date(order.CreatedAt).toLocaleString("en-IN") : null} />
              <Row label="Payment Status" value={order?.PaymentStatus ?? order?.payment_status} />
              <Row label="Total Amount" value={order?.TotalAmount ? formatCurrency(order.TotalAmount) : null} />
            </View>

            {/* Customer */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Customer</Text>
              <Row label="Name" value={order?.customer?.name ?? order?.CustomerName} />
              <Row label="Mobile" value={order?.customer?.mobile ?? order?.CustomerMobile} />
              <Row label="Address" value={order?.DeliveryAddress ?? order?.delivery_address} />
            </View>

            {/* Tailor */}
            {(order?.tailor || order?.TailorId) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Tailor</Text>
                <Row label="Name" value={order?.tailor?.name} />
                <Row label="Location" value={order?.tailor?.location} />
              </View>
            )}

            {/* Notes */}
            {(order?.Description || order?.FabricNotes || order?.CustomizationNotes) && (
              <View style={styles.section}>
                <Text style={styles.sectionTitle}>Notes</Text>
                <Row label="Description" value={order?.Description} />
                <Row label="Fabric" value={order?.FabricNotes} />
                <Row label="Customization" value={order?.CustomizationNotes} />
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Cancel button */}
          {!isTerminal && (
            <View style={[styles.actionBar, { paddingBottom: insets.bottom + 8 }]}>
              <TouchableOpacity
                style={styles.cancelBtn}
                onPress={() => setCancelModal(true)}
              >
                <Ionicons name="close-circle-outline" size={18} color={COLORS.white} />
                <Text style={styles.cancelBtnText}>Cancel Order</Text>
              </TouchableOpacity>
            </View>
          )}
        </>
      )}

      <CancelModal
        visible={cancelModal}
        onClose={() => setCancelModal(false)}
        onConfirm={handleCancel}
        loading={cancelling}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errorText: { color: COLORS.error, fontSize: 14 },
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
  statusText: { fontSize: 13, ...FONTS.bold, letterSpacing: 0.5 },
  section: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    ...SHADOW.card,
  },
  sectionTitle: { fontSize: 12, ...FONTS.semiBold, color: COLORS.gray, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between", paddingVertical: 6, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.grayLight },
  rowLabel: { fontSize: 13, color: COLORS.gray, flex: 1 },
  rowValue: { fontSize: 13, color: COLORS.black, ...FONTS.medium, flex: 2, textAlign: "right" },
  actionBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
  },
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    gap: 8,
  },
  cancelBtnText: { color: COLORS.white, fontSize: 15, ...FONTS.semiBold },
  overlay: { flex: 1, backgroundColor: COLORS.overlay, justifyContent: "flex-end" },
  modal: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    gap: 12,
  },
  modalTitle: { fontSize: 18, ...FONTS.bold, color: COLORS.black },
  modalSub: { fontSize: 13, color: COLORS.gray, lineHeight: 18 },
  reasonInput: {
    borderWidth: 1, borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md, padding: 12,
    fontSize: 14, color: COLORS.black,
    minHeight: 80, textAlignVertical: "top",
  },
  modalButtons: { flexDirection: "row", gap: 12 },
  modalCancel: {
    flex: 1, paddingVertical: 14, borderRadius: RADIUS.md,
    backgroundColor: COLORS.grayLight, alignItems: "center",
  },
  modalCancelText: { color: COLORS.gray, ...FONTS.semiBold },
  modalConfirm: {
    flex: 2, paddingVertical: 14, borderRadius: RADIUS.md,
    backgroundColor: COLORS.error, alignItems: "center",
  },
  disabledBtn: { opacity: 0.5 },
  modalConfirmText: { color: COLORS.white, ...FONTS.semiBold },
});
