import { request } from "../../services/api";
import { generateIdempotencyKey } from "../utils/idempotencyKey";

import type { AddressPayload, AddressType, ApiAddress } from "../types/api";



const BASE = "/users/addresses";



const VALID_ADDRESS_TYPES: AddressType[] = ["home", "work", "other"];



/** Normalize any API/UI value to home | work | other (lowercase). */

export function toApiAddressTypeValue(type: unknown): AddressType {

  const s = String(type ?? "home").trim().toLowerCase();

  if (s === "work") return "work";

  if (s === "other") return "other";

  return "home";

}



/**

 * Build request body for POST/PATCH /users/addresses.

 * GET responses use lowercase address_type (e.g. "home", "work", "other").

 */

function toApiAddressBody(

  payload: AddressPayload | Partial<AddressPayload>

): Record<string, unknown> {

  const { address_type, ...fields } = payload;

  const body: Record<string, unknown> = { ...fields };



  if (address_type !== undefined && address_type !== null) {

    const apiType = toApiAddressTypeValue(address_type);

    body.address_type = apiType;

    // Some backends bind PascalCase field name with the same lowercase enum values

    body.AddressType = apiType;

  }



  return body;

}



function extractList(res: any): any[] {

  if (Array.isArray(res)) return res;

  if (Array.isArray(res?.addresses)) return res.addresses;

  if (Array.isArray(res?.data)) return res.data;

  return [];

}



function mapAddress(raw: any): ApiAddress {

  return {

    id: raw?.Id ?? raw?.id ?? 0,

    user_id: raw?.UserId ?? raw?.user_id ?? 0,

    full_name: raw?.FullName ?? raw?.full_name ?? "",

    mobile: raw?.Mobile ?? raw?.mobile ?? "",

    address_line_1: raw?.AddressLine1 ?? raw?.address_line_1 ?? "",

    address_line_2: raw?.AddressLine2 ?? raw?.address_line_2 ?? "",

    city: raw?.City ?? raw?.city ?? "",

    state: raw?.State ?? raw?.state ?? "",

    pincode: raw?.Pincode ?? raw?.pincode ?? "",

    landmark: raw?.Landmark ?? raw?.landmark ?? "",

    address_type: toApiAddressTypeValue(

      raw?.AddressType ?? raw?.address_type ?? raw?.type

    ),

    is_default: raw?.IsDefault ?? raw?.is_default ?? false,

    created_at: raw?.CreatedAt ?? raw?.created_at ?? "",

    updated_at: raw?.UpdatedAt ?? raw?.updated_at ?? "",

  };

}



export async function getAddresses(): Promise<ApiAddress[]> {

  const res = await request<any>(BASE);

  return extractList(res).map(mapAddress);

}



export async function getAddressById(id: number): Promise<ApiAddress> {

  const res = await request<any>(`${BASE}/${id}`);

  return mapAddress(res?.data ?? res);

}



export async function createAddress(payload: AddressPayload): Promise<ApiAddress> {

  const res = await request<any>(BASE, {

    method: "POST",

    body: toApiAddressBody(payload),

    idempotencyKey: generateIdempotencyKey(),

  });

  return mapAddress(res?.data ?? res);

}



export async function updateAddress(

  id: number,

  payload: Partial<AddressPayload>

): Promise<ApiAddress> {

  const res = await request<any>(`${BASE}/${id}`, {

    method: "PATCH",

    body: toApiAddressBody(payload),

  });

  return mapAddress(res?.data ?? res);

}



export async function deleteAddress(id: number): Promise<void> {

  await request(`${BASE}/${id}`, { method: "DELETE" });

}



export function isValidAddressType(type: unknown): type is AddressType {

  return VALID_ADDRESS_TYPES.includes(type as AddressType);

}


