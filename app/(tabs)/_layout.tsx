/**
 * Tab navigator - Home, Orders, Cart, Profile.
 * Bookings & chat live under app/(disabled)/ and are not registered here.
 */
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS } from "../../constants/theme";
import { useAppLanguage } from "../../src/i18n/useAppLanguage";
import { useCartStore } from "../../src/store/useCartStore";
import { useCartBootstrap } from "../../src/hooks/useCartBootstrap";
import { useAuthStore } from "../../store/useAuthStore";

/** Teal accent - matches Home header (#149694) */
const TAB_ACTIVE_TEAL = "#149694";

const TABS = [
  {
    name: "index",
    labelKey: "tabs.home",
    icon: "home",
    iconOutline: "home-outline",
  },
  {
    name: "orders",
    labelKey: "tabs.orders",
    icon: "bag",
    iconOutline: "bag-outline",
  },
  {
    name: "cart",
    labelKey: "tabs.cart",
    icon: "cart",
    iconOutline: "cart-outline",
  },
  {
    name: "profile",
    labelKey: "tabs.profile",
    icon: "person",
    iconOutline: "person-outline",
  },
] as const;

const TAB_ROUTE_ORDER = TABS.map((t) => t.name);
const VISIBLE_TAB_NAMES = new Set<string>(TAB_ROUTE_ORDER);

const TAB_ICON_SIZE = 22;
const TAB_LABEL_LINE_HEIGHT = 12;
const TAB_LABEL_SLOT_HEIGHT = 13;
const TAB_ICON_SLOT_HEIGHT = 26;
/** Approximate tab content height excluding device safe-area inset */
const TAB_BAR_CONTENT_HEIGHT = 6 + 4 + (TAB_ICON_SLOT_HEIGHT + 4) + 3 + TAB_LABEL_SLOT_HEIGHT; // ~56

interface TabButtonProps {
  label: string;
  icon: string;
  iconOutline: string;
  isFocused: boolean;
  onPress: () => void;
  /** When set (including 0), shows a count badge on the tab icon - used by Cart */
  badgeCount?: number;
}

function TabButton({
  label,
  icon,
  iconOutline,
  isFocused,
  onPress,
  badgeCount,
}: TabButtonProps) {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const pillBg = useAnimatedStyle(
    () => ({
      opacity: withTiming(isFocused ? 1 : 0, { duration: 180 }),
    }),
    [isFocused],
  );

  const showBadge = badgeCount !== undefined;
  const badgeLabel =
    badgeCount !== undefined && badgeCount > 99
      ? "99+"
      : String(badgeCount ?? 0);
  const badgeEmpty = badgeCount === 0;

  return (
    <TouchableOpacity
      style={styles.tabBtn}
      onPress={onPress}
      onPressIn={() => {
        scale.value = withSpring(0.90, { damping: 18, stiffness: 320 });
      }}
      onPressOut={() => {
        scale.value = withSpring(1, { damping: 18, stiffness: 320 });
      }}
      activeOpacity={1}
      accessibilityRole="button"
      accessibilityState={{ selected: isFocused }}
    >
      <Animated.View style={[styles.tabInner, animStyle]}>
        {/* Active icon pill background */}
        <View style={styles.iconSlot}>
          <Animated.View style={[styles.iconPill, pillBg]} />
          <Ionicons
            name={(isFocused ? icon : iconOutline) as keyof typeof Ionicons.glyphMap}
            size={TAB_ICON_SIZE}
            color={isFocused ? TAB_ACTIVE_TEAL : "#9CA3AF"}
          />
          {showBadge ? (
            <View style={[styles.tabBadge, badgeEmpty && styles.tabBadgeEmpty]}>
              <Text
                style={[styles.tabBadgeText, badgeEmpty && styles.tabBadgeTextEmpty]}
                allowFontScaling={false}
              >
                {badgeLabel}
              </Text>
            </View>
          ) : null}
        </View>

        <View style={styles.labelSlot}>
          <Text
            style={[styles.tabLabel, isFocused && styles.tabLabelActive]}
            numberOfLines={1}
            ellipsizeMode="tail"
            allowFontScaling={false}
          >
            {label}
          </Text>
        </View>
      </Animated.View>
    </TouchableOpacity>
  );
}

function CustomTabBar({ state, navigation }: any) {
  const { t } = useAppLanguage();
  const insets = useSafeAreaInsets();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const cartCount = useCartStore((s) => s.itemCount);

  if (!isAuthenticated) return null;

  const visibleRoutes = state.routes
    .filter((route: { name: string }) => VISIBLE_TAB_NAMES.has(route.name))
    .sort(
      (a: { name: string }, b: { name: string }) =>
        TAB_ROUTE_ORDER.indexOf(a.name as (typeof TAB_ROUTE_ORDER)[number]) -
        TAB_ROUTE_ORDER.indexOf(b.name as (typeof TAB_ROUTE_ORDER)[number]),
    );

  return (
    <View
      style={[styles.tabBar, { paddingBottom: Math.max(insets.bottom, 4) + 2 }]}
    >
      {visibleRoutes.map((route: { key: string; name: string }) => {
        const tab = TABS.find((item) => item.name === route.name);
        if (!tab) return null;
        const focusedRoute = state.routes[state.index];
        const isFocused = focusedRoute?.key === route.key;

        const onTabPress = () => {
          const event = navigation.emit({
            type: "tabPress",
            target: route.key,
            canPreventDefault: true,
          });
          if (!isFocused && !event.defaultPrevented) {
            navigation.navigate(route.name);
          }
        };

        return (
          <TabButton
            key={route.key}
            label={t(tab.labelKey)}
            icon={tab.icon}
            iconOutline={tab.iconOutline}
            isFocused={isFocused}
            onPress={onTabPress}
            badgeCount={
              route.name === "cart" && cartCount > 0 ? cartCount : undefined
            }
          />
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  useCartBootstrap();

  return (
    <>
      <Tabs
      initialRouteName="index"
      backBehavior="initialRoute"
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    />
    </>
  );
}

const styles = StyleSheet.create({
  tabBar: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: COLORS.white,
    paddingTop: 6,
    paddingBottom: 2,
    paddingHorizontal: 8,
    minHeight: TAB_BAR_CONTENT_HEIGHT,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  tabBtn: {
    flex: 1,
    minWidth: 0,
    minHeight: 44,
    alignItems: "stretch",
    justifyContent: "center",
    paddingVertical: 2,
  },
  tabInner: {
    width: "100%",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    paddingHorizontal: 2,
  },
  iconSlot: {
    width: TAB_ICON_SLOT_HEIGHT + 10,
    height: TAB_ICON_SLOT_HEIGHT + 4,
    alignItems: "center",
    justifyContent: "center",
    position: "relative",
  },
  iconPill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.full,
    backgroundColor: `${TAB_ACTIVE_TEAL}18`,
  },
  tabBadge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: TAB_ACTIVE_TEAL,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  tabBadgeEmpty: {
    backgroundColor: "#E5E7EB",
    borderColor: COLORS.white,
  },
  tabBadgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.white,
    lineHeight: 11,
    textAlign: "center",
  },
  tabBadgeTextEmpty: {
    color: "#9CA3AF",
    fontWeight: "700",
  },
  labelSlot: {
    width: "100%",
    height: TAB_LABEL_SLOT_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
  },
  tabLabel: {
    fontSize: 10,
    lineHeight: TAB_LABEL_LINE_HEIGHT,
    fontWeight: "500",
    color: "#9CA3AF",
    textAlign: "center",
    width: "100%",
  },
  tabLabelActive: {
    color: TAB_ACTIVE_TEAL,
    fontWeight: "700",
  },
});
