/**
 * Lazy-load Razorpay native module so Expo Go does not crash on import.
 * Razorpay only works in a development or production native build.
 */
import { Platform } from "react-native";
import Constants from "expo-constants";

/** True when running inside the Expo Go app */
export function isExpoGo(): boolean {
  return Constants.executionEnvironment === "storeClient";
}

/** True when a custom dev client or standalone build is running */
export function isDevClientOrStandalone(): boolean {
  return (
    Constants.executionEnvironment === "bare" ||
    Constants.executionEnvironment === "standalone"
  );
}

/**
 * Razorpay native checkout is available (not Expo Go, native module present).
 */
export function isRazorpayNativeAvailable(): boolean {
  if (Platform.OS === "web") return false;
  // Never load native Razorpay in Expo Go - avoids native module crash
  if (isExpoGo()) return false;

  try {
    const { NativeModules } = require("react-native");
    const hasNative =
      NativeModules.RNRazorpayCheckout != null ||
      NativeModules.RazorpayCheckout != null;
    if (!hasNative) return false;

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require("react-native-razorpay");
    return typeof mod?.default?.open === "function";
  } catch {
    return false;
  }
}

export function getRazorpayCheckoutModule(): {
  open: (options: Record<string, unknown>) => Promise<{
    razorpay_payment_id: string;
    razorpay_order_id: string;
    razorpay_signature: string;
  }>;
} | null {
  if (!isRazorpayNativeAvailable()) return null;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const mod = require("react-native-razorpay");
  return mod?.default ?? null;
}

export const EXPO_GO_RAZORPAY_MESSAGE =
  "Razorpay requires a development build. Please install the dev client on your phone.\n\n" +
  "1) Run: eas build --profile development --platform android\n" +
  "2) Install the APK on your phone\n" +
  "3) Run: npx expo start --dev-client\n" +
  "4) Open the DarziApp dev build (not Expo Go)";
