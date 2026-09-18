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
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import ErrorState from "../src/components/common/ErrorState";
import { fetchCatalogTree, resolveCatalogCategory } from "../src/services/catalogService";
import {
  GROUP_DESCRIPTIONS,
  groupAlterationTiers,
  type AlterationGroupKey,
} from "../src/services/alterationGroups";
import type { CatalogStitchingType } from "../src/types/catalogApi";
import { safeRouterPush } from "../src/utils/safeNavigation";

const GROUP_ICONS: Record<AlterationGroupKey, keyof typeof Ionicons.glyphMap> = {
  repair: "hammer-outline",
  resize: "resize-outline",
  restyle: "sparkles-outline",
  other: "cut-outline",
};

export default function AlterationGroupScreen() {
  const insets = useSafeAreaInsets();
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
        setLineImageUrl(line.image_url ?? null);
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
  }, [catalogCategoryId, categoryName, serviceLineId, groupKey]);

  const groupLabel = useMemo(() => {
    const labels: Record<AlterationGroupKey, string> = {
      repair: "Repair",
      resize: "Resize",
      restyle: "Restyle",
      other: "Other",
    };
    return labels[groupKey] ?? "Options";
  }, [groupKey]);

  const navigateToDetail = (tier: CatalogStitchingType) => {
    safeRouterPush(router, {
      pathname: "/service-details",
      params: {
        catalogCategoryId: String(catalogCategoryId),
        categoryName,
        serviceName: tier.name,
        serviceLineId: String(serviceLineId),
        bookableServiceId: String(tier.service_id),
        basePrice: String(tier.base_price),
        imageUrl: tier.image_url ?? lineImageUrl ?? "",
        description: tier.description ?? "",
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
          <View>
            <Text style={styles.headerTitle}>{groupLabel}</Text>
            {serviceLineName ? <Text style={styles.headerSub}>{serviceLineName}</Text> : null}
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loadError ? (
        <ErrorState message="Could not load options. Please check your connection and try again." />
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContent}
        >
          <Text style={styles.description}>{GROUP_DESCRIPTIONS[groupKey]}</Text>

          {loading ? (
            <View style={styles.loadingWrap}>
              {[0, 1, 2].map((i) => <View key={i} style={styles.skeleton} />)}
            </View>
          ) : tiers.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>No options available in this group yet.</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {tiers.map((tier) => (
                <TouchableOpacity
                  key={tier.service_id}
                  style={styles.tierCard}
                  onPress={() => navigateToDetail(tier)}
                  activeOpacity={0.85}
                >
                  {tier.image_url ? (
                    <Image
                      source={{ uri: tier.image_url }}
                      style={styles.tierImage}
                      contentFit="cover"
                      cachePolicy="memory-disk"
                      transition={150}
                    />
                  ) : (
                    <View style={styles.tierImageFallback}>
                      <Ionicons name="cut-outline" size={22} color={COLORS.primaryDark} />
                    </View>
                  )}
                  <View style={styles.tierText}>
                    <Text style={styles.tierName} numberOfLines={2}>{tier.name}</Text>
                    <Text style={styles.tierMeta}>
                      Delivered in {tier.estimated_delivery_days} day{tier.estimated_delivery_days === 1 ? "" : "s"}
                    </Text>
                  </View>
                  <View style={styles.tierPriceWrap}>
                    <Text style={styles.tierPrice}>₹{tier.base_price.toLocaleString("en-IN")}</Text>
                    <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
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
  headerMid: { flexDirection: "row", alignItems: "center", gap: SPACING.sm, flex: 1, marginLeft: SPACING.sm },
  headerIcon: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.black },
  headerSub: { fontSize: 11, color: COLORS.gray, marginTop: 1 },
  scrollContent: { padding: SPACING.md, paddingBottom: 48 },
  description: { fontSize: 13, color: COLORS.gray, lineHeight: 19, marginBottom: SPACING.md },
  loadingWrap: { gap: 10 },
  skeleton: { height: 76, borderRadius: RADIUS.lg, backgroundColor: COLORS.grayLight },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: 48 },
  emptyText: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  list: { gap: 10 },
  tierCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    padding: SPACING.sm + 2,
  },
  tierImage: { width: 56, height: 56, borderRadius: RADIUS.md, backgroundColor: COLORS.grayLight },
  tierImageFallback: {
    width: 56, height: 56, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
  },
  tierText: { flex: 1 },
  tierName: { fontSize: 14, fontWeight: "700", color: COLORS.black, lineHeight: 18 },
  tierMeta: { fontSize: 11, color: COLORS.gray, marginTop: 3 },
  tierPriceWrap: { flexDirection: "row", alignItems: "center", gap: 4 },
  tierPrice: { fontSize: 15, fontWeight: "800", color: COLORS.primaryDark },
});
