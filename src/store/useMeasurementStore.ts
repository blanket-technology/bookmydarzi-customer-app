import { create } from "zustand";
import type {
  ApiMeasurement,
  MeasurementFormDefaults,
  MeasurementPayload,
} from "../services/measurementService";
import {
  getMeasurementFormDefaults,
  getMeasurements,
  updateMeasurement,
} from "../services/measurementService";

// Customers only ever view/edit an existing profile here - creation happens
// exclusively via Bridge/employee at pickup (bmdadmin's
// MeasurementManageSheet.tsx), so there is deliberately no create/delete
// action in this store. An edit here writes to the same USER_MEASUREMENTS
// row Bridge/Tailor/Admin already read from, so it's visible to them
// immediately - no separate sync step.
interface MeasurementState {
  measurements: ApiMeasurement[];
  formDefaults: MeasurementFormDefaults | null;
  loading: boolean;
  saving: boolean;
  error: string | null;

  fetchMeasurements: () => Promise<void>;
  fetchFormDefaults: () => Promise<void>;
  editMeasurement: (
    id: number,
    payload: Partial<MeasurementPayload>,
  ) => Promise<ApiMeasurement | null>;
  clearError: () => void;
  reset: () => void;
}

export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  measurements: [],
  formDefaults: null,
  loading: false,
  saving: false,
  error: null,

  fetchMeasurements: async () => {
    set({ loading: true, error: null });
    try {
      const data = await getMeasurements();
      set({ measurements: data.measurements, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load measurements",
      });
    }
  },

  fetchFormDefaults: async () => {
    // Static-ish per-account config (field sets, suggested name) - fetch
    // once and keep, no need to reload on every focus like the list.
    if (get().formDefaults) return;
    try {
      const defaults = await getMeasurementFormDefaults();
      set({ formDefaults: defaults });
    } catch {
      // Non-fatal - the form falls back to a generic field set if this
      // never loads (see measurements.tsx's DEFAULT_FIELDS fallback).
    }
  },

  editMeasurement: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      await updateMeasurement(id, payload);
      const data = await getMeasurements();
      set({ measurements: data.measurements, saving: false });
      return data.measurements.find((m) => m.id === id) ?? null;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to update measurement",
      });
      return null;
    }
  },

  clearError: () => set({ error: null }),
  reset: () =>
    set({ measurements: [], formDefaults: null, loading: false, saving: false, error: null }),
}));
