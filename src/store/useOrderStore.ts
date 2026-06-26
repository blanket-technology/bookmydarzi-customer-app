import { create } from "zustand";
import type { ApiOrder, CreateOrderApiPayload } from "../types/api";
import { getOrders, getOrderById, createOrder, cancelOrder } from "../services/orderService";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface OrderState {
  orders: ApiOrder[];
  selectedOrder: ApiOrder | null;
  loading: boolean;
  error: string | null;
  lastFetched: number | null;

  fetchOrders: (userId: string, forceRefresh?: boolean) => Promise<void>;
  fetchOrderById: (orderId: string) => Promise<void>;
  placeOrder: (payload: CreateOrderApiPayload) => Promise<ApiOrder | null>;
  cancelOrder: (orderId: string) => Promise<void>;
  clearError: () => void;
  invalidateCache: () => void;
  reset: () => void;
}

export const useOrderStore = create<OrderState>((set, get) => ({
  orders: [],
  selectedOrder: null,
  loading: false,
  error: null,
  lastFetched: null,

  fetchOrders: async (userId, forceRefresh = false) => {
    const { lastFetched, loading } = get();
    const isCacheValid = lastFetched !== null && Date.now() - lastFetched < CACHE_TTL_MS;
    if (isCacheValid && !forceRefresh) return;
    if (loading) return;

    set({ loading: true, error: null });
    try {
      const orders = await getOrders(userId);
      set({ orders, loading: false, lastFetched: Date.now() });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load orders",
      });
    }
  },

  fetchOrderById: async (orderId) => {
    set({ loading: true, error: null });
    try {
      const order = await getOrderById(orderId);
      set({ selectedOrder: order, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load order",
      });
    }
  },

  placeOrder: async (payload) => {
    set({ loading: true, error: null });
    try {
      const newOrder = await createOrder(payload);
      set((state) => ({ orders: [newOrder, ...state.orders], loading: false }));
      return newOrder;
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to create order",
      });
      return null;
    }
  },

  cancelOrder: async (orderId) => {
    // Optimistic update
    const prevOrders = get().orders;
    set((state) => ({
      orders: state.orders.map((o) =>
        String(o.id) === orderId ? { ...o, status: "cancelled" as const } : o
      ),
    }));
    try {
      await cancelOrder(orderId);
    } catch (err) {
      // Rollback on failure
      set({
        orders: prevOrders,
        error: err instanceof Error ? err.message : "Failed to cancel order",
      });
    }
  },

  clearError: () => set({ error: null }),
  // Bust the cache so the next fetchOrders call always hits the backend.
  // Call this after placing an order so the Orders tab shows it immediately.
  invalidateCache: () => set({ lastFetched: null }),
  reset: () => set({ orders: [], selectedOrder: null, loading: false, error: null, lastFetched: null }),
}));
