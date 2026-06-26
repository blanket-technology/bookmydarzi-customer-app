import { fetchCatalogTree } from "../services/catalogService";
import type { PopularServiceRow } from "../types/homeApi";
import { resolveBookableServiceIdFromCatalog } from "./resolveBookableServiceId";

/** Fill missing `bookableServiceId` on home popular rows via catalog tree lookup. */
export async function enrichPopularServicesWithCatalog(
  rows: PopularServiceRow[],
): Promise<PopularServiceRow[]> {
  const needsLookup = rows.some((r) => !r.bookableServiceId || r.bookableServiceId <= 0);
  if (!needsLookup) return rows;

  try {
    const tree = await fetchCatalogTree();
    return rows.map((row) => {
      if (row.bookableServiceId > 0) return row;
      const resolved = resolveBookableServiceIdFromCatalog(
        tree,
        row.category.Name,
        row.sub.Name,
      );
      if (!resolved) return row;
      return { ...row, bookableServiceId: resolved };
    });
  } catch {
    return rows;
  }
}
