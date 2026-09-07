import React from "react";
import { View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface Props {
  sessionStatus: string;
  agentName?: string;
  onClose?: () => void;
  wsConnected: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  ai_handling: "AI Assistant",
  open: "AI Assistant",
  pending_human: "Connecting to agent…",
  assigned: "Support Agent",
  resolved: "Resolved",
  closed: "Closed",
};

const STATUS_COLORS: Record<string, string> = {
  ai_handling: "#7c3aed",
  open: "#7c3aed",
  pending_human: "#f59e0b",
  assigned: "#0a8c8c",
  resolved: "#4caf50",
  closed: "#9e9e9e",
};

export function ChatHeader({ sessionStatus, agentName, onClose, wsConnected }: Props) {
  const label = agentName && sessionStatus === "assigned" ? agentName : (STATUS_LABELS[sessionStatus] ?? "Support");
  const color = STATUS_COLORS[sessionStatus] ?? "#0a8c8c";

  return (
    <View style={styles.header}>
      <View style={styles.left}>
        <View style={[styles.dot, { backgroundColor: wsConnected ? "#4caf50" : "#ccc" }]} />
        <View>
          <Text style={styles.title}>BookMyDarzi Support</Text>
          <Text style={[styles.subtitle, { color }]}>{label}</Text>
        </View>
      </View>
      {onClose && (
        <TouchableOpacity onPress={onClose} style={styles.closeBtn} activeOpacity={0.7}>
          <Text style={styles.closeText}>✕</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingHorizontal: 16, paddingVertical: 12, backgroundColor: "#fff", borderBottomWidth: 1, borderBottomColor: "#f0f0f0", elevation: 2 },
  left: { flexDirection: "row", alignItems: "center", gap: 10 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  title: { fontSize: 15, fontWeight: "700", color: "#1a1a1a" },
  subtitle: { fontSize: 12, fontWeight: "500", marginTop: 1 },
  closeBtn: { padding: 6 },
  closeText: { fontSize: 16, color: "#999" },
});
