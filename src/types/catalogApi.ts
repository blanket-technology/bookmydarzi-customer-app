// ============================================================================
// GET /catalog/categories/tree
// ============================================================================

export interface CatalogStitchingType {
  service_id: number;
  name: string;
  description?: string | null;
  base_price: number;
  display_order: number;
  service_line_id: number;
  service_line_name: string;
  category_id: number;
  category_name: string;
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
  display_order: number;
  service_line_id: number | null;
  service_line_name: string | null;
  category_id: number;
  category_name: string;
  image_url: string | null;
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
