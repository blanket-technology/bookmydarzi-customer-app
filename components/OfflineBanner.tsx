/**
 * Sticks to the bottom of the screen when there is no internet connection.
 * Mounts only after NetInfo resolves (avoids false-positive flash on cold start).
 */
import React, { useEffect } from "react";
import { StyleSheet, Text } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useNetworkStatus } from "../src/hooks/useNetworkStatus";

export default function OfflineBanner() {
  const { isConnected, isResolved } = useNetworkStatus();
  const insets = useSafeAreaInsets();
  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  const offline = isResolved && !isConnected;

  useEffect(() => {
    if (offline) {
      translateY.value = withTiming(0, { duration: 300, easing: Easing.out(Easing.quad) });
      opacity.value = withTiming(1, { duration: 300 });
    } else {
      translateY.value = withTiming(80, { duration: 250, easing: Easing.in(Easing.quad) });
      opacity.value = withTiming(0, { duration: 250 });
    }
  // Reanimated shared values are stable refs, not reactive state -
  // intentionally omitted from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offline]);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!isResolved) return null;

  return (
    <Animated.View
      style={[
        styles.banner,
        { paddingBottom: insets.bottom + 8 },
        animStyle,
      ]}
      pointerEvents={offline ? "auto" : "none"}
    >
      <Ionicons name="cloud-offline-outline" size={18} color="#fff" />
      <Text style={styles.text}>No internet connection</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#1F2937",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingTop: 12,
    paddingHorizontal: 20,
    zIndex: 9999,
  },
  text: {
    fontSize: 13,
    fontWeight: "600",
    color: "#fff",
    letterSpacing: 0.2,
  },
});
