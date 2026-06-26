import { useFocusEffect } from "@react-navigation/native";
import { useCallback } from "react";
import { BackHandler, Platform } from "react-native";

/**
 * Runs a custom handler when the Android hardware back button is pressed
 * while this screen is focused. Return true to consume the event.
 */
export function useHardwareBackHandler(
  handler: () => boolean,
  enabled = true,
) {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== "android" || !enabled) return;

      const subscription = BackHandler.addEventListener(
        "hardwareBackPress",
        handler,
      );
      return () => subscription.remove();
    }, [enabled, handler]),
  );
}
