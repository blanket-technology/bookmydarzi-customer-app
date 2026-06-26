import React, { useEffect, useRef } from "react";
import { View, Text, StyleSheet, Animated } from "react-native";
import { useRouter } from "expo-router";
import { useHardwareBackHandler } from "../../src/hooks/useHardwareBackHandler";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { navigateAfterAuthWithCart } from "../../src/utils/authCartRedirect";

const AUTO_REDIRECT_MS = 2200;

export default function OtpVerifySuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const scaleAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(24)).current;
  const ringScale = useRef(new Animated.Value(0.8)).current;
  const ringOpacity = useRef(new Animated.Value(0)).current;
  const dotAnims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;

  useEffect(() => {
    // Main content entrance
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 55,
        friction: 6,
        useNativeDriver: true,
      }),
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 400,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulsing ring behind checkmark
    Animated.loop(
      Animated.sequence([
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 1.25, duration: 900, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0.35, duration: 450, useNativeDriver: true }),
        ]),
        Animated.parallel([
          Animated.timing(ringScale, { toValue: 0.8, duration: 900, useNativeDriver: true }),
          Animated.timing(ringOpacity, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]),
      ])
    ).start();

    // Staggered bouncing dots
    const staggerDelay = 180;
    const createDotAnim = (anim: Animated.Value, delay: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(anim, { toValue: -8, duration: 300, useNativeDriver: true }),
          Animated.timing(anim, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ])
      );

    dotAnims.forEach((anim, i) => createDotAnim(anim, i * staggerDelay).start());

    const timer = setTimeout(() => {
      navigateAfterAuthWithCart(router);
    }, AUTO_REDIRECT_MS);

    return () => clearTimeout(timer);
  }, []);

  useHardwareBackHandler(() => true);

  return (
    <LinearGradient
      colors={["#0c6c75", "#1aa3b0", "#2dd4bf"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.3, y: 1 }}
      style={[styles.root, { paddingTop: insets.top, paddingBottom: insets.bottom + 24 }]}
    >
      {/* Decorative circles */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <Animated.View
        style={[
          styles.content,
          {
            opacity: fadeAnim,
            transform: [{ scale: scaleAnim }, { translateY: slideAnim }],
          },
        ]}
      >
        {/* Pulsing ring + icon */}
        <View style={styles.iconContainer}>
          <Animated.View
            style={[
              styles.pulseRing,
              { transform: [{ scale: ringScale }], opacity: ringOpacity },
            ]}
          />
          <View style={styles.iconWrap}>
            <Ionicons name="checkmark-circle" size={80} color="#ffffff" />
          </View>
        </View>

        <Text style={styles.title}>Verified!</Text>
        <Text style={styles.subtitle}>
          Your mobile number has been verified successfully.{"\n"}
          Logging you in now…
        </Text>

        {/* Staggered bouncing dots */}
        <View style={styles.dotsRow}>
          {dotAnims.map((anim, i) => (
            <Animated.View
              key={i}
              style={[styles.dot, { transform: [{ translateY: anim }] }]}
            />
          ))}
        </View>
      </Animated.View>

      <Text style={styles.footer}>Powered by Blanket Technologies Pvt Ltd</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 32,
    overflow: "hidden",
  },
  circle1: {
    position: "absolute",
    width: 340,
    height: 340,
    borderRadius: 170,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -110,
    right: -90,
  },
  circle2: {
    position: "absolute",
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -70,
    left: -70,
  },
  circle3: {
    position: "absolute",
    width: 160,
    height: 160,
    borderRadius: 80,
    backgroundColor: "rgba(255,255,255,0.06)",
    top: "30%",
    right: -50,
  },
  content: { alignItems: "center", width: "100%" },
  iconContainer: {
    width: 140,
    height: 140,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 28,
  },
  pulseRing: {
    position: "absolute",
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  iconWrap: {
    width: 120,
    height: 120,
    borderRadius: 60,
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
    fontSize: 34,
    fontWeight: "800",
    color: "#ffffff",
    textAlign: "center",
    marginBottom: 12,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 22,
    marginBottom: 36,
  },
  dotsRow: { flexDirection: "row", gap: 10, alignItems: "flex-end", height: 24 },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "rgba(255,255,255,0.7)",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    textAlign: "center",
  },
});
