import { Ionicons } from "@expo/vector-icons";
import React, { memo } from "react";
import { StyleSheet, Text, View, type ViewStyle } from "react-native";
import { RADIUS, SPACING, TYPOGRAPHY } from "../../../../constants/theme";
import {
    getOrderStatusMeta,
    STATUS_TONE_COLORS,
    type OrderStatus,
} from "../../../constants/orderStatus";

export interface StatusBadgeProps {
  status: string | null | undefined;
  /** Which role's label to show - defaults to the customer-safe label. */
  audience?: "customer" | "employee" | "tailor";
  /** Show the status icon alongside the label. Default true. */
  showIcon?: boolean;
  size?: "sm" | "md";
  style?: ViewStyle;
}

function labelFor(status: OrderStatus, audience: StatusBadgeProps["audience"]) {
  const meta = getOrderStatusMeta(status);
  if (audience === "employee") return meta.employeeLabel;
  if (audience === "tailor") return meta.tailorLabel;
  return meta.customerLabel;
}

const StatusBadge = memo(
  ({ status, audience = "customer", showIcon = true, size = "md", style }: StatusBadgeProps) => {
    const meta = getOrderStatusMeta(status);
    const colors = STATUS_TONE_COLORS[meta.tone];
    const label = labelFor(meta.status, audience);
    const isSmall = size === "sm";

    return (
      <View
        style={[
          styles.badge,
          { backgroundColor: colors.bg },
          isSmall && styles.badgeSm,
          style,
        ]}
      >
        {showIcon && (
          <Ionicons
            name={meta.icon}
            size={isSmall ? 11 : 13}
            color={colors.fg}
            style={styles.icon}
          />
        )}
        <Text
          style={[
            styles.text,
            { color: colors.fg },
            isSmall && styles.textSm,
          ]}
          numberOfLines={1}
        >
          {label}
        </Text>
      </View>
    );
  },
);

StatusBadge.displayName = "StatusBadge";
export default StatusBadge;

const styles = StyleSheet.create({
  badge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    borderRadius: RADIUS.full,
    paddingHorizontal: SPACING.sm + 2,
    paddingVertical: 6,
    gap: 5,
  },
  badgeSm: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 3,
  },
  icon: {
    marginTop: -1,
  },
  text: {
    ...TYPOGRAPHY.label.md,
    textTransform: "none",
    letterSpacing: 0,
  },
  textSm: {
    ...TYPOGRAPHY.label.sm,
    textTransform: "none",
    letterSpacing: 0,
  },
});
