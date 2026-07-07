import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { Redirect, useRootNavigationState } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useAuthStore, type AuthState } from "../store/useAuthStore";

/**
 * App entry - splash until auth store hydrates and root navigation mounts,
 * then declarative <Redirect> (never router.replace during initial mount).
 */
export default function Index() {
  const hydrated = useAuthStore((s: AuthState) => s._hasHydrated);
  const rootNavigationState = useRootNavigationState();
  const isNavigationReady = rootNavigationState?.key != null;

  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 600,
      useNativeDriver: true,
    }).start();
  }, [fadeAnim]);

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
      colors={["#0c6c75", "#1aa3b0", "#2dd4bf"]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={styles.root}
    >
      <Animated.View style={[styles.content, { opacity: fadeAnim }]}>
        <View style={styles.logoBox}>
          <Ionicons name="cut" size={52} color="#ffffff" />
        </View>
        <Text style={styles.appName}>BookMyDarzi</Text>
        <Text style={styles.tagline}>Custom tailoring at your doorstep</Text>
        <View style={styles.circle1} />
        <View style={styles.circle2} />
      </Animated.View>

      <View style={styles.spinnerWrap}>
        <ActivityIndicator size="small" color="rgba(255,255,255,0.7)" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>

      <Text style={styles.footer}>
        Powered By Blanket Technologies Pvt Ltd
      </Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  content: {
    alignItems: "center",
    justifyContent: "center",
  },
  logoBox: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.2,
    shadowRadius: 16,
    elevation: 10,
  },
  appName: {
    fontSize: 36,
    fontWeight: "800",
    color: "#ffffff",
    letterSpacing: -0.5,
    marginBottom: 8,
  },
  tagline: {
    fontSize: 15,
    color: "rgba(255,255,255,0.8)",
    textAlign: "center",
    lineHeight: 22,
    paddingHorizontal: 32,
  },
  circle1: {
    position: "absolute",
    width: 200,
    height: 200,
    borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.05)",
    top: -120,
    right: -80,
  },
  circle2: {
    position: "absolute",
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: "rgba(255,255,255,0.04)",
    bottom: -80,
    left: -60,
  },
  spinnerWrap: {
    position: "absolute",
    bottom: 80,
    alignItems: "center",
    gap: 8,
  },
  loadingText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.6)",
  },
  footer: {
    position: "absolute",
    bottom: 24,
    fontSize: 11,
    color: "rgba(255,255,255,0.5)",
  },
});
