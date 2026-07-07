/**
 * MapPinPicker – Blinkit/Uber-style full-screen map with a fixed drop-pin.
 * Drag the map; the pin stays centred and lifts with a shadow.
 * Address updates live as the map settles.
 */

import { Ionicons } from "@expo/vector-icons";
import * as Location from "expo-location";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import MapView, { Region } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";
import {
  reverseGeocodeCoords,
  type ReverseGeocodeResult,
} from "../../services/locationService";

export interface PickedLocation {
  latitude: number;
  longitude: number;
  address: ReverseGeocodeResult | null;
}

interface Props {
  visible: boolean;
  initialCoords?: { latitude: number; longitude: number } | null;
  onConfirm: (picked: PickedLocation) => void;
  onClose: () => void;
}

const DEFAULT_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const GEOCODE_DEBOUNCE_MS = 700;

// ── Custom drop-pin ──────────────────────────────────────────────────────────
function DropPin({ lifted }: { lifted: boolean }) {
  const translateY = useRef(new Animated.Value(0)).current;
  const shadowOpacity = useRef(new Animated.Value(0.22)).current;
  const shadowScale = useRef(new Animated.Value(1)).current;

  React.useEffect(() => {
    Animated.parallel([
      Animated.spring(translateY, {
        toValue: lifted ? -14 : 0,
        useNativeDriver: true,
        damping: 14,
        stiffness: 220,
      }),
      Animated.timing(shadowOpacity, {
        toValue: lifted ? 0.08 : 0.22,
        duration: 180,
        useNativeDriver: true,
      }),
      Animated.timing(shadowScale, {
        toValue: lifted ? 0.6 : 1,
        duration: 180,
        useNativeDriver: true,
      }),
    ]).start();
  }, [lifted]);

  return (
    <View style={pin.wrap} pointerEvents="none">
      {/* Pin body */}
      <Animated.View style={[pin.pin, { transform: [{ translateY }] }]}>
        <View style={pin.circle}>
          <View style={pin.inner} />
        </View>
        <View style={pin.stem} />
        <View style={pin.tip} />
      </Animated.View>
      {/* Ground shadow */}
      <Animated.View
        style={[
          pin.shadow,
          { opacity: shadowOpacity, transform: [{ scaleX: shadowScale }] },
        ]}
      />
    </View>
  );
}

const pin = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "flex-end",
    height: 80,
    width: 48,
    marginBottom: 160, // shift pin up so it sits above the bottom sheet
  },
  pin: {
    alignItems: "center",
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 6,
    elevation: 8,
  },
  inner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: "#fff",
  },
  stem: {
    width: 3,
    height: 10,
    backgroundColor: COLORS.primary,
  },
  tip: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: COLORS.primary,
  },
  shadow: {
    width: 16,
    height: 6,
    borderRadius: 4,
    backgroundColor: "rgba(0,0,0,0.35)",
    marginTop: 2,
  },
});

// ── Main component ───────────────────────────────────────────────────────────
export function MapPinPicker({ visible, initialCoords, onConfirm, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const autoLocatedRef = useRef(false);

  const initialRegion: Region = initialCoords
    ? {
        latitude: initialCoords.latitude,
        longitude: initialCoords.longitude,
        latitudeDelta: 0.005,
        longitudeDelta: 0.005,
      }
    : DEFAULT_REGION;

  const [centerCoords, setCenterCoords] = useState({
    latitude: initialRegion.latitude,
    longitude: initialRegion.longitude,
  });
  const [addressPreview, setAddressPreview] = useState<ReverseGeocodeResult | null>(null);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [locating, setLocating] = useState(false);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const geocodeCenter = useCallback((latitude: number, longitude: number) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsGeocoding(true);
      try {
        const result = await reverseGeocodeCoords(latitude, longitude);
        setAddressPreview(result);
      } catch {
        setAddressPreview(null);
      } finally {
        setIsGeocoding(false);
      }
    }, GEOCODE_DEBOUNCE_MS);
  }, []);

  const handleRegionChange = useCallback(() => {
    setIsDragging(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleRegionChangeComplete = useCallback(
    (region: Region) => {
      setIsDragging(false);
      const { latitude, longitude } = region;
      setCenterCoords({ latitude, longitude });
      geocodeCenter(latitude, longitude);
    },
    [geocodeCenter],
  );

  const handleConfirm = useCallback(() => {
    onConfirm({
      latitude: centerCoords.latitude,
      longitude: centerCoords.longitude,
      address: addressPreview,
    });
  }, [centerCoords, addressPreview, onConfirm]);

  // Move map to actual current GPS position
  const handleMyLocation = useCallback(async () => {
    setLocating(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") return;
      const pos = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      const { latitude, longitude } = pos.coords;
      const region: Region = { latitude, longitude, latitudeDelta: 0.005, longitudeDelta: 0.005 };
      mapRef.current?.animateToRegion(region, 500);
      setCenterCoords({ latitude, longitude });
      setAddressPreview(null);
      geocodeCenter(latitude, longitude);
    } catch {
      // silently fallback to initialCoords
      if (initialCoords) {
        const region: Region = { ...initialCoords, latitudeDelta: 0.005, longitudeDelta: 0.005 };
        mapRef.current?.animateToRegion(region, 400);
        setCenterCoords(initialCoords);
      }
    } finally {
      setLocating(false);
    }
  }, [initialCoords, geocodeCenter]);

  // Auto-jump to GPS when modal opens (once per open)
  React.useEffect(() => {
    if (!visible) {
      autoLocatedRef.current = false;
      return;
    }
    if (autoLocatedRef.current) return;
    autoLocatedRef.current = true;
    void handleMyLocation();
  }, [visible, handleMyLocation]);

  const addressLine = addressPreview
    ? [addressPreview.line1, addressPreview.line2, addressPreview.city, addressPreview.state]
        .filter(Boolean)
        .join(", ")
    : null;

  const confirmReady = !isGeocoding && !isDragging;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {/* ── Map ── */}
        <MapView
          ref={mapRef}
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          mapType="standard"
          zoomControlEnabled={false}
        />


        {/* ── Centred drop-pin ── */}
        <View pointerEvents="none" style={styles.pinContainer}>
          <DropPin lifted={isDragging} />
        </View>

        {/* ── Top bar ── */}
        <View style={[styles.topBar, { paddingTop: insets.top + 6 }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={20} color="#1F2937" />
          </TouchableOpacity>
          <View style={styles.titleWrap}>
            <Ionicons name="map-outline" size={16} color={COLORS.primary} />
            <Text style={styles.title}>Choose delivery location</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* ── GPS button ── */}
        <TouchableOpacity
          style={[styles.myLocationBtn, { top: insets.top + 68 }]}
          onPress={handleMyLocation}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Use my current location"
        >
          {locating ? (
            <ActivityIndicator size="small" color={COLORS.primary} />
          ) : (
            <Ionicons name="locate" size={20} color={COLORS.primary} />
          )}
        </TouchableOpacity>

        {/* ── Bottom sheet ── */}
        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <View style={styles.drag} />

          <View style={styles.addressRow}>
            <View style={styles.addressIconWrap}>
              {isGeocoding || isDragging ? (
                <ActivityIndicator size="small" color={COLORS.primary} />
              ) : (
                <Ionicons name="location" size={18} color={COLORS.primary} />
              )}
            </View>
            <View style={styles.addressTextWrap}>
              <Text style={styles.addressLabel}>Deliver here</Text>
              <Text style={styles.addressText} numberOfLines={2}>
                {isGeocoding || isDragging
                  ? "Finding address…"
                  : addressLine ?? "Drag the map to pick your location"}
              </Text>
              {addressPreview?.pincode ? (
                <Text style={styles.pincode}>📍 {addressPreview.pincode}</Text>
              ) : null}
            </View>
          </View>

          <View style={styles.row}>
            <TouchableOpacity
              style={styles.useGpsBtn}
              onPress={handleMyLocation}
              activeOpacity={0.85}
            >
              <Ionicons name="navigate" size={15} color={COLORS.primary} />
              <Text style={styles.useGpsText}>Use current location</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.confirmBtn, !confirmReady && styles.confirmBtnDisabled]}
              onPress={handleConfirm}
              disabled={!confirmReady}
              activeOpacity={0.88}
            >
              <Text style={styles.confirmBtnText}>Confirm</Text>
              <Ionicons name="checkmark" size={16} color="#fff" />
            </TouchableOpacity>
          </View>

          <Text style={styles.attribution}>Map data © Google</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#f3f4f6" },

  // ── Pin ──────────────────────────────────────────────────────────────────
  pinContainer: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
  },

  // ── Top bar ──────────────────────────────────────────────────────────────
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingBottom: 14,
    backgroundColor: "rgba(255,255,255,0.97)",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
    ...SHADOW.card,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F3F4F6",
  },
  titleWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#1F2937",
  },

  // ── GPS button ───────────────────────────────────────────────────────────
  myLocationBtn: {
    position: "absolute",
    right: SPACING.md,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.card,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "#E5E7EB",
  },

  // ── Bottom sheet ─────────────────────────────────────────────────────────
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: SPACING.lg,
    paddingTop: 14,
    ...SHADOW.strong,
  },
  drag: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: "#E5E7EB",
    alignSelf: "center",
    marginBottom: 16,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginBottom: 16,
  },
  addressIconWrap: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.primaryLight ?? "#E0F7F8",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  addressTextWrap: { flex: 1 },
  addressLabel: {
    fontSize: 11,
    fontWeight: "600",
    color: COLORS.gray ?? "#6B7280",
    marginBottom: 2,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  addressText: {
    fontSize: 14,
    fontWeight: "700",
    color: "#1F2937",
    lineHeight: 20,
  },
  pincode: {
    fontSize: 12,
    color: COLORS.gray ?? "#6B7280",
    marginTop: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 12,
  },
  useGpsBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    borderRadius: RADIUS.md ?? 12,
    borderWidth: 1.5,
    borderColor: COLORS.primary,
    backgroundColor: COLORS.primaryLight ?? "#E0F7F8",
  },
  useGpsText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primary,
  },
  confirmBtn: {
    flex: 1.3,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    borderRadius: RADIUS.md ?? 12,
    backgroundColor: COLORS.primary,
    ...SHADOW.card,
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: "#fff",
  },
  attribution: {
    fontSize: 10,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
