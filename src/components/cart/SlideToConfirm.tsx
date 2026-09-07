import { Ionicons } from "@expo/vector-icons";
import * as Haptics from "expo-haptics";
import { LinearGradient } from "expo-linear-gradient";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import Animated, {
  Easing,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS, RADIUS } from "../../../constants/theme";

const TRACK_HEIGHT = 58;
const THUMB_SIZE = 50;
const THUMB_MARGIN = 4;
const COMPLETE_THRESHOLD = 0.82;

export interface SlideToConfirmProps {
  label: string;
  disabled?: boolean;
  processing?: boolean;
  onConfirm: () => void;
  icon?: keyof typeof Ionicons.glyphMap;
}

/**
 * Premium "slide to confirm" control (Uber/Blinkit/PhonePe pattern).
 * Full drag to the end fires onConfirm; springs back on early release.
 * Reanimated + Gesture Handler only - no slider dependency.
 *
 * UX polish: a soft gradient track, a looping chevron "nudge" inviting the
 * swipe, a translucent progress fill that keeps the label readable, the thumb
 * scaling up on grab, and a green success flash with a checkmark once it fires.
 */
export default function SlideToConfirm({
  label,
  disabled = false,
  processing = false,
  onConfirm,
  icon = "arrow-forward",
}: SlideToConfirmProps) {
  const { width: screenWidth } = useWindowDimensions();
  const trackWidth = Math.min(screenWidth - 40, 520);
  const maxTranslate = trackWidth - THUMB_SIZE - THUMB_MARGIN * 2;

  const translateX = useSharedValue(0);
  const isLocked = useSharedValue(false);
  const grabbed = useSharedValue(0); // 0 → 1 while the thumb is held
  const nudge = useSharedValue(0); // looping hint animation
  const success = useSharedValue(0); // 0 → 1 on confirm
  const [confirmed, setConfirmed] = useState(false);

  const isInteractive = !disabled && !processing;

  // Looping chevron nudge + shimmer while idle & interactive.
  useEffect(() => {
    if (isInteractive) {
      nudge.value = withRepeat(
        withSequence(
          withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }),
          withDelay(400, withTiming(0, { duration: 0 })),
        ),
        -1,
        false,
      );
    } else {
      nudge.value = 0;
    }
  }, [isInteractive, nudge]);

  const fireConfirm = useCallback(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    setConfirmed(true);
    onConfirm();
  }, [onConfirm]);

  const snapBack = useCallback(() => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  }, []);

  const pan = Gesture.Pan()
    .enabled(isInteractive)
    .onBegin(() => {
      grabbed.value = withSpring(1, { damping: 15, stiffness: 240 });
    })
    .onChange((e) => {
      if (isLocked.value) return;
      const next = translateX.value + e.changeX;
      translateX.value = Math.min(Math.max(next, 0), maxTranslate);
    })
    .onEnd(() => {
      if (isLocked.value) return;
      const reached = translateX.value >= maxTranslate * COMPLETE_THRESHOLD;
      if (reached) {
        isLocked.value = true;
        translateX.value = withTiming(maxTranslate, { duration: 130 });
        success.value = withTiming(1, { duration: 220 });
        runOnJS(fireConfirm)();
      } else {
        translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
        runOnJS(snapBack)();
      }
    })
    .onFinalize(() => {
      grabbed.value = withSpring(0, { damping: 15, stiffness: 240 });
    });

  // Reset the thumb whenever processing ends without the parent navigating
  // away (cancelled COD confirm, failed checkout) so it's ready to retry.
  const prevProcessingRef = React.useRef(processing);
  useEffect(() => {
    if (prevProcessingRef.current && !processing) {
      isLocked.value = false;
      success.value = 0;
      translateX.value = withSpring(0, { damping: 18, stiffness: 220 });
      setConfirmed(false);
    }
    prevProcessingRef.current = processing;
  }, [processing, isLocked, translateX, success]);

  const thumbStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { scale: 1 + grabbed.value * 0.06 },
    ],
  }));

  const fillStyle = useAnimatedStyle(() => ({
    width: translateX.value + THUMB_SIZE + THUMB_MARGIN,
    opacity: success.value > 0 ? 0 : 1,
  }));

  const hintStyle = useAnimatedStyle(() => ({
    opacity:
      (1 - Math.min(translateX.value / (maxTranslate * 0.45), 1)) *
      (1 - success.value),
  }));

  // The chevrons drift right + fade to "pull" the eye along the track.
  const nudgeStyle = useAnimatedStyle(() => ({
    opacity: interpolate(nudge.value, [0, 0.5, 1], [0.35, 0.9, 0]),
    transform: [{ translateX: interpolate(nudge.value, [0, 1], [0, 10]) }],
  }));

  const successStyle = useAnimatedStyle(() => ({
    opacity: success.value,
  }));

  return (
    <View
      style={[styles.wrap, { width: trackWidth }, disabled && styles.trackDisabled]}
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint="Swipe right to the end to confirm"
      accessibilityState={{ disabled: !isInteractive }}
    >
      {/* Gradient track base */}
      <LinearGradient
        colors={["#0f7f89", "#0c6c75"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.track}
      />

      {/* Success flash overlay */}
      <Animated.View style={[styles.successOverlay, successStyle]} pointerEvents="none">
        <LinearGradient
          colors={["#10b981", "#059669"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <Text style={styles.successText}>Confirmed</Text>
      </Animated.View>

      {/* Translucent progress fill (keeps the label readable, unlike a solid one) */}
      <Animated.View style={[styles.fill, fillStyle]} pointerEvents="none" />

      {/* Label + looping chevron nudge */}
      <Animated.View style={[styles.hintWrap, hintStyle]} pointerEvents="none">
        <Text style={styles.hintText} numberOfLines={1}>
          {processing ? "Processing…" : label}
        </Text>
        {!processing ? (
          <Animated.View style={[styles.chevronRow, nudgeStyle]}>
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.6)" />
            <Ionicons name="chevron-forward" size={14} color="rgba(255,255,255,0.85)" style={{ marginLeft: -7 }} />
            <Ionicons name="chevron-forward" size={14} color="#fff" style={{ marginLeft: -7 }} />
          </Animated.View>
        ) : null}
      </Animated.View>

      {/* Thumb */}
      <GestureDetector gesture={pan}>
        <Animated.View style={[styles.thumb, thumbStyle]}>
          {confirmed ? (
            processing ? (
              <ActivityIndicator size="small" color={COLORS.primaryDark} />
            ) : (
              <Ionicons name="checkmark" size={24} color="#059669" />
            )
          ) : processing ? (
            <ActivityIndicator size="small" color={COLORS.primaryDark} />
          ) : (
            <Ionicons name={icon} size={22} color={COLORS.primaryDark} />
          )}
        </Animated.View>
      </GestureDetector>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    height: TRACK_HEIGHT,
    borderRadius: RADIUS.full,
    justifyContent: "center",
    overflow: "hidden",
    alignSelf: "center",
    shadowColor: COLORS.primaryDark,
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
    elevation: 7,
  },
  track: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.full,
  },
  trackDisabled: { opacity: 0.45 },
  successOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS.full,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  successText: {
    fontSize: 15,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: 0.3,
  },
  fill: {
    position: "absolute",
    left: 0,
    top: 0,
    bottom: 0,
    // Translucent white veil - reads clearly as drag progress over the teal
    // track without a hard white block swallowing the label/thumb.
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: RADIUS.full,
  },
  hintWrap: {
    position: "absolute",
    left: THUMB_SIZE + THUMB_MARGIN * 2,
    right: 14,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  hintText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  chevronRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  thumb: {
    position: "absolute",
    left: THUMB_MARGIN,
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.22,
    shadowRadius: 5,
    elevation: 5,
  },
});
