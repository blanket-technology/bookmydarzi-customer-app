import React from "react";
import { StyleSheet, View } from "react-native";
import { COLORS, RADIUS, SPACING } from "../../../constants/theme";
import SkeletonBox from "./SkeletonBox";

function Row() {
  return (
    <View style={styles.item}>
      <SkeletonBox width={38} height={38} borderRadius={RADIUS.md} />
      <View style={styles.content}>
        <SkeletonBox width="55%" height={13} style={{ marginBottom: 6 }} />
        <SkeletonBox width="85%" height={11} style={{ marginBottom: 6 }} />
        <SkeletonBox width="30%" height={10} />
      </View>
    </View>
  );
}

export default function NotificationSkeleton() {
  return (
    <View style={styles.root}>
      <Row />
      <Row />
      <Row />
      <Row />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { padding: SPACING.lg },
  item: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  content: { flex: 1 },
});
