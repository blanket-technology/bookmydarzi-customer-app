import { request } from "../../services/api";
import type {
  ApiBanner,
  ApiFeaturedTailor,
  ApiServiceCategory,
  ApiSpecialOffer,
  ApiSubCategory,
  HomeApiResponse,
  PopularServiceRow,
} from "../types/homeApi";

function normalizeSubCategory(raw: Record<string, unknown>): ApiSubCategory {
  return {
    Id: Number(
      raw.Id ??
        raw.id ??
        raw.sub_category_id ??
        raw.SubCategoryId ??
        0,
    ),
    Name: String(raw.Name ?? raw.name ?? ""),
    Description: (raw.Description ?? raw.description ?? null) as string | null,
    ImageUrl: (raw.ImageUrl ?? raw.image_url ?? raw.imageUrl ?? null) as
      | string
      | null,
    BasePrice: Number(raw.BasePrice ?? raw.base_price ?? raw.price_starting ?? 0),
    DisplayOrder: Number(raw.DisplayOrder ?? raw.display_order ?? 0),
  };
}

function normalizeServiceCategory(raw: Record<string, unknown>): ApiServiceCategory {
  const subsRaw =
    raw.SubCategories ??
    raw.sub_categories ??
    raw.subCategories ??
    raw.subcategories ??
    [];

  return {
    Id: Number(
      raw.Id ?? raw.id ?? raw.category_id ?? raw.CategoryId ?? 0,
    ),
    Name: String(raw.Name ?? raw.name ?? ""),
    Description: (raw.Description ?? raw.description ?? null) as string | null,
    ImageUrl: (raw.ImageUrl ?? raw.image_url ?? raw.imageUrl ?? null) as
      | string
      | null,
    ImageResizeMode: (raw.ImageResizeMode ?? raw.image_resize_mode ?? null) as
      | string
      | null,
    ImageObjectFit: (raw.ImageObjectFit ?? raw.image_object_fit ?? null) as
      | string
      | null,
    ImageShowFull: (raw.ImageShowFull ?? raw.image_show_full ?? undefined) as
      | boolean
      | undefined,
    DisplayOrder: Number(raw.DisplayOrder ?? raw.display_order ?? 0),
    SubCategories: Array.isArray(subsRaw)
      ? subsRaw.map((item) =>
          normalizeSubCategory(item as Record<string, unknown>),
        )
      : [],
  };
}

function normalizeHomeResponse(res: unknown): HomeApiResponse {
  const root = (res as { data?: unknown })?.data ?? res;
  const raw = (root ?? {}) as Record<string, unknown>;

  const bannersRaw = raw.banners ?? raw.Banners ?? [];
  const categoriesRaw =
    raw.service_categories ?? raw.ServiceCategories ?? raw.categories ?? [];
  const offersRaw = raw.special_offers ?? raw.SpecialOffers ?? raw.offers ?? [];
  const tailorsRaw =
    raw.featured_tailors ?? raw.FeaturedTailors ?? raw.tailors ?? [];

  return {
    banners: Array.isArray(bannersRaw)
      ? (bannersRaw as ApiBanner[])
      : [],
    service_categories: Array.isArray(categoriesRaw)
      ? categoriesRaw.map((item) =>
          normalizeServiceCategory(item as Record<string, unknown>),
        )
      : [],
    special_offers: Array.isArray(offersRaw)
      ? (offersRaw as ApiSpecialOffer[])
      : [],
    featured_tailors: Array.isArray(tailorsRaw)
      ? (tailorsRaw as ApiFeaturedTailor[])
      : [],
    cached: Boolean(raw.cached ?? raw.Cached ?? false),
  };
}

function extractServiceItems(res: unknown): Record<string, unknown>[] {
  if (Array.isArray(res)) return res as Record<string, unknown>[];
  const raw = (res as { data?: unknown })?.data ?? res;
  const r = (raw ?? {}) as Record<string, unknown>;
  if (Array.isArray(r.items)) return r.items as Record<string, unknown>[];
  if (Array.isArray(r.services)) return r.services as Record<string, unknown>[];
  if (Array.isArray(r.data)) return r.data as Record<string, unknown>[];
  if (Array.isArray(r.results)) return r.results as Record<string, unknown>[];
  return [];
}

function mapServiceItemToPopularRow(
  raw: Record<string, unknown>,
): PopularServiceRow | null {
  const title = String(
    raw.title ?? raw.Title ?? raw.name ?? raw.Name ?? "",
  ).trim();
  if (!title) return null;

  const categoryName = String(
    raw.category_name ??
      raw.CategoryName ??
      raw.category ??
      raw.Category ??
      "Services",
  ).trim();

  const bookableServiceId = Number(
    raw.service_id ?? raw.ServiceId ?? raw.bookable_service_id ?? 0,
  );

  const sub: ApiSubCategory = {
    Id: Number(raw.id ?? raw.Id ?? bookableServiceId ?? 0),
    Name: title,
    Description: String(raw.description ?? raw.Description ?? "").trim() || null,
    ImageUrl: (raw.image_url ?? raw.imageUrl ?? raw.ImageUrl ?? null) as
      | string
      | null,
    BasePrice: Number(
      raw.price_starting ??
        raw.base_price ??
        raw.BasePrice ??
        raw.starting_price ??
        0,
    ),
    DisplayOrder: Number(raw.display_order ?? raw.DisplayOrder ?? 0),
  };

  const category: ApiServiceCategory = {
    Id: Number(raw.category_id ?? raw.CategoryId ?? 0),
    Name: categoryName || "Services",
    Description: null,
    ImageUrl: null,
    DisplayOrder: 0,
    SubCategories: [],
  };

  return { sub, category, bookableServiceId };
}

export function buildPopularFromCategories(
  categories: ApiServiceCategory[],
): PopularServiceRow[] {
  const items: PopularServiceRow[] = [];
  for (const cat of categories) {
    for (const sub of cat.SubCategories ?? []) {
      if (!sub.Name?.trim()) continue;
      items.push({
        sub,
        category: cat,
        bookableServiceId: sub.Id > 0 ? sub.Id : 0,
      });
    }
  }
  items.sort((a, b) => (a.sub.DisplayOrder ?? 0) - (b.sub.DisplayOrder ?? 0));
  // Bug fix: no backend "popular" curation exists (/services?popular=true
  // isn't a real filter), so this fallback used to be a flat top-12 by
  // DisplayOrder across every category - Custom Alterations items were
  // routinely crowded out entirely if clothing categories sorted first.
  // Reserve a few slots so alteration services always appear here too.
  const alterations = items.filter((r) => r.category.Name === "Custom Alterations");
  const others = items.filter((r) => r.category.Name !== "Custom Alterations");
  const reserved = alterations.slice(0, 3);
  return [...others.slice(0, 12 - reserved.length), ...reserved];
}

/** GET /home - banners, categories, offers, tailors */
export async function fetchHomeData(): Promise<HomeApiResponse> {
  const res = await request<unknown>("/home", { skipAuth: true });
  const normalized = normalizeHomeResponse(res);

  const subCount = normalized.service_categories.reduce(
    (sum, cat) => sum + (cat.SubCategories?.length ?? 0),
    0,
  );
  return normalized;
}

/**
 * GET /services?popular=true (fallback: /services?limit=12)
 * Dedicated popular services feed for the Home screen.
 */
export async function fetchPopularServicesForHome(): Promise<PopularServiceRow[]> {
  let res = await request<unknown>("/services?popular=true", { skipAuth: true });
  let items = extractServiceItems(res);

  if (items.length === 0) {
    res = await request<unknown>("/services?limit=12", { skipAuth: true });
    items = extractServiceItems(res);
  }

  return items
    .map((item) => mapServiceItemToPopularRow(item))
    .filter((row): row is PopularServiceRow => row != null)
    .sort((a, b) => (a.sub.DisplayOrder ?? 0) - (b.sub.DisplayOrder ?? 0))
    .slice(0, 12);
}
