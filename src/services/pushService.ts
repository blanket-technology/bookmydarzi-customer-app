import { Platform } from "react-native";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { registerDeviceToken, unregisterDeviceToken } from "./notificationService";
import { captureException } from "./sentryService";

/** Remote push (and most of expo-notifications) was removed from Expo Go
 * entirely as of SDK 53 - it only works in a development/production build.
 * `expo-notifications` must never be statically imported anywhere in this
 * app: the native module throws just from being imported inside Expo Go on
 * Android, before any isPushAvailable check around a call site could ever
 * run. Every consumer must check this flag first and dynamic-import the
 * module only when it's true (see registerForPushNotifications below and
 * app/_layout.tsx's PushNotificationSetup). */
export const isPushAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

let handlerConfigured = false;

/** Lazily loads expo-notifications and configures its notification handler
 * exactly once - shared by registerForPushNotifications below and
 * app/_layout.tsx's listener setup, so both paths funnel through the same
 * single dynamic import rather than each racing their own. */
export async function loadNotifications() {
  const Notifications = await import("expo-notifications");
  if (!handlerConfigured) {
    handlerConfigured = true;
    Notifications.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowAlert: true,
        shouldPlaySound: true,
        shouldSetBadge: true,
        shouldShowBanner: true,
        shouldShowList: true,
      }),
    });
  }
  return Notifications;
}

export async function registerForPushNotifications(): Promise<string | null> {
  if (!isPushAvailable) {
    if (__DEV__) console.log("[Push] Not available in Expo Go - skipping registration");
    return null;
  }
  const Notifications = await loadNotifications();

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== "granted") {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== "granted") {
    if (__DEV__) console.log("[Push] Permission not granted - skipping registration");
    return null;
  }

  let token: string;
  try {
    const projectId: string | undefined =
      Constants.expoConfig?.extra?.eas?.projectId;
    const result = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    token = result.data;
  } catch (err) {
    // Bug fix: this failure was only ever logged behind __DEV__, so a real
    // production-build failure here (e.g. Google Play Services unavailable,
    // a transient network error talking to Expo's push token service) was
    // completely invisible - no way to tell "push doesn't work for this
    // user" from "push works but nobody's testing it". Sentry capture
    // makes a real failure here actually diagnosable.
    if (__DEV__) console.warn("[Push] Failed to get push token:", err);
    captureException(err, { stage: "getExpoPushTokenAsync" });
    return null;
  }

  const platform = (Platform.OS === "ios" ? "ios" : "android") as "android" | "ios";

  try {
    await registerDeviceToken(token, platform);
    if (__DEV__) console.log(`[Push] Registered token with backend: platform=${platform}`);
  } catch (err) {
    if (__DEV__) console.warn("[Push] Backend device-token registration failed (non-fatal):", err);
    captureException(err, { stage: "registerDeviceToken", platform });
  }

  return token;
}

export async function unregisterFromPushNotifications(token: string): Promise<void> {
  try {
    await unregisterDeviceToken(token);
  } catch (err) {
    if (__DEV__) console.warn("[Push] Unregister failed (non-fatal):", err);
  }
}
