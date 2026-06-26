import { useCallback } from "react";
import type { ApiMeasurement } from "../types/api";
import { MEASUREMENT_VALUE_KEYS } from "../utils/measurementInput";

/** Build selected_measurements payload for cart service-entry API */
export function buildSelectedMeasurements(
  measurement: ApiMeasurement,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const key of MEASUREMENT_VALUE_KEYS) {
    const value = measurement[key as keyof ApiMeasurement];
    if (typeof value === "number" && value > 0) {
      out[key] = value;
    }
  }
  return out;
}

export function buildSelectedMeasurementsFromForm(
  formByFieldKey: Record<string, string>,
): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [key, raw] of Object.entries(formByFieldKey)) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    const n = parseFloat(trimmed);
    if (!Number.isNaN(n) && n > 0) out[key] = n;
  }
  return out;
}
