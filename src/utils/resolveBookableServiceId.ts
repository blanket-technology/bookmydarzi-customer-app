import type {
  CatalogCategoriesTreeResponse,
  CatalogCategory,
} from "../types/catalogApi";

function norm(value: string): string {
  return value.trim().toLowerCase();
}

function findInCategory(
  category: CatalogCategory,
  serviceName: string,
): number | null {
  const needle = norm(serviceName);
  if (!needle) return null;

  for (const direct of category.direct_services) {
    const name = norm(direct.name);
    if (name === needle || name.includes(needle) || needle.includes(name)) {
      if (direct.service_id > 0) return direct.service_id;
    }
  }

  for (const line of category.service_lines) {
    const lineName = norm(line.name);
    if (lineName === needle || lineName.includes(needle) || needle.includes(lineName)) {
      const first = line.stitching_types[0];
      if (first?.service_id > 0) return first.service_id;
    }

    for (const stitching of line.stitching_types) {
      const stName = norm(stitching.name);
      if (stName === needle || stName.includes(needle) || needle.includes(stName)) {
        if (stitching.service_id > 0) return stitching.service_id;
      }
    }
  }

  return null;
}

/** Resolve POST /cart/service-entry `service_id` from catalog tree by names. */
export function resolveBookableServiceIdFromCatalog(
  tree: CatalogCategoriesTreeResponse,
  categoryName: string,
  serviceName: string,
): number | null {
  const catNeedle = norm(categoryName);
  const category =
    tree.categories.find((c) => norm(c.name) === catNeedle) ??
    tree.categories.find(
      (c) =>
        norm(c.name).includes(catNeedle) || catNeedle.includes(norm(c.name)),
    );

  if (category) {
    const inCategory = findInCategory(category, serviceName);
    if (inCategory) return inCategory;
  }

  for (const cat of tree.categories) {
    const found = findInCategory(cat, serviceName);
    if (found) return found;
  }

  return null;
}
