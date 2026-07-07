/**
 * Service Details - configure stitching type, options, and quantity before add-to-cart.
 */
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import { useAuthStore } from "../store/useAuthStore";
import { useCartStore } from "../src/store/useCartStore";
import { useWishlistStore } from "../src/store/useWishlistStore";
import { useToastStore } from "../src/store/useToastStore";
import {
  fetchCatalogTree,
  findDirectServiceByName,
  findServiceLine,
  findServiceLineByName,
  resolveCatalogCategory,
} from "../src/services/catalogService";
import type {
  CatalogDirectService,
  CatalogServiceLine,
  CatalogStitchingType,
} from "../src/types/catalogApi";
import { safeRouterPush } from "../src/utils/safeNavigation";

const CATEGORY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  mens: { icon: "shirt-outline", color: "#0c6c75", bg: "#e0f7f8" },
  men: { icon: "shirt-outline", color: "#0c6c75", bg: "#e0f7f8" },
  womens: { icon: "woman-outline", color: "#7C3AED", bg: "#EDE9FE" },
  women: { icon: "woman-outline", color: "#7C3AED", bg: "#EDE9FE" },
  kids: { icon: "happy-outline", color: "#DC2626", bg: "#FEE2E2" },
  alterations: { icon: "construct-outline", color: "#065F46", bg: "#D1FAE5" },
};

function getCategoryStyle(name: string) {
  const key = name.toLowerCase();
  return (
    CATEGORY_ICONS[key] ?? {
      icon: "cut-outline",
      color: "#B45309",
      bg: "#FEF3C7",
    }
  );
}

function isValidImageUrl(url: string | null | undefined): boolean {
  if (!url?.trim()) return false;
  return /^https?:\/\//i.test(url.trim());
}

function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ServiceDetailsScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    setPendingService,
    setPendingRoute,
    setBookingFlowActive,
    clearPendingBookingMeasurement,
  } = useCartStore();

  const params = useLocalSearchParams<{
    catalogCategoryId: string;
    categoryName: string;
    serviceName: string;
    subCategoryId?: string;
    basePrice?: string;
    description?: string;
    imageUrl?: string;
    bookableServiceId?: string;
    serviceLineId?: string;
    selectedStitchingId?: string;
    quantity?: string;
  }>();

  const catalogCategoryId = Number(params.catalogCategoryId ?? 0);
  const categoryName = params.categoryName ?? "Services";
  const serviceName = params.serviceName ?? "Service";
  const paramImageUrl = params.imageUrl?.trim() || null;
  const paramDescription = params.description?.trim() || "";
  const paramBasePrice = Number(params.basePrice ?? 0);
  const paramBookableId = Number(params.bookableServiceId ?? 0);
  const paramServiceLineId = Number(params.serviceLineId ?? 0);
  const paramSelectedStitchingId = Number(params.selectedStitchingId ?? 0);
  const paramQuantity = Number(params.quantity ?? 1);

  const catStyle = getCategoryStyle(categoryName);

  const [loading, setLoading] = useState(true);
  const [serviceLine, setServiceLine] = useState<CatalogServiceLine | null>(null);
  const [directService, setDirectService] = useState<CatalogDirectService | null>(null);
  const [relatedLines, setRelatedLines] = useState<CatalogServiceLine[]>([]);
  const [stitchingTypes, setStitchingTypes] = useState<CatalogStitchingType[]>([]);
  const [selectedStitchingId, setSelectedStitchingId] = useState<number | null>(null);
  const [quantitiesByStitching, setQuantitiesByStitching] = useState<
    Record<number, number>
  >({});

  const showToast = useToastStore((s) => s.show);
  const {
    fetchWishlist,
    toggle: toggleWishlist,
    isWishlisted,
  } = useWishlistStore();
  const wishlistServiceId =
    selectedStitchingId ??
    (paramBookableId > 0 ? paramBookableId : paramServiceLineId);
  const wishlisted =
    wishlistServiceId > 0
      ? Boolean(isWishlisted("service", wishlistServiceId))
      : false;

  useEffect(() => {
    if (isAuthenticated) fetchWishlist();
  }, [isAuthenticated, fetchWishlist]);

  const handleToggleWishlist = useCallback(async () => {
    if (!isAuthenticated) {
      showToast("Please log in to save favourites");
      return;
    }
    if (!wishlistServiceId || wishlistServiceId <= 0) return;
    try {
      const nowWishlisted = await toggleWishlist({
        item_type: "service",
        service_id: wishlistServiceId,
      });
      showToast(nowWishlisted ? "Added to wishlist" : "Removed from wishlist");
    } catch {
      showToast("Could not update wishlist");
    }
  }, [isAuthenticated, showToast, toggleWishlist, wishlistServiceId]);

  const getQuantityForStitching = useCallback(
    (stitchingId: number) => {
      const qty = quantitiesByStitching[stitchingId] ?? 1;
      return Math.min(99, Math.max(1, qty));
    },
    [quantitiesByStitching],
  );

  const updateStitchingQuantity = useCallback(
    (stitchingId: number, next: number) => {
      const clamped = Math.min(99, Math.max(1, next));
      setQuantitiesByStitching((prev) => ({
        ...prev,
        [stitchingId]: clamped,
      }));
    },
    [],
  );

  const buildReturnParams = useCallback((): Record<string, string> => {
    const stitchId = selectedStitchingId ?? paramBookableId;
    const stitch =
      stitchingTypes.find((s) => s.service_id === stitchId) ?? null;
    return {
      catalogCategoryId: String(catalogCategoryId),
      categoryName,
      serviceName,
      basePrice: String(stitch?.base_price ?? paramBasePrice),
      bookableServiceId: String(stitchId),
      description: paramDescription,
      imageUrl: paramImageUrl ?? "",
      selectedStitchingId: String(stitchId),
      quantity: String(getQuantityForStitching(stitchId)),
      ...(serviceLine ? { serviceLineId: String(serviceLine.id) } : {}),
      ...(paramServiceLineId > 0 && !serviceLine
        ? { serviceLineId: String(paramServiceLineId) }
        : {}),
    };
  }, [
    catalogCategoryId,
    categoryName,
    paramBasePrice,
    paramBookableId,
    paramDescription,
    paramImageUrl,
    paramServiceLineId,
    getQuantityForStitching,
    selectedStitchingId,
    serviceLine,
    serviceName,
    stitchingTypes,
  ]);

  const loadServiceData = useCallback(
    async (lineId?: number, lineName?: string) => {
      setLoading(true);
      try {
        const tree = await fetchCatalogTree();
        const category = resolveCatalogCategory(
          tree,
          catalogCategoryId,
          categoryName,
        );

        if (!category) {
          setServiceLine(null);
          setDirectService(null);
          setStitchingTypes([]);
          setRelatedLines([]);
          return;
        }

        let line: CatalogServiceLine | undefined;
        if (lineId && lineId > 0) {
          line = findServiceLine(category, lineId);
        }
        if (!line) {
          line = findServiceLineByName(category, lineName ?? serviceName);
        }

        const direct = line
          ? undefined
          : findDirectServiceByName(category, lineName ?? serviceName);

        if (line) {
          setServiceLine(line);
          setDirectService(null);
          const types = [...(line.stitching_types ?? [])].sort(
            (a, b) => a.display_order - b.display_order,
          );
          setStitchingTypes(types);
          const preferredId =
            paramSelectedStitchingId > 0 &&
            types.some((t) => t.service_id === paramSelectedStitchingId)
              ? paramSelectedStitchingId
              : (types[0]?.service_id ?? null);
          setSelectedStitchingId(preferredId);
          setRelatedLines(
            category.service_lines
              .filter((l) => l.id !== line!.id)
              .sort((a, b) => a.display_order - b.display_order),
          );
        } else if (direct) {
          setDirectService(direct);
          setServiceLine(null);
          setStitchingTypes([
            {
              service_id: direct.service_id,
              name: direct.name,
              base_price: direct.base_price,
              display_order: 0,
              service_line_id: direct.service_line_id ?? 0,
              service_line_name: direct.service_line_name ?? direct.name,
              category_id: direct.category_id,
              category_name: direct.category_name,
            },
          ]);
          setSelectedStitchingId(direct.service_id);
          setRelatedLines(
            [...category.service_lines].sort(
              (a, b) => a.display_order - b.display_order,
            ),
          );
        } else {
          setServiceLine(null);
          setDirectService(null);
          setStitchingTypes([]);
          setRelatedLines([]);
        }
      } catch {
        setServiceLine(null);
        setDirectService(null);
        setStitchingTypes([]);
        setRelatedLines([]);
      } finally {
        setLoading(false);
      }
    },
    [
      catalogCategoryId,
      categoryName,
      paramBasePrice,
      paramBookableId,
      paramSelectedStitchingId,
      serviceName,
    ],
  );

  useEffect(() => {
    void loadServiceData(
      paramServiceLineId > 0 ? paramServiceLineId : undefined,
      serviceName,
    );
  }, [loadServiceData, paramServiceLineId, serviceName]);

  useEffect(() => {
    if (paramQuantity >= 1 && paramQuantity <= 99 && paramSelectedStitchingId > 0) {
      setQuantitiesByStitching((prev) => ({
        ...prev,
        [paramSelectedStitchingId]: paramQuantity,
      }));
    }
  }, [paramQuantity, paramSelectedStitchingId]);

  const selectedStitching = useMemo(
    () => stitchingTypes.find((s) => s.service_id === selectedStitchingId) ?? null,
    [selectedStitchingId, stitchingTypes],
  );

  const displayImage = useMemo(() => {
    if (isValidImageUrl(serviceLine?.image_url)) return serviceLine!.image_url!;
    if (isValidImageUrl(paramImageUrl)) return paramImageUrl!;
    return null;
  }, [paramImageUrl, serviceLine]);

  const displayDescription = useMemo(() => {
    return (
      paramDescription.trim() ||
      (serviceLine?.description ?? "").trim() ||
      (directService?.description ?? "").trim() ||
      ""
    );
  }, [paramDescription, serviceLine, directService]);

  const unitPrice = selectedStitching?.base_price ?? paramBasePrice;

  const canContinue = selectedStitching != null && selectedStitching.service_id > 0;

  const handleContinue = useCallback(() => {
    if (!selectedStitching) {
      Alert.alert(
        "Select stitching type",
        "Please choose a stitching type to continue.",
      );
      return;
    }

    const qty = getQuantityForStitching(selectedStitching.service_id);
    const pendingItem = {
      bookableServiceId: selectedStitching.service_id,
      serviceLineId: serviceLine?.id,
      serviceLineName: serviceLine?.name ?? directService?.name ?? serviceName,
      stitchingType: selectedStitching.name,
      categoryId: catalogCategoryId,
      categoryName,
      basePrice: selectedStitching.base_price,
      displayName: `${serviceLine?.name ?? serviceName} · ${selectedStitching.name}`,
      quantity: qty,
    };

    if (!isAuthenticated) {
      setPendingService(pendingItem);
      setBookingFlowActive(true);
      clearPendingBookingMeasurement();
      setPendingRoute("/service-details", buildReturnParams());
      safeRouterPush(router, "/(auth)/login");
      return;
    }

    setPendingService(pendingItem);
    setBookingFlowActive(true);
    clearPendingBookingMeasurement();
    safeRouterPush(router, {
      pathname: "/measurement",
      params: { bookableServiceId: String(selectedStitching.service_id) },
    } as never);
  }, [
    buildReturnParams,
    catalogCategoryId,
    categoryName,
    clearPendingBookingMeasurement,
    directService?.name,
    getQuantityForStitching,
    isAuthenticated,
    router,
    selectedStitching,
    serviceLine,
    serviceName,
    setBookingFlowActive,
    setPendingRoute,
    setPendingService,
  ]);

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top, paddingBottom: insets.bottom + 32 },
        ]}
      >
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Service Details</Text>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleToggleWishlist}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            accessibilityRole="button"
            accessibilityLabel={wishlisted ? "Remove from wishlist" : "Add to wishlist"}
          >
            <Ionicons
              name={wishlisted ? "heart" : "heart-outline"}
              size={22}
              color={wishlisted ? COLORS.error : COLORS.black}
            />
          </TouchableOpacity>
        </View>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.heroCard}>
          {displayImage ? (
            <Image source={{ uri: displayImage }} style={styles.heroImage} resizeMode="cover" />
          ) : (
            <LinearGradient
              colors={["#0c6c75", "#1aa3b0"]}
              style={styles.heroFallback}
            >
              <View style={[styles.heroIcon, { backgroundColor: catStyle.bg }]}>
                <Ionicons
                  name={catStyle.icon as keyof typeof Ionicons.glyphMap}
                  size={36}
                  color={catStyle.color}
                />
              </View>
            </LinearGradient>
          )}
          <LinearGradient
            colors={["transparent", "rgba(0,0,0,0.25)", "rgba(0,0,0,0.78)"]}
            style={styles.heroOverlay}
          >
            <View style={styles.heroTopRow}>
              <View style={styles.categoryBadge}>
                <Ionicons
                  name={catStyle.icon as keyof typeof Ionicons.glyphMap}
                  size={12}
                  color={COLORS.white}
                />
                <Text style={styles.categoryBadgeText}>{categoryName}</Text>
              </View>
              <LinearGradient
                colors={["#0c6c75", "#1aa3b0"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.heroPriceBadge}
              >
                <Text style={styles.heroPriceBadgeLabel}>From</Text>
                <Text style={styles.heroPriceBadgeValue}>
                  {formatMoney(unitPrice)}
                </Text>
              </LinearGradient>
            </View>
            <Text style={styles.heroTitle}>{serviceLine?.name ?? serviceName}</Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View entering={FadeInDown.delay(60).duration(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>About this service</Text>
          {displayDescription ? (
            <Text style={styles.description}>{displayDescription}</Text>
          ) : loading ? (
            <Text style={styles.description}>Loading...</Text>
          ) : (
            <Text style={styles.description}>Service details unavailable</Text>
          )}
        </Animated.View>

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading options...</Text>
          </View>
        ) : stitchingTypes.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons name="alert-circle-outline" size={40} color={COLORS.grayBorder} />
            <Text style={styles.emptyTitle}>Service details unavailable</Text>
            <Text style={styles.emptyDesc}>
              Service details could not be loaded for this service.
            </Text>
          </View>
        ) : (
          <>
            <Animated.View
              entering={FadeInDown.delay(100).duration(400)}
              style={styles.stitchingSection}
            >
              <Text style={styles.sectionTitle}>Stitching type</Text>
              <Text style={styles.sectionSub}>Select finish and quantity</Text>
              {stitchingTypes.map((stitching) => {
                const selected = stitching.service_id === selectedStitchingId;
                const isDesigner = stitching.name.toLowerCase().includes("designer");
                const stitchQty = getQuantityForStitching(stitching.service_id);
                return (
                  <Pressable
                    key={stitching.service_id}
                    style={({ pressed }) => [
                      styles.stitchCard,
                      selected && styles.stitchCardSelected,
                      pressed && styles.optionCardPressed,
                    ]}
                    onPress={() => setSelectedStitchingId(stitching.service_id)}
                  >
                    <View style={styles.stitchCardRow}>
                      <View
                        style={[
                          styles.stitchIcon,
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
                      <View style={styles.stitchBody}>
                        <Text style={styles.stitchTitle}>{stitching.name}</Text>
                        <Text style={styles.stitchDesc}>
                          {isDesigner
                            ? "Premium designer finish with detailed styling"
                            : "Classic tailoring with reliable everyday finish"}
                        </Text>
                        <Text style={styles.stitchPrice}>
                          {formatMoney(stitching.base_price)}
                        </Text>
                      </View>
                      {selected ? (
                        <View style={styles.stitchActiveDot}>
                          <Ionicons
                            name="checkmark-circle"
                            size={22}
                            color={COLORS.primaryDark}
                          />
                        </View>
                      ) : (
                        <View style={styles.stitchRadio} />
                      )}
                    </View>
                    {selected ? (
                      <View style={styles.stitchQtyRow}>
                        <Text style={styles.stitchQtyLabel}>Quantity</Text>
                        <View style={styles.stitchQtyControl}>
                          <TouchableOpacity
                            style={styles.stitchQtyBtn}
                            onPress={() =>
                              updateStitchingQuantity(
                                stitching.service_id,
                                stitchQty - 1,
                              )
                            }
                            disabled={stitchQty <= 1}
                          >
                            <Ionicons
                              name="remove"
                              size={18}
                              color={COLORS.primaryDark}
                            />
                          </TouchableOpacity>
                          <Text style={styles.stitchQtyValue}>{stitchQty}</Text>
                          <TouchableOpacity
                            style={styles.stitchQtyBtn}
                            onPress={() =>
                              updateStitchingQuantity(
                                stitching.service_id,
                                stitchQty + 1,
                              )
                            }
                            disabled={stitchQty >= 99}
                          >
                            <Ionicons
                              name="add"
                              size={18}
                              color={COLORS.primaryDark}
                            />
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </Animated.View>

            <TouchableOpacity
              style={[
                styles.continueBtn,
                !canContinue && styles.continueBtnDisabled,
              ]}
              onPress={handleContinue}
              disabled={!canContinue}
              activeOpacity={0.9}
            >
              <Text style={styles.continueBtnText}>Continue</Text>
              <Ionicons name="arrow-forward" size={18} color={COLORS.white} />
            </TouchableOpacity>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  scroll: { paddingHorizontal: SPACING.lg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.md,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...SHADOW.card,
  },
  headerTitle: { fontSize: 17, fontWeight: "800", color: COLORS.black },
  heroCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    height: 240,
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: {
    width: 72,
    height: 72,
    borderRadius: RADIUS.lg,
    alignItems: "center",
    justifyContent: "center",
  },
  heroOverlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    top: 0,
    justifyContent: "flex-end",
    padding: SPACING.md,
  },
  heroTopRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
    gap: SPACING.sm,
  },
  categoryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(255,255,255,0.18)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.28)",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    maxWidth: "58%",
  },
  categoryBadgeText: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.white,
    letterSpacing: 0.4,
  },
  heroPriceBadge: {
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 8,
    alignItems: "flex-end",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  heroPriceBadgeLabel: {
    fontSize: 10,
    fontWeight: "600",
    color: "rgba(255,255,255,0.85)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  heroPriceBadgeValue: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.white,
    marginTop: 1,
  },
  heroTitle: {
    fontSize: 28,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: -0.5,
    lineHeight: 32,
  },
  section: { marginBottom: SPACING.lg },
  stitchingSection: { marginBottom: SPACING.md },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.black,
    marginBottom: 6,
    letterSpacing: -0.2,
  },
  sectionLead: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.sm,
    lineHeight: 18,
  },
  sectionSub: {
    fontSize: 13,
    color: COLORS.gray,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  description: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 23,
  },
  stitchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 20,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.06,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },
  stitchCardSelected: {
    borderColor: COLORS.primaryDark,
    borderWidth: 2,
    backgroundColor: "#f0fafb",
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.14,
        shadowRadius: 14,
      },
      android: { elevation: 5 },
    }),
  },
  stitchCardRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.md,
  },
  stitchIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  stitchBody: { flex: 1, minWidth: 0 },
  stitchTitle: {
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.black,
    marginBottom: 4,
  },
  stitchDesc: {
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 17,
    marginBottom: 6,
  },
  stitchPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  stitchActiveDot: { marginTop: 4 },
  stitchRadio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    marginTop: 4,
  },
  stitchQtyRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: SPACING.md,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(12, 108, 117, 0.12)",
  },
  stitchQtyLabel: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.black,
  },
  stitchQtyControl: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    paddingHorizontal: 4,
  },
  stitchQtyBtn: {
    width: 36,
    height: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  stitchQtyValue: {
    minWidth: 28,
    textAlign: "center",
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.black,
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    height: 54,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.22,
        shadowRadius: 10,
      },
      android: { elevation: 5 },
    }),
  },
  continueBtnDisabled: { opacity: 0.5 },
  continueBtnText: { fontSize: 16, fontWeight: "800", color: COLORS.white },
  loadingWrap: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  loadingText: { fontSize: 14, color: COLORS.gray },
  emptyWrap: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptyDesc: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  optionCardPressed: { opacity: 0.92 },
});
