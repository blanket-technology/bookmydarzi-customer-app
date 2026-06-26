import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADIUS, SPACING } from "../../constants/theme";
import type { Offer } from "../../constants/data";

interface Props {
  item: Offer;
}

export default function OfferCard({ item }: Props) {
  return (
    <LinearGradient
      colors={["#0c6c75", "#1aa3b0", "#C9A84C"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.card}
    >
      <View style={styles.left}>
        <Text style={styles.discount}>{item.discount}</Text>
        <Text style={styles.title}>{item.title}</Text>
        <Text style={styles.subtitle}>{item.subtitle}</Text>
      </View>
      <View style={styles.right}>
        <View style={styles.codeBox}>
          <Text style={styles.codeLabel}>USE CODE</Text>
          <Text style={styles.code}>{item.code}</Text>
        </View>
        <TouchableOpacity style={styles.claimBtn}>
          <Text style={styles.claimText}>Claim</Text>
        </TouchableOpacity>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginRight: SPACING.md,
    width: 300,
  },
  left: {
    flex: 1,
  },
  discount: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: -0.5,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
    marginTop: 2,
  },
  subtitle: {
    fontSize: 11,
    color: "rgba(255,255,255,0.75)",
    marginTop: 2,
  },
  right: {
    alignItems: "center",
    gap: 8,
  },
  codeBox: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    alignItems: "center",
  },
  codeLabel: {
    fontSize: 9,
    color: "rgba(255,255,255,0.75)",
    fontWeight: "600",
    letterSpacing: 1,
  },
  code: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: 1,
  },
  claimBtn: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  claimText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
});
