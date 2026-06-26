import { create } from "zustand";
import type { ApiMeasurement, MeasurementPayload } from "../types/api";
import {
  getMeasurements,
  createMeasurement,
  updateMeasurement,
  deleteMeasurement,
} from "../services/measurementService";

interface MeasurementState {
  measurements: ApiMeasurement[];
  loading: boolean;
  saving: boolean;
  error: string | null;

  fetchMeasurements: () => Promise<void>;
  saveMeasurement: (payload: MeasurementPayload) => Promise<ApiMeasurement | null>;
  editMeasurement: (id: number, payload: Partial<MeasurementPayload>) => Promise<ApiMeasurement | null>;
  removeMeasurement: (id: number) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useMeasurementStore = create<MeasurementState>((set, get) => ({
  measurements: [],
  loading: false,
  saving: false,
  error: null,

  fetchMeasurements: async () => {
    set({ loading: true, error: null });
    try {
      const data = await getMeasurements();
      set({ measurements: data, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load measurements",
      });
    }
  },

  saveMeasurement: async (payload) => {
    set({ saving: true, error: null });
    try {
      const created = await createMeasurement(payload);
      const data = await getMeasurements();
      set({ measurements: data, saving: false });
      return data.find((m) => m.id === created.id) ?? created;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save measurement",
      });
      return null;
    }
  },

  editMeasurement: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      await updateMeasurement(id, payload);
      const data = await getMeasurements();
      set({ measurements: data, saving: false });
      return data.find((m) => m.id === id) ?? null;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to update measurement",
      });
      return null;
    }
  },

  removeMeasurement: async (id) => {
    set({ saving: true, error: null });
    try {
      await deleteMeasurement(id);
      const data = await getMeasurements();
      set({ measurements: data, saving: false });
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to delete measurement",
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({ measurements: [], loading: false, saving: false, error: null }),
}));
