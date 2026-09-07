import { Platform } from "react-native";
import * as Notifications from "expo-notifications";
import Constants, { ExecutionEnvironment } from "expo-constants";
import { registerDeviceToken, unregisterDeviceToken } from "./notificationService";

/** Remote push (and most of expo-notifications) was removed from Expo Go
 * entirely as of SDK 53 - it only works in a development/production build.
 * Every push-related call in this module must check this first, since even
 * `setNotificationHandler` throws when invoked inside Expo Go on Android. */
export const isPushAvailable =
  Constants.executionEnvironment !== ExecutionEnvironment.StoreClient;

if (isPushAvailable) {
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

export async function registerForPushNotifications(): Promise<string | null> {
  if (!isPushAvailable) {
    if (__DEV__) console.log("[Push] Not available in Expo Go - skipping registration");
    return null;
  }
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
    if (__DEV__) console.warn("[Push] Failed to get push token:", err);
    return null;
  }

  const platform = (Platform.OS === "ios" ? "ios" : "android") as "android" | "ios";

  try {
    await registerDeviceToken(token, platform);
    if (__DEV__) console.log(`[Push] Registered token with backend: platform=${platform}`);
  } catch (err) {
    if (__DEV__) console.warn("[Push] Backend device-token registration failed (non-fatal):", err);
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
