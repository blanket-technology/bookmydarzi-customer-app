import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS } from "../../constants/theme";

const TEAL = "#149694";

const TABS = [
  { name: "index",            label: "Queue",   icon: "list",          iconOut: "list-outline" },
  { name: "my-orders",        label: "My Work", icon: "briefcase",     iconOut: "briefcase-outline" },
  { name: "employee-profile", label: "Profile", icon: "person",        iconOut: "person-outline" },
] as const;

function TabBtn({ label, icon, iconOut, focused, onPress }: {
  label: string; icon: string; iconOut: string; focused: boolean; onPress: () => void;
}) {
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

function EmployeeTabBar({ state, navigation }: any) {
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
            onPress={() => { if (!focused) navigation.navigate(route.name); }}
          />
        );
      })}
    </View>
  );
}

export default function EmployeeLayout() {
  return (
    <Tabs
      initialRouteName="index"
      tabBar={(p) => <EmployeeTabBar {...p} />}
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
