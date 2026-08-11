import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text, TouchableOpacity,
    View,
} from "react-native";
import {
    cancelOrder,
    fetchCancellationPreview,
    type CancellationPreview,
} from "../../services/cancellationService";

interface Props {
  orderId: number;
  orderStatus: string;
  onCancelled: () => void;
  onContactSupport: () => void;
}

function fmt(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

function fmtWhole(amount: number) {
  return `₹${Math.round(amount).toLocaleString("en-IN")}`;
}

export function CancelOrderSection({ orderId, orderStatus, onCancelled, onContactSupport }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<CancellationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);

  // Cancellability is gated by the caller (order-details.tsx checks
  // CUSTOMER_CANCELLABLE_STATUSES before rendering this component at all)
  // and re-validated server-side by fetchCancellationPreview - no need to
  // duplicate that check here.

  const openPreview = useCallback(async () => {
    setLoading(true);
    try {
      const p = await fetchCancellationPreview(orderId);
      if (p.contact_support) {
        onContactSupport();
        return;
      }
      setPreview(p);
      setModalVisible(true);
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail ?? "Could not load cancellation details.");
    } finally {
      setLoading(false);
    }
  }, [orderId, onContactSupport]);

  const confirmCancel = useCallback(async () => {
    if (!preview) return;
    setCancelling(true);
    try {
      await cancelOrder(orderId);
      setModalVisible(false);
      onCancelled();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail ?? "Cancellation failed. Please try again.");
    } finally {
      setCancelling(false);
    }
  }, [orderId, preview, onCancelled]);

  return (
    <>
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={openPreview}
        activeOpacity={0.8}
        disabled={loading}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#dc2626" />
        ) : (
          <>
            <Ionicons name="close-circle-outline" size={16} color="#dc2626" />
            <Text style={styles.cancelBtnText}>Cancel Order</Text>
          </>
        )}
      </TouchableOpacity>

      <Modal
        visible={modalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setModalVisible(false)}
      >
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            {/* Header */}
            <View style={styles.sheetHeader}>
              <Ionicons name="warning-outline" size={22} color="#dc2626" />
              <Text style={styles.sheetTitle}>Cancel Order?</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {preview && (
              <>
                <Text style={styles.subtitle}>
                  Are you sure you want to cancel this order? This can&apos;t be undone.
                </Text>

                {preview.payment_type === "prepaid" ? (
                  <>
                    {preview.penalty_amount > 0 && (
                      <View style={styles.penaltyBox}>
                        <Text style={styles.penaltyQuestion}>
                          A cancellation charge of{" "}
                          <Text style={styles.penaltyAmount}>{fmtWhole(preview.penalty_amount)}</Text>{" "}
                          will be deducted from your refund. Would you like to proceed?
                        </Text>
                      </View>
                    )}
                    <View style={styles.refundBox}>
                      <Row label="Amount Paid" value={fmt(preview.paid_amount)} />
                      <Row
                        label="Cancellation Charges"
                        value={`− ${fmt(preview.penalty_amount)}`}
                        valueStyle={{ color: "#dc2626" }}
                      />
                      <View style={styles.divider} />
                      <Row
                        label="Refund Amount"
                        value={fmt(preview.refund_amount)}
                        labelStyle={{ fontWeight: "800" }}
                        valueStyle={{ fontWeight: "800", color: "#059669" }}
                      />
                      <Text style={styles.refundNote}>
                        Refund will be processed to your original payment method within 5–7 business days.
                      </Text>
                    </View>
                  </>
                ) : preview.penalty_amount > 0 ? (
                  <View style={styles.penaltyBox}>
                    <Text style={styles.penaltyQuestion}>
                      A cancellation charge of{" "}
                      <Text style={styles.penaltyAmount}>{fmtWhole(preview.penalty_amount)}</Text>{" "}
                      will be applicable on your next order. Would you like to proceed?
                    </Text>
                  </View>
                ) : null}

                <TouchableOpacity
                  style={styles.policyLink}
                  onPress={() => {
                    setModalVisible(false);
                    router.push("/terms");
                  }}
                  activeOpacity={0.7}
                  accessibilityRole="button"
                >
                  <Ionicons name="document-text-outline" size={15} color="#0c6c75" />
                  <Text style={styles.policyLinkText}>Read our cancellation policy</Text>
                  <Ionicons name="chevron-forward" size={14} color="#0c6c75" />
                </TouchableOpacity>

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.keepBtn}
                    onPress={() => setModalVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.keepBtnText}>Keep Order</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.confirmBtn, cancelling && { opacity: 0.7 }]}
                    onPress={confirmCancel}
                    activeOpacity={0.8}
                    disabled={cancelling}
                  >
                    {cancelling ? (
                      <ActivityIndicator size="small" color="#fff" />
                    ) : (
                      <Text style={styles.confirmBtnText}>Yes, Cancel</Text>
                    )}
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </>
  );
}

function Row({
  label,
  value,
  labelStyle,
  valueStyle,
}: {
  label: string;
  value: string;
  labelStyle?: object;
  valueStyle?: object;
}) {
  return (
    <View style={row.root}>
      <Text style={[row.label, labelStyle]}>{label}</Text>
      <Text style={[row.value, valueStyle]}>{value}</Text>
    </View>
  );
}

const row = StyleSheet.create({
  root: { flexDirection: "row", justifyContent: "space-between", marginBottom: 6 },
  label: { fontSize: 13, color: "#4b5563" },
  value: { fontSize: 13, color: "#1f2937", fontWeight: "600" },
});

const styles = StyleSheet.create({
  cancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
    backgroundColor: "#fff5f5",
  },
  cancelBtnText: { fontSize: 14, fontWeight: "700", color: "#dc2626" },

  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 32,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 16,
  },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: "#1f2937" },

  subtitle: { fontSize: 14, color: "#4b5563", lineHeight: 20, marginBottom: 16 },

  refundBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  divider: { height: 1, backgroundColor: "#e5e7eb", marginVertical: 8 },
  refundNote: { fontSize: 11, color: "#6b7280", marginTop: 8, lineHeight: 16 },

  penaltyBox: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  penaltyQuestion: {
    fontSize: 14,
    color: "#78350f",
    lineHeight: 21,
    fontWeight: "600",
  },
  penaltyAmount: {
    fontWeight: "800",
    color: "#b45309",
  },

  policyLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f0fafb",
    borderWidth: 1,
    borderColor: "#cce9ec",
    marginBottom: 16,
  },
  policyLinkText: {
    flex: 1,
    fontSize: 13,
    fontWeight: "700",
    color: "#0c6c75",
  },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 4 },
  keepBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: "#d1d5db",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  keepBtnText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  confirmBtn: {
    flex: 1,
    backgroundColor: "#dc2626",
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: "center",
  },
  confirmBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
