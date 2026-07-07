import type { Router } from "expo-router";
import { useCartStore } from "../store/useCartStore";
import { safeRouterReplace } from "./safeNavigation";

/** Return to service-details (or other pending route) after saving measurements - no cart add. */
export function returnToPendingRouteAfterMeasurement(router: Router): boolean {
  const { pendingRoute, pendingRouteParams, clearPendingRoute } =
    useCartStore.getState();

  if (pendingRoute === "/service-details" && pendingRouteParams) {
    clearPendingRoute();
    safeRouterReplace(router, {
      pathname: "/service-details",
      params: pendingRouteParams,
    } as never);
    return true;
  }

  return false;
}
