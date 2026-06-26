import { resolveApiOrigin } from "../config/api";
import type { CatalogDirectService, CatalogServiceLine } from "../types/catalogApi";

/** Read image URL from any common API field name on a raw or mapped record. */
export function extractImageUrlFromRecord(
  raw: Record<string, unknown> | null | undefined,
): string | null {
  if (!raw || typeof raw !== "object") return null;

  const media = raw.media;
  const mediaUrl =
    media && typeof media === "object" && !Array.isArray(media)
      ? (media as Record<string, unknown>).url ??
        (media as Record<string, unknown>).image_url ??
        (media as Record<string, unknown>).imageUrl
      : null;

  const candidate =
    raw.image_url ??
    raw.ImageUrl ??
    raw.imageUrl ??
    raw.image ??
    raw.thumbnail ??
    raw.thumbnailUrl ??
    raw.thumbnail_url ??
    raw.icon ??
    raw.service_image ??
    raw.serviceImage ??
    raw.service_image_url ??
    raw.banner ??
    mediaUrl;

  if (typeof candidate !== "string") return null;
  const trimmed = candidate.trim();
  return trimmed || null;
}

/** Resolve relative paths (e.g. `/uploads/foo.jpg`) to absolute API URLs. */
export function normalizeServiceImageUrl(
  url: string | null | undefined,
): string | null {
  if (!url || typeof url !== "string") return null;
  const trimmed = url.trim();
  if (!trimmed || trimmed.includes("example.com")) return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;

  const origin = resolveApiOrigin();
  return trimmed.startsWith("/") ? `${origin}${trimmed}` : `${origin}/${trimmed}`;
}

export function isValidServiceImageUrl(
  url: string | null | undefined,
): url is string {
  return Boolean(normalizeServiceImageUrl(url));
}

export function resolveServiceLineImageUrl(
  line: CatalogServiceLine | null | undefined,
): string | null {
  if (!line) return null;
  return normalizeServiceImageUrl(line.image_url);
}

export function resolveDirectServiceImageUrl(
  service: CatalogDirectService | null | undefined,
): string | null {
  if (!service) return null;
  return normalizeServiceImageUrl(service.image_url);
}

export function resolveCatalogListItemImageUrl(item: {
  imageUrl?: string | null;
  line?: CatalogServiceLine;
  direct?: CatalogDirectService;
}): string | null {
  const fromItem = normalizeServiceImageUrl(item.imageUrl);
  if (fromItem) return fromItem;

  const fromLine = resolveServiceLineImageUrl(item.line);
  if (fromLine) return fromLine;

  return resolveDirectServiceImageUrl(item.direct);
}
