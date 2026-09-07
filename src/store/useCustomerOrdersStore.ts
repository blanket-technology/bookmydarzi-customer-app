import { create } from "zustand";
import {
  fetchActiveCustomerOrders,
  fetchCancelledCustomerOrders,
  fetchCompletedCustomerOrders,
} from "../services/customerOrderService";
import type { CustomerOrderListItem } from "../types/customerOrders";

/** Short TTL - order status changes often (pickup, stitching, delivery),
 * so this only exists to make revisiting the Orders tab instant (cached
 * data renders immediately) while still keeping data reasonably fresh via
 * a background silent refetch, not to avoid refetching altogether. */
const CACHE_TTL_MS = 60 * 1000;

// Small page size so each tab loads only a handful of orders at a time and
// paginates on scroll (proper pagination, not "load everything").
const PAGE_SIZE = 6;

interface CustomerOrdersState {
  activeOrders: CustomerOrderListItem[];
  completedOrders: CustomerOrderListItem[];
  cancelledOrders: CustomerOrderListItem[];
  loading: boolean;
  error: string | null;
  activeLastFetched: number | null;
  completedLastFetched: number | null;
  cancelledLastFetched: number | null;

  activePage: number;
  activeHasMore: boolean;
  completedPage: number;
  completedHasMore: boolean;
  cancelledPage: number;
  cancelledHasMore: boolean;

  loadActive: (forceRefresh?: boolean) => Promise<void>;
  loadCompleted: (forceRefresh?: boolean) => Promise<void>;
  loadCancelled: (forceRefresh?: boolean) => Promise<void>;
  loadMoreActive: () => Promise<void>;
  loadMoreCompleted: () => Promise<void>;
  loadMoreCancelled: () => Promise<void>;
  invalidateCache: () => void;
  clearError: () => void;
  reset: () => void;
}

export const useCustomerOrdersStore = create<CustomerOrdersState>((set, get) => ({
  activeOrders: [],
  completedOrders: [],
  cancelledOrders: [],
  loading: false,
  error: null,
  activeLastFetched: null,
  completedLastFetched: null,
  cancelledLastFetched: null,

  activePage: 1,
  activeHasMore: false,
  completedPage: 1,
  completedHasMore: false,
  cancelledPage: 1,
  cancelledHasMore: false,

  loadActive: async (forceRefresh = false) => {
    const { activeLastFetched, loading } = get();
    const isCacheValid =
      activeLastFetched !== null && Date.now() - activeLastFetched < CACHE_TTL_MS;
    if (isCacheValid && !forceRefresh) return;
    // A cache-hit view still renders instantly from existing state - only
    // show the loading flag (and thus the skeleton) when there's nothing
    // to show yet, so a background refresh never blanks the list.
    const silent = get().activeOrders.length > 0;
    if (!silent || forceRefresh) set({ loading: !silent, error: null });
    if (loading) return;
    try {
      // Page 1 uses the normal PAGE_SIZE (not the big MERGE_PAGE_SIZE) so the
      // Active tab loads fast even for customers with many orders; "load more"
      // paginates the rest. The delivered→Completed reclassification that needs
      // a large page only matters for the Completed tab (loadCompleted below).
      const data = await fetchActiveCustomerOrders({ limit: PAGE_SIZE });
      // Delivered orders are shown under Completed even though the
      // backend's own Active-list query still includes them (DELIVERED
      // only becomes COMPLETED via a separate step) - hide them here so
      // they don't appear in both tabs.
      const visible = data.items.filter((o) => o.status !== "delivered");
      set({
        activeOrders: visible,
        loading: false,
        activeLastFetched: Date.now(),
        activePage: 1,
        activeHasMore: data.total > data.items.length,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load orders",
      });
    }
  },

  loadCompleted: async (forceRefresh = false) => {
    const { completedLastFetched, loading } = get();
    const isCacheValid =
      completedLastFetched !== null && Date.now() - completedLastFetched < CACHE_TTL_MS;
    if (isCacheValid && !forceRefresh) return;
    const silent = get().completedOrders.length > 0;
    if (!silent || forceRefresh) set({ loading: !silent, error: null });
    if (loading) return;
    try {
      // Paginate the completed list normally (PAGE_SIZE per page). Separately
      // grab only the FIRST page of active to surface any orders stuck at
      // `delivered` (which the customer considers done) - a small edge-case
      // merge, not a reason to pull everything. Pagination is driven purely by
      // the completed endpoint's own total.
      const [completed, active] = await Promise.all([
        fetchCompletedCustomerOrders({ page: 1, limit: PAGE_SIZE }),
        fetchActiveCustomerOrders({ page: 1, limit: PAGE_SIZE }),
      ]);
      const delivered = active.items.filter((o) => o.status === "delivered");
      const merged = new Map<number, CustomerOrderListItem>();
      for (const o of [...completed.items, ...delivered]) merged.set(o.id, o);
      set({
        completedOrders: Array.from(merged.values()),
        loading: false,
        completedLastFetched: Date.now(),
        completedPage: 1,
        completedHasMore: completed.total > completed.items.length,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load orders",
      });
    }
  },

  loadCancelled: async (forceRefresh = false) => {
    const { cancelledLastFetched, loading } = get();
    const isCacheValid =
      cancelledLastFetched !== null && Date.now() - cancelledLastFetched < CACHE_TTL_MS;
    if (isCacheValid && !forceRefresh) return;
    const silent = get().cancelledOrders.length > 0;
    if (!silent || forceRefresh) set({ loading: !silent, error: null });
    if (loading) return;
    try {
      const data = await fetchCancelledCustomerOrders({ limit: PAGE_SIZE });
      set({
        cancelledOrders: data.items,
        loading: false,
        cancelledLastFetched: Date.now(),
        cancelledPage: 1,
        cancelledHasMore: data.total > data.items.length,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Failed to load orders",
      });
    }
  },

  loadMoreActive: async () => {
    // Gate on this list's own hasMore only - NOT the shared `loading` flag
    // (that drives the initial-load skeleton and would let one paginated call
    // block another, e.g. History loading completed + cancelled in parallel).
    const { activeHasMore, activePage, activeOrders } = get();
    if (!activeHasMore) return;
    const nextPage = activePage + 1;
    try {
      const data = await fetchActiveCustomerOrders({ page: nextPage, limit: PAGE_SIZE });
      const visible = data.items.filter((o) => o.status !== "delivered");
      const merged = new Map<number, CustomerOrderListItem>();
      for (const o of [...activeOrders, ...visible]) merged.set(o.id, o);
      set({
        activeOrders: Array.from(merged.values()),
        activePage: nextPage,
        activeHasMore: data.total > nextPage * data.limit,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load orders" });
    }
  },

  loadMoreCompleted: async () => {
    const { completedHasMore, completedPage, completedOrders } = get();
    if (!completedHasMore) return;
    const nextPage = completedPage + 1;
    try {
      const data = await fetchCompletedCustomerOrders({ page: nextPage, limit: PAGE_SIZE });
      const merged = new Map<number, CustomerOrderListItem>();
      for (const o of [...completedOrders, ...data.items]) merged.set(o.id, o);
      set({
        completedOrders: Array.from(merged.values()),
        completedPage: nextPage,
        completedHasMore: data.total > nextPage * data.limit,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load orders" });
    }
  },

  loadMoreCancelled: async () => {
    const { cancelledHasMore, cancelledPage, cancelledOrders } = get();
    if (!cancelledHasMore) return;
    const nextPage = cancelledPage + 1;
    try {
      const data = await fetchCancelledCustomerOrders({ page: nextPage, limit: PAGE_SIZE });
      const merged = new Map<number, CustomerOrderListItem>();
      for (const o of [...cancelledOrders, ...data.items]) merged.set(o.id, o);
      set({
        cancelledOrders: Array.from(merged.values()),
        cancelledPage: nextPage,
        cancelledHasMore: data.total > nextPage * data.limit,
      });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to load orders" });
    }
  },

  // Bust every tab's cache so the next load call always hits the backend -
  // call this after checkout, cancellation, or any action that changes an
  // order's data (see checkoutNavigation.ts / order-details.tsx).
  invalidateCache: () =>
    set({ activeLastFetched: null, completedLastFetched: null, cancelledLastFetched: null }),
  clearError: () => set({ error: null }),
  reset: () =>
    set({
      activeOrders: [],
      completedOrders: [],
      cancelledOrders: [],
      loading: false,
      error: null,
      activeLastFetched: null,
      completedLastFetched: null,
      cancelledLastFetched: null,
      activePage: 1,
      activeHasMore: false,
      completedPage: 1,
      completedHasMore: false,
      cancelledPage: 1,
      cancelledHasMore: false,
    }),
}));
