import { resolveApiOrigin } from "../config/api";

/** Resolve relative profile image paths from GET /users/profile. */
export function normalizeProfileImageUrl(
  url: string | null | undefined,
): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const origin = resolveApiOrigin();
  return trimmed.startsWith("/") ? `${origin}${trimmed}` : `${origin}/${trimmed}`;
}
