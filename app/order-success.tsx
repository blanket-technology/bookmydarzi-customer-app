/**
 * Order Success Screen — shown after cart checkout
 */
import React, { useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Animated,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import { useHardwareBackHandler } from "../src/hooks/useHardwareBackHandler";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";

function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function OrderSuccessScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { orderId, amount } = useLocalSearchParams<{
    orderId?: string;
    amount?: string;
  }>();

  const parsedAmount =
    amount != null && String(amount).trim() !== ""
      ? Number(amount)
      : Number.NaN;
  const orderAmountDisplay =
    Number.isFinite(parsedAmount) && parsedAmount > 0
      ? formatMoney(parsedAmount)
      : "—";

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 60,
        friction: 7,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();
  }, []);

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

      <Animated.View
        style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}
      >
        <View style={styles.iconWrap}>
          <Ionicons name="checkmark-circle" size={88} color={COLORS.white} />
        </View>

        <Text style={styles.title}>Order Confirmed</Text>
        <Text style={styles.subtitle}>
          Your service request has been submitted successfully.
        </Text>

        {orderId ? (
          <View style={styles.infoCard}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order ID</Text>
              <Text style={styles.infoValue}>#{orderId}</Text>
            </View>
            <View style={styles.infoDivider} />
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Order Amount</Text>
              <Text style={styles.infoValue}>{orderAmountDisplay}</Text>
            </View>
          </View>
        ) : null}

        <Text style={styles.note}>
          You will receive updates as your order progresses.
        </Text>
      </Animated.View>

      <Animated.View style={[styles.btns, { opacity: fadeAnim }]}>
        <TouchableOpacity
          style={styles.primaryBtn}
          onPress={() => router.replace("/(tabs)/orders")}
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
  iconWrap: {
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
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
