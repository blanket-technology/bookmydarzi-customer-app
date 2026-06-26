import React, { memo } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Alert } from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";
import { formatBookingStatus, formatPrice } from "../../utils/formatters";
import type { Booking } from "../../types";

interface Props {
  item: Booking;
  index: number;
  onCancel?: (id: string) => void;
}

const STATUS_CONFIG: Record<Booking["status"], { color: string; bg: string }> = {
  confirmed: { color: "#065F46",    bg: "#D1FAE5"        },
  pending:   { color: COLORS.gold,  bg: COLORS.goldLight },
  cancelled: { color: COLORS.error, bg: COLORS.errorLight},
  completed: { color: COLORS.gray,  bg: COLORS.grayLight },
};

const BookingCard = memo(({ item, index, onCancel }: Props) => {
  const cfg = STATUS_CONFIG[item.status];

  const handleCancel = () => {
    Alert.alert(
      "Cancel Booking",
      "Are you sure you want to cancel this appointment?",
      [
        { text: "No", style: "cancel" },
        { text: "Yes, Cancel", style: "destructive", onPress: () => onCancel?.(item.id) },
      ]
    );
  };

  return (
    <Animated.View entering={FadeInDown.delay(index * 60).duration(400)} style={styles.card}>
      {/* Tailor info */}
      <View style={styles.tailorRow}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{item.tailor.avatar}</Text>
        </View>
        <View style={styles.tailorInfo}>
          <Text style={styles.tailorName}>{item.tailor.name}</Text>
          <Text style={styles.tailorSpec}>{item.tailor.specialty}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: cfg.bg }]}>
          <Text style={[styles.statusText, { color: cfg.color }]}>
            {formatBookingStatus(item.status)}
          </Text>
        </View>
      </View>

      {/* Service */}
      <View style={styles.serviceRow}>
        <View style={[styles.serviceIcon, { backgroundColor: item.service.bgColor }]}>
          <Ionicons name={item.service.icon as any} size={16} color={item.service.color} />
        </View>
        <View>
          <Text style={styles.serviceName}>{item.service.title}</Text>
          <Text style={styles.servicePrice}>Starting {formatPrice(item.service.price_starting)}</Text>
        </View>
      </View>

      {/* Date & time */}
      <View style={styles.dateRow}>
        <View style={styles.dateItem}>
          <Ionicons name="calendar-outline" size={14} color={COLORS.gray} />
          <Text style={styles.dateText}>{item.date}</Text>
        </View>
        <View style={styles.dateItem}>
          <Ionicons name="time-outline" size={14} color={COLORS.gray} />
          <Text style={styles.dateText}>{item.time}</Text>
        </View>
      </View>

      {/* Notes */}
      {item.notes ? (
        <Text style={styles.notes}>📝 {item.notes}</Text>
      ) : null}

      {/* Actions */}
      {(item.status === "confirmed" || item.status === "pending") && onCancel && (
        <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
          <Text style={styles.cancelBtnText}>Cancel Appointment</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
});

BookingCard.displayName = "BookingCard";
export default BookingCard;

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  tailorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },
  tailorInfo: { flex: 1 },
  tailorName: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  tailorSpec: { fontSize: 12, color: COLORS.gray },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: { fontSize: 11, fontWeight: "600" },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    marginBottom: SPACING.sm,
  },
  serviceIcon: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceName: { fontSize: 13, fontWeight: "600", color: COLORS.black },
  servicePrice: { fontSize: 11, color: COLORS.gray },
  dateRow: {
    flexDirection: "row",
    gap: SPACING.lg,
    marginBottom: SPACING.sm,
  },
  dateItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  dateText: { fontSize: 12, color: COLORS.gray },
  notes: { fontSize: 12, color: COLORS.gray, marginBottom: SPACING.sm },
  cancelBtn: {
    paddingVertical: 8,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.error,
    alignItems: "center",
    marginTop: SPACING.xs,
  },
  cancelBtnText: { fontSize: 13, fontWeight: "600", color: COLORS.error },
});
