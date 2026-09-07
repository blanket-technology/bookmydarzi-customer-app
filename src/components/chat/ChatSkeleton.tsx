import React from "react";
import { StyleSheet, View } from "react-native";

/** Skeleton message bubbles shown while a session is loading, instead of a
 * bare spinner - avoids a blank/flat "loading" moment before any content
 * shape is visible. */
export function ChatSkeleton() {
  return (
    <View style={styles.wrap}>
      <View style={[styles.row, styles.rowLeft]}>
        <View style={styles.avatar} />
        <View style={[styles.bubble, { width: "55%" }]} />
      </View>
      <View style={[styles.row, styles.rowRight]}>
        <View style={[styles.bubble, styles.bubbleOwn, { width: "40%" }]} />
      </View>
      <View style={[styles.row, styles.rowLeft]}>
        <View style={styles.avatar} />
        <View style={[styles.bubble, { width: "70%" }]} />
      </View>
      <View style={[styles.row, styles.rowLeft, { marginTop: 2 }]}>
        <View style={[styles.avatar, { opacity: 0 }]} />
        <View style={[styles.bubble, { width: "35%" }]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, paddingTop: 16, gap: 10 },
  row: { flexDirection: "row", alignItems: "flex-end", gap: 8 },
  rowLeft: { justifyContent: "flex-start" },
  rowRight: { justifyContent: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#e5e7eb" },
  bubble: { height: 38, borderRadius: 16, backgroundColor: "#eef0f2" },
  bubbleOwn: { backgroundColor: "#dcecec" },
});
