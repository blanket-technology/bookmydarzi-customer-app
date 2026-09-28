import { Ionicons } from "@expo/vector-icons";
import { useEffect } from "react";
import { Modal, Pressable, StyleSheet, Text, View } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";

interface Props {
  visible: boolean;
  amountDisplay: string;
  itemCount: number;
  onCancel: () => void;
  onConfirm: () => void;
}

/**
 * COD checkout confirmation - replaces the bare Alert.alert with a proper
 * in-brand bottom sheet (Swiggy/Zomato/Amazon COD-confirm pattern): a clear
 * icon, the exact amount due, and two unmistakable actions. Alert.alert
 * can't be styled or branded and reads as a raw OS dialog, which is the
 * "too simple" complaint this replaces.
 */
export default function CodConfirmModal({
  visible,
  amountDisplay,
  itemCount,
  onCancel,
  onConfirm,
}: Props) {
  const sheetY = useSharedValue(40);
  const overlayOpacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      overlayOpacity.value = withTiming(1, { duration: 220, easing: Easing.out(Easing.cubic) });
      sheetY.value = withSpring(0, { damping: 18, stiffness: 220 });
    } else {
      sheetY.value = 40;
      overlayOpacity.value = 0;
    }
  }, [visible, overlayOpacity, sheetY]);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const sheetStyle = useAnimatedStyle(() => ({ transform: [{ translateY: sheetY.value }] }));

  return (
    <Modal visible={visible} transparent animationType="none" onRequestClose={onCancel}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, overlayStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onCancel} />
        </Animated.View>

        <Animated.View style={[styles.sheet, sheetStyle]}>
          <View style={styles.grabber} />

          <View style={styles.iconRing}>
            <Ionicons name="cash-outline" size={30} color={COLORS.primaryDark} />
          </View>

          <Text style={styles.title}>Confirm Cash on Delivery</Text>
          <Text style={styles.subtitle}>
        {itemCount === 1 ? "" : "s"} · Pay when your Order Arrives
          </Text>

          <View style={styles.amountCard}>
            <Text style={styles.amountLabel}>Amount to pay in cash</Text>
            <Text style={styles.amountValue}>{amountDisplay}</Text>
          </View>

          <View style={styles.noteRow}>
            <Ionicons name="information-circle-outline" size={15} color={COLORS.gray} />
            <Text style={styles.noteText}>
              No payment is required now. Keep the exact cash ready at delivery.
            </Text>
          </View>

          <Pressable
            style={({ pressed }) => [styles.confirmBtn, pressed && styles.confirmBtnPressed]}
            onPress={onConfirm}
          >
            <Text style={styles.confirmBtnText}>Place Order</Text>
            <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
          </Pressable>

          <Pressable style={styles.cancelBtn} onPress={onCancel}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(13,13,13,0.5)",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.xl,
    paddingTop: SPACING.sm,
    paddingBottom: SPACING.xl + 8,
    alignItems: "center",
    ...SHADOW.strong,
  },
  grabber: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.grayBorder,
    marginBottom: SPACING.lg,
  },
  iconRing: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.15)",
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: COLORS.black,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 12.5,
    color: COLORS.gray,
    textAlign: "center",
    marginTop: 4,
  },
  amountCard: {
    width: "100%",
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    paddingVertical: SPACING.md,
    marginTop: SPACING.lg,
  },
  amountLabel: {
    fontSize: 11.5,
    fontWeight: "600",
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.4,
  },
  amountValue: {
    fontSize: 30,
    fontWeight: "800",
    color: COLORS.primaryDark,
    letterSpacing: -0.5,
    marginTop: 2,
  },
  noteRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 6,
    marginTop: SPACING.md,
    paddingHorizontal: SPACING.xs,
  },
  noteText: {
    flex: 1,
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 17,
  },
  confirmBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    width: "100%",
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    height: 52,
    marginTop: SPACING.lg,
    ...SHADOW.card,
  },
  confirmBtnPressed: {
    opacity: 0.9,
  },
  confirmBtnText: {
    fontSize: 15.5,
    fontWeight: "700",
    color: COLORS.white,
  },
  cancelBtn: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    height: 44,
    marginTop: 6,
  },
  cancelBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray,
  },
});
