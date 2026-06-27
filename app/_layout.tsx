import { useEffect, useRef } from "react";
import { Stack, useRouter, useSegments } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import AppToast from "../src/components/common/AppToast";
import { useAuthStore } from "../store/useAuthStore";
import { useToastStore } from "../src/store/useToastStore";
import {
  registerForPushNotifications,
  unregisterFromPushNotifications,
} from "../src/services/pushService";

function PushNotificationSetup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const tokenRef = useRef<string | null>(null);

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

  // Show foreground notifications as in-app toast banners
  useEffect(() => {
    const sub = Notifications.addNotificationReceivedListener((notification) => {
      const title = notification.request.content.title ?? "";
      const body = notification.request.content.body ?? "";
      const text = [title, body].filter(Boolean).join("\n");
      if (text) {
        useToastStore.getState().show(text, "info");
      }
    });
    return () => sub.remove();
  }, []);

  return null;
}

function AuthGuard() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const hydrated = useAuthStore((s) => s._hasHydrated);
  const router = useRouter();
  const segments = useSegments();

  useEffect(() => {
    if (!hydrated) return;
    const inProtectedGroup =
      segments[0] === "(admin)" ||
      segments[0] === "(employee)" ||
      segments[0] === "(tailor)";
    if (!isAuthenticated && inProtectedGroup) {
      router.replace("/(auth)/login");
    }
  }, [isAuthenticated, hydrated, segments]);

  return null;
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <AuthGuard />
        <PushNotificationSetup />
        <AppToast />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" options={{ animation: "fade" }} />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="(admin)" options={{ animation: "fade" }} />
          <Stack.Screen name="(employee)" options={{ animation: "fade" }} />
          <Stack.Screen name="(tailor)" options={{ animation: "fade" }} />
          <Stack.Screen
            name="(auth)"
            options={{ animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="sub-services"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="service-details"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="stitching-type"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="measurement"
            options={{ headerShown: false, animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="address"
            options={{ headerShown: false, animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="review"
            options={{ headerShown: false, animation: "slide_from_bottom" }}
          />
          <Stack.Screen
            name="order-summary"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="order-details"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="payment"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="order-success"
            options={{
              headerShown: false,
              animation: "fade",
              gestureEnabled: false,
            }}
          />
          <Stack.Screen
            name="notifications"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="wishlist"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="support"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="support-ticket"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
          <Stack.Screen
            name="chat"
            options={{ headerShown: false, animation: "slide_from_right" }}
          />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
