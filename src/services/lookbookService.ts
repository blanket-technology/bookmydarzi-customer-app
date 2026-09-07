import { request } from "../../services/api";

export interface LookbookItem {
  id: number;
  title: string | null;
  image_url: string;
  category_tag: string | null;
  caption: string | null;
  display_order: number;
  service_id: number | null;
}

export interface LookbookResponse {
  items: LookbookItem[];
}

export async function fetchLookbook(category?: string): Promise<LookbookItem[]> {
  const url = category
    ? `/lookbook?category=${encodeURIComponent(category)}`
    : "/lookbook";
  const res = await request<LookbookResponse | LookbookItem[]>(url, { skipAuth: true });
  if (Array.isArray(res)) return res;
  return (res as LookbookResponse).items ?? [];
}

export const LOOKBOOK_CATEGORIES: { key: string; label: string }[] = [
  { key: "all", label: "All" },
  { key: "mens", label: "Men's" },
  { key: "womens", label: "Women's" },
  { key: "kids", label: "Kids" },
  { key: "wedding", label: "Wedding" },
  { key: "alterations", label: "Alterations" },
];
