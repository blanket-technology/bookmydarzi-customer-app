/**
 * Wishlist / Favourites API - /api/v1/wishlist/*
 * Supports both service and tailor favourites.
 */

import { request } from "../../services/api";
import type {
  WishlistAddPayload,
  WishlistCheckResult,
  WishlistItem,
  WishlistItemType,
} from "../types/engagement";

const BASE = "/wishlist";

function unwrap(res: any): any {
  return res?.data ?? res;
}

function mapItem(raw: any): WishlistItem {
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    item_type: (raw?.item_type ?? raw?.ItemType ?? "service") as WishlistItemType,
    service_id: raw?.service_id ?? raw?.ServiceId ?? null,
    tailor_id: raw?.tailor_id ?? raw?.TailorId ?? null,
    name: raw?.name ?? raw?.Name ?? null,
    image_url: raw?.image_url ?? raw?.ImageUrl ?? null,
    price: raw?.price ?? raw?.Price ?? null,
    created_at: String(raw?.created_at ?? raw?.CreatedAt ?? ""),
  };
}

/** GET /wishlist - optionally filter by item_type */
export async function getWishlist(itemType?: WishlistItemType): Promise<WishlistItem[]> {
  const query = itemType ? `?item_type=${itemType}` : "";
  const res = await request<any>(`${BASE}${query}`);
  const data = unwrap(res);
  const list = Array.isArray(data?.items) ? data.items : Array.isArray(data) ? data : [];
  return list.map(mapItem);
}

/** POST /wishlist - add a service or tailor */
export async function addToWishlist(payload: WishlistAddPayload): Promise<WishlistItem> {
  const res = await request<any>(BASE, { method: "POST", body: { ...payload } });
  return mapItem(unwrap(res));
}

/** GET /wishlist/check - is a given service/tailor wishlisted? */
export async function checkWishlist(
  itemType: WishlistItemType,
  ids: { serviceId?: number; tailorId?: number },
): Promise<WishlistCheckResult> {
  let query = `?item_type=${encodeURIComponent(itemType)}`;
  if (ids.serviceId != null) query += `&service_id=${ids.serviceId}`;
  if (ids.tailorId != null) query += `&tailor_id=${ids.tailorId}`;
  const res = await request<any>(`${BASE}/check${query}`);
  const data = unwrap(res);
  return {
    is_wishlisted: Boolean(data?.is_wishlisted ?? false),
    wishlist_id: data?.wishlist_id ?? null,
  };
}

/** DELETE /wishlist/{id} */
export async function removeFromWishlist(wishlistId: number): Promise<void> {
  await request(`${BASE}/${wishlistId}`, { method: "DELETE" });
}
