import React, { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";
import Animated, { FadeInUp, FadeOutUp } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOW } from "../../../constants/theme";
import { useToastStore } from "../../store/useToastStore";

/** Global success/error toast banner */
export default function AppToast() {
  const insets = useSafeAreaInsets();
  const { message, visible, hide } = useToastStore();

  useEffect(() => {
    if (!visible) return;
    const t = setTimeout(hide, 2800);
    return () => clearTimeout(t);
  }, [visible, hide]);

  if (!visible || !message) return null;

  return (
    <Animated.View
      entering={FadeInUp.duration(220)}
      exiting={FadeOutUp.duration(180)}
      style={[styles.wrap, { top: insets.top + 8 }]}
      pointerEvents="none"
    >
      <View style={styles.toast}>
        <Ionicons name="checkmark-circle" size={20} color={COLORS.success} />
        <Text style={styles.text} numberOfLines={2}>
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
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 16,
    paddingVertical: 12,
    maxWidth: 400,
    width: "100%",
    ...SHADOW.strong,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.12)",
  },
  text: {
    flex: 1,
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.black,
  },
});
