import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { useRouter } from "expo-router";
import { useAuthStore } from "../../store/useAuthStore";
import { useCartStore, type PendingCartItem } from "../store/useCartStore";
import { fetchCatalogTree } from "../services/catalogService";
import type { PopularServiceRow } from "../types/homeApi";
import { postPopularServiceToCart } from "../utils/popularCartAdd";
import { resolveBookableServiceIdFromCatalog } from "../utils/resolveBookableServiceId";
import { safeRouterPush } from "../utils/safeNavigation";

async function resolvePopularServiceId(row: PopularServiceRow): Promise<number> {
  let serviceId = row.bookableServiceId ?? 0;
  if (serviceId > 0) return serviceId;

  try {
    const tree = await fetchCatalogTree();
    const resolved = resolveBookableServiceIdFromCatalog(
      tree,
      row.category.Name,
      row.sub.Name,
    );
    if (resolved) return resolved;
  } catch {
    // optional catalog lookup
  }

  return row.sub.Id > 0 ? row.sub.Id : 0;
}

/**
 * Home Popular Services add-to-cart - POST only, no screen navigation.
 * Sub-services flows use their own handlers on those screens.
 */
export function useAddToCart() {
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [addingId, setAddingId] = useState<number | null>(null);

  const addServiceEntry = useCartStore((s) => s.addServiceEntry);
  const setPendingService = useCartStore((s) => s.setPendingService);
  const setPendingRoute = useCartStore((s) => s.setPendingRoute);

  const requireLogin = useCallback(() => {
    setPendingRoute("/(tabs)");
    safeRouterPush(router, "/(auth)/login");
  }, [router, setPendingRoute]);

  const buildPendingItem = useCallback(
    (bookableServiceId: number, row: PopularServiceRow): PendingCartItem => ({
      bookableServiceId,
      serviceLineName: row.sub.Name,
      categoryId: row.category.Id,
      categoryName: row.category.Name,
      basePrice: row.sub.BasePrice,
      displayName: row.sub.Name,
    }),
    [],
  );

  const addPopularToCart = useCallback(
    async (row: PopularServiceRow) => {
      const rowKey = row.sub.Id;
      const serviceId = await resolvePopularServiceId(row);

      if (!isAuthenticated) {
        setPendingService(buildPendingItem(serviceId || rowKey, row));
        setPendingRoute("/(tabs)");
        requireLogin();
        return;
      }

      if (serviceId <= 0) {
        Alert.alert(
          "Add to cart failed",
          "This service could not be added. Please try again later.",
        );
        return;
      }

      setAddingId(rowKey);
      try {
        await postPopularServiceToCart(serviceId);
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "Could not add to cart.";
        Alert.alert("Add to cart failed", msg);
      } finally {
        setAddingId(null);
      }
    },
    [
      buildPendingItem,
      isAuthenticated,
      requireLogin,
      setPendingRoute,
      setPendingService,
    ],
  );

  const addPendingItemToCart = useCallback(
    async (item: PendingCartItem) => {
      await addServiceEntry({
        service_id: item.bookableServiceId,
        quantity: 1,
        tailor_id: item.tailorId,
      });
    },
    [addServiceEntry],
  );

  return {
    addingId,
    addPopularToCart,
    addPendingItemToCart,
    isAdding: addingId != null,
  };
}
