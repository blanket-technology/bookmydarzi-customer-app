import { create } from "zustand";
import type { WishlistAddPayload, WishlistItem, WishlistItemType } from "../types/engagement";
import {
  addToWishlist,
  getWishlist,
  removeFromWishlist,
} from "../services/wishlistService";

interface WishlistState {
  items: WishlistItem[];
  loading: boolean;
  saving: boolean;
  error: string | null;
  lastFetched: number | null;

  fetchWishlist: (itemType?: WishlistItemType, forceRefresh?: boolean) => Promise<void>;
  add: (payload: WishlistAddPayload) => Promise<WishlistItem | null>;
  remove: (wishlistId: number) => Promise<void>;
  /** Add or remove depending on current state; returns the new wishlisted state */
  toggle: (payload: WishlistAddPayload) => Promise<boolean>;
  isWishlisted: (itemType: WishlistItemType, id: number) => WishlistItem | undefined;
  clearError: () => void;
  reset: () => void;
}

const CACHE_TTL_MS = 2 * 60 * 1000;

export const useWishlistStore = create<WishlistState>((set, get) => ({
  items: [],
  loading: false,
  saving: false,
  error: null,
  lastFetched: null,

  fetchWishlist: async (itemType, forceRefresh = false) => {
    const { lastFetched, loading } = get();
    const cacheValid = lastFetched !== null && Date.now() - lastFetched < CACHE_TTL_MS;
    if (cacheValid && !forceRefresh && !itemType) return;
    if (loading) return;

    set({ loading: true, error: null });
    try {
      const items = await getWishlist(itemType);
      set({ items, loading: false, lastFetched: Date.now() });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load wishlist",
      });
    }
  },

  add: async (payload) => {
    set({ saving: true, error: null });
    try {
      const item = await addToWishlist(payload);
      set((state) => ({ items: [item, ...state.items], saving: false }));
      return item;
    } catch (err) {
      set({
        saving: false,
        error: err instanceof Error ? err.message : "Failed to add to wishlist",
      });
      return null;
    }
  },

  remove: async (wishlistId) => {
    const prev = get().items;
    set({ items: prev.filter((i) => i.id !== wishlistId) });
    try {
      await removeFromWishlist(wishlistId);
    } catch (err) {
      set({
        items: prev,
        error: err instanceof Error ? err.message : "Failed to remove from wishlist",
      });
      throw err;
    }
  },

  toggle: async (payload) => {
    const targetId = payload.item_type === "service" ? payload.service_id : payload.tailor_id;
    const existing =
      targetId != null ? get().isWishlisted(payload.item_type, targetId) : undefined;
    if (existing) {
      await get().remove(existing.id);
      return false;
    }
    const added = await get().add(payload);
    return added != null;
  },

  isWishlisted: (itemType, id) =>
    get().items.find(
      (i) =>
        i.item_type === itemType &&
        (itemType === "service" ? i.service_id === id : i.tailor_id === id),
    ),

  clearError: () => set({ error: null }),
  reset: () => set({ items: [], loading: false, saving: false, error: null, lastFetched: null }),
}));
