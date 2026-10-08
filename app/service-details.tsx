/**
 * Service Details - configure stitching type, options, and quantity.
 * Bottom CTA: Add to Cart (cart flow) + Book Now (direct checkout flow).
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    useWindowDimensions,
    View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import AddonPicker from "../src/components/service/AddonPicker";
import ErrorState from "../src/components/common/ErrorState";
import ScreenHeader from "../src/components/common/ScreenHeader";
import { useAppLanguage } from "../src/i18n/useAppLanguage";
import {
    fetchBillingEstimate,
    fetchCatalogTree,
    fetchServiceAddons,
    fetchServiceRatings,
    findDirectServiceByName,
    findServiceLine,
    findServiceLineByName,
    resolveCatalogCategory,
    type BillingEstimate,
    type ServiceRatings,
} from "../src/services/catalogService";
import { useCartStore } from "../src/store/useCartStore";
import { useToastStore } from "../src/store/useToastStore";
import type {
    CatalogDirectService,
    CatalogServiceLine,
    CatalogStitchingType,
    ServiceAddon,
} from "../src/types/catalogApi";
import { safeRouterPush } from "../src/utils/safeNavigation";
import { normalizeServiceImageUrl } from "../src/utils/serviceImage";
import { fallbackTierDescription } from "../src/services/fallbackDescription";
import { stripQualityPrefix } from "../src/services/alterationGroups";
import { useAuthStore } from "../store/useAuthStore";
import type { SelectedAddon, StitchingPreferences } from "../src/types/cart";

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


function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

function getServiceBaseName(name: string): string {
  const t = name.trim();
  const l = t.toLowerCase();
  if (l.startsWith("normal ")) return t.slice("normal ".length).trim();
  if (l.startsWith("designer ")) return t.slice("designer ".length).trim();
  return t;
}

export default function ServiceDetailsScreen() {
  const insets = useSafeAreaInsets();
  const { height: screenHeight } = useWindowDimensions();
  const heroHeight = Math.min(190, Math.max(150, screenHeight * 0.24));
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    setPendingService,
    setPendingRoute,
    setBookingFlowActive,
    setBuyNowMode,
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
    filterBaseName?: string;
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
  const filterBaseName = params.filterBaseName?.trim() || null;

  const catStyle = getCategoryStyle(categoryName);
  // "Custom Alterations" services are repair/resize/adjustment work, not
  // stitching a new garment from scratch - the picker below lists things
  // like "Sleeve Repair"/"Button replacement", so "Alteration type" is the
  // accurate label here, not "Stitching type" (which still applies to
  // every other category, e.g. Men/Women/Kids Clothing's Normal/Designer
  // stitching quality picker).
  const isAlterationsCategory = categoryName.toLowerCase().includes("alteration");

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [serviceLine, setServiceLine] = useState<CatalogServiceLine | null>(null);
  const [directService, setDirectService] = useState<CatalogDirectService | null>(null);
  const [relatedLines, setRelatedLines] = useState<CatalogServiceLine[]>([]);
  const [stitchingTypes, setStitchingTypes] = useState<CatalogStitchingType[]>([]);
  // Every tier on the line, unfiltered by group - stitchingTypes above is
  // narrowed to just the tapped tier for display; this stays the full set
  // so the "Add more work to this garment" checkbox list below can offer
  // tiers from any group (repair/resize/restyle), not just siblings.
  const [allLineTiers, setAllLineTiers] = useState<CatalogStitchingType[]>([]);
  const [checkedTierIds, setCheckedTierIds] = useState<Set<number>>(new Set());
  const [selectedStitchingId, setSelectedStitchingId] = useState<number | null>(null);
  const [designStyle, setDesignStyle] = useState<StitchingPreferences["design_style"] | undefined>(undefined);
  const [embellishmentLevel, setEmbellishmentLevel] = useState<StitchingPreferences["embellishment_level"] | undefined>(undefined);
  const [designNotes, setDesignNotes] = useState("");
  const [categoryImageUrl, setCategoryImageUrl] = useState<string | null>(null);
  const [quantitiesByStitching, setQuantitiesByStitching] = useState<
    Record<number, number>
  >({});
  const [serviceRatings, setServiceRatings] = useState<ServiceRatings | null>(null);
  const [billingEstimate, setBillingEstimate] = useState<BillingEstimate | null>(null);
  const [showBillingBreakdown, setShowBillingBreakdown] = useState(false);
  const [addons, setAddons] = useState<ServiceAddon[]>([]);
  const [selectedAddons, setSelectedAddons] = useState<SelectedAddon[]>([]);
  // Per-extra-tier add-on catalog/selection, keyed by that tier's own
  // service_id - "Add more work to this garment" previously let a customer
  // check e.g. Sleeve Repair as an extra tier with no way to also pick its
  // own add-ons (Button Replacement, etc), even though that same tier's
  // own detail page has a full AddonPicker for it. Fetched lazily, only
  // once a tier is actually checked, not for every tier up front.
  const [extraTierAddons, setExtraTierAddons] = useState<Record<number, ServiceAddon[]>>({});
  const [extraTierSelectedAddons, setExtraTierSelectedAddons] = useState<Record<number, SelectedAddon[]>>({});
  const [extraTierAddonsLoading, setExtraTierAddonsLoading] = useState<Record<number, boolean>>({});

  const { t } = useAppLanguage();

  // Bug fix: "Can't perform a React state update on a component that
  // hasn't mounted yet"/"on an unmounted component" - loadServiceData,
  // the ratings fetch, and the per-tier addon fetch below all call
  // setState after an await with no guard, so navigating away from this
  // screen while any of them was still in flight (back button, tapping a
  // related-line card) fired the warning. Same isMountedRef guard pattern
  // as OrderTimeline/index.tsx.
  const isMountedRef = useRef(true);
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Capped at 5 (was 99) - matches the backend's own cap (cart.py schema),
  // and a doorstep-tailoring order this large per line item is almost
  // always a mistake, not a genuine home-customer order.
  const MAX_QUANTITY = 5;

  const getQuantityForStitching = useCallback(
    (stitchingId: number) => {
      const qty = quantitiesByStitching[stitchingId] ?? 1;
      return Math.min(MAX_QUANTITY, Math.max(1, qty));
    },
    [quantitiesByStitching],
  );

  const updateStitchingQuantity = useCallback(
    (stitchingId: number, next: number) => {
      const clamped = Math.min(MAX_QUANTITY, Math.max(1, next));
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
      setLoadError(false);
      try {
        const tree = await fetchCatalogTree();
        if (!isMountedRef.current) return;
        const category = resolveCatalogCategory(
          tree,
          catalogCategoryId,
          categoryName,
        );

        if (!category) {
          setServiceLine(null);
          setDirectService(null);
          setStitchingTypes([]);
          setAllLineTiers([]);
          setRelatedLines([]);
          return;
        }

        setCategoryImageUrl(normalizeServiceImageUrl(category.image_url) ?? null);

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
          const allTypes = [...(line.stitching_types ?? [])].sort(
            (a, b) => a.display_order - b.display_order,
          );
          // Custom Alterations tiers are booked one at a time - this screen
          // shows exactly the tapped tier's own info, never a picker to
          // switch between siblings (matches the website's tier detail
          // page). sub-services.tsx's older flow narrows by exact quality
          // name (filterBaseName, e.g. "Sleeve Repair" out of Normal/
          // Designer); alteration-group.tsx and any other alteration entry
          // narrow to just the one tapped tier by id. Wanting to add
          // several alteration tiers to one order is handled separately by
          // the "Add more work to this garment" checkbox list below, which
          // reads from allLineTiers (the full, unfiltered line) rather than
          // this narrowed list.
          //
          // Bug fix: the home screen's "Popular Services" card
          // (navigateToServiceDetails/buildServiceDetailsParams) passes
          // neither filterBaseName nor selectedStitchingId, only
          // bookableServiceId - so a Custom Alterations popular-service tap
          // (e.g. "Blouse Alteration") fell all the way through to
          // `types = allTypes`, showing every alteration tier in the whole
          // Blouse line (Sleeve Length, Stitching Repair, Neck Adjustment,
          // Hooks/button/zip, ...) as individually selectable primary
          // tiles instead of just the one tapped service. bookableServiceId
          // is now a third narrowing fallback, same one-tier-only behavior
          // as selectedStitchingId.
          let types = allTypes;
          if (filterBaseName) {
            types = allTypes.filter((t) => getServiceBaseName(t.name) === filterBaseName);
          } else if (isAlterationsCategory && paramSelectedStitchingId > 0) {
            const tapped = allTypes.find((t) => t.service_id === paramSelectedStitchingId);
            if (tapped) types = [tapped];
          } else if (isAlterationsCategory && paramBookableId > 0) {
            const tapped = allTypes.find((t) => t.service_id === paramBookableId);
            if (tapped) types = [tapped];
          }
          setStitchingTypes(types);
          setAllLineTiers(allTypes);
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
              description: direct.description,
              base_price: direct.base_price,
              estimated_delivery_days: direct.estimated_delivery_days ?? 7,
              display_order: 0,
              is_premium: direct.is_premium ?? false,
              is_active: direct.is_active ?? true,
              image_url: direct.image_url,
              highlights: direct.highlights ?? [],
              service_line_id: direct.service_line_id ?? 0,
              service_line_name: direct.service_line_name ?? direct.name,
              category_id: direct.category_id,
              category_name: direct.category_name,
            },
          ]);
          setSelectedStitchingId(direct.service_id);
          setAllLineTiers([]);
          setRelatedLines(
            [...category.service_lines].sort(
              (a, b) => a.display_order - b.display_order,
            ),
          );
        } else {
          setServiceLine(null);
          setDirectService(null);
          setStitchingTypes([]);
          setAllLineTiers([]);
          setRelatedLines([]);
        }
      } catch {
        if (!isMountedRef.current) return;
        setServiceLine(null);
        setDirectService(null);
        setStitchingTypes([]);
        setAllLineTiers([]);
        setRelatedLines([]);
        setLoadError(true);
      } finally {
        if (isMountedRef.current) setLoading(false);
      }
    },
    [
      catalogCategoryId,
      categoryName,
      paramSelectedStitchingId,
      serviceName,
      filterBaseName,
    ],
  );

  // Kicks off an async service-data fetch - real network side-effect.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadServiceData(
      paramServiceLineId > 0 ? paramServiceLineId : undefined,
      serviceName,
    );
  }, [loadServiceData, paramServiceLineId, serviceName]);

  useEffect(() => {
    const ratingServiceId =
      paramBookableId > 0 ? paramBookableId : paramServiceLineId;
    if (ratingServiceId > 0) {
      void fetchServiceRatings(ratingServiceId).then((result) => {
        if (isMountedRef.current) setServiceRatings(result);
      });
    }
  }, [paramBookableId, paramServiceLineId]);

  // GST rate/platform fee - not per-service, fetched once for the whole
  // screen. Matches bookmydarzi-web-final's useBillingEstimate hook.
  useEffect(() => {
    void fetchBillingEstimate().then((result) => {
      if (isMountedRef.current) setBillingEstimate(result);
    });
  }, []);

  // Syncs quantitiesByStitching from URL params (e.g. deep-linking back
  // into this screen with a pre-set quantity) - reacts to a prop-derived
  // param, not something computable purely during render.
  useEffect(() => {
    if (paramQuantity >= 1 && paramQuantity <= 99 && paramSelectedStitchingId > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
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

  // Add-ons are per-service (see ServiceAddon.ServiceId) - refetch and clear
  // any prior selection whenever the customer switches stitching type
  // (Normal/Designer), since one variant's extras don't apply to another.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setSelectedAddons([]);
    setCheckedTierIds(new Set());
    if (!selectedStitching || selectedStitching.service_id <= 0) {
      setAddons([]);
      return;
    }
    let cancelled = false;
    void fetchServiceAddons(selectedStitching.service_id).then((result) => {
      if (!cancelled) setAddons(result);
    });
    return () => {
      cancelled = true;
    };
    // Deliberately keyed on service_id alone, not the whole selectedStitching
    // object (a new object identity on every catalog refetch would otherwise
    // re-fetch addons and wipe the customer's selection for no reason).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedStitching?.service_id]);

  const addonsTotal = useMemo(
    () => selectedAddons.reduce((sum, a) => sum + a.price, 0),
    [selectedAddons],
  );

  // Mirrors bookmydarzi-web-final's identical liveTotal computation
  // (AlterationGroupPicker.tsx), which mirrors backend's compute_billing
  // (app/services/orders/billing_breakdown.py) - rounds subtotal, GST,
  // and platform fee independently and sums the already-rounded pieces,
  // not just the final total once, since BookMyDarzi never bills in
  // paise anywhere and backend rounds at every intermediate step too.
  const billingSubtotal = useMemo(
    () => (selectedStitching ? Math.round(selectedStitching.base_price + addonsTotal) : 0),
    [selectedStitching, addonsTotal],
  );
  const billingGst = useMemo(
    () => (billingEstimate ? Math.round(billingSubtotal * billingEstimate.gst_rate) : 0),
    [billingEstimate, billingSubtotal],
  );
  const billingFee = billingEstimate ? Math.round(billingEstimate.platform_fee) : 0;
  const liveTotal = billingSubtotal + billingGst + billingFee;

  // Selected variant's own photo (e.g. Designer Kurti's actual photo) wins
  // over the shared line image, so the hero updates when the customer
  // switches quality - falls back to the line/param/category image only
  // when that specific variant has no photo of its own.
  const displayImage = useMemo(() => {
    const fromVariant = normalizeServiceImageUrl(selectedStitching?.image_url);
    if (fromVariant) return fromVariant;
    const fromLine = normalizeServiceImageUrl(serviceLine?.image_url);
    if (fromLine) return fromLine;
    const fromParam = normalizeServiceImageUrl(paramImageUrl);
    if (fromParam) return fromParam;
    return categoryImageUrl ?? null;
  }, [selectedStitching, paramImageUrl, serviceLine, categoryImageUrl]);

  // Selected variant's own description wins, same as displayImage above -
  // falls back to the static nav param / line / direct-service description
  // only when that specific variant has none of its own.
  const displayDescription = useMemo(() => {
    const real =
      (selectedStitching?.description ?? "").trim() ||
      paramDescription.trim() ||
      (serviceLine?.description ?? "").trim() ||
      (directService?.description ?? "").trim();
    if (real) return real;
    if (!selectedStitching) return "";
    return fallbackTierDescription({
      name: selectedStitching.name,
      basePrice: selectedStitching.base_price,
      estimatedDeliveryDays: selectedStitching.estimated_delivery_days ?? 7,
    });
  }, [selectedStitching, paramDescription, serviceLine, directService]);

  const lowestPrice = useMemo(
    () =>
      stitchingTypes.length > 0
        ? Math.min(...stitchingTypes.map((s) => s.base_price))
        : paramBasePrice,
    [stitchingTypes, paramBasePrice],
  );

  const canContinue = selectedStitching != null && selectedStitching.service_id > 0;

  const [addingToCart, setAddingToCart] = useState(false);

  // Add to Cart never needs an address - nothing ships yet, the item just
  // joins the cart (address is only resolved once at actual checkout, see
  // app/(tabs)/cart.tsx's resolveCheckoutAddressId). Previously this routed
  // through the same /address screen "Book Now" uses, interrupting
  // browsing on every single add - stays on this page instead, matching
  // the same no-navigation pattern already used for the home screen's
  // popular-service shortcut (src/utils/popularCartAdd.ts).
  const handleContinue = useCallback(async () => {
    if (!selectedStitching) {
      Alert.alert("Select stitching type", "Please choose a stitching type to continue.");
      return;
    }
    if (!isAuthenticated) {
      const qty = getQuantityForStitching(selectedStitching.service_id);
      const isPremiumSelected = selectedStitching.is_premium ?? false;
      setPendingService({
        bookableServiceId: selectedStitching.service_id,
        serviceLineId: serviceLine?.id,
        serviceLineName: serviceLine?.name ?? directService?.name ?? serviceName,
        stitchingType: selectedStitching.name,
        categoryId: catalogCategoryId,
        categoryName,
        basePrice: selectedStitching.base_price,
        // Bug fix: this used to always prefix the garment/line name
        // ("Lehenga Alteration · Lehenga Waist Alteration"), redundant for
        // Custom Alterations where the leaf's own name is already fully
        // specific - same rule as the backend's order-display fix
        // (order_display.py/customer_order_history_service.py). Regular
        // clothing keeps the "Line · Tier" format (e.g. "Shirts · Normal
        // Stitching"), still genuinely informative there.
        displayName: isAlterationsCategory
          ? selectedStitching.name
          : `${serviceLine?.name ?? serviceName} · ${selectedStitching.name}`,
        imageUrl: displayImage,
        quantity: qty,
        stitchingPreferences: isPremiumSelected
          ? {
              design_style: designStyle,
              embellishment_level: embellishmentLevel,
              design_notes: designNotes.trim() || undefined,
            }
          : undefined,
        addons: selectedAddons.length > 0 ? selectedAddons : undefined,
      });
      setBuyNowMode(false);
      setPendingRoute("/service-details", buildReturnParams());
      safeRouterPush(router, "/(auth)/login");
      return;
    }

    const isPremiumSelected = selectedStitching.is_premium ?? false;
    const extraTiers = allLineTiers.filter((t) => checkedTierIds.has(t.service_id));
    // Suppress each call's own default "Added to Cart" toast whenever
    // extras are involved, since a single combined summary toast fires
    // once the whole batch finishes below - otherwise checking 2 extra
    // tiers fires 3 separate "Added to Cart" toasts back-to-back before
    // the real summary, a visible stacking/flicker bug.
    const suppressPerCallToast = extraTiers.length > 0;
    setAddingToCart(true);
    try {
      await useCartStore.getState().addServiceEntry({
        service_id: selectedStitching.service_id,
        quantity: getQuantityForStitching(selectedStitching.service_id),
        stitching_preferences: isPremiumSelected
          ? {
              design_style: designStyle,
              embellishment_level: embellishmentLevel,
              design_notes: designNotes.trim() || undefined,
            }
          : undefined,
        addons: selectedAddons.length > 0 ? selectedAddons : undefined,
      }, suppressPerCallToast ? { toastMessage: null } : undefined);

      // "Add more work to this garment" - each ticked tier is a full,
      // independently priced/bookable service in its own right (not a
      // ServiceAddon extra), so each becomes its own cart line via the
      // same single-item add call, fired sequentially rather than in
      // parallel so cart state stays consistent call-by-call. A tier that
      // fails partway through does not roll back the ones that already
      // succeeded - those are valid lines the customer would still want;
      // they're told exactly which one failed and can retry from cart.
      const failedNames: string[] = [];
      for (const tier of extraTiers) {
        const tierAddons = extraTierSelectedAddons[tier.service_id];
        try {
          await useCartStore.getState().addServiceEntry({
            service_id: tier.service_id,
            quantity: 1,
            addons: tierAddons && tierAddons.length > 0 ? tierAddons : undefined,
          }, { toastMessage: null });
        } catch {
          failedNames.push(stripQualityPrefix(tier.name));
        }
      }
      if (!isMountedRef.current) return;
      setCheckedTierIds(new Set());
      setExtraTierSelectedAddons({});
      if (failedNames.length > 0) {
        useToastStore.getState().show(
          `Added to cart, but couldn't add: ${failedNames.join(", ")}. Try again from the cart.`,
          "error",
        );
      } else if (extraTiers.length > 0) {
        useToastStore.getState().show(
          `Added ${extraTiers.length + 1} items to cart.`,
          "success",
        );
      }
    } catch {
      // addServiceEntry already surfaces its own error via useCartStore's
      // error state / a caller-visible throw - nothing further to do here
      // beyond not leaving the button stuck in a loading state.
    } finally {
      if (isMountedRef.current) setAddingToCart(false);
    }
  }, [
    selectedStitching, isAuthenticated, getQuantityForStitching,
    serviceLine, directService?.name, serviceName, catalogCategoryId, categoryName,
    displayImage, designStyle, embellishmentLevel, designNotes, selectedAddons,
    allLineTiers, checkedTierIds, extraTierSelectedAddons,
    setPendingService, setBuyNowMode, setPendingRoute, buildReturnParams, router,
  ]);

  const handleBookNow = useCallback(() => {
    if (!selectedStitching) {
      Alert.alert("Select stitching type", "Please choose a stitching type to continue.");
      return;
    }
    const qty = getQuantityForStitching(selectedStitching.service_id);
    const isPremiumSelected = selectedStitching.is_premium ?? false;
    const extraTiers = allLineTiers.filter((t) => checkedTierIds.has(t.service_id));
    const pendingItem = {
      bookableServiceId: selectedStitching.service_id,
      serviceLineId: serviceLine?.id,
      serviceLineName: serviceLine?.name ?? directService?.name ?? serviceName,
      stitchingType: selectedStitching.name,
      categoryId: catalogCategoryId,
      categoryName,
      basePrice: selectedStitching.base_price,
      // See the identical comment on the unauthenticated-user branch above.
      displayName: isAlterationsCategory
        ? selectedStitching.name
        : `${serviceLine?.name ?? serviceName} · ${selectedStitching.name}`,
      imageUrl: displayImage,
      quantity: qty,
      stitchingPreferences: isPremiumSelected
        ? {
            design_style: designStyle,
            embellishment_level: embellishmentLevel,
            design_notes: designNotes.trim() || undefined,
          }
        : undefined,
      addons: selectedAddons.length > 0 ? selectedAddons : undefined,
      // "Add more work to this garment" - each checked tier becomes its
      // own real order line via POST /orders/direct's multi-item `items`,
      // a genuine multi-item Book Now (no cart involved at all), not the
      // primary tier's own addons.
      extraItems: extraTiers.length > 0
        ? extraTiers.map((t) => {
            const tierAddons = extraTierSelectedAddons[t.service_id];
            return {
              serviceId: t.service_id,
              name: stripQualityPrefix(t.name),
              basePrice: t.base_price,
              addons: tierAddons && tierAddons.length > 0 ? tierAddons : undefined,
            };
          })
        : undefined,
    };
    if (!isAuthenticated) {
      setPendingService(pendingItem);
      setBuyNowMode(true);
      setPendingRoute("/service-details", buildReturnParams());
      safeRouterPush(router, "/(auth)/login");
      return;
    }
    setPendingService(pendingItem);
    setBuyNowMode(true);
    setCheckedTierIds(new Set());
    setExtraTierSelectedAddons({});
    // Book Now skips the cart entirely, so (unlike Add to Cart) it does
    // need an address right away - measurement is still never collected
    // from the customer here; that's filled later by Bridge/employee at
    // pickup, or by Admin.
    setBookingFlowActive(false);
    safeRouterPush(router, { pathname: "/address", params: { mode: "buy-now" } } as never);
  }, [
    selectedStitching, getQuantityForStitching, serviceLine, directService?.name, serviceName,
    catalogCategoryId, categoryName, displayImage, designStyle, embellishmentLevel, designNotes,
    selectedAddons, isAuthenticated, setPendingService, setBuyNowMode, setPendingRoute,
    buildReturnParams, router, setBookingFlowActive, allLineTiers, checkedTierIds,
    extraTierSelectedAddons,
  ]);

  // Every other bookable tier on this same line, any group (e.g. "Button
  // Replacement" or "Waist Adjustment" while "Sleeve Repair" is the primary
  // tier) - offered as opt-in checkboxes so a customer fixing one garment
  // can add several tiers of work to it in one Add to Cart tap, instead of
  // navigating back and adding each one separately.
  const otherTiers = useMemo(
    () => allLineTiers.filter((s) => s.service_id !== selectedStitchingId),
    [allLineTiers, selectedStitchingId],
  );

  const toggleTierChecked = useCallback((serviceId: number) => {
    setCheckedTierIds((prev) => {
      const next = new Set(prev);
      const wasChecked = next.has(serviceId);
      if (wasChecked) next.delete(serviceId);
      else next.add(serviceId);

      if (wasChecked) {
        // Unchecked - drop this tier's addon selection so a stale pick
        // doesn't silently resurface if it's checked again later, and
        // free the fetched catalog (cheap to refetch if needed again).
        setExtraTierSelectedAddons((prevSel) => {
          if (!(serviceId in prevSel)) return prevSel;
          const copy = { ...prevSel };
          delete copy[serviceId];
          return copy;
        });
      } else if (!(serviceId in extraTierAddons) && !extraTierAddonsLoading[serviceId]) {
        // First time this tier is checked - fetch its own add-on catalog,
        // same data every tier's own detail page already fetches for
        // itself, just lazily and scoped to this one tier.
        setExtraTierAddonsLoading((prevLoading) => ({ ...prevLoading, [serviceId]: true }));
        void fetchServiceAddons(serviceId)
          .then((result) => {
            if (!isMountedRef.current) return;
            setExtraTierAddons((prevAddons) => ({ ...prevAddons, [serviceId]: result }));
          })
          .finally(() => {
            if (isMountedRef.current) {
              setExtraTierAddonsLoading((prevLoading) => ({ ...prevLoading, [serviceId]: false }));
            }
          });
      }
      return next;
    });
  }, [extraTierAddons, extraTierAddonsLoading]);

  const navigateToRelatedLine = useCallback(
    (relatedLine: CatalogServiceLine) => {
      const firstStitch = relatedLine.stitching_types[0];
      if (!firstStitch) return;
      safeRouterPush(router, {
        pathname: "/service-details",
        params: {
          catalogCategoryId: String(catalogCategoryId),
          categoryName,
          serviceName: relatedLine.name,
          serviceLineId: String(relatedLine.id),
          bookableServiceId: String(firstStitch.service_id),
          basePrice: String(relatedLine.starting_price),
          imageUrl: relatedLine.image_url ?? "",
          description: relatedLine.description ?? "",
        },
      } as never);
    },
    [router, catalogCategoryId, categoryName],
  );

  return (
    <View style={styles.root}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scroll,
          // Bottom padding now also clears the fixed CTA footer below
          // (roughly its own height + safe-area inset) so the last scroll
          // content ("You might also like") never ends up hidden behind it.
          { paddingTop: insets.top, paddingBottom: insets.bottom + 140 },
        ]}
      >
        <ScreenHeader title={filterBaseName ?? serviceLine?.name ?? serviceName} />

        <Animated.View entering={FadeInDown.duration(400)} style={[styles.heroCard, { height: heroHeight }]}>
          {displayImage ? (
            <Image source={{ uri: displayImage }} style={styles.heroImage} contentFit="cover" cachePolicy="memory-disk" transition={150} />
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
            {/* Service name lives in the header now - not repeated on the
                image. Only the price pill sits at the bottom of the hero. */}
            <LinearGradient
              colors={["#0c6c75", "#1aa3b0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.heroPriceBadge}
            >
              <Text style={styles.heroPriceBadgeValue}>
                Starting from {formatMoney(lowestPrice)}
              </Text>
            </LinearGradient>
          </LinearGradient>
        </Animated.View>

        {/* Guarantee strip - builds trust before they read the details */}
        <Animated.View entering={FadeInDown.delay(30).duration(380)} style={styles.guaranteeStrip}>
          {(
            [
              { icon: "ribbon-outline" as const,            text: "Fit guaranteed\nor free redo" },
              { icon: "shield-checkmark-outline" as const,  text: "Verified expert\ntailors" },
              { icon: "bicycle-outline" as const,           text: "Doorstep pickup\n& delivery" },
            ] as const
          ).map((item, i) => (
            <React.Fragment key={item.icon}>
              <View style={styles.guaranteeItem}>
                <View style={styles.guaranteeIconBox}>
                  <Ionicons name={item.icon} size={16} color="#0c6c75" />
                </View>
                <Text style={styles.guaranteeText}>{item.text}</Text>
              </View>
              {i < 2 ? <View style={styles.guaranteeDivider} /> : null}
            </React.Fragment>
          ))}
        </Animated.View>

        {serviceRatings != null && serviceRatings.total_reviews > 0 ? (
          <Animated.View
            entering={FadeInDown.delay(40).duration(400)}
            style={styles.ratingsSection}
          >
            <Text style={styles.sectionTitle}>{t("service.customerReviews")}</Text>
            <View style={styles.ratingsSummary}>
              <View style={styles.ratingsScoreCol}>
                <Text style={styles.ratingsScore}>
                  {serviceRatings.avg_rating.toFixed(1)}
                </Text>
                <View style={styles.starsRow}>
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Ionicons
                      key={star}
                      name={
                        serviceRatings.avg_rating >= star
                          ? "star"
                          : serviceRatings.avg_rating >= star - 0.5
                          ? "star-half"
                          : "star-outline"
                      }
                      size={14}
                      color="#F59E0B"
                    />
                  ))}
                </View>
                <Text style={styles.ratingsCount}>
                  {serviceRatings.total_reviews} review
                  {serviceRatings.total_reviews !== 1 ? "s" : ""}
                </Text>
              </View>
              <View style={styles.ratingsBarsCol}>
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = serviceRatings.star_counts[String(star)] ?? 0;
                  const pct =
                    serviceRatings.total_reviews > 0
                      ? count / serviceRatings.total_reviews
                      : 0;
                  return (
                    <View key={star} style={styles.ratingsBarRow}>
                      <Text style={styles.ratingsBarLabel}>{star}</Text>
                      <View style={styles.ratingsBarTrack}>
                        <View
                          style={[styles.ratingsBarFill, { flex: pct }]}
                        />
                        <View style={{ flex: 1 - pct }} />
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>

            {serviceRatings.recent_reviews.length > 0 ? (
              <View style={styles.reviewsList}>
                {serviceRatings.recent_reviews.slice(0, 3).map((review, idx) => (
                  <View key={idx} style={styles.reviewCard}>
                    <View style={styles.reviewHeader}>
                      <View style={styles.reviewStars}>
                        {[1, 2, 3, 4, 5].map((s) => (
                          <Ionicons
                            key={s}
                            name={s <= review.rating ? "star" : "star-outline"}
                            size={12}
                            color="#F59E0B"
                          />
                        ))}
                      </View>
                      {review.created_at ? (
                        <Text style={styles.reviewDate}>
                          {new Date(review.created_at).toLocaleDateString("en-IN", {
                            day: "numeric",
                            month: "short",
                            year: "numeric",
                          })}
                        </Text>
                      ) : null}
                    </View>
                    {review.comment ? (
                      <Text style={styles.reviewComment} numberOfLines={3}>
                        {review.comment}
                      </Text>
                    ) : (
                      <Text style={styles.reviewNoComment}>No comment</Text>
                    )}
                  </View>
                ))}
              </View>
            ) : null}
          </Animated.View>
        ) : null}

        {loading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color={COLORS.primary} />
            <Text style={styles.loadingText}>Loading options...</Text>
          </View>
        ) : loadError ? (
          <ErrorState
            message="Could not load service details. Please check your connection and try again."
            onRetry={() =>
              loadServiceData(
                paramServiceLineId > 0 ? paramServiceLineId : undefined,
                serviceName,
              )
            }
          />
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
              {isAlterationsCategory && stitchingTypes.length <= 1 ? null : (
                <>
                  <Text style={styles.sectionTitle}>
                    {isAlterationsCategory ? "Alteration type" : t("service.stitchingType")}
                  </Text>
                  <Text style={styles.sectionSub}>
                    {isAlterationsCategory ? "Select the work you need" : t("service.selectFinish")}
                  </Text>
                </>
              )}
              {stitchingTypes.map((stitching) => {
                const selected = stitching.service_id === selectedStitchingId;
                const isPremium = stitching.is_premium ?? false;
                const stitchQty = getQuantityForStitching(stitching.service_id);
                const deliveryDays = stitching.estimated_delivery_days ?? 7;
                const highlights = stitching.highlights ?? [];
                const stitchDesc = stitching.description?.trim() || null;
                return (
                  <Pressable
                    key={stitching.service_id}
                    style={({ pressed }) => [
                      styles.stitchCard,
                      isPremium && !selected && styles.stitchCardPremium,
                      selected && styles.stitchCardSelected,
                      pressed && styles.optionCardPressed,
                    ]}
                    onPress={() => setSelectedStitchingId(stitching.service_id)}
                  >
                    <View style={styles.stitchCardRow}>
                      <View
                        style={[
                          styles.stitchIcon,
                          { backgroundColor: isPremium ? "#F5E6C0" : COLORS.primaryLight },
                        ]}
                      >
                        <Ionicons
                          name={isPremium ? "diamond-outline" : "shirt-outline"}
                          size={24}
                          color={isPremium ? "#C9A84C" : COLORS.primaryDark}
                        />
                      </View>
                      <View style={styles.stitchBody}>
                        <View style={styles.stitchTitleRow}>
                          <Text style={styles.stitchTitle}>
                            {isAlterationsCategory ? stripQualityPrefix(stitching.name) : stitching.name}
                          </Text>
                          {isPremium ? (
                            <View style={styles.premiumBadge}>
                              <Ionicons name="diamond-outline" size={9} color="#C9A84C" />
                              <Text style={styles.premiumBadgeText}>Designer Pick</Text>
                            </View>
                          ) : null}
                        </View>
                        {stitchDesc ? (
                          <Text style={styles.stitchDesc}>{stitchDesc}</Text>
                        ) : null}
                        <View style={styles.stitchMeta}>
                          <View>
                            <Text style={styles.stitchPrice}>
                              {formatMoney(
                                selected && addonsTotal > 0
                                  ? stitching.base_price + addonsTotal
                                  : stitching.base_price,
                              )}
                            </Text>
                            {selected && addonsTotal > 0 ? (
                              <Text style={styles.stitchPriceBase}>
                                {formatMoney(stitching.base_price)} + extras
                              </Text>
                            ) : null}
                          </View>
                          <View style={styles.deliveryBadge}>
                            <Ionicons name="time-outline" size={11} color="#065F46" />
                            <Text style={styles.deliveryBadgeText}>{deliveryDays}d</Text>
                          </View>
                        </View>
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

                    {selected && highlights.length > 0 ? (
                      <View style={styles.highlightsWrap}>
                        {highlights.map((h, idx) => (
                          <View key={idx} style={styles.highlightRow}>
                            <Ionicons name="checkmark-circle" size={13} color={COLORS.primaryDark} />
                            <Text style={styles.highlightText}>{h}</Text>
                          </View>
                        ))}
                      </View>
                    ) : null}

                    {selected ? (
                      <View style={styles.stitchQtyRow}>
                        <Text style={styles.stitchQtyLabel}>{t("service.quantity")}</Text>
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

                    {selected && addons.length > 0 ? (
                      <View style={styles.addonsWrap}>
                        <AddonPicker addons={addons} onChange={setSelectedAddons} />
                      </View>
                    ) : null}

                    {selected && isPremium ? (
                      <View style={styles.designBriefWrap}>
                        <View style={styles.designBriefHeader}>
                          <Ionicons name="diamond-outline" size={14} color="#C9A84C" />
                          <Text style={styles.designBriefTitle}>Your Design Brief</Text>
                        </View>
                        <Text style={styles.designBriefSub}>
                          Tell your specialist tailor what you have in mind - optional, but helps them nail the design.
                        </Text>

                        <Text style={styles.designBriefLabel}>Design style</Text>
                        <View style={styles.designChipRow}>
                          {(["traditional", "contemporary", "fusion", "custom"] as const).map((opt) => (
                            <TouchableOpacity
                              key={opt}
                              style={[styles.designChip, designStyle === opt && styles.designChipSelected]}
                              onPress={() => setDesignStyle(designStyle === opt ? undefined : opt)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.designChipText, designStyle === opt && styles.designChipTextSelected]}>
                                {opt.charAt(0).toUpperCase() + opt.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.designBriefLabel}>Embellishment</Text>
                        <View style={styles.designChipRow}>
                          {(["none", "light", "heavy"] as const).map((opt) => (
                            <TouchableOpacity
                              key={opt}
                              style={[styles.designChip, embellishmentLevel === opt && styles.designChipSelected]}
                              onPress={() => setEmbellishmentLevel(embellishmentLevel === opt ? undefined : opt)}
                              activeOpacity={0.8}
                            >
                              <Text style={[styles.designChipText, embellishmentLevel === opt && styles.designChipTextSelected]}>
                                {opt.charAt(0).toUpperCase() + opt.slice(1)}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>

                        <Text style={styles.designBriefLabel}>Describe your design idea</Text>
                        <TextInput
                          style={styles.designNotesInput}
                          placeholder="e.g. Mandarin collar, full sleeves, like a Pathani suit"
                          placeholderTextColor={COLORS.gray}
                          value={designNotes}
                          onChangeText={setDesignNotes}
                          multiline
                          numberOfLines={3}
                          maxLength={1000}
                        />
                      </View>
                    ) : null}
                  </Pressable>
                );
              })}
            </Animated.View>

            {otherTiers.length > 0 ? (
              <View style={styles.otherTiersSection}>
                <Text style={styles.sectionTitle}>Add more work to this garment</Text>
                <Text style={styles.sectionSub}>
                  Fixing more than one thing? Add it now in the same order.
                </Text>
                <View style={styles.otherTiersList}>
                  {otherTiers.map((tier) => {
                    const checked = checkedTierIds.has(tier.service_id);
                    const tierAddons = extraTierAddons[tier.service_id] ?? [];
                    const tierAddonsLoading = !!extraTierAddonsLoading[tier.service_id];
                    return (
                      <View
                        key={tier.service_id}
                        style={[styles.otherTierCard, checked && styles.otherTierCardChecked]}
                      >
                        <TouchableOpacity
                          style={styles.otherTierRow}
                          activeOpacity={0.85}
                          onPress={() => toggleTierChecked(tier.service_id)}
                        >
                          {normalizeServiceImageUrl(tier.image_url) ? (
                            <Image
                              source={{ uri: normalizeServiceImageUrl(tier.image_url)! }}
                              style={styles.otherTierImage}
                              contentFit="cover"
                              cachePolicy="memory-disk"
                              transition={150}
                            />
                          ) : (
                            <View style={styles.otherTierImageFallback}>
                              <Ionicons name="cut-outline" size={20} color={COLORS.primaryDark} />
                            </View>
                          )}
                          <View style={styles.otherTierBody}>
                            <Text style={styles.otherTierName} numberOfLines={1}>
                              {isAlterationsCategory ? stripQualityPrefix(tier.name) : tier.name}
                            </Text>
                            <View style={styles.otherTierMetaRow}>
                              <Text style={styles.otherTierPrice}>{formatMoney(tier.base_price)}</Text>
                              <Ionicons name="time-outline" size={11} color={COLORS.gray} />
                              <Text style={styles.otherTierDays}>
                                {tier.estimated_delivery_days ?? 7}d
                              </Text>
                            </View>
                          </View>
                          <Ionicons
                            name={checked ? "checkmark-circle" : "ellipse-outline"}
                            size={22}
                            color={checked ? COLORS.primaryDark : COLORS.grayBorder}
                          />
                        </TouchableOpacity>

                        {/* Inline add-on picker for this tier, only once
                            checked - same picker the primary tier already
                            uses, so checking "Sleeve Repair" as extra work
                            lets a customer pick ITS OWN add-ons (e.g.
                            Button Replacement) exactly like booking it
                            directly would. */}
                        {checked ? (
                          tierAddonsLoading ? (
                            <View style={styles.otherTierAddonsLoading}>
                              <ActivityIndicator size="small" color={COLORS.primaryDark} />
                            </View>
                          ) : tierAddons.length > 0 ? (
                            <View style={styles.otherTierAddonsWrap}>
                              <AddonPicker
                                addons={tierAddons}
                                onChange={(selected) =>
                                  setExtraTierSelectedAddons((prev) => ({
                                    ...prev,
                                    [tier.service_id]: selected,
                                  }))
                                }
                              />
                            </View>
                          ) : null
                        ) : null}
                      </View>
                    );
                  })}
                </View>
              </View>
            ) : null}

            {relatedLines.length > 0 ? (
              <View style={styles.relatedSection}>
                <Text style={styles.sectionTitle}>You might also like</Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={styles.relatedRow}
                >
                  {relatedLines.map((related) => (
                    <TouchableOpacity
                      key={related.id}
                      style={styles.relatedCard}
                      activeOpacity={0.85}
                      onPress={() => navigateToRelatedLine(related)}
                    >
                      <Image
                        source={{ uri: normalizeServiceImageUrl(related.image_url) ?? undefined }}
                        style={styles.relatedCardImage}
                        contentFit="cover"
                        cachePolicy="memory-disk"
                        transition={150}
                      />
                      <Text style={styles.relatedCardName} numberOfLines={1}>
                        {related.name}
                      </Text>
                      <Text style={styles.relatedCardPrice}>
                        From ₹{related.starting_price}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {/* Bug fix: Book Now/Add to Cart used to sit inline in the scroll
          content (right above "You might also like"), so scrolling past
          them made the CTA inaccessible without scrolling back up - exactly
          the "must remain accessible while scrolling" issue flagged in the
          production-safety review. Moved outside the ScrollView as a fixed
          bottom bar, same buttons/styles/handlers, padded for the bottom
          safe-area inset (home indicator / Android nav bar) instead of a
          hardcoded height. Guarded by the same loading/error/empty check
          the CTA's old position was implicitly inside, so it never renders
          floating over a loading spinner or an empty-state message. */}
      {!loading && !loadError && stitchingTypes.length > 0 ? (
        <View style={[styles.ctaFooter, { paddingBottom: insets.bottom + SPACING.sm }]}>
          {checkedTierIds.size > 0 ? (
            <Text style={styles.multiAddHint}>
              All {checkedTierIds.size + 1} items will be booked together in one order.
            </Text>
          ) : null}
          {selectedStitching && checkedTierIds.size === 0 ? (
            <TouchableOpacity
              onPress={() => setShowBillingBreakdown((v) => !v)}
              activeOpacity={0.7}
              style={styles.billingTotalRow}
            >
              <View>
                <View style={styles.billingTotalLabelRow}>
                  <Text style={styles.billingTotalLabel}>Total (incl. GST & fees)</Text>
                  <Ionicons name="information-circle-outline" size={13} color={COLORS.gray} />
                </View>
                <Text style={styles.billingTotalValue}>{formatMoney(liveTotal)}</Text>
              </View>
              <Ionicons
                name={showBillingBreakdown ? "chevron-down" : "chevron-up"}
                size={16}
                color={COLORS.gray}
              />
            </TouchableOpacity>
          ) : null}
          {showBillingBreakdown && selectedStitching && checkedTierIds.size === 0 ? (
            <View style={styles.billingBreakdownBox}>
              <View style={styles.billingBreakdownRow}>
                <Text style={styles.billingBreakdownLabel}>Subtotal</Text>
                <Text style={styles.billingBreakdownValue}>{formatMoney(billingSubtotal)}</Text>
              </View>
              <View style={styles.billingBreakdownRow}>
                <Text style={styles.billingBreakdownLabel}>
                  GST{billingEstimate ? ` (${billingEstimate.gst_percent}%)` : ""}
                </Text>
                <Text style={styles.billingBreakdownValue}>{formatMoney(billingGst)}</Text>
              </View>
              <View style={styles.billingBreakdownRow}>
                <Text style={styles.billingBreakdownLabel}>Platform fee</Text>
                <Text style={styles.billingBreakdownValue}>{formatMoney(billingFee)}</Text>
              </View>
            </View>
          ) : null}
          <View style={styles.ctaRow}>
            <TouchableOpacity
              style={[styles.addToCartBtn, (!canContinue || addingToCart) && styles.continueBtnDisabled]}
              onPress={handleContinue}
              disabled={!canContinue || addingToCart}
              activeOpacity={0.9}
            >
              {addingToCart ? (
                <ActivityIndicator size="small" color={COLORS.primaryDark} />
              ) : (
                <>
                  <Ionicons name="cart-outline" size={18} color={COLORS.primaryDark} />
                  <Text style={styles.addToCartBtnText}>
                    {checkedTierIds.size > 0
                      ? `${t("service.addToCart")} (${checkedTierIds.size + 1})`
                      : t("service.addToCart")}
                  </Text>
                </>
              )}
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.bookNowBtn, !canContinue && styles.continueBtnDisabled]}
              onPress={handleBookNow}
              disabled={!canContinue}
              activeOpacity={0.9}
            >
              <Ionicons name="flash-outline" size={18} color={COLORS.white} />
              <Text style={styles.bookNowBtnText}>
                {checkedTierIds.size > 0
                  ? `${t("service.bookNow")} (${checkedTierIds.size + 1})`
                  : t("service.bookNow")}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  // Uniform vertical rhythm: the ScrollView lays out its section children
  // with a single `gap`, so every block is evenly spaced. Sections must NOT
  // add their own marginBottom (it would stack on top of the gap) or
  // marginHorizontal (the padding here already sets the gutter).
  scroll: { paddingHorizontal: SPACING.md, gap: SPACING.md },
  heroCard: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOW.card,
  },
  heroImage: { width: "100%", height: "100%" },
  heroFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  heroIcon: {
    width: 56,
    height: 56,
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
  heroPriceBadge: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginTop: 8,
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
  heroPriceBadgeValue: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.white,
    letterSpacing: 0.2,
  },
  section: {},
  stitchingSection: {},
  sectionTitle: {
    fontSize: 15,
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
  otherTiersSection: {
    marginTop: SPACING.lg,
  },
  otherTiersList: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  otherTierCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    overflow: "hidden",
  },
  otherTierCardChecked: {
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.primaryLight,
  },
  otherTierRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    padding: SPACING.sm,
  },
  otherTierAddonsWrap: {
    paddingHorizontal: SPACING.sm,
    paddingBottom: SPACING.sm,
    paddingTop: 2,
  },
  otherTierAddonsLoading: {
    paddingVertical: SPACING.sm,
    alignItems: "center",
  },
  otherTierImage: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.grayLight,
  },
  otherTierImageFallback: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  otherTierBody: {
    flex: 1,
    minWidth: 0,
  },
  otherTierName: {
    fontSize: 13.5,
    fontWeight: "700",
    color: COLORS.black,
  },
  otherTierMetaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginTop: 2,
  },
  otherTierPrice: {
    fontSize: 12.5,
    fontWeight: "700",
    color: COLORS.primaryDark,
    marginRight: 4,
  },
  otherTierDays: {
    fontSize: 11,
    color: COLORS.gray,
  },
  multiAddHint: {
    fontSize: 11.5,
    color: COLORS.gray,
    marginTop: SPACING.xs,
    lineHeight: 16,
  },
  billingTotalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: SPACING.xs,
  },
  billingTotalLabelRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  billingTotalLabel: {
    fontSize: 10.5,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.3,
    color: COLORS.gray,
  },
  billingTotalValue: {
    fontSize: 19,
    fontWeight: "800",
    color: COLORS.black,
    marginTop: 2,
  },
  billingBreakdownBox: {
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.xs,
    gap: 4,
  },
  billingBreakdownRow: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  billingBreakdownLabel: {
    fontSize: 12,
    color: COLORS.gray,
  },
  billingBreakdownValue: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.black,
  },
  relatedSection: {
    marginTop: SPACING.lg,
  },
  relatedRow: {
    gap: SPACING.sm,
    paddingRight: SPACING.md,
  },
  relatedCard: {
    width: 132,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  relatedCardImage: {
    width: "100%",
    height: 96,
    backgroundColor: COLORS.grayLight,
  },
  relatedCardName: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.black,
    marginTop: 6,
    marginHorizontal: 8,
  },
  relatedCardPrice: {
    fontSize: 11,
    color: COLORS.gray,
    marginTop: 2,
    marginHorizontal: 8,
    marginBottom: 8,
  },
  description: {
    fontSize: 15,
    color: "#374151",
    lineHeight: 23,
  },
  stitchCard: {
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.sm,
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
  stitchCardPremium: {
    borderColor: "#E8CE8B",
    backgroundColor: "#FFFDF7",
    ...Platform.select({
      ios: {
        shadowColor: "#C9A84C",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.12,
        shadowRadius: 10,
      },
      android: { elevation: 3 },
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
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  stitchBody: { flex: 1, minWidth: 0 },
  stitchTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 6,
    marginBottom: 4,
  },
  stitchTitle: {
    fontSize: 14.5,
    fontWeight: "800",
    color: COLORS.black,
  },
  premiumBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 2,
  },
  premiumBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#92400E",
    letterSpacing: 0.2,
  },
  stitchDesc: {
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 17,
    marginBottom: 6,
  },
  stitchMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stitchPrice: {
    fontSize: 15,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  stitchPriceBase: {
    fontSize: 10.5,
    fontWeight: "600",
    color: COLORS.gray,
  },
  addonsWrap: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(12, 108, 117, 0.12)",
  },
  deliveryBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "#D1FAE5",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  deliveryBadgeText: {
    fontSize: 10,
    fontWeight: "700",
    color: "#065F46",
  },
  highlightsWrap: {
    marginTop: SPACING.sm,
    marginBottom: 2,
    paddingTop: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(12, 108, 117, 0.12)",
    gap: 6,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
  },
  highlightText: {
    fontSize: 12,
    color: "#374151",
    lineHeight: 17,
    flex: 1,
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
  designBriefWrap: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(12, 108, 117, 0.12)",
  },
  designBriefHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  designBriefTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: COLORS.black,
  },
  designBriefSub: {
    fontSize: 11.5,
    color: COLORS.gray,
    marginTop: 3,
    marginBottom: SPACING.sm,
    lineHeight: 15,
  },
  designBriefLabel: {
    fontSize: 11.5,
    fontWeight: "700",
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.3,
    marginTop: SPACING.sm,
    marginBottom: 6,
  },
  designChipRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  designChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    backgroundColor: COLORS.white,
  },
  designChipSelected: {
    borderColor: "#C9A84C",
    backgroundColor: "#FDF3DC",
  },
  designChipText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: COLORS.gray,
  },
  designChipTextSelected: {
    color: "#8A6D1F",
  },
  designNotesInput: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    fontSize: 13,
    color: COLORS.black,
    minHeight: 64,
    textAlignVertical: "top",
  },
  continueBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: COLORS.primaryDark,
    borderRadius: 16,
    height: 48,
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
  continueBtnText: { fontSize: 15, fontWeight: "800", color: COLORS.white },
  ctaRow: {
    flexDirection: "row",
    gap: 10,
  },
  addToCartBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: COLORS.primaryDark,
    backgroundColor: COLORS.white,
  },
  addToCartBtnText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  bookNowBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    height: 48,
    borderRadius: 16,
    backgroundColor: COLORS.primaryDark,
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
  bookNowBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.white,
  },
  ctaFooter: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -2 },
        shadowOpacity: 0.06,
        shadowRadius: 8,
      },
      android: { elevation: 8 },
    }),
  },
  loadingWrap: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  loadingText: { fontSize: 14, color: COLORS.gray },
  emptyWrap: { alignItems: "center", gap: SPACING.sm, paddingVertical: SPACING.xl },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptyDesc: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  optionCardPressed: { opacity: 0.92 },

  // ── Guarantee strip ───────────────────────────────────────────────────────
  guaranteeStrip: {
    flexDirection: "row",
    alignItems: "stretch",
    backgroundColor: "#F0FDFB",
    borderRadius: RADIUS.md,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: "#C7F0EE",
  },
  guaranteeItem: {
    flex: 1,
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 6,
  },
  guaranteeIconBox: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#D1FAF7",
    alignItems: "center",
    justifyContent: "center",
  },
  guaranteeText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#0c6c75",
    textAlign: "center",
    lineHeight: 15,
  },
  guaranteeDivider: {
    width: 1,
    backgroundColor: "#C7F0EE",
    marginVertical: 4,
  },
  ratingsSection: {},
  ratingsSummary: {
    flexDirection: "row",
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: 16,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: { shadowColor: "#0c6c75", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 2 },
    }),
  },
  ratingsScoreCol: { alignItems: "center", justifyContent: "center", minWidth: 60 },
  ratingsScore: { fontSize: 30, fontWeight: "800", color: COLORS.black, lineHeight: 34 },
  starsRow: { flexDirection: "row", gap: 2, marginTop: 4 },
  ratingsCount: { fontSize: 11, color: COLORS.gray, marginTop: 4 },
  ratingsBarsCol: { flex: 1, justifyContent: "center", gap: 5 },
  ratingsBarRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  ratingsBarLabel: { fontSize: 11, color: COLORS.gray, width: 10, textAlign: "right" },
  ratingsBarTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#F3F4F6",
    flexDirection: "row",
    overflow: "hidden",
  },
  ratingsBarFill: { backgroundColor: "#F59E0B", borderRadius: 3 },
  reviewsList: { gap: SPACING.sm },
  reviewCard: {
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: SPACING.sm,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.grayBorder,
  },
  reviewHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  reviewStars: { flexDirection: "row", gap: 2 },
  reviewDate: { fontSize: 11, color: COLORS.gray },
  reviewComment: { fontSize: 14, color: "#374151", lineHeight: 20 },
  reviewNoComment: { fontSize: 13, color: COLORS.gray, fontStyle: "italic" },
});
