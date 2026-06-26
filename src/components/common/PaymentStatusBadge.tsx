import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { RADIUS } from "../../../constants/theme";
import {
  resolvePaymentDisplay,
  getPaymentStatusLabel,
  getPaymentStatusColors,
  type PaymentDisplayStatus,
} from "../../utils/paymentStatus";

interface Props {
  paymentStatus?: string | null;
  paymentMethod?: string | null;
  /** Override resolved display (e.g. from payment API sync) */
  display?: PaymentDisplayStatus;
}

export function PaymentStatusBadge({ paymentStatus, paymentMethod, display }: Props) {
  const resolved = display ?? resolvePaymentDisplay(paymentStatus, paymentMethod);
  const { color, bg } = getPaymentStatusColors(resolved);

  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      <Text style={[styles.text, { color }]}>{getPaymentStatusLabel(resolved)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  text: { fontSize: 11, fontWeight: "700" },
});
