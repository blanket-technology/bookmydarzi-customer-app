import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../../constants/theme";
import {
  PAYMENT_METHOD_META,
  PAYMENT_METHOD_ORDER,
  type PaymentMethodOption,
} from "../../../types/payment";

export interface PaymentMethodSelectorProps {
  value: PaymentMethodOption;
  onChange: (method: PaymentMethodOption) => void;
  disabled?: boolean;
}

/**
 * Checkout payment-method picker - premium selectable cards (Amazon/Myntra/
 * Urban Company style), not bare radio buttons. Driven entirely by
 * PAYMENT_METHOD_META (src/types/payment.ts) so adding a future method
 * (UPI-only, Wallet, Pay Later) only means adding one metadata entry, never
 * touching this component or any checkout screen.
 */
const PaymentMethodSelector = memo(
  ({ value, onChange, disabled = false }: PaymentMethodSelectorProps) => {
    return (
      <View style={styles.wrap}>
        {PAYMENT_METHOD_ORDER.map((method) => {
          const meta = PAYMENT_METHOD_META[method];
          const selected = value === method;
          return (
            <Pressable
              key={method}
              onPress={() => !disabled && onChange(method)}
              disabled={disabled}
              style={({ pressed }) => [
                styles.card,
                selected && styles.cardSelected,
                pressed && !disabled && styles.cardPressed,
              ]}
              accessibilityRole="radio"
              accessibilityState={{ checked: selected, disabled }}
              accessibilityLabel={meta.title}
            >
              {meta.badge ? (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{meta.badge}</Text>
                </View>
              ) : null}
              <View
                style={[
                  styles.iconWrap,
                  selected && styles.iconWrapSelected,
                ]}
              >
                <Ionicons
                  name={meta.icon}
                  size={15}
                  color={selected ? COLORS.white : COLORS.primaryDark}
                />
              </View>
              <Text style={[styles.title, selected && styles.titleSelected]} numberOfLines={1}>
                {meta.title}
              </Text>
              <View style={[styles.radio, selected && styles.radioSelected]}>
                {selected ? <View style={styles.radioDot} /> : null}
              </View>
            </Pressable>
          );
        })}
      </View>
    );
  },
);

PaymentMethodSelector.displayName = "PaymentMethodSelector";
export default PaymentMethodSelector;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    gap: SPACING.sm,
    marginTop: 12,
  },
  card: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
    paddingHorizontal: SPACING.sm,
    paddingVertical: SPACING.sm + 2,
    minHeight: 52,
  },
  cardSelected: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
    ...SHADOW.card,
  },
  cardPressed: {
    opacity: 0.85,
  },
  iconWrap: {
    width: 26,
    height: 26,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  iconWrapSelected: {
    backgroundColor: COLORS.primaryDark,
  },
  title: {
    flex: 1,
    fontSize: 11.5,
    fontWeight: "700",
    color: COLORS.black,
  },
  titleSelected: {
    color: COLORS.primaryDark,
  },
  badge: {
    position: "absolute",
    top: -8,
    left: SPACING.sm + 2,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderWidth: 1.5,
    borderColor: COLORS.white,
    zIndex: 1,
    elevation: 3,
  },
  badgeText: {
    fontSize: 8,
    fontWeight: "700",
    color: COLORS.white,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  radio: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: "#D1D5DB",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  radioSelected: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.white,
  },
  radioDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
    backgroundColor: COLORS.primaryDark,
  },
});
