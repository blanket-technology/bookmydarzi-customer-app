import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { useEffect, useState } from "react";
import { Platform, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS } from "../../constants/theme";
import { wsService } from "../../src/services/wsService";

const TEAL = "#149694";

const TABS = [
  { name: "index",            label: "Queue",    icon: "list",             iconOut: "list-outline" },
  { name: "my-orders",        label: "My Work",  icon: "briefcase",        iconOut: "briefcase-outline" },
  { name: "chat",             label: "Messages", icon: "chatbubbles",      iconOut: "chatbubbles-outline" },
  { name: "employee-profile", label: "Profile",  icon: "person",           iconOut: "person-outline" },
] as const;

function TabBtn({ label, icon, iconOut, focused, onPress, badge }: {
  label: string; icon: string; iconOut: string;
  focused: boolean; onPress: () => void; badge?: number;
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
        <View style={styles.iconWrap}>
          <Ionicons name={(focused ? icon : iconOut) as any} size={22} color={focused ? TEAL : "#9CA3AF"} />
          {badge && badge > 0 ? (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{badge > 9 ? "9+" : badge}</Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.label, focused && styles.labelActive]}>{label}</Text>
        <View style={styles.dotSlot}><Animated.View style={[styles.dot, dotStyle]} /></View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function EmployeeTabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [chatUnread, setChatUnread] = useState(0);

  // Increment badge when a new CHAT_MESSAGE arrives while not on the chat tab
  useEffect(() => {
    const chatIdx = state.routes.findIndex((r: any) => r.name === "chat");
    const isChatFocused = state.index === chatIdx;
    const unsub = wsService.on("CHAT_MESSAGE", () => {
      if (!isChatFocused) setChatUnread((n) => n + 1);
    });
    return unsub;
  }, [state]);

  // Clear badge when chat tab is navigated to
  const activeName = state.routes[state.index]?.name;
  useEffect(() => {
    if (activeName === "chat") setChatUnread(0);
  }, [activeName]);

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 4) + 2 }]}>
      {state.routes.map((route: any) => {
        const tab = TABS.find((t) => t.name === route.name);
        if (!tab) return null;
        const focused = state.routes[state.index]?.key === route.key;
        const badge = route.name === "chat" ? chatUnread : undefined;
        return (
          <TabBtn
            key={route.key}
            label={tab.label}
            icon={tab.icon}
            iconOut={tab.iconOut}
            focused={focused}
            badge={badge}
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
  iconWrap: { position: "relative" },
  badge: {
    position: "absolute", top: -4, right: -6,
    minWidth: 16, height: 16, borderRadius: 8,
    backgroundColor: "#DC2626",
    alignItems: "center", justifyContent: "center",
    paddingHorizontal: 3,
    borderWidth: 1.5, borderColor: COLORS.white,
  },
  badgeText: { fontSize: 9, fontWeight: "800", color: COLORS.white },
  label: { fontSize: 10, fontWeight: "500", color: "#9CA3AF", marginTop: 2 },
  labelActive: { color: TEAL, fontWeight: "700" },
  dotSlot: { width: "100%", height: 5, alignItems: "center", justifyContent: "center", marginTop: 2 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: TEAL },
});
