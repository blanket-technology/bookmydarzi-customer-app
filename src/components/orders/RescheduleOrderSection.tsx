import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS } from "../../../constants/theme";
import PickupDateCalendarModal from "../common/PickupDateCalendarModal";
import { buildPickupTimeSlots } from "../../utils/pickupTimeSlots";
import { reschedulePickup } from "../../services/rescheduleService";

interface Props {
  orderId: number;
  currentPickupAt: string | null;
  onRescheduled: () => void;
}

function formatSelectedDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-IN", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  } catch {
    return iso;
  }
}

// Direct self-service reschedule, mirroring CancelOrderSection's shape and
// reusing the exact date-picker (PickupDateCalendarModal) and time-slot
// generator (buildPickupTimeSlots) the cart/buy-now checkout flows already
// use for the FIRST pickup scheduling - same picking experience, just
// PATCHing an existing order instead of creating one. Only rendered by the
// caller while the order is in pickup_scheduled/pickup_pending (see
// order-details.tsx's RESCHEDULABLE_STATUSES) - the backend hard-rejects
// every other status.
export function RescheduleOrderSection({ orderId, currentPickupAt, onRescheduled }: Props) {
  const pickupTimeSlots = useMemo(() => buildPickupTimeSlots(), []);
  const [modalVisible, setModalVisible] = useState(false);
  const [showCalendar, setShowCalendar] = useState(false);
  const [date, setDate] = useState<string | null>(() => {
    if (!currentPickupAt) return null;
    const d = new Date(currentPickupAt);
    return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  });
  const [slotLabel, setSlotLabel] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const confirmReschedule = useCallback(async () => {
    const slot = pickupTimeSlots.find((s) => s.label === slotLabel);
    if (!date || !slot) {
      Alert.alert("Choose a time", "Please pick a date and time slot.");
      return;
    }
    const dt = new Date(date);
    dt.setHours(slot.hour, slot.minute, 0, 0);
    if (dt.getTime() <= Date.now()) {
      Alert.alert("Invalid time", "Please choose a time in the future.");
      return;
    }
    setSubmitting(true);
    try {
      await reschedulePickup(orderId, dt.toISOString(), slot.label);
      setModalVisible(false);
      onRescheduled();
    } catch (e: any) {
      Alert.alert("Error", e?.response?.data?.detail ?? "Could not reschedule pickup. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }, [date, slotLabel, pickupTimeSlots, orderId, onRescheduled]);

  return (
    <>
      <TouchableOpacity
        style={styles.rescheduleBtn}
        onPress={() => setModalVisible(true)}
        activeOpacity={0.8}
      >
        <Ionicons name="calendar-clear-outline" size={16} color={COLORS.primaryDark} />
        <Text style={styles.rescheduleBtnText}>Reschedule Pickup</Text>
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
              <Ionicons name="calendar-clear-outline" size={22} color={COLORS.primaryDark} />
              <Text style={styles.sheetTitle}>Reschedule Pickup</Text>
              <TouchableOpacity onPress={() => setModalVisible(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color="#6b7280" />
              </TouchableOpacity>
            </View>

            <Text style={styles.subtitle}>Choose a new date and time for your cloth pickup.</Text>

            <Text style={styles.label}>Pickup date</Text>
            <TouchableOpacity
              style={styles.dateSelectBtn}
              onPress={() => setShowCalendar(true)}
              activeOpacity={0.7}
            >
              <Ionicons name="calendar-outline" size={16} color={date ? COLORS.primaryDark : COLORS.gray} />
              <Text style={[styles.dateSelectText, !date && styles.dateSelectPlaceholder]}>
                {date ? formatSelectedDate(date) : "Choose a date"}
              </Text>
              <Ionicons name="chevron-forward" size={14} color={COLORS.gray} />
            </TouchableOpacity>

            <Text style={[styles.label, { marginTop: 12 }]}>Time slot (9 AM – 9 PM)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.slotRow}>
              {pickupTimeSlots.map((slot) => (
                <TouchableOpacity
                  key={slot.label}
                  style={[styles.slotChip, slotLabel === slot.label && styles.slotChipActive]}
                  onPress={() => setSlotLabel(slot.label)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.slotChipText, slotLabel === slot.label && styles.slotChipTextActive]}>
                    {slot.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.keepBtn}
                onPress={() => setModalVisible(false)}
                activeOpacity={0.8}
                disabled={submitting}
              >
                <Text style={styles.keepBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (submitting || !date || !slotLabel) && { opacity: 0.6 }]}
                onPress={confirmReschedule}
                activeOpacity={0.8}
                disabled={submitting || !date || !slotLabel}
              >
                {submitting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.confirmBtnText}>Confirm New Time</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PickupDateCalendarModal
        visible={showCalendar}
        selectedDate={date}
        onSelect={setDate}
        onClose={() => setShowCalendar(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  rescheduleBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderWidth: 1.5,
    borderColor: COLORS.primaryDark,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
    backgroundColor: COLORS.primaryLight ?? "#f0fafb",
  },
  rescheduleBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.45)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 32 },
  sheetHeader: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 12 },
  sheetTitle: { flex: 1, fontSize: 18, fontWeight: "800", color: "#1f2937" },
  subtitle: { fontSize: 14, color: "#4b5563", lineHeight: 20, marginBottom: 16 },

  label: { fontSize: 12, fontWeight: "700", color: "#6b7280", marginBottom: 6, textTransform: "uppercase" },
  dateSelectBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
  },
  dateSelectText: { flex: 1, fontSize: 14, fontWeight: "600", color: "#1f2937" },
  dateSelectPlaceholder: { color: "#9ca3af", fontWeight: "400" },

  slotRow: { gap: 8, paddingVertical: 4 },
  slotChip: {
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 999,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  slotChipActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  slotChipText: { fontSize: 13, fontWeight: "600", color: "#374151" },
  slotChipTextActive: { color: "#fff" },

  actionRow: { flexDirection: "row", gap: 10, marginTop: 20 },
  keepBtn: { flex: 1, borderWidth: 1.5, borderColor: "#d1d5db", borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  keepBtnText: { fontSize: 14, fontWeight: "700", color: "#374151" },
  confirmBtn: { flex: 1, backgroundColor: COLORS.primaryDark, borderRadius: 10, paddingVertical: 12, alignItems: "center" },
  confirmBtnText: { fontSize: 14, fontWeight: "700", color: "#fff" },
});
