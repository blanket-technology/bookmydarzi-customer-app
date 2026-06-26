import type { ApiAddress } from "../types/api";

export function formatAddressSummary(addr: ApiAddress): string {
  const parts = [
    addr.address_line_1,
    addr.address_line_2,
    addr.landmark,
    addr.city,
    addr.state,
    addr.pincode,
  ].filter((p) => p != null && String(p).trim().length > 0);
  return parts.join(", ");
}

export function getDefaultAddress(addresses: ApiAddress[]): ApiAddress | null {
  if (!addresses.length) return null;
  const explicit = addresses.find((a) => a.is_default);
  if (explicit) return explicit;
  const sorted = [...addresses].sort((a, b) => {
    const ta = String(a.updated_at || a.created_at || "");
    const tb = String(b.updated_at || b.created_at || "");
    return tb.localeCompare(ta);
  });
  return sorted[0] ?? null;
}

export function formatHomeHeaderLocation(addr: ApiAddress | null): string | null {
  if (!addr) return null;
  const parts = [
    addr.address_line_1?.trim(),
    (addr.address_line_2?.trim() || addr.landmark?.trim()) ?? "",
    addr.city?.trim(),
  ].filter((p) => p && p.length > 0);
  return parts.length > 0 ? parts.join(", ") : null;
}

export function getAddressDisplayText(
  addresses: ApiAddress[],
  profileAddress?: string | null
): string {
  const saved = getDefaultAddress(addresses);
  if (saved) return formatAddressSummary(saved);
  const trimmed = profileAddress?.trim();
  return trimmed && trimmed.length > 0 ? trimmed : "Not set";
}
