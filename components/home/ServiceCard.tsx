import React from "react";
import { TouchableOpacity, Text, StyleSheet, View } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import type { Service } from "../../constants/data";

interface Props {
  item: Service;
  onPress?: () => void;
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

export default function ServiceCard({ item, onPress }: Props) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <AnimatedTouchable
      style={[styles.card, animStyle]}
      // react-hooks/immutability doesn't yet recognize react-native-reanimated's
      // SharedValue.value as a mutable escape hatch outside React's render
      // model - this is the library's own documented usage pattern, not a bug.
      // eslint-disable-next-line react-hooks/immutability
      onPressIn={() => { scale.value = withSpring(0.94); }}
      // eslint-disable-next-line react-hooks/immutability
      onPressOut={() => { scale.value = withSpring(1); }}
      onPress={onPress}
      activeOpacity={1}
    >
      <View style={[styles.iconBox, { backgroundColor: item.bgColor }]}>
        <Ionicons name={item.icon as any} size={26} color={item.color} />
      </View>
      <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
      <Text style={styles.desc} numberOfLines={1}>{item.description}</Text>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: "47%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    alignItems: "flex-start",
    ...SHADOW.card,
  },
  iconBox: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: 2,
  },
  desc: {
    fontSize: 11,
    color: COLORS.gray,
  },
});
