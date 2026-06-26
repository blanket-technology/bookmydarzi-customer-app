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



    set({ loading: true, error: null });



    try {

      const [data, popularFromApi] = await Promise.all([

        fetchHomeData(),

        fetchPopularServicesForHome(),

      ]);



      const banners = data.banners ?? [];

      const serviceCategories = data.service_categories ?? [];

      const specialOffers = data.special_offers ?? [];

      const featuredTailors = data.featured_tailors ?? [];



      const popularFromHome = buildPopularFromCategories(serviceCategories);

      const popularBase =
        popularFromApi.length > 0 ? popularFromApi : popularFromHome;
      const popularServices = await enrichPopularServicesWithCatalog(popularBase);



      console.log(

        `[HomeStore] loaded — banners=${banners.length} categories=${serviceCategories.length} popularApi=${popularFromApi.length} popularHome=${popularFromHome.length} popularFinal=${popularServices.length}`,

      );



      if (popularServices.length === 0) {

        console.warn(

          "[HomeStore] popularServices is empty — Popular Services section will be hidden",

        );

      }



      set({

        banners,

        serviceCategories,

        popularServices,

        specialOffers,

        featuredTailors,

        loading: false,

        lastFetched: Date.now(),

      });

    } catch (err: unknown) {

      set({

        loading: false,

        error:

          err instanceof Error

            ? err.message

            : "Failed to load home data. Please try again.",

      });

    }

  },



  clearError: () => set({ error: null }),

}));


