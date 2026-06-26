import { useEffect } from "react";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore } from "../store/useCartStore";

/** Ensures an active cart exists — only for customer (user) role. */
export function useCartBootstrap() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const userRole = useAuthStore((s) => s.user?.role);
  const initializeCart = useCartStore((s) => s.initializeCart);
  const clearCartState = useCartStore((s) => s.clearCartState);

  const isCustomer = userRole === "user";

  useEffect(() => {
    if (isAuthenticated && isCustomer) {
      void initializeCart().catch(() => {});
    } else {
      clearCartState();
    }
  }, [isAuthenticated, isCustomer, initializeCart, clearCartState]);
}
