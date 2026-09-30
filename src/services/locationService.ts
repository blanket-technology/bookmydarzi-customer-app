/**
 * Location helpers - GPS capture, reverse-geocode, serviceability check.
 *
 * Geocode priority (most accurate first):
 *  1. Backend proxy  → /location/reverse-geocode  (Mapbox server-side + DB cache, free)
 *  2. expo-location native geocoder (Google on Android, Apple Maps on iOS) - fallback
 *  3. Nominatim (OSM) - last resort if backend is unreachable
 */
import * as Location from "expo-location";
import { buildApiV1Url } from "../config/api";
import { request } from "../../services/api";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface GpsCoords {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface ReverseGeocodeResult {
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export interface ServiceabilityResult {
  serviceable: boolean;
  // Serviceable branch: the covered area the point falls inside.
  city: string | null;
  // Unserviceable branch: the nearest area we DO cover (see the backend's
  // ServiceabilityResponseSchema - this used to be silently dropped by a
  // schema/field-name mismatch, now fixed).
  nearest_city?: string | null;
  distance_km: number | null;
  estimated_pickup_hours: number | null;
  message: string;
}

// ---------------------------------------------------------------------------
// Permission
// ---------------------------------------------------------------------------

export async function requestLocationPermission(): Promise<boolean> {
  const { status: existing } = await Location.getForegroundPermissionsAsync();
  if (existing === "granted") return true;
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === "granted";
}

// ---------------------------------------------------------------------------
// GPS - with timeout + accuracy fallback
// ---------------------------------------------------------------------------

const GPS_BEST_TIMEOUT_MS = 12_000;
const GPS_HIGH_TIMEOUT_MS = 10_000;
const GPS_BALANCED_TIMEOUT_MS = 8_000;

// Accuracy.High (4) is NOT the best expo-location can request - Highest (5)
// and BestForNavigation (6) exist above it and are what actually forces the
// device to use its real GPS chip for a precise (~3-10m) fix under open sky,
// instead of accepting a fast network/WiFi-triangulated position (~100-500m,
// which resolves to "the general area" - e.g. the correct neighbourhood but
// the wrong building - exactly the "shows Mamura, not my exact spot" symptom).
// BestForNavigation is the strongest signal but can fail/be unsupported on
// some devices, so it's tried first and true GPS-grade accuracy still comes
// from the Highest fallback beneath it - Balanced is only a last resort.
function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

export async function getCurrentGpsCoords(): Promise<GpsCoords> {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error(
      "Location permission denied.\n" +
        "Go to: Settings → Apps → BookMyDarzi → Permissions → Location → Allow.",
    );
  }

  try {
    const loc = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation }),
      GPS_BEST_TIMEOUT_MS,
      "Best-for-navigation GPS",
    );
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const isTimeout = msg.includes("timed out");
    if (!isTimeout) throw formatGpsError(err);
    if (__DEV__) console.warn("[GPS] BestForNavigation timed out - retrying with Highest");
  }

  try {
    const loc = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest }),
      GPS_HIGH_TIMEOUT_MS,
      "Highest-accuracy GPS",
    );
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : "";
    const isTimeout = msg.includes("timed out");
    if (!isTimeout) throw formatGpsError(err);
    if (__DEV__) console.warn("[GPS] Highest accuracy timed out - retrying with Balanced");
  }

  try {
    const loc = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      GPS_BALANCED_TIMEOUT_MS,
      "Balanced GPS",
    );
    return {
      latitude: loc.coords.latitude,
      longitude: loc.coords.longitude,
      accuracy: loc.coords.accuracy,
    };
  } catch (err) {
    throw formatGpsError(err);
  }
}

function formatGpsError(err: unknown): Error {
  const msg = err instanceof Error ? err.message : "";
  if (msg.includes("timed out")) {
    return new Error(
      "GPS signal is weak. Please step outside or try again.\n" +
        "You can also enter your address manually or pin it on the map.",
    );
  }
  if (
    msg.toLowerCase().includes("location provider") ||
    msg.toLowerCase().includes("unavailable")
  ) {
    return new Error(
      "Location services are off. Please enable GPS in your device settings.",
    );
  }
  return new Error(
    "Could not get your location. Please try again or enter the address manually.",
  );
}

// ---------------------------------------------------------------------------
// 1. Google Maps Geocoding API - primary, most accurate for India
//    Returns full address_components with typed fields:
//    street_number, route, sublocality_level_1/2, locality, postal_code, etc.
// ---------------------------------------------------------------------------

interface GoogleAddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface GoogleGeocodeResult {
  address_components: GoogleAddressComponent[];
  formatted_address: string;
}

interface GoogleGeocodeResponse {
  status: string;
  results: GoogleGeocodeResult[];
}

function getComponent(
  components: GoogleAddressComponent[],
  ...types: string[]
): string {
  for (const type of types) {
    const match = components.find((c) => c.types.includes(type));
    if (match?.long_name) return match.long_name;
  }
  return "";
}

async function reverseGeocodeGoogle(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  const apiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY;
  if (!apiKey) return null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    // result_type filter gets the most specific result first
    const url =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?latlng=${latitude},${longitude}` +
      `&key=${apiKey}` +
      `&language=en` +
      `&result_type=street_address|route|sublocality|locality`;

    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) return null;

    const data: GoogleGeocodeResponse = await res.json();
    if (data.status !== "OK" || !data.results?.length) return null;

    // Use most specific result (first in list after result_type filter)
    const c = data.results[0].address_components;

    const houseNumber  = getComponent(c, "street_number");
    const route        = getComponent(c, "route");
    const premise      = getComponent(c, "premise");
    const establishment = getComponent(c, "establishment", "point_of_interest");

    // Sublocality: level 2 is more specific (Block B, Sector 12)
    // level 1 is the neighbourhood (Connaught Place, Hauz Khas)
    const sublocality2 = getComponent(c, "sublocality_level_2");
    const sublocality1 = getComponent(c, "sublocality_level_1", "sublocality");

    // City: locality works for most cities; admin_level_2 covers some district-towns
    const city = getComponent(c, "locality", "administrative_area_level_2");

    // State
    const state = getComponent(c, "administrative_area_level_1");

    // Pincode
    const pincode = getComponent(c, "postal_code");

    // Build line1: named building/POI > premise > house + road
    const streetPart = [houseNumber, route].filter(Boolean).join(" ");
    const namedPlace = establishment || premise;
    const line1 = namedPlace
      ? streetPart
        ? `${namedPlace}, ${streetPart}`
        : namedPlace
      : streetPart;

    // Build line2: sub-locality detail (more specific first)
    // Only include sublocality2 in line1 if it gives real detail (e.g. "Block B")
    const line2Parts: string[] = [];
    if (sublocality2 && sublocality2.toLowerCase() !== route.toLowerCase()) {
      line2Parts.push(sublocality2);
    }
    if (
      sublocality1 &&
      sublocality1.toLowerCase() !== city.toLowerCase() &&
      sublocality1.toLowerCase() !== route.toLowerCase()
    ) {
      line2Parts.push(sublocality1);
    }
    const line2 = line2Parts.join(", ");

    if (!city && !pincode) return null;

    if (__DEV__) {
      console.log("[Geocode:Google]", { line1, line2, city, state, pincode });
    }

    return { line1, line2, city, state, pincode };
  } catch (err) {
    if (__DEV__) console.warn("[Geocode:Google] failed:", err);
    return null;
  }
}

// ---------------------------------------------------------------------------
// 2. expo-location native geocoder - secondary fallback
//    Google Maps on Android, Apple Maps on iOS. Less structured than direct API.
// ---------------------------------------------------------------------------

async function reverseGeocodeNative(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!results?.length) return null;

    const r = results[0];
    const streetNumber = (r as any).streetNumber ?? "";
    const street = r.street ?? "";
    const line1 = [streetNumber, street].filter(Boolean).join(" ");
    const line2 = r.district || r.subregion || "";
    const city = r.city || r.subregion || r.district || "";
    const state = r.region || "";
    const pincode = r.postalCode || "";

    if (!city && !pincode) return null;
    return { line1, line2, city, state, pincode };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// 3. Nominatim (OSM) - last resort fallback
//    Rate-limited: max 1 req/s. User-Agent required by ToS.
// ---------------------------------------------------------------------------

interface NominatimAddress {
  house_number?: string;
  building?: string;
  amenity?: string;
  shop?: string;
  office?: string;
  road?: string;
  pedestrian?: string;
  footway?: string;
  neighbourhood?: string;
  quarter?: string;
  suburb?: string;
  hamlet?: string;
  city_district?: string;
  district?: string;
  county?: string;
  city?: string;
  town?: string;
  village?: string;
  state_district?: string;
  state?: string;
  postcode?: string;
}

function resolveCityIndia(a: NominatimAddress): string {
  if (a.state?.toLowerCase() === "delhi") {
    const sub = a.city_district || a.county || a.district || a.state_district;
    if (sub && sub.toLowerCase() !== "delhi") return sub;
    return a.city || "Delhi";
  }
  return a.city || a.town || a.village || a.county || a.state_district || "";
}

function resolveLocalityIndia(a: NominatimAddress): string {
  return (
    a.neighbourhood ||
    a.quarter ||
    a.suburb ||
    a.hamlet ||
    a.city_district ||
    a.district ||
    ""
  );
}

async function reverseGeocodeNominatim(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse` +
      `?lat=${latitude}&lon=${longitude}&format=json&addressdetails=1&zoom=19`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8_000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "BookMyDarzi/1.0 (support@bookmydarzi.com)",
        "Accept-Language": "en",
      },
    });
    clearTimeout(timer);

    if (!res.ok) return null;
    const data = await res.json();
    if (data.error || !data.address) return null;

    const a: NominatimAddress = data.address;
    const road = a.road || a.pedestrian || a.footway || "";
    const poiName: string = (data as any).name || "";
    const buildingName = a.building || a.amenity || a.shop || a.office || poiName || "";
    const houseNo = a.house_number || "";
    const streetPart = [houseNo, road].filter(Boolean).join(" ");
    const line1 = buildingName
      ? streetPart
        ? `${buildingName}, ${streetPart}`
        : buildingName
      : streetPart;
    const locality = resolveLocalityIndia(a);
    const line2 = locality && locality.toLowerCase() !== road.toLowerCase() ? locality : "";
    const city = resolveCityIndia(a);
    const state = a.state || "";
    const pincode = a.postcode || "";

    if (!city && !pincode) return null;
    return { line1, line2, city, state, pincode };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Merge: used when Google API is unavailable, combines native + Nominatim
// Native is better for city/state/pincode; Nominatim for street detail
// ---------------------------------------------------------------------------

function mergeResults(
  native: ReverseGeocodeResult | null,
  nominatim: ReverseGeocodeResult | null,
): ReverseGeocodeResult {
  if (!native && !nominatim) {
    throw new Error(
      "Could not determine address from your location. Please fill in the fields manually.",
    );
  }
  const base = native ?? nominatim!;
  const detail = nominatim ?? native!;
  return {
    line1: detail.line1 || base.line1,
    line2: detail.line2 || base.line2,
    city: base.city || detail.city,
    state: base.state || detail.state,
    pincode: base.pincode || detail.pincode,
  };
}

// ---------------------------------------------------------------------------
// Main export - try Google first, fall back gracefully
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 0. Backend proxy - primary path (server-side Google key + DB cache)
//    No API key exposed on client. Cache hit = instant, zero cost.
// ---------------------------------------------------------------------------

async function reverseGeocodeBackend(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  try {
    const url = `${buildApiV1Url("/location/reverse-geocode")}?latitude=${latitude}&longitude=${longitude}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 6_000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.city && !data.pincode) return null;
    if (__DEV__) console.log("[Geocode:Backend]", data.cached ? "(cache hit)" : "(API call)", data);
    return {
      line1: data.line1 ?? "",
      line2: data.line2 ?? "",
      city: data.city ?? "",
      state: data.state ?? "",
      pincode: data.pincode ?? "",
    };
  } catch {
    return null;
  }
}

/**
 * Turns GPS coordinates into structured Indian address components.
 *
 * Priority:
 *  1. Backend proxy (server-side Google key + DB cache) - zero client key exposure
 *  2. Google Maps Geocoding API (direct client call) - if backend is unreachable
 *  3. expo-location native + Nominatim merge - final fallback
 */
export async function reverseGeocodeCoords(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  // Fire backend + client fallbacks in parallel for speed
  const [backendResult, nativeResult, nominatimResult] = await Promise.allSettled([
    reverseGeocodeBackend(latitude, longitude),
    reverseGeocodeNative(latitude, longitude),
    reverseGeocodeNominatim(latitude, longitude),
  ]);

  const backend   = backendResult.status   === "fulfilled" ? backendResult.value   : null;
  const native    = nativeResult.status    === "fulfilled" ? nativeResult.value    : null;
  const nominatim = nominatimResult.status === "fulfilled" ? nominatimResult.value : null;

  // Backend wins (Mapbox/cached, key stays server-side)
  if (backend) return backend;

  // Final fallback: merge native geocoder + Nominatim
  return mergeResults(native, nominatim);
}

// ---------------------------------------------------------------------------
// Serviceability check
// ---------------------------------------------------------------------------

export async function checkServiceability(
  latitude: number,
  longitude: number,
): Promise<ServiceabilityResult> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
  });
  const url = `${buildApiV1Url("/location/check-serviceability")}?${params}`;

  // Deliberately NOT fail-open: a network/server failure here must never be
  // silently treated as "serviceable" - that's exactly backwards (it would
  // let an out-of-area address save with no warning whenever the check
  // itself happens to fail, rather than only when the area genuinely is
  // serviceable). Callers see the failure and decide what to do (e.g. skip
  // showing a badge, but never claim serviceability we didn't verify).
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ServiceabilityResult>;
}

/**
 * Serviceability check for a manually-typed address (no GPS/map coords
 * available) - forward-geocodes the typed fields server-side, then runs the
 * same check as checkServiceability(). Used by the address form's save flow
 * so a typed address gets the same "not serviceable" warning a GPS-detected
 * one already does, instead of silently saving with no check at all.
 */
export async function checkServiceabilityByAddress(fields: {
  line1?: string;
  city: string;
  state?: string;
  pincode?: string;
}): Promise<ServiceabilityResult> {
  const params = new URLSearchParams({
    city: fields.city,
    ...(fields.line1 ? { line1: fields.line1 } : {}),
    ...(fields.state ? { state: fields.state } : {}),
    ...(fields.pincode ? { pincode: fields.pincode } : {}),
  });
  const url = `${buildApiV1Url("/location/check-serviceability-by-address")}?${params}`;

  const res = await fetch(url, { method: "GET" });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json() as Promise<ServiceabilityResult>;
}

// ---------------------------------------------------------------------------
// "Notify me" capture for unserviceable areas
// ---------------------------------------------------------------------------

/**
 * Registers a customer's interest in an area we don't yet serve - shown as
 * a "Notify me" action wherever a serviceability check fails (see
 * app/address.tsx's serviceability badge, app/buy-now-review.tsx's place-
 * order error). Coordinates are optional - the backend best-effort forward-
 * geocodes city/pincode server-side when omitted. Works for a logged-out
 * user too (the backend endpoint no longer requires auth - a guest's
 * submission is stored with a null customer id) - request()'s Authorization
 * header is only attached when a real token exists, so this call already
 * degrades correctly with no code change needed here.
 */
export async function registerServiceAreaInterest(payload: {
  latitude?: number | null;
  longitude?: number | null;
  city?: string | null;
  pincode?: string | null;
  address_text?: string | null;
}): Promise<{ message: string }> {
  return request<{ message: string }>("/location/service-area-interest", {
    method: "POST",
    body: payload,
  });
}
