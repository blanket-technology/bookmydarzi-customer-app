import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS, SPACING } from "../../../constants/theme";
import { useSessionStore } from "../../store/useSessionStore";

// Full-screen takeover shown once when a refresh-token cycle genuinely fails
// (services/api.ts's forceLogout → registerLogoutCallback in useAuthStore.ts),
// before the app's own !isAuthenticated guards redirect to login - without
// this, that transition was completely silent. AuthGuard only force-redirects
// from staff route groups; customer (tabs) screens allow guest browsing, so
// this button navigates explicitly rather than relying on that guard.
export default function SessionExpiredModal() {
  const expired = useSessionStore((s) => s.expired);
  const clear = useSessionStore((s) => s.clear);
  const router = useRouter();

  const handlePress = () => {
    clear();
    router.replace("/(auth)/login");
  };

  return (
    <Modal visible={expired} transparent animationType="fade">
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={styles.iconBox}>
            <Ionicons name="time-outline" size={30} color={COLORS.primaryDark} />
          </View>
          <Text style={styles.title}>Session Expired</Text>
          <Text style={styles.message}>
            Your session has ended for your security. Please sign in again to continue.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={handlePress}>
            <Text style={styles.btnText}>Go to Login</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(13,13,13,0.45)",
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: SPACING.xl,
    alignItems: "center",
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: "#e0f7f8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  btn: {
    marginTop: SPACING.lg,
    width: "100%",
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: "center",
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
});
