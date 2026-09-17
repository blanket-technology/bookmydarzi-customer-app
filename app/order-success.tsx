/**
 * Order Success Screen - shown after cart / buy-now checkout.
 *
 * Staged entrance (Uber/Swiggy/Zomato "order confirmed" pattern):
 *   checkmark pops in with a bounce + haptic tick, radiating rings pulse
 *   once, then title/subtitle/info-card/note/buttons cascade in with a
 *   short stagger. All native-driver transforms/opacity - no layout thrash.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import React, { useEffect } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import { useHardwareBackHandler } from "../src/hooks/useHardwareBackHandler";
import { PAYMENT_METHOD_META } from "../src/types/payment";

function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function OrderSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId, orderCode, amount, remaining, payment } = useLocalSearchParams<{
    orderId?: string;
    orderCode?: string;
    amount?: string;
    remaining?: string;
    /** cod_pending | fully_paid - set by the checkout flow that landed here (see checkoutNavigation.ts / buy-now-review.tsx). */
    payment?: string;
  }>();

  const orderNumberDisplay = orderCode?.trim() || (orderId ? `#${orderId}` : "-");
  const isCod = payment === "cod_pending";

  const parsedAmount =
    amount != null && String(amount).trim() !== ""
      ? Number(amount)
      : Number.NaN;
  const orderAmountDisplay =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? formatMoney(parsedAmount)
      : "-";

  const parsedRemaining =
    remaining != null && String(remaining).trim() !== ""
      ? Number(remaining)
      : Number.NaN;
  const remainingDisplay =
    Number.isFinite(parsedRemaining) && parsedRemaining > 0
      ? formatMoney(parsedRemaining)
      : null;

  // ── Choreographed entrance ────────────────────────────────────────────────
  const ringScale = useSharedValue(0);
  const ringOpacity = useSharedValue(0);
  const checkScale = useSharedValue(0);
  const checkRotate = useSharedValue(-30);

  const titleY = useSharedValue(14);
  const titleO = useSharedValue(0);
  const subtitleY = useSharedValue(14);
  const subtitleO = useSharedValue(0);
  const cardY = useSharedValue(20);
  const cardO = useSharedValue(0);
  const noteO = useSharedValue(0);
  const btnsY = useSharedValue(16);
  const btnsO = useSharedValue(0);

  useEffect(() => {
    // Ring pulses out from behind the checkmark, then fades.
    ringOpacity.value = withSequence(
      withTiming(0.35, { duration: 200 }),
      withDelay(180, withTiming(0, { duration: 420 })),
    );
    ringScale.value = withTiming(1.6, { duration: 700, easing: Easing.out(Easing.cubic) });

    // Checkmark: overshoot bounce + slight rotation settle.
    checkScale.value = withSpring(1, { damping: 9, stiffness: 140, mass: 0.7 });
    checkRotate.value = withSpring(0, { damping: 11, stiffness: 140 });

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});

    const ENT = Easing.out(Easing.cubic);
    const stage = (
      opacityVal: typeof titleO,
      translateVal: typeof titleY,
      delay: number,
    ) => {
      opacityVal.value = withDelay(delay, withTiming(1, { duration: 380, easing: ENT }));
      translateVal.value = withDelay(delay, withTiming(0, { duration: 380, easing: ENT }));
    };

    stage(titleO, titleY, 260);
    stage(subtitleO, subtitleY, 340);
    stage(cardO, cardY, 420);
    noteO.value = withDelay(520, withTiming(1, { duration: 380, easing: ENT }));
    stage(btnsO, btnsY, 600);
  // Reanimated shared values are stable refs, not reactive state -
  // intentionally omitted from deps.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const ringStyle = useAnimatedStyle(() => ({
    opacity: ringOpacity.value,
    transform: [{ scale: ringScale.value }],
  }));
  const checkStyle = useAnimatedStyle(() => ({
    transform: [{ scale: checkScale.value }, { rotate: `${checkRotate.value}deg` }],
  }));
  const titleStyle = useAnimatedStyle(() => ({
    opacity: titleO.value,
    transform: [{ translateY: titleY.value }],
  }));
  const subtitleStyle = useAnimatedStyle(() => ({
    opacity: subtitleO.value,
    transform: [{ translateY: subtitleY.value }],
  }));
  const cardStyle = useAnimatedStyle(() => ({
    opacity: cardO.value,
    transform: [{ translateY: cardY.value }],
  }));
  const noteStyle = useAnimatedStyle(() => ({ opacity: noteO.value }));
  const btnsStyle = useAnimatedStyle(() => ({
    opacity: btnsO.value,
    transform: [{ translateY: btnsY.value }],
  }));

  useHardwareBackHandler(() => true);

  return (
    <LinearGradient
      colors={["#0c6c75", "#1aa3b0", "#2dd4bf"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={[
        styles.root,
        { paddingTop: insets.top, paddingBottom: insets.bottom + SPACING.lg },
      ]}
    >
      <View style={styles.circle1} />
      <View style={styles.circle2} />

      <View style={styles.content}>
        <View style={styles.iconStack}>
          <Animated.View style={[styles.ring, ringStyle]} />
          <Animated.View style={[styles.iconWrap, checkStyle]}>
            <Ionicons name="checkmark-circle" size={88} color={COLORS.white} />
          </Animated.View>
        </View>

        <Animated.Text style={[styles.title, titleStyle]}>Order Confirmed</Animated.Text>
        <Animated.Text style={[styles.subtitle, subtitleStyle]}>
          {isCod
            ? "Your order has been placed. Pay in cash when it's delivered."
            : "Your payment was successful and your order is confirmed."}
        </Animated.Text>

        {orderId ? (
          <Animated.View style={[styles.infoCard, cardStyle]}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Number</Text>
              <Text style={styles.infoValue}>{orderNumberDisplay}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Payment Method</Text>
              <Text style={styles.infoValue}>
                {isCod ? PAYMENT_METHOD_META.cod.displayLabel : PAYMENT_METHOD_META.online.displayLabel}
              </Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>
                {isCod ? "Amount Due" : "Total"}
              </Text>
              <Text style={styles.infoValue}>{orderAmountDisplay}</Text>
            </View>
            {!isCod && remainingDisplay ? (
              <>
                <View style={styles.infoDivider} />
                <View style={styles.infoRow}>
                  <Text style={styles.infoLabel}>Balance at Delivery</Text>
                  <Text style={styles.infoValue}>{remainingDisplay}</Text>
                </View>
              </>
            ) : null}
          </Animated.View>
        ) : null}

        <Animated.Text style={[styles.note, noteStyle]}>
          {isCod
            ? "Our team will arrange cloth pickup shortly. Please keep the cash ready at delivery. You'll receive a notification with updates."
            : "Our team will arrange cloth pickup shortly. You will receive a notification with updates."}
        </Animated.Text>
      </View>

      <Animated.View style={[styles.btns, btnsStyle]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => {
            if (orderId) {
              router.replace({
                pathname: "/order-details" as never,
                params: { orderId },
              });
            } else {
              router.replace("/(tabs)/orders");
            }
          }}
          activeOpacity={0.85}
        >
          <Ionicons name="navigate-outline" size={20} color={COLORS.primaryDark} />
          <Text style={styles.primaryBtnText}>Track Order</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.secondaryBtn}
          onPress={() => router.replace("/(tabs)")}
          activeOpacity={0.85}
        >
          <Text style={styles.secondaryBtnText}>Back To Home</Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.xl,
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: 320,
    height: 320,
    borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: -100,
    right: -80,
  },
  circle2: {
    position: "absolute",
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -60,
    left: -60,
  },
  content: {
    alignItems: "center",
    width: "100%",
    flex: 1,
    justifyContent: "center",
  },
  iconStack: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  ring: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.6)",
  },
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.white,
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.88)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  infoCard: {
    width: "100%",
    maxWidth: 320,
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: RADIUS.lg,
    padding: SPACING.lg,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  infoDivider: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.2)",
    marginVertical: SPACING.md,
  },
  infoLabel: { fontSize: 13, color: "rgba(255,255,255,0.75)" },
  infoValue: { fontSize: 16, fontWeight: "800", color: COLORS.white },
  note: {
    fontSize: 13,
    color: "rgba(255,255,255,0.7)",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 300,
  },
  btns: {
    width: "100%",
    maxWidth: 320,
    gap: SPACING.md,
  },
  primaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    height: 52,
    ...SHADOW.card,
  },
  primaryBtnText: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  secondaryBtn: {
    alignItems: "center",
    justifyContent: "center",
    height: 48,
    borderRadius: RADIUS.lg,
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.45)",
  },
  secondaryBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.white,
  },
});
