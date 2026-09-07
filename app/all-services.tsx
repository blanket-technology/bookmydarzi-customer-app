/**
 * "Our Services" - the full tappable category grid, "What's Included"
 * summary, and the closing "Pick a Service" CTA. Split out from browse.tsx
 * (which now only covers Hero + How It Works + What We Offer) so it can be
 * reached directly from the homepage's "View All Services" buttons without
 * forcing users through the How It Works content first.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useMemo } from "react";
import {
    Image,
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
    useWindowDimensions,
} from "react-native";
import Animated, {
    FadeInDown,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { RADIUS } from "../constants/theme";
import { useHomeStore } from "../src/store/useHomeStore";
import type { ApiServiceCategory } from "../src/types/homeApi";
import { resolveCatalogCategoryId } from "../src/utils/catalogCategoryMap";
import { normalizeProfileImageUrl } from "../src/utils/profileImage";

const TEAL = "#0F766E";
const TEAL_DARK = "#0a3d3d";
const COPPER = "#B87333";
const FOREST = "#0D1410";
const LINEN = "#F7F3EE";
const H_PAD = 16;

const INCLUDED = [
  { icon: "location-outline" as const, text: "Measurement visit at your home" },
  { icon: "cut-outline" as const, text: "Handcrafted by a trained BMD tailor" },
  {
    icon: "shield-checkmark-outline" as const,
    text: "Quality check before every delivery",
  },
  {
    icon: "refresh-circle-outline" as const,
    text: "Free redo if the fit isn't right",
  },
  { icon: "bicycle-outline" as const, text: "Pickup & delivery at your door" },
  { icon: "time-outline" as const, text: "Real-time order tracking" },
] as const;

const CAT_GRADIENTS: Record<string, [string, string]> = {
  women: ["#4C1D95", "#7C3AED"],
  womens: ["#4C1D95", "#7C3AED"],
  ladies: ["#831843", "#DB2777"],
  men: ["#0a3d3d", "#0F766E"],
  mens: ["#0a3d3d", "#0F766E"],
  wedding: ["#78350F", "#B45309"],
  bridal: ["#831843", "#B45309"],
  kids: ["#1E40AF", "#3B82F6"],
  children: ["#1E40AF", "#3B82F6"],
  alterations: ["#065F46", "#059669"],
  repair: ["#065F46", "#059669"],
};

function getCatGradient(name: string): [string, string] {
  const k = name.trim().toLowerCase();
  if (CAT_GRADIENTS[k]) return CAT_GRADIENTS[k];
  if (k.includes("women") || k.includes("ladies") || k.includes("girl"))
    return CAT_GRADIENTS.women;
  if (k.includes("men") && !k.includes("women")) return CAT_GRADIENTS.men;
  if (k.includes("wedding") || k.includes("bridal"))
    return CAT_GRADIENTS.wedding;
  if (k.includes("kid") || k.includes("child") || k.includes("boy"))
    return CAT_GRADIENTS.kids;
  if (k.includes("alter") || k.includes("repair") || k.includes("fix"))
    return CAT_GRADIENTS.alterations;
  return [TEAL_DARK, TEAL];
}

function resolveImage(url: string | null | undefined): string | null {
  const r = normalizeProfileImageUrl(url);
  if (!r || r.includes("example.com") || r.includes("placeholder")) return null;
  return r;
}

export default function AllServicesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: W } = useWindowDimensions();
  const { serviceCategories } = useHomeStore();

  const gridGap = 12;
  const catCardW = (W - H_PAD * 2 - gridGap * 2) / 3;
  const catCardH = catCardW * 1.15;

  const sortedCats = useMemo(
    () =>
      [...serviceCategories].sort(
        (a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0),
      ),
    [serviceCategories],
  );

  const handleCatPress = useCallback(
    async (cat: ApiServiceCategory) => {
      let id = cat.Id;
      if (!id) {
        id = await resolveCatalogCategoryId(cat.Name, serviceCategories);
      }
      router.push({
        pathname: "/sub-services",
        params: { catalogCategoryId: String(id), categoryName: cat.Name },
      });
    },
    [router, serviceCategories],
  );

  return (
    <View style={s.root}>
      <View style={[s.header, { paddingTop: insets.top + 10 }]}>
        <TouchableOpacity
          style={s.backBtn}
          onPress={() => router.back()}
          hitSlop={12}
          activeOpacity={0.85}
        >
          <Ionicons name="arrow-back" size={22} color={FOREST} style={{ marginRight: 1.5 }} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Our Services</Text>
        <View style={{ width: 36 }} />
      </View>

      <Animated.ScrollView
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        contentContainerStyle={[s.scrollContent, { paddingBottom: insets.bottom + 40 }]}
      >
        {/* ════════════════════════ SERVICES ════════════════════════════════ */}
        {sortedCats.length > 0 && (
          <View style={s.section}>
            <Animated.View
              entering={FadeInDown.delay(0).duration(450)}
              style={s.sectionHead}
            >
              <Text style={s.eyebrow}>Our Services</Text>
              <Text style={[s.sectionTitle, { fontSize: W < 380 ? 19 : 21 }]}>
                Browse by category
              </Text>
              <Text style={s.sectionSub}>
                Tap any category to see available styles and pricing.
              </Text>
            </Animated.View>

            <View style={s.catGrid}>
              {sortedCats.map((cat, i) => {
                const gradient = getCatGradient(cat.Name);
                const imgUrl = resolveImage(cat.ImageUrl);
                const subCount = cat.SubCategories?.length ?? 0;

                return (
                  <Animated.View
                    key={`cat-${cat.Id ?? i}`}
                    entering={FadeInDown.delay(i * 55 + 60).duration(400)}
                    style={{ width: catCardW }}
                  >
                    <TouchableOpacity
                      style={[s.catCard, { height: catCardH }]}
                      activeOpacity={0.9}
                      onPress={() => handleCatPress(cat)}
                    >
                      {imgUrl ? (
                        <Image
                          source={{ uri: imgUrl }}
                          style={s.catImg}
                          resizeMode="cover"
                        />
                      ) : (
                        <LinearGradient
                          colors={gradient}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                      )}
                      <LinearGradient
                        colors={["transparent", "rgba(0,0,0,0.15)", "rgba(0,0,0,0.72)"]}
                        locations={[0, 0.5, 1]}
                        style={s.catOverlay}
                      />

                      <View style={s.catArrow}>
                        <Ionicons name="arrow-forward" size={10} color={FOREST} />
                      </View>

                      <View style={s.catBody}>
                        <Text style={s.catName} numberOfLines={1}>
                          {cat.Name}
                        </Text>
                        <Text style={s.catCount}>
                          {subCount} service{subCount !== 1 ? "s" : ""}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  </Animated.View>
                );
              })}
            </View>
          </View>
        )}

        {/* ════════════════════════ WHAT'S INCLUDED ═════════════════════════ */}
        <Animated.View
          entering={FadeInDown.delay(60).duration(450)}
          style={s.includedCard}
        >
          <Text style={s.eyebrow}>What&apos;s Included</Text>
          <Text
            style={[
              s.sectionTitle,
              { fontSize: W < 380 ? 17 : 18, marginBottom: 4 },
            ]}
          >
            No hidden charges.
          </Text>
          <Text style={[s.sectionSub, { marginBottom: 22 }]}>
            Every service includes all of the below.
          </Text>

          {INCLUDED.map((item, i) => (
            <Animated.View
              key={item.text}
              entering={FadeInDown.delay(i * 45 + 80).duration(340)}
              style={[
                s.incRow,
                i === INCLUDED.length - 1 && { borderBottomWidth: 0 },
              ]}
            >
              <View style={s.incIcon}>
                <Ionicons name={item.icon} size={16} color={TEAL} />
              </View>
              <Text style={s.incText}>{item.text}</Text>
            </Animated.View>
          ))}
        </Animated.View>

        {/* ════════════════════════ BOTTOM CTA ══════════════════════════════ */}
        <Animated.View entering={FadeInDown.delay(80).duration(420)}>
          <LinearGradient
            colors={["#051515", "#0a3d3d", TEAL]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={s.ctaCard}
          >
            <Text style={s.ctaEye}>Ready?</Text>
            <Text style={[s.ctaTitle, { fontSize: W < 380 ? 19 : 21, lineHeight: (W < 380 ? 19 : 21) * 1.25 }]}>
              Your perfect fit{"\n"}starts here.
            </Text>
            <Text style={s.ctaSub}>
              Choose a category above and book in under 2 minutes.
            </Text>
            <TouchableOpacity
              style={s.ctaBtn}
              activeOpacity={0.88}
              onPress={() => router.push("/(tabs)")}
            >
              <Ionicons name="home-outline" size={16} color={TEAL} />
              <Text style={s.ctaBtnTxt}>Pick a Service</Text>
            </TouchableOpacity>
          </LinearGradient>
        </Animated.View>
      </Animated.ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: LINEN,
  },
  scrollContent: {
    paddingHorizontal: H_PAD,
    paddingTop: 20,
  },

  // ── Header ─────────────────────────────────────────────────────────────────
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: H_PAD,
    paddingBottom: 14,
    backgroundColor: LINEN,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: FOREST,
    letterSpacing: -0.3,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },

  section: {
    marginBottom: 32,
  },
  sectionHead: {
    marginBottom: 18,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "800",
    color: TEAL,
    letterSpacing: 2.2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  sectionTitle: {
    fontWeight: "800",
    color: FOREST,
    lineHeight: 34,
    letterSpacing: -0.6,
    marginBottom: 8,
  },
  sectionSub: {
    fontSize: 14,
    color: "#5C6168",
    lineHeight: 21,
  },

  // ── Category cards (3-col, image-forward grid) ────────────────────────────
  catGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    rowGap: 10,
  },
  catCard: {
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    justifyContent: "flex-end",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
      },
      android: { elevation: 2 },
    }),
  },
  catImg: {
    ...StyleSheet.absoluteFillObject,
  },
  catOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  catArrow: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  catBody: {
    padding: 8,
  },
  catName: {
    fontSize: 11.5,
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.1,
    lineHeight: 14,
  },
  catCount: {
    fontSize: 9.5,
    color: "rgba(255,255,255,0.75)",
    marginTop: 1,
    fontWeight: "500",
  },

  // ── Included card ──────────────────────────────────────────────────────────
  includedCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    padding: 18,
    marginBottom: 32,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.06,
        shadowRadius: 14,
      },
      android: { elevation: 3 },
    }),
  },
  incRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#F3F4F6",
  },
  incIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: "#E6F7F7",
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
  incText: {
    flex: 1,
    fontSize: 13,
    color: "#1F2937",
    fontWeight: "500",
    lineHeight: 18,
  },

  // ── Bottom CTA ─────────────────────────────────────────────────────────────
  ctaCard: {
    borderRadius: 20,
    padding: 20,
  },
  ctaEye: {
    fontSize: 10,
    fontWeight: "800",
    color: COPPER,
    letterSpacing: 2,
    textTransform: "uppercase",
    marginBottom: 8,
  },
  ctaTitle: {
    fontWeight: "800",
    color: "#FFFFFF",
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  ctaSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.62)",
    lineHeight: 18,
    marginBottom: 18,
  },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
    backgroundColor: "#FFFFFF",
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 11,
  },
  ctaBtnTxt: {
    fontSize: 15,
    fontWeight: "700",
    color: TEAL,
  },
});
