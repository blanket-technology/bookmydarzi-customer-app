/**
 * Cart store - API cart + booking flow state.
 *
 * Booking flow (pre-cart):
 *   Service line → stitching type → add to cart → cart tab
 * (Measurement is never collected from the customer - it's filled later by
 * Bridge/employee at pickup, or by Admin.)
 *
 * API cart:
 *   GET/POST /cart, service entries, checkout
 */
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  addCartServiceEntry as addCartServiceEntryApi,
  checkoutCart as checkoutCartApi,
  createCart,
  deleteCartServiceEntry,
  fetchCart,
  updateCartServiceEntry,
} from "../services/cartService";
import { useToastStore } from "./useToastStore";
import { EMPTY_CART } from "../types/cart";
import type {
  AddCartServiceEntryPayload,
  ApiCart,
  CartBilling,
  CartCheckoutPayload,
  CartCheckoutResult,
  CartServiceEntry,
  SelectedAddon,
  StitchingPreferences,
} from "../types/cart";

export interface PendingCartItem {
  bookableServiceId: number;
  serviceLineId?: number;
  serviceLineName: string;
  stitchingType?: string;
  categoryId: number;
  categoryName: string;
  basePrice: number;
  displayName: string;
  imageUrl?: string | null;
  tailorId?: number;
  tailorName?: string;
  /** Client-only quantity selected before add-to-cart */
  quantity?: number;
  /** Designer design brief - only collected when stitchingType is Designer. */
  stitchingPreferences?: StitchingPreferences;
  /** Extras selected on the service detail screen (e.g. Button Replacement)
   * before add-to-cart/book-now - see AddonPicker. */
  addons?: SelectedAddon[];
  /** Other tiers checked under "Add more work to this garment" before Book
   * Now - each becomes its own line on the same direct order as
   * bookableServiceId, via POST /orders/direct's multi-item `items`. Name/
   * price are carried here purely for display on the order summary screen
   * (the actual charge is always recomputed server-side from service_id). */
  extraItems?: { serviceId: number; name: string; basePrice: number }[];
}

interface CartState {
  cartId: number | null;
  status: string;
  address: unknown | null;
  entries: CartServiceEntry[];
  billing: CartBilling;
  itemCount: number;
  loading: boolean;
  mutating: boolean;
  error: string | null;
  initialized: boolean;

  /** Service being configured before add-to-cart */
  pendingService: PendingCartItem | null;
  pendingRoute: string | null;
  pendingRouteParams: Record<string, string> | null;
  selectedAddressId: number | null;
  checkoutFlow: boolean;
  pickupType: "instant" | "scheduled";
  /** Service Details → Address booking path */
  bookingFlowActive: boolean;

  /** True when the user tapped "Order Now" (quantity=1 direct flow, bypasses cart) */
  buyNowMode: boolean;
  setBuyNowMode: (v: boolean) => void;
  clearBuyNowMode: () => void;

  /** Applied offer (selected by user on cart screen) - discountType/Value
   * drive the CLIENT-SIDE display estimate only; checkout sends just
   * offer_id and the backend recomputes the real discount authoritatively
   * (see checkout_service.py's is_flat/is_percentage branch), so this can
   * never desync into an incorrect charge even if the estimate is stale. */
  appliedOfferId: number | null;
  appliedOfferDiscountType: "percentage" | "flat";
  appliedOfferDiscountValue: number;
  appliedOfferTitle: string;
  /** Mirrors the backend's own clamp/cap (checkout_service.py) so the
   * cart screen's discount estimate never promises more than checkout will
   * actually grant - see CouponSection.tsx's AppliedOffer for the same
   * fields on the Book Now path. */
  appliedOfferMaxDiscountAmount: number | null;
  appliedOfferMinOrderValue: number;
  setAppliedOffer: (
    id: number,
    discountType: "percentage" | "flat",
    discountValue: number,
    title: string,
    maxDiscountAmount?: number | null,
    minOrderValue?: number,
  ) => void;
  clearAppliedOffer: () => void;

  applyCart: (cart: ApiCart) => void;
  clearCartState: () => void;
  ensureCart: () => Promise<number>;
  refreshCart: (options?: {
    silent?: boolean;
    allowCreate?: boolean;
  }) => Promise<void>;
  initializeCart: () => Promise<void>;
  addServiceEntry: (
    payload: AddCartServiceEntryPayload,
    options?: { toastMessage?: string | null },
  ) => Promise<void>;
  updateEntryQuantity: (entryId: number, quantity: number) => Promise<void>;
  removeEntry: (entryId: number) => Promise<void>;
  checkout: (payload: CartCheckoutPayload) => Promise<CartCheckoutResult>;

  setPendingService: (item: PendingCartItem) => void;
  clearPendingService: () => void;
  setPendingRoute: (route: string, params?: Record<string, string>) => void;
  clearPendingRoute: () => void;
  setAddressId: (id: number) => void;
  setCheckoutFlow: (active: boolean) => void;
  setPickupType: (type: "instant" | "scheduled") => void;
  setBookingFlowActive: (active: boolean) => void;
  resetBookingFlow: () => void;
}

function applyCartToState(cart: ApiCart): Partial<CartState> {
  return {
    cartId: cart.id || null,
    status: cart.status,
    address: cart.address,
    entries: cart.entries,
    billing: cart.billing,
    itemCount: cart.itemCount,
    error: null,
  };
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      cartId: null,
      status: "",
      address: null,
      entries: [],
      billing: EMPTY_CART.billing,
      itemCount: 0,
      loading: false,
      mutating: false,
      error: null,
      initialized: false,

      pendingService: null,
      pendingRoute: null,
      pendingRouteParams: null,
      selectedAddressId: null,
      checkoutFlow: false,
      pickupType: "instant",
      bookingFlowActive: false,
      buyNowMode: false,
      appliedOfferId: null,
      appliedOfferDiscountType: "percentage",
      appliedOfferDiscountValue: 0,
      appliedOfferTitle: "",
      appliedOfferMaxDiscountAmount: null,
      appliedOfferMinOrderValue: 0,

      setAppliedOffer: (id, discountType, discountValue, title, maxDiscountAmount = null, minOrderValue = 0) =>
        set({
          appliedOfferId: id,
          appliedOfferDiscountType: discountType,
          appliedOfferDiscountValue: discountValue,
          appliedOfferTitle: title,
          appliedOfferMaxDiscountAmount: maxDiscountAmount,
          appliedOfferMinOrderValue: minOrderValue,
        }),
      clearAppliedOffer: () =>
        set({
          appliedOfferId: null,
          appliedOfferDiscountType: "percentage",
          appliedOfferDiscountValue: 0,
          appliedOfferTitle: "",
          appliedOfferMaxDiscountAmount: null,
          appliedOfferMinOrderValue: 0,
        }),

      applyCart: (cart) => set(applyCartToState(cart)),

      clearCartState: () =>
        set({
          cartId: null,
          status: "",
          address: null,
          entries: [],
          billing: EMPTY_CART.billing,
          itemCount: 0,
          error: null,
          initialized: false,
          appliedOfferId: null,
          appliedOfferDiscountType: "percentage",
          appliedOfferDiscountValue: 0,
          appliedOfferTitle: "",
          appliedOfferMaxDiscountAmount: null,
          appliedOfferMinOrderValue: 0,
        }),

      ensureCart: async () => {
        try {
          const cart = await fetchCart();
          if (cart?.id) {
            set({ ...applyCartToState(cart), initialized: true });
            return cart.id;
          }
        } catch {
          // fall through to create
        }

        set({ cartId: null });
        const created = await createCart();
        set({ ...applyCartToState(created), initialized: true });
        return created.id;
      },

      refreshCart: async (options) => {
        const silent = options?.silent ?? false;
        const allowCreate = options?.allowCreate ?? false;

        if (!silent) {
          set({ loading: true, error: null });
        }

        try {
          const cart = await fetchCart();
          if (cart) {
            set({
              ...applyCartToState(cart),
              loading: false,
              initialized: true,
            });
            return;
          }

          if (allowCreate) {
            const created = await createCart();
            set({
              ...applyCartToState(created),
              loading: false,
              initialized: true,
            });
            return;
          }

          set({
            entries: [],
            itemCount: 0,
            billing: EMPTY_CART.billing,
            cartId: null,
            status: "",
            address: null,
            loading: false,
            error: null,
            initialized: true,
          });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to load cart.";
          set({ loading: false, error: message });
          throw err;
        }
      },

      initializeCart: async () => {
        if (get().loading) return;
        try {
          await get().refreshCart({ allowCreate: true });
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Failed to initialize cart.";
          set({ loading: false, error: message, initialized: true });
        }
      },

      addServiceEntry: async (payload, options) => {
        set({ mutating: true, error: null });
        try {
          await get().ensureCart();
          const cart = await addCartServiceEntryApi(payload);
          // Apply the add-entry response immediately so the item is visible.
          set({ ...applyCartToState(cart), mutating: false });
          // Await a silent re-fetch so billing totals are always up to date
          // even if a network hiccup caused the add response to carry a stale
          // TotalAmount from the backend.
          await get()
            .refreshCart({ silent: true, allowCreate: false })
            .catch(() => {});
          if (options?.toastMessage !== null) {
            useToastStore
              .getState()
              .show(options?.toastMessage ?? "Added to Cart");
          }
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Could not add to cart.";
          set({ mutating: false, error: message });
          throw new Error(message);
        }
      },

      updateEntryQuantity: async (entryId, quantity) => {
        const prev = get().entries;
        const optimistic = prev.map((e) =>
          e.id === entryId
            ? {
                ...e,
                quantity,
                lineTotal: e.unitPrice * quantity,
              }
            : e,
        );
        const itemCount = optimistic.reduce((s, e) => s + e.quantity, 0);
        set({
          entries: optimistic,
          itemCount,
          mutating: true,
          error: null,
        });

        try {
          const cart = await updateCartServiceEntry(entryId, { quantity });
          set({ ...applyCartToState(cart), mutating: false });
          void get()
            .refreshCart({ silent: true, allowCreate: false })
            .catch(() => {});
        } catch (err) {
          set({
            entries: prev,
            itemCount: prev.reduce((s, e) => s + e.quantity, 0),
            mutating: false,
          });
          const message =
            err instanceof Error ? err.message : "Failed to update quantity.";
          set({ error: message });
          throw new Error(message);
        }
      },

      removeEntry: async (entryId) => {
        const prev = get().entries;
        const optimistic = prev.filter((e) => e.id !== entryId);
        const itemCount = optimistic.reduce((s, e) => s + e.quantity, 0);
        set({ entries: optimistic, itemCount, mutating: true, error: null });

        try {
          const cart = await deleteCartServiceEntry(entryId);
          set({ ...applyCartToState(cart), mutating: false });
          void get()
            .refreshCart({ silent: true, allowCreate: false })
            .catch(() => {});
          useToastStore.getState().show("Item removed");
        } catch (err) {
          set({
            entries: prev,
            itemCount: prev.reduce((s, e) => s + e.quantity, 0),
            mutating: false,
          });
          const message =
            err instanceof Error ? err.message : "Failed to remove item.";
          set({ error: message });
          throw new Error(message);
        }
      },

      checkout: async (payload) => {
        set({ mutating: true, error: null });
        try {
          const result = await checkoutCartApi(payload);
          set({
            ...applyCartToState(EMPTY_CART),
            mutating: false,
            pendingService: null,
            checkoutFlow: false,
            selectedAddressId: null,
            appliedOfferId: null,
            appliedOfferDiscountType: "percentage",
            appliedOfferDiscountValue: 0,
            appliedOfferTitle: "",
            appliedOfferMaxDiscountAmount: null,
            appliedOfferMinOrderValue: 0,
          });
          void get()
            .refreshCart({ silent: true, allowCreate: true })
            .catch(() => {});
          return result;
        } catch (err) {
          const message =
            err instanceof Error ? err.message : "Checkout failed.";
          set({ mutating: false, error: message });
          throw new Error(message);
        }
      },

      setBuyNowMode: (v) => set({ buyNowMode: v }),
      clearBuyNowMode: () => set({ buyNowMode: false }),

      setPendingService: (item) => set({ pendingService: item }),
      clearPendingService: () => set({ pendingService: null }),
      setPendingRoute: (route, params = {}) =>
        set({ pendingRoute: route, pendingRouteParams: params }),
      clearPendingRoute: () =>
        set({ pendingRoute: null, pendingRouteParams: null }),
      setAddressId: (id) => set({ selectedAddressId: id }),
      setCheckoutFlow: (active) => set({ checkoutFlow: active }),
      setPickupType: (type) => set({ pickupType: type }),
      setBookingFlowActive: (active) => set({ bookingFlowActive: active }),
      resetBookingFlow: () =>
        set({
          pendingService: null,
          pendingRoute: null,
          pendingRouteParams: null,
          selectedAddressId: null,
          checkoutFlow: false,
          pickupType: "instant",
          bookingFlowActive: false,
          buyNowMode: false,
        }),
    }),
    {
      name: "cart-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        cartId: state.cartId,
      }),
    },
  ),
);