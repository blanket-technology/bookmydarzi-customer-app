import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS, RADIUS, SPACING } from "../../../constants/theme";
import SkeletonBox from "./SkeletonBox";

const CATEGORY_SIZE = 72;

function CategoryRowSkeleton() {
  return (
    <View style={styles.categoryRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={styles.categoryItem}>
          <SkeletonBox width={CATEGORY_SIZE} height={CATEGORY_SIZE} borderRadius={CATEGORY_SIZE / 2} />
          <SkeletonBox width={CATEGORY_SIZE - 12} height={10} style={{ marginTop: 8 }} />
        </View>
      ))}
    </View>
  );
}

function PopularCardSkeleton() {
  return (
    <View style={styles.popularCard}>
      <SkeletonBox width="100%" height={110} borderRadius={RADIUS.md} />
      <SkeletonBox width="80%" height={13} style={{ marginTop: 10 }} />
      <SkeletonBox width="50%" height={11} style={{ marginTop: 6 }} />
    </View>
  );
}

/**
 * Homepage skeleton shown only on the very first load (no cached data yet) -
 * mirrors the real layout (hero, services row, banner, popular row) so the
 * page doesn't flash from blank to populated once the fetches resolve.
 */
export default function HomeSkeleton() {
  return (
    <View style={styles.container}>
      {/* Greeting */}
      <SkeletonBox width="60%" height={22} style={{ marginBottom: 8 }} />
      <SkeletonBox width="40%" height={13} style={{ marginBottom: SPACING.lg }} />

      {/* Hero card */}
      <SkeletonBox width="100%" height={120} borderRadius={RADIUS.lg} style={{ marginBottom: SPACING.lg }} />

      {/* Services section */}
      <SkeletonBox width="35%" height={16} style={{ marginBottom: 12 }} />
      <CategoryRowSkeleton />

      {/* Banner */}
      <SkeletonBox width="100%" height={140} borderRadius={RADIUS.lg} style={{ marginTop: SPACING.lg, marginBottom: SPACING.lg }} />

      {/* Popular services */}
      <SkeletonBox width="45%" height={16} style={{ marginBottom: 12 }} />
      <View style={styles.popularRow}>
        <PopularCardSkeleton />
        <PopularCardSkeleton />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingTop: SPACING.lg,
  },
  categoryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  categoryItem: {
    alignItems: "center",
  },
  popularRow: {
    flexDirection: "row",
    gap: SPACING.md,
  },
  popularCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.sm,
  },
});
