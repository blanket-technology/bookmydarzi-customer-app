import React from "react";
import { View, StyleSheet } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";

export default function ServiceCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonBox width={48} height={48} borderRadius={RADIUS.md} style={{ marginBottom: 10 }} />
      <SkeletonBox width="70%" height={14} style={{ marginBottom: 6 }} />
      <SkeletonBox width="90%" height={11} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
});
