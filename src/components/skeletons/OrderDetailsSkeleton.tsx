import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";
import SkeletonBox from "./SkeletonBox";

function SkeletonCard({ lines = 3 }: { lines?: number }) {
  return (
    <View style={styles.card}>
      <SkeletonBox width="45%" height={13} style={{ marginBottom: 12 }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonBox
          key={i}
          width={i === lines - 1 ? "60%" : "90%"}
          height={12}
          style={{ marginBottom: i === lines - 1 ? 0 : 10 }}
        />
      ))}
    </View>
  );
}

/** Mirrors order-details.tsx's real content shape (hero, payment, status,
 * pickup, tracking cards) so the loading state doesn't jump/reflow once
 * data arrives - just a plain spinner previously. */
export default function OrderDetailsSkeleton() {
  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <SkeletonBox width={56} height={56} borderRadius={28} />
        <View style={{ flex: 1, marginLeft: SPACING.md, gap: 8 }}>
          <SkeletonBox width="70%" height={16} />
          <SkeletonBox width="45%" height={12} />
        </View>
      </View>
      <SkeletonCard lines={3} />
      <SkeletonCard lines={2} />
      <SkeletonCard lines={4} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: SPACING.lg },
  hero: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
});
