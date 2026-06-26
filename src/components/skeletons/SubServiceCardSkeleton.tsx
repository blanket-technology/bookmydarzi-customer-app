import React from "react";
import { View, StyleSheet, Dimensions } from "react-native";
import SkeletonBox from "./SkeletonBox";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const CARD_WIDTH = (SCREEN_WIDTH - SPACING.lg * 2 - SPACING.md) / 2;

export default function SubServiceCardSkeleton() {
  return (
    <View style={styles.card}>
      {/* Image / icon area */}
      <SkeletonBox
        width="100%"
        height={110}
        borderRadius={RADIUS.md}
        style={{ marginBottom: SPACING.sm }}
      />
      {/* Title */}
      <SkeletonBox width="75%" height={14} style={{ marginBottom: 6 }} />
      {/* Description */}
      <SkeletonBox width="90%" height={11} style={{ marginBottom: 4 }} />
      <SkeletonBox width="60%" height={11} style={{ marginBottom: SPACING.sm }} />
      {/* Price */}
      <SkeletonBox width="55%" height={13} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: CARD_WIDTH,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
});
