/**
 * Tailor Broadcast Offers - FCFS accept/decline screen.
 */
import { Ionicons } from "@expo/vector-icons";
import { useCallback, useEffect, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SPACING } from "../../constants/theme";
import {
    type BroadcastOffer,
    acceptBroadcast,
    declineBroadcast,
    listBroadcastOffers,
} from "../../src/services/tailorService";
import { wsService } from "../../src/services/wsService";

const TEAL = "#0D9488";
const SLATE = "#64748B";
const ROUND_TIMEOUT_MS = 15 * 60 * 1000;
const POLL_INTERVAL_MS = 30_000;

function timeLeft(expiresAt: string): { label: string; ms: number } {
  const ms = Math.max(0, new Date(expiresAt).getTime() - Date.now());
  if (ms === 0) return { label: "Expired", ms: 0 };
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return { label: m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`, ms };
}

function timerProgress(expiresAt: string): number {
  return Math.max(0, Math.min(1, (new Date(expiresAt).getTime() - Date.now()) / ROUND_TIMEOUT_MS));
}

function fmtDate(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Offer Card ───────────────────────────────────────────────────────────────

function OfferCard({
  offer,
  onAccept,
  onDecline,
  busy,
}: {
  offer: BroadcastOffer;
  onAccept: () => void;
  onDecline: () => void;
  busy: boolean;
}) {
  const [time, setTime] = useState(() => timeLeft(offer.expires_at));
  const [prog, setProg] = useState(() => timerProgress(offer.expires_at));

  useEffect(() => {
    const t = setInterval(() => {
      setTime(timeLeft(offer.expires_at));
      setProg(timerProgress(offer.expires_at));
    }, 1000);
    return () => clearInterval(t);
  }, [offer.expires_at]);

  const expired = time.ms === 0;
  const canAct = !busy && !expired;

  const timerColor =
    expired ? COLORS.grayBorder
    : prog < 0.25 ? "#DC2626"
    : prog < 0.5 ? "#D97706"
    : TEAL;

  const isUrgent = offer.urgency_level === "urgent";
  const isExpress = offer.urgency_level === "express";

  // Single meta line - area · garment count
  const meta = [
    offer.pickup_area,
    `${offer.garment_count} ${offer.garment_count === 1 ? "garment" : "garments"}`,
  ].filter(Boolean).join("  ·  ");

  // Detail line - ETA and urgency (only shown when meaningful)
  const eta = fmtDate(offer.expected_delivery_date);
  const urgencyLabel = isUrgent ? "Urgent" : isExpress ? "Express" : null;
  const detail = [eta ? `By ${eta}` : null, urgencyLabel].filter(Boolean).join("  ·  ");
  const detailColor = isUrgent ? "#B91C1C" : isExpress ? "#C2410C" : SLATE;

  // Requirements - flatten to a single flowing sentence
  const reqParts = [
    offer.description,
    offer.cloth_details ? `Cloth: ${offer.cloth_details}` : null,
    offer.fabric_notes ? `Fabric: ${offer.fabric_notes}` : null,
    offer.customization_notes,
    offer.stitching_preferences
      ? Object.entries(offer.stitching_preferences).map(([k, v]) => `${k}: ${v}`).join(", ")
      : null,
  ].filter(Boolean);
  const reqText = reqParts.join("  ·  ");

  return (
    <View style={card.root}>
      {/* Order code + round (only shown for round > 1) */}
      <View style={card.codeRow}>
        <Text style={card.code}>{offer.order_code}</Text>
        {offer.broadcast_round > 1 ? (
          <Text style={card.round}>Round {offer.broadcast_round}</Text>
        ) : null}
      </View>

      {/* Service name - the main visual anchor */}
      <Text style={card.service} numberOfLines={2}>{offer.service_name}</Text>

      {/* Area · garments */}
      <Text style={card.meta}>{meta}</Text>

      {/* ETA · urgency */}
      {detail ? (
        <Text style={[card.detail, { color: detailColor }]}>{detail}</Text>
      ) : null}

      {/* Requirements (when present) */}
      {reqText ? (
        <>
          <View style={card.rule} />
          <Text style={card.req} numberOfLines={3}>{reqText}</Text>
        </>
      ) : null}

      {/* Countdown */}
      <View style={card.timerWrap}>
        <View style={card.track}>
          <View
            style={[card.fill, { width: `${prog * 100}%` as any, backgroundColor: timerColor }]}
          />
        </View>
        <Text style={[card.timerLabel, { color: timerColor }]}>
          {expired ? "Offer expired" : `${time.label} left`}
        </Text>
      </View>

      {/* Actions */}
      <View style={card.actions}>
        <TouchableOpacity
          style={[card.pass, !canAct && card.dimmed]}
          onPress={onDecline}
          disabled={!canAct}
          activeOpacity={0.55}
        >
          <Text style={[card.passLabel, !canAct && { color: COLORS.grayBorder }]}>Pass</Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[card.accept, !canAct && card.dimmed]}
          onPress={onAccept}
          disabled={!canAct}
          activeOpacity={0.85}
        >
          {busy ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={card.acceptLabel}>{expired ? "Expired" : "Accept"}</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function BroadcastsScreen() {
  const insets = useSafeAreaInsets();
  const [offers, setOffers] = useState<BroadcastOffer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const load = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    setError(null);
    try {
      setOffers(await listBroadcastOffers());
    } catch (e: any) {
      setError(e?.message ?? "Failed to load offers");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    load();
    pollRef.current = setInterval(() => load(true), POLL_INTERVAL_MS);
    const unsub = wsService.on("BROADCAST_OFFER", () => load(true));
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
      unsub();
    };
  }, [load]);

  const handleAccept = async (offer: BroadcastOffer) => {
    setBusyId(offer.order_id);
    try {
      await acceptBroadcast(offer.order_id);
      Alert.alert(
        "Order accepted",
        `You're assigned to ${offer.order_code}. Head to My Work to begin.`,
        [{ text: "OK" }],
      );
      setOffers((prev) => prev.filter((o) => o.order_id !== offer.order_id));
    } catch (e: any) {
      const msg: string = e?.message ?? "";
      if (msg.toLowerCase().includes("already") || msg.toLowerCase().includes("taken")) {
        Alert.alert("Already taken", "Another tailor got there first.", [{ text: "OK" }]);
        setOffers((prev) => prev.filter((o) => o.order_id !== offer.order_id));
      } else {
        Alert.alert("Could not accept", msg || "Please try again.");
      }
    } finally {
      setBusyId(null);
    }
  };

  const handleDecline = async (offer: BroadcastOffer) => {
    setBusyId(offer.order_id);
    try {
      await declineBroadcast(offer.order_id);
      setOffers((prev) => prev.filter((o) => o.order_id !== offer.order_id));
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not decline.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <View style={scr.root}>
      <View style={[scr.header, { paddingTop: insets.top + 14 }]}>
        <Text style={scr.title}>New Orders</Text>
        {offers.length > 0 ? (
          <Text style={scr.subtitle}>{offers.length} {offers.length === 1 ? "offer" : "offers"} available</Text>
        ) : null}
      </View>

      {loading && !refreshing ? (
        <View style={scr.center}>
          <ActivityIndicator color={TEAL} />
        </View>
      ) : error ? (
        <View style={scr.center}>
          <Ionicons name="alert-circle-outline" size={32} color={COLORS.grayBorder} />
          <Text style={scr.errText}>{error}</Text>
          <TouchableOpacity style={scr.retryBtn} onPress={() => load()}>
            <Text style={scr.retryLabel}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={offers}
          keyExtractor={(o) => String(o.broadcast_id)}
          contentContainerStyle={[scr.list, offers.length === 0 && scr.listCenter]}
          ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() => { setRefreshing(true); load(true); }}
              tintColor={TEAL}
              colors={[TEAL]}
            />
          }
          ListEmptyComponent={
            <View style={scr.empty}>
              <Ionicons name="cut-outline" size={28} color={COLORS.grayBorder} />
              <Text style={scr.emptyTitle}>No new orders</Text>
              <Text style={scr.emptySub}>
                You&apos;ll be notified when an order becomes available in your area.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <OfferCard
              offer={item}
              onAccept={() => handleAccept(item)}
              onDecline={() => handleDecline(item)}
              busy={busyId === item.order_id}
            />
          )}
        />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const scr = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F5F5F5" },

  header: {
    backgroundColor: COLORS.white,
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  title: { fontSize: 22, ...FONTS.bold, color: "#0F172A", letterSpacing: -0.4 },
  subtitle: { fontSize: 13, color: SLATE, marginTop: 2 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  errText: { fontSize: 14, color: COLORS.gray, textAlign: "center", paddingHorizontal: 32 },
  retryBtn: {
    paddingHorizontal: 24,
    paddingVertical: 10,
    backgroundColor: TEAL,
    borderRadius: RADIUS.full,
  },
  retryLabel: { color: "#fff", ...FONTS.semiBold, fontSize: 14 },

  list: { padding: SPACING.md, paddingBottom: 32 },
  listCenter: { flex: 1 },

  empty: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 64,
  },
  emptyTitle: { fontSize: 16, ...FONTS.semiBold, color: "#0F172A", marginTop: 4 },
  emptySub: {
    fontSize: 13,
    color: SLATE,
    textAlign: "center",
    lineHeight: 19,
    paddingHorizontal: 40,
  },
});

const card = StyleSheet.create({
  root: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    paddingHorizontal: 18,
    paddingTop: 16,
    paddingBottom: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.07,
    shadowRadius: 10,
    elevation: 3,
    gap: 5,
  },

  codeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 2,
  },
  code: {
    fontSize: 11,
    ...FONTS.semiBold,
    color: SLATE,
    letterSpacing: 0.8,
    textTransform: "uppercase",
  },
  round: { fontSize: 11, ...FONTS.semiBold, color: "#D97706" },

  service: { fontSize: 17, ...FONTS.bold, color: "#0F172A", lineHeight: 23 },
  meta: { fontSize: 13, color: SLATE },
  detail: { fontSize: 13, ...FONTS.medium },

  rule: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: COLORS.grayBorder,
    marginVertical: 8,
  },
  req: { fontSize: 13, color: "#374151", lineHeight: 19 },

  timerWrap: { marginTop: 10, gap: 5 },
  track: { height: 3, backgroundColor: "#F1F5F9", borderRadius: 2, overflow: "hidden" },
  fill: { height: "100%" as any, borderRadius: 2 },
  timerLabel: { fontSize: 12, ...FONTS.medium },

  actions: { flexDirection: "row", gap: 8, marginTop: 12 },
  pass: {
    width: 76,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  passLabel: { fontSize: 14, color: SLATE, ...FONTS.medium },
  accept: {
    flex: 1,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.md,
    backgroundColor: TEAL,
  },
  acceptLabel: { fontSize: 15, ...FONTS.semiBold, color: "#fff" },
  dimmed: { opacity: 0.4 },
});
