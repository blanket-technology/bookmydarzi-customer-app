/**
 * MapPinPicker — full-screen modal map with a fixed crosshair pin.
 * The user drags the map; the pin stays centered.
 * Address preview updates live as the region settles.
 * "Confirm" returns the pinned coords to the parent.
 *
 * Usage:
 *   <MapPinPicker
 *     visible={mapPickerVisible}
 *     initialCoords={gpsCoords}
 *     onConfirm={(picked) => { ... }}
 *     onClose={() => setMapPickerVisible(false)}
 *   />
 */

import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
// eslint-disable-next-line import/no-extraneous-dependencies
import MapView, { Region, UrlTile } from "react-native-maps";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "../../../constants/theme";
import { reverseGeocodeCoords, type ReverseGeocodeResult } from "../../services/locationService";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Defaults
// ---------------------------------------------------------------------------

const DEFAULT_REGION: Region = {
  latitude: 28.6139,
  longitude: 77.209,
  latitudeDelta: 0.01,
  longitudeDelta: 0.01,
};

const GEOCODE_DEBOUNCE_MS = 800;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MapPinPicker({ visible, initialCoords, onConfirm, onClose }: Props) {
  const insets = useSafeAreaInsets();

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

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleRegionChange = useCallback(() => {
    setIsDragging(true);
    if (debounceRef.current) clearTimeout(debounceRef.current);
  }, []);

  const handleRegionChangeComplete = useCallback((region: Region) => {
    setIsDragging(false);
    const { latitude, longitude } = region;
    setCenterCoords({ latitude, longitude });

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

  const handleConfirm = useCallback(() => {
    onConfirm({
      latitude: centerCoords.latitude,
      longitude: centerCoords.longitude,
      address: addressPreview,
    });
  }, [centerCoords, addressPreview, onConfirm]);

  const addressLine = addressPreview
    ? [addressPreview.line1, addressPreview.line2, addressPreview.city, addressPreview.state]
        .filter(Boolean)
        .join(", ")
    : null;

  return (
    <Modal visible={visible} animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <View style={styles.root}>
        {/* ── Map ─────────────────────────────────────────── */}
        {/*
          mapType="none" hides Google/Apple base tiles so no API key is needed.
          OSM tiles are loaded via UrlTile instead.
        */}
        <MapView
          style={StyleSheet.absoluteFillObject}
          initialRegion={initialRegion}
          onRegionChange={handleRegionChange}
          onRegionChangeComplete={handleRegionChangeComplete}
          showsUserLocation
          showsMyLocationButton={false}
          showsCompass={false}
          mapType="none"
          zoomControlEnabled={false}
        >
          <UrlTile
            urlTemplate="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
            maximumZ={19}
            tileSize={256}
            shouldReplaceMapContent
            // OSM tile usage policy: must show attribution
            // Attribution shown in bottom sheet below
          />
        </MapView>

        {/* ── Fixed crosshair pin ─────────────────────────── */}
        <View pointerEvents="none" style={styles.pinContainer}>
          <View style={[styles.pinWrapper, isDragging && styles.pinWrapperLifted]}>
            <Ionicons name="location" size={48} color={COLORS.primary} />
          </View>
        </View>

        {/* ── Top bar ─────────────────────────────────────── */}
        <View style={[styles.topBar, { paddingTop: insets.top + SPACING.sm }]}>
          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.8}>
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.title}>Pin your location</Text>
          <View style={styles.closeBtnPlaceholder} />
        </View>

        {/* ── My Location button ──────────────────────────── */}
        <TouchableOpacity
          style={[styles.myLocationBtn, { top: insets.top + 60 + SPACING.sm }]}
          onPress={() => {
            if (initialCoords) {
              setCenterCoords(initialCoords);
              setAddressPreview(null);
            }
          }}
          activeOpacity={0.8}
        >
          <Ionicons name="locate" size={20} color={COLORS.primary} />
        </TouchableOpacity>

        {/* ── Bottom sheet ────────────────────────────────── */}
        <View style={[styles.bottomSheet, { paddingBottom: insets.bottom + SPACING.md }]}>
          <Text style={styles.attribution}>© OpenStreetMap contributors</Text>
          <View style={styles.addressRow}>
            {isGeocoding || isDragging ? (
              <ActivityIndicator size="small" color={COLORS.primary} />
            ) : (
              <Ionicons name="location-outline" size={18} color={COLORS.primary} />
            )}
            <Text style={styles.addressText} numberOfLines={2}>
              {isGeocoding || isDragging
                ? "Locating address…"
                : addressLine
                  ? addressLine
                  : "Drag the map to pin your location"}
            </Text>
          </View>

          {addressPreview?.pincode ? (
            <Text style={styles.pincodeText}>Pincode: {addressPreview.pincode}</Text>
          ) : null}

          <TouchableOpacity
            style={[styles.confirmBtn, (isGeocoding || isDragging) && styles.confirmBtnDisabled]}
            onPress={handleConfirm}
            disabled={isGeocoding || isDragging}
            activeOpacity={0.85}
          >
            <Text style={styles.confirmBtnText}>Confirm Location</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#000",
  },

  // ── Pin ──────────────────────────────────────────────────────────────────
  pinContainer: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  pinWrapper: {
    marginBottom: 48,
  },
  pinWrapperLifted: {
    transform: [{ translateY: -8 }],
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
    paddingBottom: SPACING.sm,
    backgroundColor: "rgba(255,255,255,0.95)",
    ...SHADOW.card,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.grayLight,
  },
  closeBtnPlaceholder: { width: 36 },
  title: {
    flex: 1,
    textAlign: "center",
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.black,
  },

  // ── My Location ──────────────────────────────────────────────────────────
  myLocationBtn: {
    position: "absolute",
    right: SPACING.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.card,
  },

  // ── Bottom sheet ─────────────────────────────────────────────────────────
  bottomSheet: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.lg,
    ...SHADOW.strong,
  },
  addressRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    marginBottom: SPACING.xs,
  },
  addressText: {
    flex: 1,
    fontSize: 14,
    color: COLORS.black,
    lineHeight: 20,
  },
  pincodeText: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.sm,
    marginLeft: 26,
  },
  confirmBtn: {
    marginTop: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.md,
    paddingVertical: 14,
    alignItems: "center",
  },
  confirmBtnDisabled: {
    opacity: 0.55,
  },
  confirmBtnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
  attribution: {
    fontSize: 10,
    color: COLORS.gray,
    textAlign: "right",
    marginBottom: SPACING.xs,
  },
});
