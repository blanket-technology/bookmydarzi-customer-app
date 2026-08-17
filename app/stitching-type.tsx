/**
 * Stitching Type Screen - Normal vs Designer for a catalog service line.
 * Uses stitching_types[].service_id (bookable) - never service_lines[].id.
 */
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useCartStore } from "../src/store/useCartStore";
import {
  fetchCatalogTree,
  findServiceLine,
  resolveCatalogCategory,
} from "../src/services/catalogService";
import type { CatalogStitchingType } from "../src/types/catalogApi";

export default function StitchingTypeScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setPendingService, setPendingRoute, setBookingFlowActive } = useCartStore();

  const params = useLocalSearchParams<{
    catalogCategoryId: string;
    serviceLineId: string;
    categoryName: string;
    serviceLineName: string;
    tailorId?: string;
    tailorName?: string;
  }>();

  const catalogCategoryId = Number(params.catalogCategoryId ?? 0);
  const serviceLineId = Number(params.serviceLineId ?? 0);
  const categoryName = params.categoryName ?? "Services";
  const serviceLineName = params.serviceLineName ?? "Service";
  const paramTailorId = params.tailorId ? Number(params.tailorId) : undefined;
  const paramTailorName = params.tailorName ?? undefined;

  const [loading, setLoading] = useState(true);
  const [stitchingTypes, setStitchingTypes] = useState<CatalogStitchingType[]>(
    [],
  );

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const tree = await fetchCatalogTree();
        if (cancelled) return;

        const category = resolveCatalogCategory(
          tree,
          catalogCategoryId,
          categoryName,
        );
        const line = category
          ? findServiceLine(category, serviceLineId)
          : undefined;

        setStitchingTypes(
          [...(line?.stitching_types ?? [])].sort(
            (a, b) => a.display_order - b.display_order,
          ),
        );
      } catch {
        if (!cancelled) setStitchingTypes([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogCategoryId, categoryName, serviceLineId]);

  const subtitle = useMemo(
    () => `Choose stitching style for ${serviceLineName}`,
    [serviceLineName],
  );

  const handleSelectStitching = useCallback(
    (stitching: CatalogStitchingType) => {
      const bookableServiceId = stitching.service_id;
      if (bookableServiceId <= 0) return;

      const existingCart = useCartStore.getState().pendingService;
      const resolvedTailorId = paramTailorId ?? existingCart?.tailorId;
      const resolvedTailorName = paramTailorName ?? existingCart?.tailorName;

      setPendingService({
        bookableServiceId,
        serviceLineId,
        serviceLineName,
        stitchingType: stitching.name,
        categoryId: catalogCategoryId,
        categoryName,
        basePrice: stitching.base_price,
        displayName: `${serviceLineName} · ${stitching.name}`,
        imageUrl: stitching.image_url,
        tailorId: resolvedTailorId,
        tailorName: resolvedTailorName,
      });

      if (!isAuthenticated) {
        setPendingRoute("/stitching-type", {
          catalogCategoryId: String(catalogCategoryId),
          serviceLineId: String(serviceLineId),
          categoryName,
          serviceLineName,
          ...(paramTailorId ? { tailorId: String(paramTailorId) } : {}),
          ...(paramTailorName ? { tailorName: paramTailorName } : {}),
        });
        router.push("/(auth)/login");
        return;
      }

      // Measurement is never collected from the customer - go straight to
      // address selection; measurement is filled later by Bridge/employee at
      // pickup, or by Admin.
      setBookingFlowActive(true);
      router.push("/address");
    },
    [
      paramTailorId,
      paramTailorName,
      serviceLineId,
      serviceLineName,
      catalogCategoryId,
      categoryName,
      isAuthenticated,
      router,
      setBookingFlowActive,
      setPendingRoute,
      setPendingService,
    ],
  );

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
        <View style={styles.headerTextWrap}>
          <Text style={styles.headerTitle}>Stitching Type</Text>
          <Text style={styles.headerSubtitle} numberOfLines={1}>
            {categoryName} · {serviceLineName}
          </Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
          <LinearGradient
            colors={["#0c6c75", "#1aa3b0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <Ionicons name="cut-outline" size={28} color="rgba(255,255,255,0.92)" />
            <Text style={styles.heroTitle}>{serviceLineName}</Text>
            <Text style={styles.heroSub}>{subtitle}</Text>
          </LinearGradient>
        </Animated.View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading stitching options...</Text>
          </View>
        ) : stitchingTypes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="alert-circle-outline" size={40} color={COLORS.grayBorder} />
            <Text style={styles.emptyTitle}>No stitching options</Text>
            <Text style={styles.emptyDesc}>
              This service line has no stitching types available right now.
            </Text>
          </View>
        ) : (
          stitchingTypes.map((stitching, index) => {
            const isDesigner = stitching.name
              .toLowerCase()
              .includes("designer");
            return (
              <Animated.View
                key={stitching.service_id}
                entering={FadeInDown.delay(80 + index * 60).duration(400)}
              >
                <Pressable
                  style={({ pressed }) => [
                    styles.optionCard,
                    pressed && styles.optionCardPressed,
                  ]}
                  onPress={() => handleSelectStitching(stitching)}
                >
                  <View
                    style={[
                      styles.optionIcon,
                      {
                        backgroundColor: isDesigner
                          ? "#F5E6C0"
                          : COLORS.primaryLight,
                      },
                    ]}
                  >
                    <Ionicons
                      name={isDesigner ? "diamond-outline" : "shirt-outline"}
                      size={24}
                      color={isDesigner ? "#C9A84C" : COLORS.primaryDark}
                    />
                  </View>

                  <View style={styles.optionBody}>
                    <Text style={styles.optionTitle}>{stitching.name}</Text>
                    <Text style={styles.optionDesc}>
                      {isDesigner
                        ? "Premium finish with designer detailing"
                        : "Classic tailoring with reliable finish"}
                    </Text>
                    <Text style={styles.optionPrice}>
                      ₹{stitching.base_price.toLocaleString("en-IN")}
                    </Text>
                  </View>

                  <Ionicons
                    name="chevron-forward"
                    size={20}
                    color={COLORS.gray}
                  />
                </Pressable>
              </Animated.View>
            );
          })
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTextWrap: { flex: 1, alignItems: "center", paddingHorizontal: SPACING.sm },
  headerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.black },
  headerSubtitle: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  scroll: { padding: SPACING.lg, paddingBottom: SPACING.xxl },
  heroCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },
  heroGradient: {
    padding: SPACING.lg,
    alignItems: "center",
    gap: SPACING.sm,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.white,
    textAlign: "center",
  },
  heroSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.85)",
    textAlign: "center",
    lineHeight: 18,
  },
  loadingWrap: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  loadingText: { fontSize: 14, color: COLORS.gray },
  emptyWrap: {
    alignItems: "center",
    gap: SPACING.sm,
    paddingVertical: SPACING.xl,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptyDesc: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  optionCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(12, 108, 117, 0.12)",
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: { elevation: 3 },
    }),
  },
  optionCardPressed: { opacity: 0.92, transform: [{ scale: 0.995 }] },
  optionIcon: {
    width: 52,
    height: 52,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  optionBody: { flex: 1, minWidth: 0 },
  optionTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.black,
    marginBottom: 4,
  },
  optionDesc: {
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 16,
    marginBottom: 8,
  },
  optionPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
});
