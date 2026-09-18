import { Ionicons } from "@expo/vector-icons";
import { Link, Stack } from "expo-router";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SPACING } from "../constants/theme";

// Fallback for any unmatched route (stale deep link, old share link, a
// removed path) - without this Expo Router shows its own unbranded
// "Unmatched Route" dev screen with no way back into the app's own
// navigation (the custom tab bar in app/_layout.tsx doesn't render here).
export default function NotFoundScreen() {
  const insets = useSafeAreaInsets();
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.container, { paddingBottom: insets.bottom + SPACING.lg }]}>
        <View style={styles.iconWrap}>
          <Ionicons name="compass-outline" size={40} color={COLORS.primaryDark} />
        </View>
        <Text style={styles.title}>Page not found</Text>
        <Text style={styles.message}>
          The link you followed may be broken or the page may have been removed.
        </Text>
        <Link href="/(tabs)" asChild>
          <TouchableOpacity style={styles.btn} activeOpacity={0.9}>
            <Ionicons name="home-outline" size={16} color={COLORS.white} />
            <Text style={styles.btnText}>Go to Home</Text>
          </TouchableOpacity>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: SPACING.lg,
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
  },
  iconWrap: {
    width: 76,
    height: 76,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
  },
  message: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 20,
  },
  btn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: SPACING.md,
  },
  btnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.white,
  },
});
