import AsyncStorage from "@react-native-async-storage/async-storage";
import { useEffect, useRef, useState } from "react";
import * as Location from "expo-location";
import {
  checkServiceability,
  registerServiceAreaInterest,
  type ServiceabilityResult,
} from "../../services/locationService";
import ServiceAreaModal from "./ServiceAreaModal";

const DISMISS_STORAGE_KEY = "bmd_serviceability_popup_dismissed_at";
const DISMISS_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

async function wasRecentlyDismissed(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = Number(raw);
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < DISMISS_COOLDOWN_MS;
  } catch {
    return false;
  }
}

async function markDismissed(): Promise<void> {
  try {
    await AsyncStorage.setItem(DISMISS_STORAGE_KEY, String(Date.now()));
  } catch {
    // Nothing to do if storage is unavailable - the popup just reappears
    // next launch, same as before this fix.
  }
}

/**
 * App-launch "do you serve my area?" check - matches
 * bookmydarzi-web-final's PincodeServiceabilityCheck.tsx exactly: silent
 * by default, only interrupts with a popup when the area is genuinely
 * unserviceable, dismissal persisted with a 7-day cooldown so it doesn't
 * nag on every app open.
 *
 * Deliberately does NOT force the OS location-permission prompt (unlike
 * address.tsx's requestLocationPermission, used when the customer is
 * actively trying to save an address) - only checks when permission is
 * ALREADY granted from some earlier flow, so a fresh install never gets
 * an unsolicited permission dialog just from opening the app. This
 * mirrors the website's own passive behavior (the browser's geolocation
 * prompt only ever fires from a real user action, never forced on load).
 */
export default function ServiceAreaCheck() {
  const [visible, setVisible] = useState(false);
  const [result, setResult] = useState<ServiceabilityResult | null>(null);
  const [notifyState, setNotifyState] = useState<"idle" | "submitting" | "done">("idle");
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const checkedRef = useRef(false);

  useEffect(() => {
    if (checkedRef.current) return;
    checkedRef.current = true;

    (async () => {
      if (await wasRecentlyDismissed()) return;

      const { status } = await Location.getForegroundPermissionsAsync();
      if (status !== "granted") return;

      try {
        const loc = await Location.getCurrentPositionAsync({
          accuracy: Location.Accuracy.Balanced,
        });
        coordsRef.current = { latitude: loc.coords.latitude, longitude: loc.coords.longitude };
        const svc = await checkServiceability(loc.coords.latitude, loc.coords.longitude);
        if (!svc.serviceable) {
          setResult(svc);
          setVisible(true);
        }
      } catch {
        // Best-effort - a GPS/network failure here just means the popup
        // doesn't show, never a hard error surfaced to the user.
      }
    })();
  }, []);

  const handleDismiss = () => {
    setVisible(false);
    void markDismissed();
  };

  const handleNotifyMe = async () => {
    setNotifyState("submitting");
    try {
      await registerServiceAreaInterest({
        latitude: coordsRef.current?.latitude ?? null,
        longitude: coordsRef.current?.longitude ?? null,
      });
      setNotifyState("done");
      void markDismissed();
    } catch {
      setNotifyState("idle");
    }
  };

  if (!visible || !result) return null;

  return (
    <ServiceAreaModal
      visible={visible}
      title="We're not in your area yet"
      message={
        result.nearest_city && result.distance_km != null
          ? `We're not quite there yet, but we're close! The nearest area we currently serve is ${result.nearest_city}, about ${Math.round(result.distance_km)} km away. We're expanding fast.`
          : (result.message ?? "We're still growing our doorstep tailoring network and haven't reached your area just yet.")
      }
      onNotifyMe={handleNotifyMe}
      onDismiss={handleDismiss}
      notifyState={notifyState}
    />
  );
}
