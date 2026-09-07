/**
 * Skeleton shimmer using Reanimated 2 - no external dependencies.
 * Usage:
 *   <SkeletonShimmer width={200} height={20} borderRadius={8} />
 *   <SkeletonShimmer circle size={48} />
 */
import { LinearGradient } from "expo-linear-gradient";
import React, { useEffect } from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
    Easing,
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
} from "react-native-reanimated";

interface Props {
  width?: number | `${number}%`;
  height?: number;
  borderRadius?: number;
  circle?: boolean;
  size?: number;
  style?: ViewStyle;
}

export default function SkeletonShimmer({
  width = "100%",
  height = 16,
  borderRadius = 8,
  circle = false,
  size,
  style,
}: Props) {
  const translateX = useSharedValue(-1);

  useEffect(() => {
    translateX.value = withRepeat(
      withTiming(1, { duration: 1000, easing: Easing.linear }),
      -1,
      false,
    );
  // Reanimated shared values are stable refs, not reactive state -
  // intentionally omitted from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: `${translateX.value * 100}%` as any }],
  }));

  const w = circle ? size ?? 48 : width;
  const h = circle ? size ?? 48 : height;
  const r = circle ? (size ?? 48) / 2 : borderRadius;

  return (
    <View
      style={[
        styles.base,
        { width: w as any, height: h, borderRadius: r },
        style,
      ]}
    >
      <Animated.View style={[StyleSheet.absoluteFill, shimmerStyle]}>
        <LinearGradient
          colors={["transparent", "rgba(255,255,255,0.45)", "transparent"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

export function SkeletonRow({
  lines = 2,
  lastLineWidth = "60%",
}: {
  lines?: number;
  lastLineWidth?: `${number}%`;
}) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonShimmer
          key={i}
          width={i === lines - 1 ? lastLineWidth : "100%"}
          height={14}
          borderRadius={7}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: "#E8EAED",
    overflow: "hidden",
  },
});
