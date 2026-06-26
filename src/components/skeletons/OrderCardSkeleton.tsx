import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";

export default function OrderCardSkeleton() {
  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.left}>
          <SkeletonBox width="60%" height={16} style={{ marginBottom: 8 }} />
          <SkeletonBox width="40%" height={12} />
        </View>
        <SkeletonBox width={80} height={26} borderRadius={RADIUS.full} />
      </View>
      <View style={styles.footer}>
        <SkeletonBox width={16} height={16} borderRadius={8} />
        <SkeletonBox width="50%" height={12} style={{ marginLeft: 6 }} />
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
  left: { flex: 1 },
  footer: { flexDirection: "row", alignItems: "center" },
});
