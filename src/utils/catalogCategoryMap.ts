import {
  fetchCatalogTree,
  findCatalogCategoryByName,
} from "../services/catalogService";
import type { CatalogCategory } from "../types/catalogApi";
import type { ApiServiceCategory } from "../types/homeApi";

function normName(value: string): string {
  return value.trim().toLowerCase();
}

function readSlug(record: {
  slug?: string | null;
  Slug?: string | null;
}): string {
  return String(record.slug ?? record.Slug ?? "").trim();
}

function recordMatchesNeedle(
  needle: string,
  record: {
    name?: string;
    Name?: string;
    slug?: string | null;
    Slug?: string | null;
  },
): boolean {
  const n = normName(needle);
  if (!n) return false;

  const slug = normName(readSlug(record));
  if (slug && slug === n) return true;

  const name = normName(String(record.name ?? record.Name ?? ""));
  if (name && name === n) return true;

  return false;
}

function matchCategoryRecord(
  categoryName: string,
  record: {
    id?: number;
    Id?: number;
    name?: string;
    Name?: string;
    slug?: string | null;
    Slug?: string | null;
  },
): number {
  const id = Number(record.id ?? record.Id ?? 0);
  if (id <= 0) return 0;
  if (recordMatchesNeedle(categoryName, record)) return id;
  return 0;
}

/** Resolve from home API categories (id, name, optional slug). */
export function resolveCatalogCategoryIdFromHomeCategories(
  categoryName: string,
  categories: ApiServiceCategory[],
): number {
  const needle = categoryName.trim();
  if (!needle) return 0;

  for (const cat of categories) {
    const id = matchCategoryRecord(needle, cat);
    if (id > 0) return id;
  }

  return 0;
}

/** Resolve from catalog tree categories (id, name). */
export function resolveCatalogCategoryIdFromCatalogCategories(
  categoryName: string,
  categories: CatalogCategory[],
): number {
  const needle = categoryName.trim();
  if (!needle) return 0;

  const found = findCatalogCategoryByName({ categories }, needle);
  if (found) return found.id;

  for (const cat of categories) {
    const id = matchCategoryRecord(needle, cat);
    if (id > 0) return id;
  }

  return 0;
}

/**
 * Resolve catalog category id from home categories, then catalog tree API.
 * Returns 0 when not found (never uses hardcoded fallback IDs).
 */
export async function resolveCatalogCategoryId(
  categoryName: string,
  homeCategories: ApiServiceCategory[] = [],
): Promise<number> {
  const needle = categoryName.trim();
  if (!needle) return 0;

  const fromHome = resolveCatalogCategoryIdFromHomeCategories(
    needle,
    homeCategories,
  );
  if (fromHome > 0) {
    console.log(`[catalogCategoryMap] ${needle} | ${fromHome} | Success`);
    return fromHome;
  }

  try {
    const tree = await fetchCatalogTree();
    const fromTree = resolveCatalogCategoryIdFromCatalogCategories(
      needle,
      tree.categories,
    );
    if (fromTree > 0) {
      console.log(`[catalogCategoryMap] ${needle} | ${fromTree} | Success`);
      return fromTree;
    }
  } catch (err) {
    console.warn(
      `[catalogCategoryMap] catalog tree lookup failed for "${needle}":`,
      err instanceof Error ? err.message : err,
    );
  }

  console.warn(`[catalogCategoryMap] category not found: "${needle}"`);
  console.log(`[catalogCategoryMap] ${needle} | 0 | Failed`);
  return 0;
}
