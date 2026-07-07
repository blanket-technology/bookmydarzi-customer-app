import { useCartStore } from "../store/useCartStore";
import { useMeasurementStore } from "../store/useMeasurementStore";
import type { AddCartServiceEntryPayload } from "../types/cart";
import { buildSelectedMeasurements } from "./cartMeasurement";

/** POST /cart/service-entry for a resolved popular service id - no navigation. */
export async function postPopularServiceToCart(serviceId: number): Promise<void> {
  if (serviceId <= 0) {
    throw new Error("A valid service is required.");
  }

  await useMeasurementStore.getState().fetchMeasurements();
  const measurements = useMeasurementStore.getState().measurements;
  const defaultProfile =
    measurements.find((m) => m.is_default) ?? measurements[0];

  const payload: AddCartServiceEntryPayload = {
    service_id: serviceId,
    quantity: 1,
  };

  if (defaultProfile?.id) {
    payload.measurement_profile_id = defaultProfile.id;
    payload.selected_measurements = buildSelectedMeasurements(defaultProfile);
  }

  await useCartStore.getState().addServiceEntry(payload);
}
