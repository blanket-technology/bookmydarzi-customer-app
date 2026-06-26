import { useCallback } from "react";
import { Alert, BackHandler } from "react-native";
import { useHardwareBackHandler } from "./useHardwareBackHandler";

/**
 * On the root Home tab, Android back shows an exit confirmation instead of
 * leaving the app unexpectedly (or bouncing through splash).
 */
export function useHomeExitBackHandler(enabled = true) {
  const handleBack = useCallback(() => {
    Alert.alert(
      "Exit BookMyDarzi?",
      "Are you sure you want to close the app?",
      [
        { text: "Stay", style: "cancel" },
        {
          text: "Exit",
          style: "destructive",
          onPress: () => BackHandler.exitApp(),
        },
      ],
    );
    return true;
  }, []);

  useHardwareBackHandler(handleBack, enabled);
}
