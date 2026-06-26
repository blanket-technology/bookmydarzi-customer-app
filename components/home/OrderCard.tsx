import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import type { Order } from "../../constants/data";

interface Props {
  item: Order;
}

const STATUS_COLORS: Record<Order["status"], string> = {
  "In Progress": COLORS.primary,
  "Ready": COLORS.success,
  "Delivered": COLORS.gray,
  "Pending": COLORS.gold,
};

export default function OrderCard({ item }: Props) {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <Text style={styles.item}>{item.item}</Text>
          <Text style={styles.cloth}>{item.clothType}</Text>
        </View>
        <View style={[styles.statusBadge, { backgroundColor: `${STATUS_COLORS[item.status]}15` }]}>
          <Text style={[styles.statusText, { color: STATUS_COLORS[item.status] }]}>
            {item.status}
          </Text>
        </View>
      </View>
      <View style={styles.footer}>
        <Ionicons name="calendar-outline" size={14} color={COLORS.gray} />
        <Text style={styles.date}>{item.deliveryDate}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: SPACING.sm,
  },
  left: {
    flex: 1,
  },
  item: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: 2,
  },
  cloth: {
    fontSize: 12,
    color: COLORS.gray,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "600",
  },
  footer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  date: {
    fontSize: 12,
    color: COLORS.gray,
  },
});
