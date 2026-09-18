// ============================================================================
// GET /catalog/categories/tree
// ============================================================================

export interface CatalogStitchingType {
  service_id: number;
  name: string;
  description?: string | null;
  base_price: number;
  estimated_delivery_days: number;
  display_order: number;
  is_premium: boolean;
  is_active: boolean;
  image_url?: string | null;
  highlights: string[];
  service_line_id: number;
  service_line_name: string;
  category_id: number;
  category_name: string;
  /** Admin-set Repair/Resize/Restyle grouping, only meaningful for a
   * Custom Alterations tier. Null if not yet explicitly assigned - callers
   * fall back to keyword classification on the tier name in that case
   * (see services/alterationGroups.ts's classifyByKeyword()). */
  alteration_group?: "repair" | "resize" | "restyle" | null;
}

export interface CatalogServiceLine {
  id: number;
  name: string;
  description?: string | null;
  display_order: number;
  image_url: string | null;
  starting_price: number;
  stitching_types: CatalogStitchingType[];
}

export interface CatalogDirectService {
  service_id: number;
  name: string;
  description?: string | null;
  base_price: number;
  estimated_delivery_days: number;
  display_order: number;
  is_premium: boolean;
  is_active: boolean;
  image_url: string | null;
  highlights: string[];
  service_line_id: number | null;
  service_line_name: string | null;
  category_id: number;
  category_name: string;
}

export interface CatalogCategory {
  id: number;
  name: string;
  description: string | null;
  image_url: string | null;
  display_order: number;
  service_lines: CatalogServiceLine[];
  direct_services: CatalogDirectService[];
}

export interface CatalogCategoriesTreeResponse {
  categories: CatalogCategory[];
}

// ============================================================================
// GET /catalog/services/{service_id}/addons
// ============================================================================

/** Optional per-service extra (e.g. Button Replacement, Shoulder Adjustment
 * for a shirt repair) - mirrors ServiceAddonResponse in
 * app/schemas/service_catalog.py. Selecting one folds its price additively
 * into the service's price at checkout (see SelectedAddon in
 * src/types/cart.ts). */
export interface ServiceAddon {
  id: number;
  service_id: number;
  name: string;
  description?: string | null;
  price: number;
  display_order: number;
  is_active: boolean;
}
