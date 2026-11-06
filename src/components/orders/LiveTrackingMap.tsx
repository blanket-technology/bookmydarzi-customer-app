/**
 * Inline live-tracking map - shown on the order detail screen while an
 * order's pickup/delivery/return/repair leg is actually in transit.
 *
 * Unlike MapPinPicker (full-screen, drag-to-pick), this is a small bounded
 * map embedded in the scroll: a partner pin + a destination pin + a
 * straight line between them, with a live "Arriving in X min" pill that
 * updates as PARTNER_LOCATION_UPDATE events arrive over the existing
 * WebSocket connection (wsService) - no extra connection, no polling.
 *
 * Falls back to one REST fetch (GET .../live-location) so the map has
 * something to show the instant the screen opens, before the partner's
 * next GPS ping (~every 20s) arrives.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import MapView, { Marker, Polyline, Region } from "react-native-maps";

import { COLORS, RADIUS, SHADOW } from "../../../constants/theme";
import { wsService } from "../../services/wsService";
import { fetchOrderLiveLocation, type LiveLocationSnapshot } from "../../services/customerOrderService";

interface Props {
  orderId: number;
  /** Only render/poll while the order is actually on a trackable leg -
   * caller already knows the order status, no need to duplicate that
   * check here. */
  enabled: boolean;
}

// All coordinate/ETA fields are optional on the wire (absent entirely on a
// {"trackable": false} response) - this narrows to "definitely has them",
// which is the only shape this component ever actually renders.
interface TrackableSnapshot extends LiveLocationSnapshot {
  partner_latitude: number;
  partner_longitude: number;
  destination_latitude: number;
  destination_longitude: number;
  distance_km: number;
  eta_minutes: number;
  eta_label: string;
}

function isTrackable(snapshot: LiveLocationSnapshot): snapshot is TrackableSnapshot {
  return (
    typeof snapshot.partner_latitude === "number" &&
    typeof snapshot.partner_longitude === "number" &&
    typeof snapshot.destination_latitude === "number" &&
    typeof snapshot.destination_longitude === "number"
  );
}

function regionFor(snapshot: TrackableSnapshot): Region {
  const lats = [snapshot.partner_latitude, snapshot.destination_latitude];
  const lons = [snapshot.partner_longitude, snapshot.destination_longitude];
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  // Padding so both pins sit comfortably inside the frame, not pinned to
  // its edge - 1.8x the raw span, with a floor so two very-close points
  // (partner right outside the door) don't zoom in to an unreadable level.
  const latDelta = Math.max((maxLat - minLat) * 1.8, 0.006);
  const lonDelta = Math.max((maxLon - minLon) * 1.8, 0.006);
  return {
    latitude: (minLat + maxLat) / 2,
    longitude: (minLon + maxLon) / 2,
    latitudeDelta: latDelta,
    longitudeDelta: lonDelta,
  };
}

export function LiveTrackingMap({ orderId, enabled }: Props) {
  const [snapshot, setSnapshot] = useState<TrackableSnapshot | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!enabled) {
      setSnapshot(null);
      setLoaded(false);
      return;
    }
    let mounted = true;
    fetchOrderLiveLocation(orderId)
      .then((result) => {
        if (mounted && isTrackable(result)) setSnapshot(result);
      })
      .catch(() => {
        // Non-critical - the WS event below will fill this in once the
        // partner's next GPS ping arrives, same as any other live feed.
      })
      .finally(() => {
        if (mounted) setLoaded(true);
      });
    return () => {
      mounted = false;
    };
  }, [orderId, enabled]);

  useEffect(() => {
    if (!enabled) return;
    return wsService.on("PARTNER_LOCATION_UPDATE", (data) => {
      const payload = data as unknown as LiveLocationSnapshot;
      if (Number(payload.order_id) !== orderId) return;
      if (isTrackable(payload)) setSnapshot(payload);
    });
  }, [orderId, enabled]);

  const region = useMemo(() => (snapshot ? regionFor(snapshot) : null), [snapshot]);

  if (!enabled || !loaded) return null;
  if (!snapshot || region === null) return null;

  return (
    <View style={styles.wrap}>
      <MapView
        style={styles.map}
        region={region}
        scrollEnabled={false}
        zoomEnabled={false}
        rotateEnabled={false}
        pitchEnabled={false}
        toolbarEnabled={false}
      >
        <Marker
          coordinate={{ latitude: snapshot.partner_latitude, longitude: snapshot.partner_longitude }}
          title={snapshot.partner_name}
          anchor={{ x: 0.5, y: 0.5 }}
        >
          <View style={styles.partnerPin}>
            <Ionicons name="bicycle" size={16} color="#fff" />
          </View>
        </Marker>
        <Marker
          coordinate={{ latitude: snapshot.destination_latitude, longitude: snapshot.destination_longitude }}
          anchor={{ x: 0.5, y: 1 }}
        >
          <Ionicons name="location" size={30} color={COLORS.primaryDark} />
        </Marker>
        <Polyline
          coordinates={[
            { latitude: snapshot.partner_latitude, longitude: snapshot.partner_longitude },
            { latitude: snapshot.destination_latitude, longitude: snapshot.destination_longitude },
          ]}
          strokeColor={COLORS.primary}
          strokeWidth={2}
          lineDashPattern={[6, 6]}
        />
      </MapView>
      <View style={styles.etaPill}>
        <Ionicons name="time-outline" size={14} color={COLORS.primaryDark} />
        <Text style={styles.etaText}>{snapshot.eta_label}</Text>
        <Text style={styles.distanceText}>· {snapshot.distance_km.toFixed(1)} km away</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    borderRadius: RADIUS.lg,
    overflow: "hidden",
    marginBottom: 12,
    ...SHADOW.card,
  },
  map: { width: "100%", height: 180 },
  partnerPin: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#fff",
  },
  etaPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: "#fff",
  },
  etaText: { fontSize: 13, fontWeight: "700", color: COLORS.primaryDark },
  distanceText: { fontSize: 12, color: COLORS.gray },
});
