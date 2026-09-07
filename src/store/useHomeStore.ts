import { create } from "zustand";

import {

  buildPopularFromCategories,

  fetchHomeData,

  fetchPopularServicesForHome,

} from "../services/homeService";

import { enrichPopularServicesWithCatalog } from "../utils/enrichPopularServices";

import type {

  ApiBanner,

  ApiFeaturedTailor,

  ApiServiceCategory,

  ApiSpecialOffer,

  PopularServiceRow,

} from "../types/homeApi";



const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes



interface HomeState {

  // ── Data ──────────────────────────────────────────────────────────────────

  banners: ApiBanner[];

  serviceCategories: ApiServiceCategory[];

  popularServices: PopularServiceRow[];

  specialOffers: ApiSpecialOffer[];

  featuredTailors: ApiFeaturedTailor[];



  // ── Async state ───────────────────────────────────────────────────────────

  loading: boolean;

  // True while popularServices is still being enriched with catalog IDs.
  // Kept separate from `loading` so the rest of the homepage (banners,
  // categories, offers, tailors) can render as soon as it lands instead of
  // waiting on this extra chained request.
  popularLoading: boolean;

  error: string | null;

  lastFetched: number | null;



  // ── Actions ───────────────────────────────────────────────────────────────

  loadHomeData: (forceRefresh?: boolean) => Promise<void>;

  clearError: () => void;

}



export const useHomeStore = create<HomeState>((set, get) => ({

  banners: [],

  serviceCategories: [],

  popularServices: [],

  specialOffers: [],

  featuredTailors: [],

  loading: false,

  popularLoading: false,

  error: null,

  lastFetched: null,



  loadHomeData: async (forceRefresh = false) => {

    const { lastFetched, loading } = get();

    const isCacheValid =

      lastFetched !== null && Date.now() - lastFetched < CACHE_TTL_MS;



    // Skip if cache is fresh and not forced

    if (isCacheValid && !forceRefresh) return;

    // Skip if already loading

    if (loading) return;



    set({ loading: true, popularLoading: true, error: null });



    // Fire every top-level fetch in parallel - previously the catalog-tree
    // lookup used for popular-service enrichment was chained *after*
    // fetchHomeData/fetchPopularServicesForHome resolved, and nothing on the
    // page (including sections unrelated to popular services) could render
    // until all three requests had completed in sequence.
    const homeDataPromise = fetchHomeData();
    const popularApiPromise = fetchPopularServicesForHome();

    try {
      const data = await homeDataPromise;

      const banners = data.banners ?? [];
      const serviceCategories = data.service_categories ?? [];
      const specialOffers = data.special_offers ?? [];
      const featuredTailors = data.featured_tailors ?? [];

      // Commit the primary sections immediately so the homepage renders
      // without waiting on popular-services enrichment.
      set({
        banners,
        serviceCategories,
        specialOffers,
        featuredTailors,
        loading: false,
        lastFetched: Date.now(),
      });

      const popularFromHome = buildPopularFromCategories(serviceCategories);

      popularApiPromise
        .then(async (popularFromApi) => {
          const popularBase =
            popularFromApi.length > 0 ? popularFromApi : popularFromHome;
          const popularServices = await enrichPopularServicesWithCatalog(popularBase);
          set({ popularServices, popularLoading: false });
        })
        .catch(() => {
          // Popular services are non-critical for the rest of the page -
          // fall back to the categories-derived list instead of erroring.
          set({ popularServices: popularFromHome, popularLoading: false });
        });

    } catch (err: unknown) {

      set({

        loading: false,

        popularLoading: false,

        error:

          err instanceof Error

            ? err.message

            : "Failed to load home data. Please try again.",

      });

    }

  },



  clearError: () => set({ error: null }),

}));


