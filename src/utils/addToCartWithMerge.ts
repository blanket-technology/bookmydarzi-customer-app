import { useCartStore } from "../store/useCartStore";
import { useMeasurementStore } from "../store/useMeasurementStore";
import type { AddCartServiceEntryPayload } from "../types/cart";
import { buildSelectedMeasurements } from "./cartMeasurement";

export interface AddToCartOptions {
  serviceId: number;
  quantity: number;
  tailorId?: number;
  measurementProfileId?: number;
  selectedMeasurements?: Record<string, number>;
  selectedSize?: string;
}

/**
 * Adds to cart or merges quantity when the same service_id already exists.
 */
export async function addToCartWithMerge(options: AddToCartOptions): Promise<void> {
  const { serviceId, quantity, tailorId, measurementProfileId, selectedMeasurements, selectedSize } =
    options;

  if (serviceId <= 0) {
    throw new Error("A valid service is required.");
  }

  const { entries, addServiceEntry, updateEntryQuantity } = useCartStore.getState();
  const existing = entries.find((entry) => entry.serviceId === serviceId);

  if (existing) {
    await updateEntryQuantity(existing.id, existing.quantity + quantity);
    return;
  }

  const payload: AddCartServiceEntryPayload = {
    service_id: serviceId,
    quantity,
    tailor_id: tailorId,
    selected_size: selectedSize,
    selected_measurements: selectedMeasurements,
    measurement_profile_id: measurementProfileId,
  };

  await addServiceEntry(payload);
}

/** Resolve default measurement profile if the user has saved profiles. */
export async function resolveDefaultMeasurementProfile() {
  await useMeasurementStore.getState().fetchMeasurements();
  const measurements = useMeasurementStore.getState().measurements;
  return measurements.find((m) => m.is_default) ?? measurements[0] ?? null;
}

export async function addToCartWithDefaultMeasurement(
  serviceId: number,
  quantity: number,
  tailorId?: number,
): Promise<"added" | "needs_measurement"> {
  const profile = await resolveDefaultMeasurementProfile();

  if (!profile?.id) {
    return "needs_measurement";
  }

  await addToCartWithMerge({
    serviceId,
    quantity,
    tailorId,
    measurementProfileId: profile.id,
    selectedMeasurements: buildSelectedMeasurements(profile),
  });

  return "added";
}
