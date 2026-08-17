import { useCartStore } from "../store/useCartStore";
import type { AddCartServiceEntryPayload } from "../types/cart";

/** POST /cart/service-entry for a resolved popular service id - no navigation.
 * Measurement is never supplied by the customer - it's collected later by
 * Bridge/employee at pickup or by Admin. */
export async function postPopularServiceToCart(serviceId: number): Promise<void> {
  if (serviceId <= 0) {
    throw new Error("A valid service is required.");
  }

  const payload: AddCartServiceEntryPayload = {
    service_id: serviceId,
    quantity: 1,
  };

  await useCartStore.getState().addServiceEntry(payload);
}
