import type { Router } from "expo-router";
import { useCartStore } from "../store/useCartStore";
import { useAuthStore } from "../../store/useAuthStore";
import { postPopularServiceToCart } from "./popularCartAdd";
import { safeRouterReplace } from "./safeNavigation";

/** Post-login redirect - deferred until root layout is mounted. */
export function navigateAfterAuthWithCart(router: Router): void {
  const {
    pendingRoute,
    pendingRouteParams,
    pendingService,
    clearPendingRoute,
    clearPendingService,
  } = useCartStore.getState();

  if (!pendingRoute) {
    const role = useAuthStore.getState().user?.role;
    if (role === "admin" || role === "superadmin") {
      safeRouterReplace(router, "/(admin)");
      return;
    }
    if (role === "employee") {
      safeRouterReplace(router, "/(employee)");
      return;
    }
    if (role === "tailor") {
      safeRouterReplace(router, "/(tailor)");
      return;
    }
    safeRouterReplace(router, "/(tabs)");
    return;
  }

  const route = pendingRoute;
  const params = pendingRouteParams ?? {};
  const bookingFlowActive = useCartStore.getState().bookingFlowActive;
  clearPendingRoute();

  // Measurement is never supplied by the customer, so a pending service from
  // service-details/the (tabs) redirect (or the old "/measurement" pending
  // route from before this flow was removed) all resolve the same way now:
  // add straight to cart, no measurement step in between.
  if (
    pendingService &&
    (route === "/(tabs)" || (bookingFlowActive && route === "/service-details") || route === "/measurement")
  ) {
    const item = pendingService;
    clearPendingService();
    safeRouterReplace(router, "/(tabs)");
    void postPopularServiceToCart(item.bookableServiceId).catch(() => {});
    return;
  }

  safeRouterReplace(router, { pathname: route, params } as never);
}
