/**
 * Location helpers - GPS capture, reverse-geocode, serviceability check.
 *
 * Geocode cascade (most reliable first for India):
 *  1. expo-location native geocoder (Google on Android / Apple Maps on iOS)
 *  2. Nominatim (OSM) - richer street detail, used to fill gaps from native
 */
import * as Location from "expo-location";
import { buildApiV1Url } from "../config/api";

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
  city: string | null;
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

const GPS_HIGH_TIMEOUT_MS = 10_000;
const GPS_BALANCED_TIMEOUT_MS = 8_000;

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timed out after ${ms / 1000}s`)), ms),
    ),
  ]);
}

/**
 * Gets the device's current GPS fix.
 * - Tries HIGH accuracy first (10 s timeout)
 * - Falls back to BALANCED accuracy (8 s timeout) on timeout
 * - Throws a user-friendly message if permission denied or both attempts fail
 */
export async function getCurrentGpsCoords(): Promise<GpsCoords> {
  const granted = await requestLocationPermission();
  if (!granted) {
    throw new Error(
      "Location permission denied.\n" +
        "Go to: Settings → Apps → BookMyDarzi → Permissions → Location → Allow.",
    );
  }

  // Attempt 1: High accuracy (uses GPS chip)
  try {
    const loc = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
      GPS_HIGH_TIMEOUT_MS,
      "High-accuracy GPS",
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
    if (__DEV__) console.warn("[GPS] High accuracy timed out - retrying with Balanced");
  }

  // Attempt 2: Balanced accuracy (uses network/wifi - faster, less precise)
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
  if (msg.toLowerCase().includes("location provider") || msg.toLowerCase().includes("unavailable")) {
    return new Error(
      "Location services are off. Please enable GPS in your device settings.",
    );
  }
  return new Error("Could not get your location. Please try again or enter the address manually.");
}

// ---------------------------------------------------------------------------
// Reverse-geocode - native first, Nominatim for detail gaps
// ---------------------------------------------------------------------------

// ─── expo-location native geocoder ─────────────────────────────────────────
// Most reliable in India - backed by Google Maps on Android, Apple Maps on iOS.

async function reverseGeocodeNative(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult | null> {
  try {
    const results = await Location.reverseGeocodeAsync({ latitude, longitude });
    if (!results || results.length === 0) return null;

    const r = results[0];

    // streetNumber is typed as string | null in newer expo-location
    const streetNumber = (r as any).streetNumber ?? "";
    const street = r.street ?? "";
    const line1 = [streetNumber, street].filter(Boolean).join(" ");

    // district → subregion are the best locality proxies from native geocoder
    const line2 = r.district || r.subregion || "";

    // city: Android gives city, iOS gives subregion for smaller places
    const city = r.city || r.subregion || r.district || "";
    const state = r.region || "";
    const pincode = r.postalCode || "";

    if (!city && !pincode) return null;
    return { line1, line2, city, state, pincode };
  } catch {
    return null;
  }
}

// ─── Nominatim (OSM) ────────────────────────────────────────────────────────
// Better for: specific colony/sector names, house numbers, road names.
// Rate-limited: max 1 req/s. User-Agent required by ToS.

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
  // Delhi special case - `city` is often empty, district is more useful
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
    // POI/building name comes from the top-level `name` field (e.g. "DLF Cyber City", "Apollo Hospital")
    const poiName: string = (data as any).name || "";
    const buildingName = a.building || a.amenity || a.shop || a.office || poiName || "";
    const houseNo = a.house_number || "";
    // Build line1: building name first, then house no + road
    const streetPart = [houseNo, road].filter(Boolean).join(" ");
    const line1 = buildingName
      ? streetPart ? `${buildingName}, ${streetPart}` : buildingName
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

// ─── Merge: native fills city/state/pincode, Nominatim fills street detail ──

/**
 * Merge two geocode results - prefer Nominatim for line1/line2 (street detail),
 * prefer native for city/state/pincode (more reliable for Indian cities).
 */
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

/**
 * Turns GPS coordinates into structured Indian address components.
 *
 * Strategy:
 *  - Fires native geocoder and Nominatim in parallel
 *  - Merges results: native wins for city/state/pincode,
 *    Nominatim wins for street/locality detail
 */
export async function reverseGeocodeCoords(
  latitude: number,
  longitude: number,
): Promise<ReverseGeocodeResult> {
  const [native, nominatim] = await Promise.allSettled([
    reverseGeocodeNative(latitude, longitude),
    reverseGeocodeNominatim(latitude, longitude),
  ]);

  const nativeResult = native.status === "fulfilled" ? native.value : null;
  const nominatimResult = nominatim.status === "fulfilled" ? nominatim.value : null;

  return mergeResults(nativeResult, nominatimResult);
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

  try {
    const res = await fetch(url, { method: "GET" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json() as Promise<ServiceabilityResult>;
  } catch {
    // Serviceability failures must never block the form
    return {
      serviceable: true,
      city: null,
      distance_km: null,
      estimated_pickup_hours: null,
      message: "",
    };
  }
}
