import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { COLORS, SPACING } from "../../../constants/theme";
import type { CustomerOrderKeyValue } from "../../types/customerOrders";
import { ORDER_DISPLAY_FALLBACK } from "../../types/api";

interface Props {
  rows: CustomerOrderKeyValue[];
}

export default function OrderKeyValueRows({ rows }: Props) {
  if (!rows.length) {
    return <Text style={styles.empty}>{ORDER_DISPLAY_FALLBACK}</Text>;
  }

  return (
    <>
      {rows.map((row, index) => (
        <View
          key={`${row.label}-${index}`}
          style={[styles.row, index < rows.length - 1 && styles.rowBorder]}
        >
          <Text style={styles.label}>{row.label}</Text>
          <Text style={styles.value}>{row.value}</Text>
        </View>
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    gap: SPACING.md,
    paddingVertical: 10,
  },
  rowBorder: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  label: {
    flex: 1,
    fontSize: 13,
    color: COLORS.gray,
    fontWeight: "500",
  },
  value: {
    flex: 1.2,
    fontSize: 13,
    color: COLORS.black,
    fontWeight: "600",
    textAlign: "right",
  },
  empty: {
    fontSize: 13,
    color: COLORS.gray,
  },
});
