import type { Router } from "expo-router";
import { useCartStore } from "../store/useCartStore";
import { useAuthStore } from "../../store/useAuthStore";
import { useToastStore } from "../store/useToastStore";
import { postPopularServiceToCart } from "./popularCartAdd";
import { safeRouterReplace } from "./safeNavigation";

// BookMyDarzi customer app is customer-only - tailor/employee/bridge/admin
// accounts have their own dedicated staff app (bmdadmin) now. This app used
// to bundle all four roles' screens in one binary; those route groups
// ((admin)/(employee)/(tailor)) have been removed, so a staff account
// logging in here has nowhere role-appropriate to land. Rather than drop
// them into the customer (tabs) home (confusing - an admin seeing an empty
// "browse services" screen looks broken, not intentional), reject the
// login outright with a clear message and sign them back out.
const STAFF_ROLES = new Set(["admin", "superadmin", "employee", "tailor"]);

/** Post-login redirect - deferred until root layout is mounted. */
export function navigateAfterAuthWithCart(router: Router): void {
  const role = useAuthStore.getState().user?.role;
  if (role && STAFF_ROLES.has(role)) {
    useToastStore.getState().show(
      "This account is for BookMyDarzi staff. Please use the BookMyDarzi Staff app instead.",
      "error",
    );
    void useAuthStore.getState().logout();
    safeRouterReplace(router, "/(auth)/login");
    return;
  }

  const {
    pendingRoute,
    pendingRouteParams,
    pendingService,
    clearPendingRoute,
    clearPendingService,
  } = useCartStore.getState();

  if (!pendingRoute) {
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
