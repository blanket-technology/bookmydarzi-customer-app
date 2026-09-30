/**
 * Alteration Group - lists the bookable tiers within one Repair/Resize/
 * Restyle group of a Custom Alterations line. Sits between sub-services.tsx
 * (line selection) and service-details.tsx (booking) - a real extra tap,
 * matching the website's dedicated group pages, per explicit direction to
 * keep both platforms consistent rather than an in-page section.
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import ErrorState from "../src/components/common/ErrorState";
import { fetchCatalogTree, resolveCatalogCategory } from "../src/services/catalogService";
import {
  GROUP_DESCRIPTIONS,
  groupAlterationTiers,
  stripQualityPrefix,
  type AlterationGroupKey,
} from "../src/services/alterationGroups";
import type { CatalogStitchingType } from "../src/types/catalogApi";
import { safeRouterPush } from "../src/utils/safeNavigation";
import { normalizeServiceImageUrl } from "../src/utils/serviceImage";
import { fallbackTierDescription } from "../src/services/fallbackDescription";
import { useResponsiveLayout } from "../src/hooks/useResponsiveLayout";

const GROUP_ICONS: Record<AlterationGroupKey, keyof typeof Ionicons.glyphMap> = {
  repair: "hammer-outline",
  resize: "resize-outline",
  restyle: "sparkles-outline",
  other: "cut-outline",
};

const GROUP_LABELS: Record<AlterationGroupKey, string> = {
  repair: "Repair",
  resize: "Resize",
  restyle: "Restyle",
  other: "Other",
};

export default function AlterationGroupScreen() {
  const insets = useSafeAreaInsets();
  const { screenWidth, isTablet } = useResponsiveLayout();
  // Per explicit request: this tier-selection screen ("2 options
  // available") now uses the same side-by-side tile grid as the
  // Repair/Resize/Restyle group screen it follows (sub-services.tsx's
  // GroupCard), instead of a single-column row list - responsive same
  // way, 2/3/4 columns depending on available width.
  const gridColumns = isTablet && screenWidth > 900 ? 4 : isTablet && screenWidth > 650 ? 3 : 2;
  const gridItemWidthPct = `${100 / gridColumns - 2}%` as const;
  const router = useRouter();
  const params = useLocalSearchParams<{
    catalogCategoryId: string;
    categoryName: string;
    serviceLineId: string;
    serviceLineName: string;
    groupKey: string;
  }>();

  const catalogCategoryId = Number(params.catalogCategoryId ?? 0);
  const categoryName = params.categoryName ?? "Custom Alterations";
  const serviceLineId = Number(params.serviceLineId ?? 0);
  const serviceLineName = params.serviceLineName ?? "";
  const groupKey = (params.groupKey ?? "repair") as AlterationGroupKey;

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [tiers, setTiers] = useState<CatalogStitchingType[]>([]);
  const [lineImageUrl, setLineImageUrl] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const tree = await fetchCatalogTree();
        if (cancelled) return;
        const category = resolveCatalogCategory(tree, catalogCategoryId, categoryName);
        const line = category?.service_lines.find((l) => l.id === serviceLineId);
        if (!line) {
          setTiers([]);
          setLoadError(true);
          return;
        }
        setLineImageUrl(normalizeServiceImageUrl(line.image_url));
        const groups = groupAlterationTiers(line.stitching_types ?? []);
        const group = groups.find((g) => g.key === groupKey);
        setTiers(group?.tiers ?? []);
      } catch {
        if (!cancelled) setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogCategoryId, categoryName, serviceLineId, groupKey, retryTick]);

  const groupLabel = useMemo(() => GROUP_LABELS[groupKey] ?? "Options", [groupKey]);
  const heroImage = useMemo(
    () => normalizeServiceImageUrl(tiers.find((t) => t.image_url)?.image_url) ?? lineImageUrl,
    [tiers, lineImageUrl],
  );

  const navigateToDetail = (tier: CatalogStitchingType) => {
    const resolvedImage = normalizeServiceImageUrl(tier.image_url) ?? lineImageUrl ?? "";
    const description =
      tier.description?.trim() ||
      fallbackTierDescription({
        name: tier.name,
        basePrice: tier.base_price,
        estimatedDeliveryDays: tier.estimated_delivery_days ?? 7,
      });
    safeRouterPush(router, {
      pathname: "/service-details",
      params: {
        catalogCategoryId: String(catalogCategoryId),
        categoryName,
        serviceName: tier.name,
        serviceLineId: String(serviceLineId),
        bookableServiceId: String(tier.service_id),
        // Without this, service-details.tsx's tier-resolution effect falls
        // back to the FIRST tier on the whole line (types[0]) whenever no
        // filterBaseName is supplied - it was never wrong for sub-
        // services.tsx's own navigateToDetail() because that always passes
        // filterBaseName, narrowing the list down to (usually) just the one
        // tapped item first. This screen has no such narrowing, so it must
        // say explicitly which tier was tapped.
        selectedStitchingId: String(tier.service_id),
        basePrice: String(tier.base_price),
        imageUrl: resolvedImage,
        description,
      },
    } as never);
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <View style={styles.headerMid}>
          <View style={styles.headerIcon}>
            <Ionicons name={GROUP_ICONS[groupKey]} size={18} color={COLORS.primaryDark} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.headerTitle} numberOfLines={1}>{groupLabel}</Text>
            {serviceLineName ? (
              <Text style={styles.headerSub} numberOfLines={1}>{serviceLineName}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {loadError ? (
        <ErrorState
          message="Could not load options. Please check your connection and try again."
          onRetry={() => setRetryTick((t) => t + 1)}
        />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          {loading ? (
            <>
              <View style={styles.heroSkeleton} />
              <View style={styles.loadingWrap}>
                {[0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)}
              </View>
            </>
          ) : (
            <>
              {heroImage ? (
                <Animated.View entering={FadeIn.duration(220)}>
                  <Image
                    source={{ uri: heroImage }}
                    style={styles.heroImage}
                    contentFit="cover"
                    cachePolicy="memory-disk"
                    transition={150}
                  />
                </Animated.View>
              ) : null}

              <View style={styles.introBlock}>
                <View style={styles.groupBadge}>
                  <Ionicons name={GROUP_ICONS[groupKey]} size={13} color={COLORS.primaryDark} />
                  <Text style={styles.groupBadgeText}>{groupLabel.toUpperCase()}</Text>
                </View>
                <Text style={styles.description}>{GROUP_DESCRIPTIONS[groupKey]}</Text>
              </View>

              <Text style={styles.sectionLabel}>
                {tiers.length} option{tiers.length === 1 ? "" : "s"} available
              </Text>

              {tiers.length === 0 ? (
                <View style={styles.empty}>
                  <Ionicons name="cut-outline" size={28} color={COLORS.grayBorder} />
                  <Text style={styles.emptyText}>No options available in this group yet.</Text>
                </View>
              ) : (
                <View style={styles.grid}>
                  {tiers.map((tier, idx) => {
                    const tierImage = normalizeServiceImageUrl(tier.image_url) ?? heroImage;
                    return (
                    <Animated.View
                      key={tier.service_id}
                      style={[styles.gridItem, { width: gridItemWidthPct }]}
                      entering={FadeInDown.delay(idx * 40).duration(220)}
                    >
                      <TouchableOpacity
                        style={styles.tierCard}
                        onPress={() => navigateToDetail(tier)}
                        activeOpacity={0.85}
                      >
                        {tierImage ? (
                          <Image
                            source={{ uri: tierImage }}
                            style={styles.tierCardImage}
                            contentFit="cover"
                            cachePolicy="memory-disk"
                            transition={150}
                          />
                        ) : (
                          <View style={styles.tierCardImageFallback}>
                            <Ionicons name="cut-outline" size={26} color={COLORS.primaryDark} />
                          </View>
                        )}

                        <View style={styles.tierCardBody}>
                          <Text style={styles.tierCardName} numberOfLines={2}>
                            {stripQualityPrefix(tier.name)}
                          </Text>
                          <Text style={styles.tierCardDesc}>
                            {tier.estimated_delivery_days} day{tier.estimated_delivery_days === 1 ? "" : "s"} turnaround
                          </Text>
                        </View>

                        <Text style={styles.tierCardPrice}>₹{tier.base_price.toLocaleString("en-IN")}</Text>
                      </TouchableOpacity>
                    </Animated.View>
                  );})}
                </View>
              )}
            </>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  backBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: COLORS.grayLight,
    alignItems: "center", justifyContent: "center",
  },
  headerMid: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1, marginLeft: SPACING.sm, minWidth: 0 },
  headerIcon: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.black },
  headerSub: { fontSize: 11, color: COLORS.gray, marginTop: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: 48 },
  heroImage: {
    width: "100%",
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.grayLight,
    marginBottom: SPACING.md,
  },
  heroSkeleton: {
    width: "100%",
    height: 180,
    borderRadius: RADIUS.lg,
    backgroundColor: COLORS.grayLight,
    marginBottom: SPACING.md,
  },
  introBlock: { marginBottom: SPACING.lg, gap: 8 },
  groupBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 5,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  groupBadgeText: { fontSize: 10, fontWeight: "800", color: COLORS.primaryDark, letterSpacing: 0.4 },
  description: { fontSize: 13.5, color: COLORS.gray, lineHeight: 20 },
  sectionLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
  loadingWrap: { gap: 10 },
  skeleton: { height: 84, borderRadius: RADIUS.lg, backgroundColor: COLORS.grayLight },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 10 },
  emptyText: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  // Side-by-side tile grid, matching sub-services.tsx's GroupCard/TypeCard
  // shape, per explicit request - this "pick a bookable tier" screen now
  // looks like the Repair/Resize/Restyle group screen it follows, not a
  // single-column row list. Responsive: 2/3/4 columns depending on screen
  // width (see gridItemWidthPct in the component body).
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: {},
  tierCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    alignItems: "flex-start",
    gap: 10,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  // aspectRatio: 1 (square) - the real uploaded catalog photos are all
  // 1254x1254 (true 1:1), not 4:3 as first assumed; square matches the
  // website's identical fix (aspect-square on the equivalent tier card
  // image).
  tierCardImage: { width: "100%", aspectRatio: 1, borderRadius: RADIUS.md, backgroundColor: COLORS.grayLight },
  tierCardImageFallback: {
    width: "100%", aspectRatio: 1, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  tierCardBody: { gap: 4, width: "100%" },
  tierCardName: { fontSize: 13, fontWeight: "700", color: COLORS.black, lineHeight: 18 },
  tierCardDesc: { fontSize: 11, color: COLORS.gray, lineHeight: 15 },
  tierCardPrice: { fontSize: 12, fontWeight: "800", color: COLORS.primaryDark },
});
