import { Ionicons } from "@expo/vector-icons";
import { Redirect, Tabs } from "expo-router";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS } from "../../constants/theme";
import { useAuthStore } from "../../store/useAuthStore";

// Roles allowed inside the (admin) group. Staff-only surface.
const ADMIN_ROLES = new Set(["admin", "superadmin", "employee"]);

// Where each non-admin role belongs, so we bounce them to the right home
// instead of a generic screen.
const ROLE_HOME: Record<string, string> = {
  tailor: "/(tailor)",
  user: "/(tabs)",
};

const TEAL = "#149694";

const TABS = [
  { name: "index",        label: "Dashboard", icon: "grid",          iconOut: "grid-outline" },
  { name: "orders",       label: "Orders",    icon: "bag",            iconOut: "bag-outline" },
  { name: "admin-profile",label: "Profile",   icon: "person",         iconOut: "person-outline" },
] as const;

function TabBtn({
  label, icon, iconOut, focused, onPress,
}: { label: string; icon: string; iconOut: string; focused: boolean; onPress: () => void }) {
  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const dotStyle = useAnimatedStyle(() => ({
    opacity: withTiming(focused ? 1 : 0, { duration: 200 }),
    transform: [{ scale: withSpring(focused ? 1 : 0.6) }],
  }), [focused]);

  return (
    <TouchableOpacity
      style={styles.btn}
      onPress={onPress}
      onPressIn={() => { scale.value = withSpring(0.92, { damping: 18, stiffness: 320 }); }}
      onPressOut={() => { scale.value = withSpring(1, { damping: 18, stiffness: 320 }); }}
      activeOpacity={1}
    >
      <Animated.View style={[styles.inner, animStyle]}>
        <View style={styles.pillSlot}>{focused && <View style={styles.pill} />}</View>
        <Ionicons name={(focused ? icon : iconOut) as any} size={22} color={focused ? TEAL : "#9CA3AF"} />
        <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
        <View style={styles.dotSlot}><Animated.View style={[styles.dot, dotStyle]} /></View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function AdminTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 4) + 2 }]}>
      {state.routes.map((route: any) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.routes[state.index]?.key === route.key;
        return (
          <TabBtn
            key={route.key}
            label={tab.label}
            icon={tab.icon}
            iconOut={tab.iconOut}
            focused={focused}
            onPress={() => {
              if (!focused) navigation.navigate(route.name);
            }}
          />
        );
      })}
    </View>
  );
}

export default function AdminLayout() {
  const hydrated = useAuthStore((s) => s._hasHydrated);
  const role = useAuthStore((s) => s.user?.role);

  // Render-time gate for the whole (admin) group: if the role is known and
  // is NOT a staff role, redirect out BEFORE any admin screen (and its
  // fetch-on-mount) renders - this is the root-cause fix for a "user" landing
  // in (admin) and firing 403s. While the role is still resolving (not
  // hydrated / no role yet) we render nothing rather than bounce a legit admin
  // mid-hydration; the per-screen fetch gates hold the line until it resolves.
  if (hydrated && role && !ADMIN_ROLES.has(role)) {
    return <Redirect href={(ROLE_HOME[role] ?? "/(tabs)") as never} />;
  }

  return (
    <Tabs
      initialRouteName="index"
      tabBar={(p) => <AdminTabBar {...p} />}
      screenOptions={{ headerShown: false }}
    />
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    paddingTop: 4,
    paddingHorizontal: 4,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 8 },
    }),
  },
  btn: { flex: 1, minHeight: 44, alignItems: "stretch", justifyContent: "center", paddingVertical: 1 },
  inner: { alignItems: "center", paddingHorizontal: 2 },
  pillSlot: { width: "100%", height: 5, alignItems: "center", justifyContent: "flex-end", marginBottom: 1 },
  pill: { width: 26, height: 3, borderRadius: RADIUS.full, backgroundColor: TEAL },
  label: { fontSize: 10, fontWeight: "500", color: "#9CA3AF", marginTop: 2 },
  labelActive: { color: TEAL, fontWeight: "700" },
  dotSlot: { width: "100%", height: 5, alignItems: "center", justifyContent: "center", marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: TEAL },
});
