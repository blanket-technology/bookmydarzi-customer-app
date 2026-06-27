import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOW } from "../../../constants/theme";
import { useToastStore } from "../../store/useToastStore";

const DURATIONS: Record<string, number> = {
  success: 2800,
  error: 4000,
  info: 3200,
};

const CONFIG = {
  success: {
    icon: "checkmark-circle" as const,
    color: COLORS.success ?? "#065F46",
    bg: "#F0FDF4",
    border: "rgba(6,95,70,0.15)",
  },
  error: {
    icon: "alert-circle" as const,
    color: "#DC2626",
    bg: "#FEF2F2",
    border: "rgba(220,38,38,0.15)",
  },
  info: {
    icon: "information-circle" as const,
    color: "#0C6C75",
    bg: "#F0F9FA",
    border: "rgba(12,108,117,0.18)",
  },
};

export default function AppToast() {
  const insets = useSafeAreaInsets();
  const { message, type, visible, hide } = useToastStore();

  useEffect(() => {
    if (!visible) return;
    const duration = DURATIONS[type] ?? 2800;
    const t = setTimeout(hide, duration);
    return () => clearTimeout(t);
  }, [visible, type, hide]);

  if (!visible || !message) return null;

  const cfg = CONFIG[type] ?? CONFIG.success;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="none"
    >
      <View style={[styles.toast, { backgroundColor: cfg.bg, borderColor: cfg.border }]}>
        <Ionicons name={cfg.icon} size={20} color={cfg.color} />
        <Text style={[styles.text, { color: type === "error" ? "#991B1B" : COLORS.black }]} numberOfLines={3}>
          {message}
        </Text>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 16,
    right: 16,
    zIndex: 9999,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 420,
    width: "100%",
    ...SHADOW.strong,
    borderWidth: 1,
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    lineHeight: 20,
  },
});
