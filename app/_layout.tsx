import { useEffect, useRef, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { Stack, usePathname, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider, useSafeAreaInsets } from "react-native-safe-area-context";
import { configureReanimatedLogger, ReanimatedLogLevel } from "react-native-reanimated";
import * as Notifications from "expo-notifications";

// Reanimated's "strict mode" render-time `.value` read warning fires from
// its own internal entering/exiting animation builders (FadeInDown etc.)
// combined with FlatList/AnimatedFlatList mounting, not from any `.value`
// read in this app's code - verified by tracing every useSharedValue in the
// home/orders/cart screens. Quiet the diagnostic instead of chasing a
// warning with no real app-level source.
configureReanimatedLogger({
  level: ReanimatedLogLevel.warn,
  strict: false,
});
import { Ionicons } from "@expo/vector-icons";
import AppToast from "../src/components/common/AppToast";
import { ErrorBoundary } from "../src/components/common/ErrorBoundary";
import SessionExpiredModal from "../src/components/common/SessionExpiredModal";
import { initSentry } from "../src/services/sentryService";

initSentry();
import AppSplashScreen from "./splash";
import OfflineBanner from "../components/OfflineBanner";
import { useAuthStore } from "../store/useAuthStore";
import { useToastStore } from "../src/store/useToastStore";
import {
  isPushAvailable,
  registerForPushNotifications,
  unregisterFromPushNotifications,
} from "../src/services/pushService";
import { wsService } from "../src/services/wsService";
import { useCartStore } from "../src/store/useCartStore";
import { useHomeStore } from "../src/store/useHomeStore";
import { useOrderStore } from "../src/store/useOrderStore";
import { useCustomerOrdersStore } from "../src/store/useCustomerOrdersStore";
import { useCartBootstrap } from "../src/hooks/useCartBootstrap";
import { useAppLanguage } from "../src/i18n/useAppLanguage";
import { COLORS, RADIUS } from "../constants/theme";

// ─── Tab bar config ────────────────────────────────────────────────────────────

const TAB_ACTIVE = "#149694";

const TABS_CONFIG = [
  { name: "index",   route: "/",        labelKey: "tabs.home",    icon: "home",   iconOutline: "home-outline"   },
  { name: "orders",  route: "/orders",  labelKey: "tabs.orders",  icon: "bag",    iconOutline: "bag-outline"    },
  { name: "cart",    route: "/cart",    labelKey: "tabs.cart",    icon: "cart",   iconOutline: "cart-outline"   },
  { name: "profile", route: "/profile", labelKey: "tabs.profile", icon: "person", iconOutline: "person-outline" },
] as const;

const HIDE_ON_SEGMENTS = new Set(["(auth)", "(admin)", "(employee)", "(tailor)"]);
const HIDE_ON_PATHS    = new Set(["/payment", "/order-success", "/chat", "/support-chat"]);

// ─── Persistent footer tab bar ─────────────────────────────────────────────────

function PersistentTabBar() {
  const router          = useRouter();
  const pathname        = usePathname();
  const segments        = useSegments();
  const insets          = useSafeAreaInsets();
  const { t }           = useAppLanguage();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const cartCount       = useCartStore((s) => s.itemCount);

  const seg0 = segments[0] as string | undefined;
  if (!isAuthenticated) return null;
  if (seg0 && HIDE_ON_SEGMENTS.has(seg0)) return null;
  if (HIDE_ON_PATHS.has(pathname)) return null;

  const activeTab =
    pathname === "/"        ? "index"   :
    pathname === "/orders"  ? "orders"  :
    pathname === "/cart"    ? "cart"    :
    pathname === "/profile" ? "profile" : null;

  return (
    <View style={[tb.bar, { paddingBottom: Math.max(insets.bottom, 4) + 2 }]}>
      {TABS_CONFIG.map((tab) => {
        const isFocused = activeTab === tab.name;
        const showBadge = tab.name === "cart" && cartCount > 0;
        return (
          <TouchableOpacity
            key={tab.name}
            style={tb.btn}
            onPress={() => router.navigate(tab.route as never)}
            activeOpacity={0.7}
            accessibilityRole="button"
          >
            <View style={tb.iconSlot}>
              {isFocused && <View style={tb.pill} />}
              <Ionicons
                name={(isFocused ? tab.icon : tab.iconOutline) as never}
                size={22}
                color={isFocused ? TAB_ACTIVE : "#9CA3AF"}
              />
              {showBadge && (
                <View style={tb.badge}>
                  <Text style={tb.badgeText} allowFontScaling={false}>
                    {cartCount > 99 ? "99+" : String(cartCount)}
                  </Text>
                </View>
              )}
            </View>
            <Text
              style={[tb.label, isFocused && tb.labelActive]}
              allowFontScaling={false}
              numberOfLines={1}
            >
              {t(tab.labelKey)}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const tb = StyleSheet.create({
  bar: {
    flexDirection: "row",
    backgroundColor: COLORS.white,
    paddingTop: 6,
    paddingHorizontal: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 12,
  },
  btn: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    minHeight: 44,
    paddingVertical: 2,
  },
  iconSlot: {
    width: 36,
    height: 30,
    alignItems: "center",
    justifyContent: "center",
  },
  pill: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: RADIUS.full,
    backgroundColor: `${TAB_ACTIVE}18`,
  },
  badge: {
    position: "absolute",
    top: -2,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    paddingHorizontal: 4,
    backgroundColor: TAB_ACTIVE,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: COLORS.white,
  },
  badgeText: {
    fontSize: 9,
    fontWeight: "800",
    color: COLORS.white,
    lineHeight: 11,
    textAlign: "center",
  },
  label: {
    fontSize: 10,
    fontWeight: "500",
    color: "#9CA3AF",
    textAlign: "center",
  },
  labelActive: {
    color: TAB_ACTIVE,
    fontWeight: "700",
  },
});

// ─── Setup helpers ─────────────────────────────────────────────────────────────

function CartBootstrap() {
  useCartBootstrap();
  return null;
}

/** Route a tapped notification to the screen it's about. Chat notifications
 * (type: "chat") always carry the session's order_id in their data payload
 * (see app/services/notifications/notification_service.py callers in
 * chat_ws.py/handoff_service.py) - navigating by order_id, not session_uuid,
 * is what guarantees this lands on the correct conversation: sessions are
 * now uniquely scoped per (customer, order) (see the chat_v2 session-
 * isolation fix), so re-resolving by order_id on open always finds the
 * same session a session_uuid would have pointed to, without the support
 * screen needing to accept a raw session_uuid prop at all. */
function routeForNotification(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const type = data.type as string | undefined;
  if (type === "chat") {
    const orderId = data.order_id;
    return orderId != null ? `/support-chat?orderId=${orderId}` : "/support-chat";
  }
  // Support-agent/AI notifications (policy.py support_* helpers) carry the
  // session's UUID as `session_id` and no order_id - open that exact session
  // directly by uuid so the tap always lands on the right conversation, even
  // for order-less (general) support threads.
  if (type === "support" && data.session_id != null) {
    return `/support-chat?sessionUuid=${data.session_id}`;
  }
  if (type === "order_update" && data.order_id != null) {
    return `/order-details?orderId=${data.order_id}`;
  }
  return null;
}

function PushNotificationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tokenRef = useRef<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    if (isAuthenticated) {
      registerForPushNotifications().then((token) => {
        tokenRef.current = token;
      });
    } else if (tokenRef.current) {
      unregisterFromPushNotifications(tokenRef.current);
      tokenRef.current = null;
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (!isPushAvailable) return;
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? "";
      const body  = notification.request.content.body  ?? "";
      const text  = [title, body].filter(Boolean).join("\n");
      if (text) useToastStore.getState().show(text, "info");
    });
    return () => sub.remove();
  }, []);

  // Deep-link on tap - foreground, background, and killed-app cold-start
  // are all delivered through this same listener by expo-notifications.
  // Unavailable in Expo Go (see isPushAvailable) - only works in a
  // development/production build.
  useEffect(() => {
    if (!isPushAvailable) return;
    const handleResponse = (response: Notifications.NotificationResponse) => {
      const data = response.notification.request.content.data as
        | Record<string, unknown>
        | undefined;
      const route = routeForNotification(data);
      if (route) router.push(route as any);
    };

    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    const sub = Notifications.addNotificationResponseReceivedListener(handleResponse);
    return () => sub.remove();
  }, [router]);

  return null;
}

function WebSocketSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    if (!isAuthenticated) {
      wsService.disconnect();
      return;
    }

    wsService.connect();

    const unsubs = [
      wsService.on("BILLING_UPDATED", () => {
        useCartStore.getState().refreshCart({ silent: true });
      }),
      wsService.on("HOME_UPDATED", () => {
        useHomeStore.getState().loadHomeData(true);
      }),
      wsService.on("ORDER_STATUS_UPDATED", (data) => {
        useOrderStore.getState().invalidateCache();
        const code   = (data.order_code as string) ?? "";
        const status = ((data.status as string) ?? "").replace(/_/g, " ");
        useToastStore.getState().show(`Order ${code}: ${status}`, "info");
      }),
      // Every real order-lifecycle push (tailor assigned, pickup, stitching,
      // dispatch, delivered, cancelled, refunds, COD) goes through
      // notification_service.create_notification, which fires "NOTIFICATION"
      // - not "ORDER_STATUS_UPDATED" (that event only exists for the admin
      // manual-status-edit tool). Without this handler, none of those events
      // ever invalidated the order cache - the app relied entirely on
      // useFocusEffect refetching when a screen regained focus, so a
      // customer watching an open order-details screen never saw it update.
      wsService.on("NOTIFICATION", (data) => {
        const payload = (data as { type?: string }) ?? {};
        if (payload.type === "order_update") {
          useOrderStore.getState().invalidateCache();
          useCustomerOrdersStore.getState().invalidateCache();
        }
      }),
    ];

    return () => {
      unsubs.forEach((u) => u());
      wsService.disconnect();
    };
  }, [isAuthenticated]);

  return null;
}

// Maps each role to the route group it belongs in.
const ROLE_HOME: Record<string, string> = {
  admin:      "/(admin)",
  superadmin: "/(admin)",
  employee:   "/(employee)",
  tailor:     "/(tailor)",
  user:       "/(tabs)",
};

// Which roles are allowed inside each route group.
const GROUP_ALLOWED_ROLES: Record<string, Set<string>> = {
  "(admin)":    new Set(["admin", "superadmin"]),
  "(employee)": new Set(["employee"]),
  "(tailor)":   new Set(["tailor"]),
  "(tabs)":     new Set(["user"]),
};

function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const role            = useAuthStore((s) => s.user?.role);
  const hydrated        = useAuthStore((s) => s._hasHydrated);
  const router          = useRouter();
  const segments        = useSegments();

  useEffect(() => {
    if (!hydrated) return;

    const seg0 = segments[0] as string | undefined;

    // 1. Not authenticated inside a STAFF group → login. The customer (tabs)
    //    group is intentionally NOT here: BookMyDarzi allows guest browsing of
    //    the home/services tabs before login (Blinkit/Zepto-style), so guarding
    //    (tabs) would bounce guests to login and break "back → home". Logout
    //    from a customer tab is handled explicitly at the logout call site.
    const isProtected =
      seg0 === "(admin)" ||
      seg0 === "(employee)" ||
      seg0 === "(tailor)";
    if (!isAuthenticated && isProtected) {
      router.replace("/(auth)/login");
      return;
    }

    // 2. Authenticated but wrong role for the current route group → correct home.
    //    This is the defence-in-depth catch for the race condition where the initial
    //    redirect in index.tsx ran before the profile fetch resolved the true role.
    if (isAuthenticated && role && seg0 && GROUP_ALLOWED_ROLES[seg0]) {
      const allowed = GROUP_ALLOWED_ROLES[seg0];
      if (!allowed.has(role)) {
        const home = ROLE_HOME[role] ?? "/(tabs)";
        router.replace(home as never);
      }
    }
  }, [isAuthenticated, role, hydrated, segments]);

  return null;
}

// ─── Root layout ───────────────────────────────────────────────────────────────

export default function RootLayout() {
  const [showSplash, setShowSplash] = useState(true);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
      <SafeAreaProvider>
        <AuthGuard />
        <WebSocketSetup />
        <PushNotificationSetup />
        <CartBootstrap />
        <AppToast />
        <SessionExpiredModal />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index"         options={{ animation: "fade" }} />
          <Stack.Screen name="onboarding"    options={{ animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(admin)"       options={{ animation: "fade" }} />
          <Stack.Screen name="(employee)"    options={{ animation: "fade" }} />
          <Stack.Screen name="(tailor)"      options={{ animation: "fade" }} />
          <Stack.Screen name="(auth)"        options={{ animation: "slide_from_right" }} />
          <Stack.Screen name="sub-services"  options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="service-details" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="stitching-type"  options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="address"       options={{ headerShown: false, animation: "slide_from_bottom" }} />
          <Stack.Screen name="measurements"  options={{ headerShown: false, animation: "slide_from_bottom" }} />
          <Stack.Screen name="edit-profile"  options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="order-summary" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="order-details" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="buy-now-review" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="payment"       options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="order-success" options={{ headerShown: false, animation: "fade", gestureEnabled: false }} />
          <Stack.Screen name="notifications" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="support"       options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="support-order-picker" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="support-issue-picker" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="support-ticket" options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="chat"          options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="support-chat"  options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="browse"        options={{ headerShown: false, animation: "slide_from_bottom" }} />
          <Stack.Screen name="all-services"  options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="lookbook"      options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="payments"      options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="privacy"       options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="terms"         options={{ headerShown: false, animation: "slide_from_right" }} />
          <Stack.Screen name="about"         options={{ headerShown: false, animation: "slide_from_right" }} />
        </Stack>
        <PersistentTabBar />
        <OfflineBanner />
        {showSplash && (
          <AppSplashScreen onComplete={() => setShowSplash(false)} />
        )}
      </SafeAreaProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}
