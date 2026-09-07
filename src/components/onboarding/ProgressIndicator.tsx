/**
 * Onboarding progress dots - filled/expanded pill for the active slide,
 * small dots for the rest. Purely presentational; the parent carousel owns
 * `activeIndex`.
 */
import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS } from "../../../constants/theme";

export interface ProgressIndicatorProps {
  total: number;
  activeIndex: number;
}

export default function ProgressIndicator({ total, activeIndex }: ProgressIndicatorProps) {
  return (
    <View style={styles.row} accessible accessibilityRole="adjustable" accessibilityLabel={`Slide ${activeIndex + 1} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <View
          key={i}
          style={[styles.dot, i === activeIndex && styles.dotActive]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: 6 },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.grayBorder,
  },
  dotActive: {
    width: 22,
    height: 7,
    borderRadius: 4,
    backgroundColor: COLORS.primaryDark,
  },
});
