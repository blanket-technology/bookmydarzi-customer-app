import { useRootNavigationState } from "expo-router";

/** True once Expo Router's root navigation container is mounted. */
export function useNavigationReady(): boolean {
  const rootNavigationState = useRootNavigationState();
  return rootNavigationState?.key != null;
}
