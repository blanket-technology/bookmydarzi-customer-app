import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import {
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuthStore, type AuthState } from "../store/useAuthStore";

function PulseDots() {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(dot, { toValue: 1, duration: 320, easing: Easing.out(Easing.ease), useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 320, easing: Easing.in(Easing.ease), useNativeDriver: true }),
          Animated.delay((2 - i) * 180 + 200),
        ])
      )
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  }, []);

  return (
    <View style={dotStyles.row}>
      {dots.map((dot, i) => (
        <Animated.View
          key={i}
          style={[dotStyles.dot, {
            opacity: dot.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
            transform: [{ scaleY: dot.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }) }],
          }]}
        />
      ))}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: 8, alignItems: "center" },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "rgba(255,255,255,0.85)" },
});

/**
 * App entry — splash until auth store hydrates and root navigation mounts,
 * then declarative <Redirect> (never router.replace during initial mount).
 */
export default function Index() {
  const hydrated = useAuthStore((s: AuthState) => s._hasHydrated);
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = rootNavigationState?.key != null;

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.88)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 700, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.spring(scaleAnim, { toValue: 1, tension: 60, friction: 8, useNativeDriver: true }),
    ]).start();

    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.06, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.ease), useNativeDriver: true }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  if (hydrated && isNavigationReady) {
    const role = useAuthStore.getState().user?.role;
    if (role === "admin" || role === "superadmin") {
      return <Redirect href="/(admin)" />;
    }
    if (role === "employee") {
      return <Redirect href="/(employee)" />;
    }
    if (role === "tailor") {
      return <Redirect href="/(tailor)" />;
    }
    return <Redirect href="/(tabs)" />;
  }

  return (
    <LinearGradient
      colors={["#083d43", "#0c6c75", "#1aa3b0"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.4, y: 1 }}
      style={styles.root}
    >
      {/* Background decorative circles */}
      <View style={styles.circle1} />
      <View style={styles.circle2} />
      <View style={styles.circle3} />

      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        <Animated.View style={[styles.logoBox, { transform: [{ scale: pulseAnim }] }]}>
          <Ionicons name="cut" size={54} color="#ffffff" />
        </Animated.View>
        <Text style={styles.appName}>BookMyDarzi</Text>
        <Text style={styles.tagline}>Custom tailoring at your doorstep</Text>
      </Animated.View>

      <View style={styles.bottomArea}>
        <PulseDots />
        <Text style={styles.loadingText}>Getting things ready…</Text>
      </View>

      <Text style={styles.footer}>Powered By Blanket Technologies Pvt Ltd</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },

  circle1: {
    position: "absolute", width: 320, height: 320, borderRadius: 160,
    backgroundColor: "rgba(255,255,255,0.04)", top: -100, right: -80,
  },
  circle2: {
    position: "absolute", width: 220, height: 220, borderRadius: 110,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: 80, left: -70,
  },
  circle3: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.03)", top: "40%", right: -40,
  },

  content: { alignItems: "center" },

  logoBox: {
    width: 108, height: 108, borderRadius: 32,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 28,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25, shadowRadius: 20, elevation: 14,
    borderWidth: 1, borderColor: "rgba(255,255,255,0.25)",
  },

  appName: {
    fontSize: 38, fontWeight: "800", color: "#ffffff",
    letterSpacing: -0.5, marginBottom: 10,
    textShadowColor: "rgba(0,0,0,0.2)", textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8,
  },
  tagline: {
    fontSize: 15, color: "rgba(255,255,255,0.75)",
    textAlign: "center", lineHeight: 22, paddingHorizontal: 40,
  },

  bottomArea: {
    position: "absolute", bottom: 72,
    alignItems: "center", gap: 14,
  },
  loadingText: { fontSize: 13, color: "rgba(255,255,255,0.5)", letterSpacing: 0.3 },

  footer: {
    position: "absolute", bottom: 24,
    fontSize: 11, color: "rgba(255,255,255,0.4)", letterSpacing: 0.2,
  },
});
