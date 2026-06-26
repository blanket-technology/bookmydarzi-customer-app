import type { Service, Tailor, SearchFilters, SearchResults } from "../types";
import { SERVICES_DATA } from "../data/services";
import { TAILORS_DATA } from "../data/tailors";
import { mockRequest } from "./_mockHelper";

/**
 * Search services and tailors by query + optional filters.
 * Real API: GET /search?q=query&category=...&priceMin=...
 */
export async function searchServices(
  query: string,
  filters?: SearchFilters
): Promise<SearchResults> {
  return mockRequest(() => {
    const q = query.toLowerCase().trim();

    let filteredServices: Service[] = SERVICES_DATA;
    let filteredTailors: Tailor[] = TAILORS_DATA;

    if (q.length > 0) {
      filteredServices = SERVICES_DATA.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          s.description.toLowerCase().includes(q) ||
          s.category.toLowerCase().includes(q)
      );
      filteredTailors = TAILORS_DATA.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.specialty.toLowerCase().includes(q)
      );
    }

    if (filters) {
      if (filters.category && filters.category !== "all") {
        filteredServices = filteredServices.filter((s) => s.category === filters.category);
      }
      if (filters.priceMin !== undefined) {
        filteredServices = filteredServices.filter(
          (s) => s.price_starting >= (filters.priceMin ?? 0)
        );
      }
      if (filters.priceMax !== undefined) {
        filteredServices = filteredServices.filter(
          (s) => s.price_starting <= (filters.priceMax ?? Infinity)
        );
      }
      if (filters.rating !== undefined) {
        filteredTailors = filteredTailors.filter(
          (t) => t.rating >= (filters.rating ?? 0)
        );
      }
      if (filters.onlineOnly) {
        filteredTailors = filteredTailors.filter((t) => t.online === true);
      }
    }

    return { services: filteredServices, tailors: filteredTailors, query, filters: filters ?? {} };
  }, { delay: 300 });
}

/**
 * Get popular/featured services for home screen.
 * Real API: GET /services?popular=true
 */
export async function getPopularServices(): Promise<Service[]> {
  return mockRequest(
    () => SERVICES_DATA.filter((s) => s.popular === true),
    { delay: 200 }
  );
}

/**
 * Get featured tailors for home screen.
 * Real API: GET /tailors?featured=true&limit=5
 */
export async function getFeaturedTailors(): Promise<Tailor[]> {
  return mockRequest(
    () => TAILORS_DATA.filter((t) => t.badge !== undefined),
    { delay: 200 }
  );
}

/**
 * Get all services.
 * Real API: GET /services
 */
export async function getAllServices(): Promise<Service[]> {
  return mockRequest(() => [...SERVICES_DATA], { delay: 300 });
}
