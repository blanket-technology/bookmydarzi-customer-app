/**
 * Service range grid for onboarding screen 3 - each garment/service type
 * gets its own icon + label card, laid out 2-per-row. Replaces the earlier
 * plain text tag pills (too thin) and the floating-icon-cluster
 * illustration (skewed toward one garment type, read as incomplete) with
 * one visual that gives menswear, womenswear, and alterations equal
 * billing.
 */
import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../constants/theme";

const SERVICES: { icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { icon: "shirt-outline", label: "Suits" },
  { icon: "woman-outline", label: "Sarees" },
  { icon: "sparkles-outline", label: "Lehengas" },
  { icon: "body-outline", label: "Blouses" },
  { icon: "cut-outline", label: "Alterations" },
  { icon: "man-outline", label: "Kurtas" },
];

export default function ServiceGrid() {
  return (
    <View style={styles.grid}>
      {SERVICES.map((s) => (
        <View key={s.label} style={styles.card}>
          <View style={styles.iconWrap}>
            <Ionicons name={s.icon} size={20} color={COLORS.primaryDark} />
          </View>
          <Text style={styles.label} maxFontSizeMultiplier={1.5}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: SPACING.sm,
  },
  card: {
    width: "31.5%",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    paddingVertical: SPACING.sm + 4,
    paddingHorizontal: SPACING.xs,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  label: {
    ...TYPOGRAPHY.label.md,
    color: COLORS.black,
    textAlign: "center",
  },
});
