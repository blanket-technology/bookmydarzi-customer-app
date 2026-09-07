// ============================================================================
// Types that exactly match the GET /home API response
// ============================================================================

export interface ApiBanner {
  Id: number;
  Title: string;
  Subtitle: string;
  ImageUrl: string | null;
  RedirectUrl: string;
  DisplayOrder: number;
}

export interface ApiSubCategory {
  Id: number;
  Name: string;
  Description: string | null;
  ImageUrl: string | null;
  BasePrice: number;
  DisplayOrder: number;
}

export interface ApiServiceCategory {
  Id: number;
  Name: string;
  Description: string | null;
  ImageUrl: string | null;
  ImageResizeMode?: string | null;
  ImageObjectFit?: string | null;
  ImageShowFull?: boolean;
  DisplayOrder: number;
  SubCategories: ApiSubCategory[];
}

export interface ApiSpecialOffer {
  Id: number;
  Title: string;
  Description: string;
  // Mirrors app/schemas/home_admin.py OfferListItem — DiscountType selects
  // which of the two amount fields is meaningful (checkout_service.py's
  // is_flat/is_percentage checks the same way). Both are always present in
  // the response; only the one matching DiscountType is > 0.
  DiscountType?: "percentage" | "flat";
  DiscountPercent: number;
  DiscountAmount?: number | null;
  ImageUrl: string | null;
  ValidFrom?: string | null;
  ValidUntil: string;
}

export interface ApiFeaturedTailor {
  tailor_id: number;
  user_id: number;
  name: string;
  profile_image: string | null;
  specialization: string;
  experience: number;
  rating: number;
  location: string;
  bio: string;
  is_available: boolean;
  is_featured: boolean;
  portfolio_images: string[];
}

export interface HomeApiResponse {
  banners: ApiBanner[];
  service_categories: ApiServiceCategory[];
  special_offers: ApiSpecialOffer[];
  featured_tailors: ApiFeaturedTailor[];
  cached: boolean;
}

/** One card in the Home "Popular Services" horizontal list */
export interface PopularServiceRow {
  sub: ApiSubCategory;
  category: ApiServiceCategory;
  /** Bookable service id for POST /cart/service-entry (from /services API) */
  bookableServiceId: number;
}
