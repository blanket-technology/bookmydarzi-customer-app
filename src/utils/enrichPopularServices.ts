import { fetchCatalogTree } from "../services/catalogService";
import type { PopularServiceRow } from "../types/homeApi";
import { resolveBookableServiceIdFromCatalog } from "./resolveBookableServiceId";

/**
 * Resolve correct bookableServiceId (ServiceSubCategory.Id) for all popular rows
 * via catalog tree lookup. Always runs because home API sub-categories for
 * service-line categories send ServiceLine.Id - not ServiceSubCategory.Id.
 */
export async function enrichPopularServicesWithCatalog(
  rows: PopularServiceRow[],
): Promise<PopularServiceRow[]> {
  if (rows.length === 0) return rows;

  try {
    const tree = await fetchCatalogTree();
    return rows.map((row) => {
      const resolved = resolveBookableServiceIdFromCatalog(
        tree,
        row.category.Name,
        row.sub.Name,
      );
      if (!resolved || resolved <= 0) return row;
      return { ...row, bookableServiceId: resolved };
    });
  } catch {
    return rows;
  }
}
