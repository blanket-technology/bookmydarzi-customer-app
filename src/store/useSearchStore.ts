import { create } from "zustand";
import type { Service, Tailor, SearchFilters } from "../types";
import {
  searchServices,
  getPopularServices,
  getFeaturedTailors,
  getAllServices,
} from "../services/searchService";

const CACHE_TTL_MS = 5 * 60 * 1000;

interface SearchState {
  query: string;
  filters: SearchFilters;
  resultServices: Service[];
  resultTailors: Tailor[];
  popularServices: Service[];
  featuredTailors: Service[];
  allServices: Service[];
  hasSearched: boolean;
  loading: boolean;
  homeLoading: boolean;
  error: string | null;
  lastFetched: number | null;

  setQuery: (query: string) => void;
  search: (query: string, filters?: SearchFilters) => Promise<void>;
  clearSearch: () => void;
  loadHomeData: (forceRefresh?: boolean) => Promise<void>;
  clearError: () => void;
}

export const useSearchStore = create<SearchState>((set, get) => ({
  query: "",
  filters: {},
  resultServices: [],
  resultTailors: [],
  popularServices: [],
  featuredTailors: [],
  allServices: [],
  hasSearched: false,
  loading: false,
  homeLoading: false,
  error: null,
  lastFetched: null,

  setQuery: (query) => set({ query }),

  search: async (query, filters) => {
    set({ loading: true, error: null, query });
    try {
      const results = await searchServices(query, filters ?? get().filters);
      set({
        resultServices: results.services,
        resultTailors: results.tailors,
        loading: false,
        hasSearched: true,
      });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : "Search failed",
      });
    }
  },

  clearSearch: () =>
    set({
      query: "",
      filters: {},
      resultServices: [],
      resultTailors: [],
      hasSearched: false,
      error: null,
    }),

  loadHomeData: async (forceRefresh = false) => {
    const { lastFetched } = get();
    const isCacheValid = lastFetched !== null && Date.now() - lastFetched < CACHE_TTL_MS;
    if (isCacheValid && !forceRefresh) return;

    set({ homeLoading: true, error: null });
    try {
      const [popular, featured, all] = await Promise.all([
        getPopularServices(),
        getFeaturedTailors(),
        getAllServices(),
      ]);
      set({
        popularServices: popular,
        featuredTailors: featured as any,
        allServices: all,
        homeLoading: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      set({
        homeLoading: false,
        error: err instanceof Error ? err.message : "Failed to load home data",
      });
    }
  },

  clearError: () => set({ error: null }),
}));
