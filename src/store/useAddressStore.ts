import { create } from "zustand";
import type { ApiAddress, AddressPayload } from "../types/api";
import {
  getAddresses,
  createAddress,
  updateAddress,
  deleteAddress,
} from "../services/addressService";

interface AddressState {
  addresses: ApiAddress[];
  loading: boolean;
  saving: boolean;
  error: string | null;

  fetchAddresses: () => Promise<void>;
  saveAddress: (payload: AddressPayload) => Promise<ApiAddress | null>;
  editAddress: (id: number, payload: Partial<AddressPayload>) => Promise<ApiAddress | null>;
  removeAddress: (id: number) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useAddressStore = create<AddressState>((set, get) => ({
  addresses: [],
  loading: false,
  saving: false,
  error: null,

  fetchAddresses: async () => {
    set({ loading: true, error: null });
    try {
      const data = await getAddresses();
      set({ addresses: data, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load addresses",
      });
    }
  },

  saveAddress: async (payload) => {
    set({ saving: true, error: null });
    try {
      const created = await createAddress(payload);
      const data = await getAddresses();
      set({ addresses: data, saving: false });
      return data.find((a) => a.id === created.id) ?? created;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to save address",
      });
      return null;
    }
  },

  editAddress: async (id, payload) => {
    set({ saving: true, error: null });
    try {
      await updateAddress(id, payload);
      const data = await getAddresses();
      set({ addresses: data, saving: false });
      return data.find((a) => a.id === id) ?? null;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to update address",
      });
      return null;
    }
  },

  removeAddress: async (id) => {
    set({ saving: true, error: null });
    try {
      await deleteAddress(id);
      const data = await getAddresses();
      set({ addresses: data, saving: false });
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to delete address",
      });
      throw err;
    }
  },

  clearError: () => set({ error: null }),
  reset: () => set({ addresses: [], loading: false, saving: false, error: null }),
}));
