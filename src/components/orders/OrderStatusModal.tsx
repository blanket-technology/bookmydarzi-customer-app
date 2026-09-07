import { Ionicons } from "@expo/vector-icons";
import React, { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";

export type OrderCelebrationKind = "order_accepted" | "delivered" | "completed";

const CONTENT: Record<
  OrderCelebrationKind,
  { icon: keyof typeof Ionicons.glyphMap; title: string; body: (code: string) => string; cta: string }
> = {
  order_accepted: {
    icon: "checkmark-done-circle",
    title: "Order Accepted!",
    body: (code) =>
      `Great news! Your order ${code} has been accepted. Our team will arrange cloth pickup from your location shortly.`,
    cta: "Got it",
  },
  delivered: {
    icon: "gift",
    title: "Order Delivered!",
    body: (code) => `Your order ${code} has been delivered. We hope you love your new garment!`,
    cta: "Got it",
  },
  completed: {
    icon: "ribbon",
    title: "Order Completed!",
    body: (code) => `Your order ${code} is complete. Thank you for choosing BookMyDarzi!`,
    cta: "Thanks!",
  },
};

interface Props {
  visible: boolean;
  kind: OrderCelebrationKind | null;
  orderCode: string;
  onDismiss: () => void;
}

/**
 * Branded celebration sheet for order-lifecycle milestones (accepted /
 * delivered / completed) - replaces a bare Alert.alert with the same
 * pop + ring-pulse language as order-success.tsx, so the "your order was
 * accepted" moment reads as an in-app event, not an OS system dialog.
 */
export default function OrderStatusModal({ visible, kind, orderCode, onDismiss }: Props) {
  const overlayOpacity = useSharedValue(0);
  const sheetScale = useSharedValue(0.85);
  const ringOpacity = useSharedValue(0);
  const ringScale = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.cubic) });
      sheetScale.value = withSpring(1, { damping: 14, stiffness: 180 });
      ringOpacity.value = withSequence(
        withTiming(0.3, { duration: 180 }),
        withDelay(160, withTiming(0, { duration: 380 })),
      );
      ringScale.value = withTiming(1.5, { duration: 600, easing: Easing.out(Easing.cubic) });
    } else {
      overlayOpacity.value = 0;
      sheetScale.value = 0.85;
      ringOpacity.value = 0;
      ringScale.value = 0;
    }
  }, [visible, overlayOpacity, sheetScale, ringOpacity, ringScale]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ scale: sheetScale.value }] }));
  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));

  if (!kind) return null;
  const content = CONTENT[kind];

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onDismiss}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} />
        </Animated.View>

        <Animated.View style={[styles.card, sheetStyle]}>
          <View style={styles.iconStack}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <View style={styles.iconWrap}>
              <Ionicons name={content.icon} size={40} color={COLORS.white} />
            </View>
          </View>

          <Text style={styles.title}>{content.title}</Text>
          <Text style={styles.body}>{content.body(orderCode)}</Text>

          <Pressable
            style={({ pressed }) => [styles.btn, pressed && styles.btnPressed]}
            onPress={onDismiss}
          >
            <Text style={styles.btnText}>{content.cta}</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,13,13,0.5)",
    paddingHorizontal: SPACING.xl,
  },
  card: {
    width: "100%",
    maxWidth: 340,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.xl,
    paddingBottom: SPACING.lg,
    alignItems: "center",
    ...SHADOW.strong,
  },
  iconStack: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  ring: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 2,
    borderColor: COLORS.primaryDark,
  },
  iconWrap: {
    width: 84,
    height: 84,
    borderRadius: 42,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.card,
  },
  title: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.black,
    textAlign: "center",
  },
  body: {
    fontSize: 13.5,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 19,
    marginTop: 8,
  },
  btn: {
    width: "100%",
    height: 48,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    marginTop: SPACING.lg,
  },
  btnPressed: { opacity: 0.9 },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
});
