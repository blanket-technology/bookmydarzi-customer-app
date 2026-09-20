import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { formatDateSeparatorLabel } from "../../utils/formatters";

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
 * so date-separator copy is consistent across both chat surfaces.
 * Re-exported from the shared formatters.ts implementation - kept as its
 * own named export here so SupportChatScreen.tsx's existing import site
 * doesn't need to change. */
export const formatDateSeparator = formatDateSeparatorLabel;

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", alignItems: "center", marginVertical: 12, paddingHorizontal: 12, gap: 10 },
  line: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: "#e5e7eb" },
  text: { fontSize: 11, fontWeight: "700", color: "#9ca3af", textTransform: "uppercase", letterSpacing: 0.3 },
});
