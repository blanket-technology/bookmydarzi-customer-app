import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    StyleSheet,
    Text, TextInput, TouchableOpacity,
    View,
} from "react-native";
import {
    cancelOrderItem,
    fetchItemCancellationPreview,
    type ItemCancellationPreview,
} from "../../services/cancellationService";

interface Props {
  orderId: number;
  itemId: number;
  itemLabel?: string | null;
  onCancelled: () => void;
  onContactSupport: () => void;
}

function fmt(amount: number) {
  return `₹${amount.toFixed(2)}`;
}

// Same quick-pick reasons as the website's cancel modal and the admin
// app's cancel sheet - kept identical everywhere so the flow feels like
// one consistent product regardless of which app it's used from.
const CANCEL_ITEM_REASONS = [
  "Ordered by mistake",
  "Found a better price elsewhere",
  "No longer needed",
  "Taking too long",
  "Wrong size or measurement",
  "Other",
];

/** Per-item sibling of CancelOrderSection.tsx - cancel ONE line item
 * within a multi-item order, without touching the rest of the order.
 * Rendered as a small inline trigger (not a full-width button) since this
 * appears once per item in a list, not as its own standalone section. */
export function CancelOrderItemSection({ orderId, itemId, itemLabel, onCancelled, onContactSupport }: Props) {
  const router = useRouter();
  const [preview, setPreview] = useState<ItemCancellationPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedReason, setSelectedReason] = useState<string | null>(null);
  const [otherReasonText, setOtherReasonText] = useState("");

  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const openPreview = useCallback(async () => {
    setLoading(true);
    try {
      const p = await fetchItemCancellationPreview(orderId, itemId);
      if (!isMountedRef.current) return;
      if (p.contact_support) {
        onContactSupport();
        return;
      }
      if (!p.cancellation_allowed) {
        Alert.alert("Can't cancel this item", p.cancel_reason ?? "This item can't be cancelled right now.");
        return;
      }
      setPreview(p);
      setSelectedReason(null);
      setOtherReasonText("");
      setModalVisible(true);
    } catch (e: any) {
      if (!isMountedRef.current) return;
      Alert.alert("Error", e?.response?.data?.detail ?? "Could not load cancellation details.");
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  }, [orderId, itemId, onContactSupport]);

  const confirmCancel = useCallback(async () => {
    if (!preview) return;
    setCancelling(true);
    try {
      const reason =
        selectedReason === "Other" ? otherReasonText.trim() || undefined : selectedReason ?? undefined;
      await cancelOrderItem(orderId, itemId, reason);
      if (!isMountedRef.current) return;
      setModalVisible(false);
      onCancelled();
    } catch (e: any) {
      if (!isMountedRef.current) return;
      Alert.alert("Error", e?.response?.data?.detail ?? "Cancellation failed. Please try again.");
    } finally {
      if (isMountedRef.current) setCancelling(false);
    }
  }, [orderId, itemId, preview, selectedReason, otherReasonText, onCancelled]);

  return (
    <>
      <TouchableOpacity
        style={styles.cancelBtn}
        onPress={openPreview}
        activeOpacity={0.8}
        disabled={loading}
        hitSlop={8}
      >
        {loading ? (
          <ActivityIndicator size="small" color="#dc2626" />
        ) : (
          <Ionicons name="close-circle-outline" size={18} color="#dc2626" />
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
            <View style={styles.sheetHeader}>
              <View style={styles.sheetHeaderIcon}>
                <Ionicons name="close" size={20} color="#dc2626" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.sheetTitle}>Cancel this item?</Text>
                {(itemLabel || preview?.service_name) && (
                  <Text style={styles.sheetSubtitle} numberOfLines={1}>
                    {itemLabel ?? preview?.service_name}
                  </Text>
                )}
              </View>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            {preview && (
              <>
                <Text style={styles.subtitle}>
                  This can&apos;t be undone. Cancelling a single item is always free - no cancellation charge.
                </Text>

                {preview.payment_type === "prepaid" ? (
                  <View style={styles.refundBox}>
                    <Row
                      label="Refund Amount"
                      value={fmt(preview.refund_amount)}
                      labelStyle={{ fontWeight: "800" }}
                      valueStyle={{ fontWeight: "800", color: "#059669" }}
                    />
                    <Text style={styles.refundNote}>
                      Full item price, refunded to your original payment method within 5–7 business days.
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

                <Text style={styles.reasonLabel}>Why are you cancelling? (optional)</Text>
                <View style={styles.reasonChipRow}>
                  {CANCEL_ITEM_REASONS.map((option) => {
                    const active = selectedReason === option;
                    return (
                      <TouchableOpacity
                        key={option}
                        onPress={() => setSelectedReason(active ? null : option)}
                        style={[styles.reasonChip, active && styles.reasonChipActive]}
                        activeOpacity={0.8}
                      >
                        <Text style={[styles.reasonChipText, active && styles.reasonChipTextActive]}>
                          {option}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {selectedReason === "Other" && (
                  <TextInput
                    style={styles.otherReasonInput}
                    placeholder="Tell us a bit more..."
                    placeholderTextColor="#9ca3af"
                    value={otherReasonText}
                    onChangeText={setOtherReasonText}
                    multiline
                    maxLength={500}
                    autoFocus
                  />
                )}

                <View style={styles.actionRow}>
                  <TouchableOpacity
                    style={styles.keepBtn}
                    onPress={() => setModalVisible(false)}
                    activeOpacity={0.8}
                  >
                    <Text style={styles.keepBtnText}>Keep Item</Text>
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
    alignItems: "center",
    justifyContent: "center",
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: "#dc2626",
    backgroundColor: "#fff5f5",
  },

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
    gap: 10,
    marginBottom: 16,
  },
  sheetHeaderIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fee2e2",
    alignItems: "center",
    justifyContent: "center",
  },
  sheetTitle: { fontSize: 18, fontWeight: "800", color: "#1f2937" },
  sheetSubtitle: { fontSize: 13, fontWeight: "600", color: "#6b7280", marginTop: 1 },

  subtitle: { fontSize: 14, color: "#4b5563", lineHeight: 20, marginBottom: 16 },

  reasonLabel: {
    fontSize: 11,
    fontWeight: "800",
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.4,
    marginBottom: 8,
  },
  reasonChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 4,
  },
  reasonChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "#e5e7eb",
  },
  reasonChipActive: {
    backgroundColor: "#171717",
    borderColor: "#171717",
  },
  reasonChipText: { fontSize: 12, fontWeight: "600", color: "#4b5563" },
  reasonChipTextActive: { color: "#fff" },
  otherReasonInput: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#1f2937",
    backgroundColor: "#f9fafb",
    minHeight: 44,
    textAlignVertical: "top",
  },

  refundBox: {
    backgroundColor: "#f9fafb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
  },
  refundNote: { fontSize: 11, color: "#6b7280", marginTop: 8, lineHeight: 16 },

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
