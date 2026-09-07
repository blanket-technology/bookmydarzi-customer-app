import React from "react";
import { StyleSheet, Text, View } from "react-native";

export function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.line} />
      <Text style={styles.text}>{label}</Text>
      <View style={styles.line} />
    </View>
  );
}

/** Today / Yesterday / "12 Jan" - matches (employee)/order-chat.tsx's format
 * so date-separator copy is consistent across both chat surfaces. */
export function formatDateSeparator(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", marginVertical: 12, paddingHorizontal: 12, gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#e5e7eb" },
  text: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.3 },
});
