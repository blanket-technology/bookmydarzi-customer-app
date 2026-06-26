import type { Router } from "expo-router";
import type { ApiServiceCategory, PopularServiceRow } from "../types/homeApi";
import { resolveCatalogCategoryId } from "./catalogCategoryMap";
import { safeRouterPush } from "./safeNavigation";

export async function buildServiceDetailsParams(
  row: PopularServiceRow,
  homeCategories: ApiServiceCategory[] = [],
): Promise<Record<string, string>> {
  let catalogCategoryId = row.category.Id;
  if (!catalogCategoryId) {
    catalogCategoryId = await resolveCatalogCategoryId(
      row.category.Name,
      homeCategories,
    );
  }

  return {
    catalogCategoryId: String(catalogCategoryId),
    categoryName: row.category.Name,
    serviceName: row.sub.Name,
    subCategoryId: String(row.sub.Id),
    basePrice: String(row.sub.BasePrice),
    description: (row.sub.Description ?? row.category.Description ?? "").trim(),
    imageUrl: row.sub.ImageUrl?.trim() ?? "",
    bookableServiceId: String(row.bookableServiceId ?? 0),
  };
}

export async function navigateToServiceDetails(
  router: Router,
  row: PopularServiceRow,
  homeCategories: ApiServiceCategory[] = [],
): Promise<void> {
  const params = await buildServiceDetailsParams(row, homeCategories);
  safeRouterPush(router, {
    pathname: "/service-details",
    params,
  } as never);
}
