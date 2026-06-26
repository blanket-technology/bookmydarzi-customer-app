import type { Router } from "expo-router";
import { useCartStore } from "../store/useCartStore";
import { useAuthStore } from "../../store/useAuthStore";
import { postPopularServiceToCart } from "./popularCartAdd";
import { safeRouterReplace } from "./safeNavigation";

/** Post-login redirect — deferred until root layout is mounted. */
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

  if (pendingService && bookingFlowActive && route === "/service-details") {
    safeRouterReplace(router, {
      pathname: "/measurement",
      params: {
        bookableServiceId: String(pendingService.bookableServiceId),
      },
    } as never);
    return;
  }

  if (pendingService && route === "/(tabs)") {
    const item = pendingService;
    clearPendingService();
    safeRouterReplace(router, "/(tabs)");
    void postPopularServiceToCart(item.bookableServiceId).catch(() => {});
    return;
  }

  if (pendingService && route === "/measurement") {
    safeRouterReplace(router, {
      pathname: "/measurement",
      params: {
        bookableServiceId: String(pendingService.bookableServiceId),
        stitchingType: pendingService.stitchingType ?? "",
        serviceLineName: pendingService.serviceLineName,
        basePrice: String(pendingService.basePrice),
      },
    } as never);
    return;
  }

  safeRouterReplace(router, { pathname: route, params } as never);
}
