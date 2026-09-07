import { request } from "../../services/api";
import type {
    CatalogCategoriesTreeResponse,
    CatalogCategory,
    CatalogDirectService,
    CatalogServiceLine,
    CatalogStitchingType,
} from "../types/catalogApi";
import { extractImageUrlFromRecord } from "../utils/serviceImage";

function mapStitchingType(raw: Record<string, unknown>): CatalogStitchingType {
  return {
    service_id: Number(raw.service_id ?? raw.ServiceId ?? 0),
    name: String(raw.name ?? raw.Name ?? ""),
    description: (raw.description ?? raw.Description ?? null) as string | null,
    base_price: Number(raw.base_price ?? raw.BasePrice ?? 0),
    estimated_delivery_days: Number(raw.estimated_delivery_days ?? raw.EstimatedDeliveryDays ?? 0),
    display_order: Number(raw.display_order ?? raw.DisplayOrder ?? 0),
    is_premium: Boolean(raw.is_premium ?? raw.IsPremium ?? false),
    is_active: Boolean(raw.is_active ?? raw.IsActive ?? true),
    image_url: extractImageUrlFromRecord(raw),
    highlights: Array.isArray(raw.highlights ?? raw.Highlights) ? (raw.highlights ?? raw.Highlights) as string[] : [],
    service_line_id: Number(raw.service_line_id ?? raw.ServiceLineId ?? 0),
    service_line_name: String(raw.service_line_name ?? raw.ServiceLineName ?? ""),
    category_id: Number(raw.category_id ?? raw.CategoryId ?? 0),
    category_name: String(raw.category_name ?? raw.CategoryName ?? ""),
  };
}

function mapServiceLine(raw: Record<string, unknown>): CatalogServiceLine {
  const stitchingRaw = raw.stitching_types ?? raw.StitchingTypes ?? [];
  const desc = raw.description ?? raw.Description ?? null;
  return {
    id: Number(raw.id ?? raw.Id ?? 0),
    name: String(raw.name ?? raw.Name ?? ""),
    description: typeof desc === "string" && desc.trim() ? desc.trim() : null,
    display_order: Number(raw.display_order ?? raw.DisplayOrder ?? 0),
    image_url: extractImageUrlFromRecord(raw),
    starting_price: Number(raw.starting_price ?? raw.StartingPrice ?? 0),
    stitching_types: Array.isArray(stitchingRaw)
      ? stitchingRaw.map((item) =>
          mapStitchingType(item as Record<string, unknown>),
        )
      : [],
  };
}

function mapDirectService(raw: Record<string, unknown>): CatalogDirectService {
  return {
    service_id: Number(raw.service_id ?? raw.ServiceId ?? 0),
    name: String(raw.name ?? raw.Name ?? ""),
    description: (raw.description ?? raw.Description ?? null) as string | null,
    base_price: Number(raw.base_price ?? raw.BasePrice ?? 0),
    estimated_delivery_days: Number(raw.estimated_delivery_days ?? raw.EstimatedDeliveryDays ?? 0),
    display_order: Number(raw.display_order ?? raw.DisplayOrder ?? 0),
    is_premium: Boolean(raw.is_premium ?? raw.IsPremium ?? false),
    is_active: Boolean(raw.is_active ?? raw.IsActive ?? true),
    highlights: Array.isArray(raw.highlights ?? raw.Highlights) ? (raw.highlights ?? raw.Highlights) as string[] : [],
    service_line_id:
      raw.service_line_id != null || raw.ServiceLineId != null
        ? Number(raw.service_line_id ?? raw.ServiceLineId)
        : null,
    service_line_name:
      (raw.service_line_name ?? raw.ServiceLineName ?? null) as string | null,
    category_id: Number(raw.category_id ?? raw.CategoryId ?? 0),
    category_name: String(raw.category_name ?? raw.CategoryName ?? ""),
    image_url: extractImageUrlFromRecord(raw),
  };
}

function mapCategory(raw: Record<string, unknown>): CatalogCategory {
  const linesRaw = raw.service_lines ?? raw.ServiceLines ?? [];
  const directRaw = raw.direct_services ?? raw.DirectServices ?? [];

  return {
    id: Number(raw.id ?? raw.Id ?? 0),
    name: String(raw.name ?? raw.Name ?? ""),
    description: (raw.description ?? raw.Description ?? null) as string | null,
    image_url: extractImageUrlFromRecord(raw),
    display_order: Number(raw.display_order ?? raw.DisplayOrder ?? 0),
    service_lines: Array.isArray(linesRaw)
      ? linesRaw.map((item) => mapServiceLine(item as Record<string, unknown>))
      : [],
    direct_services: Array.isArray(directRaw)
      ? directRaw.map((item) =>
          mapDirectService(item as Record<string, unknown>),
        )
      : [],
  };
}

function extractCategoriesRaw(res: unknown): unknown[] {
  if (Array.isArray(res)) return res;

  const root = res as Record<string, unknown> | null | undefined;
  if (!root || typeof root !== "object") return [];

  const data = root.data;
  if (Array.isArray(data)) return data;

  if (data && typeof data === "object") {
    const nested = data as Record<string, unknown>;
    if (Array.isArray(nested.items)) return nested.items;
    if (Array.isArray(nested.data)) return nested.data;
    if (Array.isArray(nested.categories)) return nested.categories;
    if (Array.isArray(nested.Categories)) return nested.Categories;
  }

  if (Array.isArray(root.items)) return root.items;
  if (Array.isArray(root.categories)) return root.categories;
  if (Array.isArray(root.Categories)) return root.Categories;

  return [];
}

function mapCategoriesFromRaw(categoriesRaw: unknown[]): CatalogCategory[] {
  return categoriesRaw.map((item) => mapCategory(item as Record<string, unknown>));
}

let _catalogTreeCache: CatalogCategoriesTreeResponse | null = null;
let _catalogTreePromise: Promise<CatalogCategoriesTreeResponse> | null = null;

/** GET /catalog/categories/tree - in-memory cached (catalog is static per session) */
export async function fetchCatalogTree(): Promise<CatalogCategoriesTreeResponse> {
  if (_catalogTreeCache) return _catalogTreeCache;
  if (_catalogTreePromise) return _catalogTreePromise;

  _catalogTreePromise = request<unknown>("/catalog/categories/tree", { skipAuth: true })
    .then((res) => {
      const categoriesRaw = extractCategoriesRaw(res);
      const categories = mapCategoriesFromRaw(categoriesRaw);
      _catalogTreeCache = { categories };
      _catalogTreePromise = null;
      return _catalogTreeCache;
    })
    .catch((err) => {
      _catalogTreePromise = null;
      throw err;
    });

  return _catalogTreePromise;
}

/** GET /catalog/categories/{categoryId} (fallback when tree lookup is empty) */
export async function fetchCatalogSubcategories(
  categoryId: number,
): Promise<CatalogCategory | null> {
  if (categoryId <= 0) return null;

  try {
    const res = await request<unknown>(
      `/catalog/categories/${categoryId}`,
      { skipAuth: true },
    );
    const itemsRaw = extractCategoriesRaw(res);
    if (itemsRaw.length === 0) {
      const single = (res as Record<string, unknown>)?.data ?? res;
      if (single && typeof single === "object" && !Array.isArray(single)) {
        return mapCategory(single as Record<string, unknown>);
      }
      return null;
    }

    const first = itemsRaw[0];
    if (first && typeof first === "object") {
      const record = first as Record<string, unknown>;
      if (record.service_lines != null || record.ServiceLines != null) {
        return mapCategory(record);
      }
    }

    return {
      id: categoryId,
      name: "",
      description: null,
      image_url: null,
      display_order: 0,
      service_lines: itemsRaw.map((item) => mapServiceLine(item as Record<string, unknown>)),
      direct_services: [],
    };
  } catch {
    return null;
  }
}

export function findCatalogCategory(
  tree: CatalogCategoriesTreeResponse,
  catalogCategoryId: number,
): CatalogCategory | undefined {
  if (catalogCategoryId <= 0) return undefined;
  return tree.categories.find((c) => c.id === catalogCategoryId);
}

export function findCatalogCategoryByName(
  tree: CatalogCategoriesTreeResponse,
  categoryName: string,
): CatalogCategory | undefined {
  const needle = normName(categoryName);
  if (!needle) return undefined;

  return (
    tree.categories.find((c) => normName(c.name) === needle) ??
    tree.categories.find((c) => {
      const name = normName(c.name);
      return name.includes(needle) || needle.includes(name);
    })
  );
}

/** Resolve category by id first, then by display name. */
export function resolveCatalogCategory(
  tree: CatalogCategoriesTreeResponse,
  catalogCategoryId: number,
  categoryName: string,
): CatalogCategory | undefined {
  const byId = findCatalogCategory(tree, catalogCategoryId);
  if (byId) return byId;

  const byName = findCatalogCategoryByName(tree, categoryName);
  if (byName) return byName;

  return undefined;
}

export function findServiceLine(
  category: CatalogCategory,
  serviceLineId: number,
): CatalogServiceLine | undefined {
  return category.service_lines.find((line) => line.id === serviceLineId);
}

function normName(value: string): string {
  return value.trim().toLowerCase();
}

export function findServiceLineByName(
  category: CatalogCategory,
  serviceName: string,
): CatalogServiceLine | undefined {
  const needle = normName(serviceName);
  if (!needle) return undefined;

  return category.service_lines.find((line) => {
    const name = normName(line.name);
    return name === needle || name.includes(needle) || needle.includes(name);
  });
}

export function findDirectServiceByName(
  category: CatalogCategory,
  serviceName: string,
): CatalogDirectService | undefined {
  const needle = normName(serviceName);
  if (!needle) return undefined;

  return category.direct_services.find((service) => {
    const name = normName(service.name);
    return name === needle || name.includes(needle) || needle.includes(name);
  });
}

export interface ServiceReview {
  rating: number;
  comment: string | null;
  created_at: string | null;
}

export interface ServiceRatings {
  service_id: number;
  avg_rating: number;
  total_reviews: number;
  star_counts: Record<string, number>;
  recent_reviews: ServiceReview[];
}

export async function fetchServiceRatings(serviceId: number): Promise<ServiceRatings | null> {
  if (serviceId <= 0) return null;
  try {
    return await request<ServiceRatings>(`/catalog/services/${serviceId}/ratings`, {
      skipAuth: true,
    });
  } catch {
    return null;
  }
}

export interface CatalogServiceLookup {
  serviceLineName: string;
  stitchingTypeName: string | null;
}

/** Resolve display names for a bookable service_id from the catalog tree. */
export function lookupCatalogServiceById(
  tree: CatalogCategoriesTreeResponse,
  serviceId: number,
): CatalogServiceLookup | null {
  if (serviceId <= 0) return null;

  for (const category of tree.categories) {
    for (const line of category.service_lines) {
      for (const stitching of line.stitching_types) {
        if (stitching.service_id !== serviceId) continue;
        return {
          serviceLineName:
            stitching.service_line_name.trim() || line.name.trim() || stitching.name,
          stitchingTypeName: stitching.name.trim() || null,
        };
      }
    }

    for (const direct of category.direct_services) {
      if (direct.service_id !== serviceId) continue;
      return {
        serviceLineName:
          (direct.service_line_name ?? "").trim() || direct.name.trim() || "Service",
        stitchingTypeName: null,
      };
    }
  }

  return null;
}

export interface ServiceNavParams {
  catalogCategoryId: string;
  categoryName: string;
  serviceName: string;
  serviceLineId: string;
  bookableServiceId: string;
  basePrice: string;
  imageUrl: string;
  description: string;
}

/**
 * Resolves a bare service_id (e.g. from a lookbook photo tagged with the
 * garment it shows) into the exact route params /service-details expects -
 * the same shape sub-services.tsx's navigateToDetail() builds when a
 * customer taps a stitching type from the browse flow, so a lookbook photo
 * lands on an identically-configured booking screen instead of a bespoke
 * one-off. Returns null if the id doesn't match anything in the current
 * catalog (deleted/deactivated service, stale tag, etc.) - callers should
 * treat that as "can't book this photo" rather than erroring.
 */
export function resolveServiceNavParams(
  tree: CatalogCategoriesTreeResponse,
  serviceId: number,
): ServiceNavParams | null {
  if (serviceId <= 0) return null;

  for (const category of tree.categories) {
    for (const line of category.service_lines) {
      for (const stitching of line.stitching_types) {
        if (stitching.service_id !== serviceId) continue;
        return {
          catalogCategoryId: String(category.id),
          categoryName: category.name,
          serviceName: line.name,
          serviceLineId: String(line.id),
          bookableServiceId: String(stitching.service_id),
          basePrice: String(stitching.base_price),
          imageUrl: stitching.image_url ?? line.image_url ?? "",
          description: stitching.description ?? line.description ?? "",
        };
      }
    }

    for (const direct of category.direct_services) {
      if (direct.service_id !== serviceId) continue;
      return {
        catalogCategoryId: String(category.id),
        categoryName: category.name,
        serviceName: direct.name,
        serviceLineId: String(direct.service_line_id ?? 0),
        bookableServiceId: String(direct.service_id),
        basePrice: String(direct.base_price),
        imageUrl: direct.image_url ?? "",
        description: direct.description ?? "",
      };
    }
  }

  return null;
}
