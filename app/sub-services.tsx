/**
 * Category Browse - 3-level drawer layout:
 *   Left sidebar  → service lines  (Shirt, Blazer, Sherwani…)
 *   Right panel   → shirt types    (Chinese Collar, Formal, Casual…)
 *   Bottom sheet  → quality picker (Normal / Designer) + quantity + Book
 */
import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Modal,
    Platform,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, { FadeIn, FadeInRight } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import ErrorState from "../src/components/common/ErrorState";
import {
    fetchCatalogSubcategories,
    fetchCatalogTree,
    resolveCatalogCategory,
} from "../src/services/catalogService";
import { useCartStore } from "../src/store/useCartStore";
import type {
    CatalogDirectService,
    CatalogServiceLine,
    CatalogStitchingType,
} from "../src/types/catalogApi";
import type { StitchingPreferences } from "../src/types/cart";
import { safeRouterPush } from "../src/utils/safeNavigation";
import { useAuthStore } from "../store/useAuthStore";

const SIDEBAR_W = 112;

// ─── Fallback descriptions ─────────────────────────────────────────────────────

const DESCRIPTIONS: Array<[string, string]> = [
  ["blazer", "Formal & business style"],
  ["suit", "Full custom-fit formal wear"],
  ["kurta", "Traditional Indian ethnic"],
  ["sherwani", "Elegant ethnic occasion wear"],
  ["indo-western", "Fusion contemporary style"],
  ["indo western", "Fusion contemporary style"],
  ["waist coat", "Layered formal styling"],
  ["waistcoat", "Layered formal styling"],
  ["shirt", "Casual & formal stitching"],
  ["pant", "Tailored bottom wear"],
  ["trouser", "Formal lower wear"],
  ["jean", "Custom denim fit"],
  ["sarees fall", "Saree finishing & fall pleating"],
  ["saree", "Traditional saree stitching"],
  ["blouse", "Designer & pattern blouse"],
  ["leheng", "Bridal & festive wear"],
  ["salwar", "Traditional & fusion styling"],
  ["skirt", "Custom length & silhouette"],
  ["frock", "Kids party & casual wear"],
  ["dress", "Custom-fit dress stitching"],
  ["repair", "Fix & restore garments"],
  ["resize", "Perfect fit adjustments"],
  ["embroidery", "Decorative needlework"],
  ["hemm", "Precise length adjustment"],
  ["linen", "Fabric lining & inner finish"],
  ["astar", "Fabric lining & inner finish"],
  ["jacket", "Styled outerwear tailoring"],
  ["coat", "Formal outerwear stitching"],
  ["pajama", "Comfortable lower wear"],
];

function getDesc(name: string): string {
  const l = name.toLowerCase();
  for (const [k, v] of DESCRIPTIONS) if (l.includes(k)) return v;
  return "";
}

// ─── Category style map ────────────────────────────────────────────────────────

type CatStyle = { icon: string; color: string; bg: string };
const CAT_MAP: Record<string, CatStyle> = {
  mens:                 { icon: "shirt-outline",     color: "#0c6c75", bg: "#e0f7f8" },
  men:                  { icon: "shirt-outline",     color: "#0c6c75", bg: "#e0f7f8" },
  womens:               { icon: "woman-outline",     color: "#7C3AED", bg: "#EDE9FE" },
  women:                { icon: "woman-outline",     color: "#7C3AED", bg: "#EDE9FE" },
  kids:                 { icon: "happy-outline",     color: "#DC2626", bg: "#FEE2E2" },
  "custom alterations": { icon: "construct-outline", color: "#065F46", bg: "#D1FAE5" },
  alterations:          { icon: "construct-outline", color: "#065F46", bg: "#D1FAE5" },
  wedding:              { icon: "heart-outline",     color: "#C9A84C", bg: "#F5E6C0" },
};
const FALLBACK_CS: CatStyle = { icon: "cut-outline", color: "#B45309", bg: "#FEF3C7" };
function getCatStyle(name: string): CatStyle {
  return CAT_MAP[name.toLowerCase()] ?? FALLBACK_CS;
}

// ─── Stitch grouping ───────────────────────────────────────────────────────────
//
// Groups stitching types by their base name, stripping the "Normal" / "Designer"
// quality prefix so the right panel can show types first, quality second.
//
// Examples:
//   "Normal Shirt"            → base "Shirt",            quality "Normal"
//   "Designer Shirt"          → base "Shirt",            quality "Designer"
//   "Normal Chinese Collar"   → base "Chinese Collar",   quality "Normal"
//   "Normal"                  → base = parentLineName,   quality "Normal"
//   "Chinese Collar Shirt"    → base "Chinese Collar Shirt" (no prefix → standalone)

type StitchGroup = {
  baseName: string;
  minPrice: number;
  hasDesigner: boolean;
  items: CatalogStitchingType[];
  imageUrl?: string | null;
};

function groupStitchingTypes(
  types: CatalogStitchingType[],
  parentName: string,
): StitchGroup[] {
  const map = new Map<string, CatalogStitchingType[]>();

  for (const stitch of types) {
    const name = stitch.name.trim();
    const lower = name.toLowerCase();

    let base: string;

    if (lower === "normal" || lower === "designer") {
      // Bare quality word - group all under the parent service line name
      base = parentName;
    } else if (lower.startsWith("normal ")) {
      base = name.slice("normal ".length).trim();
    } else if (lower.startsWith("designer ")) {
      base = name.slice("designer ".length).trim();
    } else {
      // No quality prefix - treat the whole name as a standalone type
      base = name;
    }

    if (!map.has(base)) map.set(base, []);
    map.get(base)!.push(stitch);
  }

  return Array.from(map.entries()).map(([baseName, items]) => ({
    baseName,
    minPrice: Math.min(...items.map((i) => i.base_price)),
    hasDesigner: items.some((i) => i.name.toLowerCase().includes("designer")),
    items,
  }));
}

// ─── Types ─────────────────────────────────────────────────────────────────────

type SidebarEntry = {
  key: string;
  name: string;
  kind: "line" | "direct";
  line?: CatalogServiceLine;
  direct?: CatalogDirectService;
};

// ─── Sidebar item ──────────────────────────────────────────────────────────────

function SidebarItem({
  entry,
  selected,
  accentColor,
  onPress,
}: {
  entry: SidebarEntry;
  selected: boolean;
  accentColor: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      style={[sb.item, selected && { backgroundColor: accentColor + "18" }]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {selected && <View style={[sb.accentBar, { backgroundColor: accentColor }]} />}
      <Text
        style={[sb.label, selected && { color: accentColor }]}
        numberOfLines={3}
      >
        {entry.name}
      </Text>
    </TouchableOpacity>
  );
}

// ─── Stitch-type card (grid tile) ─────────────────────────────────────────────

function TypeCard({ group, onPress }: { group: StitchGroup; onPress: () => void }) {
  const { hasDesigner, baseName, minPrice, items, imageUrl } = group;
  const isSingle = items.length === 1;
  const accentColor = hasDesigner ? "#C9A84C" : COLORS.primaryDark;
  const iconBg = hasDesigner ? "#FDF3DC" : COLORS.primaryLight;
  const desc = getDesc(baseName);
  return (
    <TouchableOpacity style={tc.card} onPress={onPress} activeOpacity={0.78}>
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={tc.image} contentFit="cover" cachePolicy="memory-disk" transition={150} />
      ) : (
        <View style={[tc.iconBox, { backgroundColor: iconBg }]}>
          <Ionicons
            name={hasDesigner ? "diamond-outline" : "shirt-outline"}
            size={26}
            color={accentColor}
          />
        </View>
      )}
      <Text style={tc.name} numberOfLines={2}>{baseName}</Text>
      {desc ? <Text style={tc.desc} numberOfLines={2}>{desc}</Text> : null}
      <View style={tc.footer}>
        <Text style={[tc.price, { color: accentColor }]}>
          from ₹{minPrice.toLocaleString("en-IN")}
        </Text>
        {!isSingle && (
          <View style={tc.pill}>
            <Text style={tc.pillText}>{items.length} opts</Text>
          </View>
        )}
        {isSingle && (
          <View style={[tc.pill, { backgroundColor: accentColor + "18" }]}>
            <Text style={[tc.pillText, { color: accentColor }]}>Book →</Text>
          </View>
        )}
      </View>
    </TouchableOpacity>
  );
}

// ─── Direct service panel ──────────────────────────────────────────────────────

const DIRECT_DESCRIPTIONS: Array<[string, string]> = [
  ["repair",    "Fix and restore damaged garments. Covers torn seams, loose threads, broken zippers, and button replacements."],
  ["resize",    "Adjust the fit of any garment - waist, length, sleeves, and more. Works on all fabrics and styles."],
  ["embroider", "Add custom needlework to any fabric. Choose from patterns, monograms, or traditional designs."],
  ["hemm",      "Precise length adjustment for trousers, kurtas, dresses, and skirts with a clean finish."],
  ["linen",     "Full inner lining added to your garment for extra structure, comfort, and a premium feel."],
  ["astar",     "Full inner lining added to your garment for extra structure, comfort, and a premium feel."],
];
function getDirectDesc(name: string): string {
  const l = name.toLowerCase();
  for (const [k, v] of DIRECT_DESCRIPTIONS) if (l.includes(k)) return v;
  return "Professional alteration and finishing by skilled craftsmen.";
}

function DirectPanel({
  service,
  cs,
  onOrderNow,
  onAddToCart,
}: {
  service: CatalogDirectService;
  cs: CatStyle;
  onOrderNow: () => void;
  onAddToCart: () => void;
}) {
  const desc = service.description?.trim() || getDirectDesc(service.name);

  return (
    <View style={dp.root}>
      {/* ── Header ───────────────────────────────────────── */}
      <View style={dp.header}>
        {service.image_url ? (
          <Image source={{ uri: service.image_url }} style={dp.headerImage} contentFit="cover" cachePolicy="memory-disk" transition={150} />
        ) : (
          <View style={[dp.headerIcon, { backgroundColor: cs.bg }]}>
            <Ionicons name={cs.icon as never} size={22} color={cs.color} />
          </View>
        )}
        <View style={dp.headerText}>
          <Text style={dp.serviceName}>{service.name}</Text>
          <Text style={dp.categoryLabel}>{service.category_name}</Text>
        </View>
        <View style={[dp.priceBadge, { backgroundColor: cs.bg }]}>
          <Text style={[dp.priceValue, { color: cs.color }]}>
            ₹{service.base_price.toLocaleString("en-IN")}
          </Text>
        </View>
      </View>

      <View style={dp.divider} />

      {/* ── Description ──────────────────────────────────── */}
      <View style={dp.section}>
        <Text style={dp.sectionLabel}>About this service</Text>
        <Text style={dp.descText}>{desc}</Text>
      </View>

      <View style={dp.divider} />

      {/* ── Service info ─────────────────────────────────── */}
      <View style={dp.infoList}>
        <View style={dp.infoRow}>
          <Ionicons name="cube-outline" size={15} color={cs.color} />
          <Text style={dp.infoText}>We collect from your doorstep</Text>
        </View>
        <View style={dp.infoRow}>
          <Ionicons name="time-outline" size={15} color={cs.color} />
          <Text style={dp.infoText}>Delivered in 2–5 working days</Text>
        </View>
        <View style={dp.infoRow}>
          <Ionicons name="checkmark-done-outline" size={15} color={cs.color} />
          <Text style={dp.infoText}>Quality checked before delivery</Text>
        </View>
      </View>

      <View style={dp.divider} />

      {/* ── CTAs ─────────────────────────────────────────── */}
      <View style={dp.ctaStack}>
        <TouchableOpacity
          onPress={onOrderNow}
          activeOpacity={0.82}
          style={[dp.orderNowBtn, { backgroundColor: cs.color }]}
        >
          <Ionicons name="flash-outline" size={15} color="#fff" />
          <Text style={dp.orderNowText}>Book Now</Text>
        </TouchableOpacity>
        <TouchableOpacity
          onPress={onAddToCart}
          activeOpacity={0.82}
          style={[dp.addToCartBtn, { borderColor: cs.color }]}
        >
          <Ionicons name="cart-outline" size={15} color={cs.color} />
          <Text style={[dp.addToCartText, { color: cs.color }]}>Add to Cart</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

// ─── Quality + booking bottom sheet ───────────────────────────────────────────

function BookingSheet({
  visible,
  group,
  selectedId,
  qty,
  onSelectId,
  onQtyChange,
  onBook,
  onOrderNow,
  onClose,
}: {
  visible: boolean;
  group: StitchGroup | null;
  selectedId: number | null;
  qty: number;
  onSelectId: (id: number) => void;
  onQtyChange: (n: number) => void;
  onBook: () => void;
  onOrderNow?: () => void;
  onClose: () => void;
}) {
  if (!group) return null;

  const selectedStitch = group.items.find((i) => i.service_id === selectedId) ?? null;
  const hasMultiple = group.items.length > 1;
  const subtotal = (selectedStitch?.base_price ?? 0) * qty;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={bs.backdrop} onPress={onClose}>
        <Pressable style={bs.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={bs.handle} />

          <Text style={bs.title}>{group.baseName}</Text>
          {hasMultiple && <Text style={bs.subtitle}>Select stitching quality</Text>}

          <View style={bs.divider} />

          {/* Quality selector - shown only when group has multiple items */}
          {hasMultiple && (
            <View style={bs.optionsWrap}>
              {group.items.map((stitch) => {
                const sel = stitch.service_id === selectedId;
                const isDes = stitch.name.toLowerCase().includes("designer");
                return (
                  <TouchableOpacity
                    key={stitch.service_id}
                    style={[bs.qualCard, sel && bs.qualCardSel]}
                    onPress={() => onSelectId(stitch.service_id)}
                    activeOpacity={0.8}
                  >
                    <View
                      style={[bs.qualIcon, { backgroundColor: isDes ? "#F5E6C0" : COLORS.primaryLight }]}
                    >
                      <Ionicons
                        name={isDes ? "diamond-outline" : "shirt-outline"}
                        size={18}
                        color={isDes ? "#C9A84C" : COLORS.primaryDark}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[bs.qualName, sel && { color: COLORS.primaryDark }]}>
                        {isDes ? "Designer" : "Normal"}
                      </Text>
                      <Text style={bs.qualDesc}>
                        {isDes ? "Premium designer finish" : "Classic everyday finish"}
                      </Text>
                    </View>
                    <Text style={[bs.qualPrice, { color: isDes ? "#C9A84C" : COLORS.primaryDark }]}>
                      ₹{stitch.base_price.toLocaleString("en-IN")}
                    </Text>
                    <View style={[bs.radio, sel && bs.radioSel]}>
                      {sel && <View style={bs.radioDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Single item: just show its info */}
          {!hasMultiple && selectedStitch && (
            <View style={bs.singleRow}>
              <View style={bs.qualIcon}>
                <Ionicons name="shirt-outline" size={18} color={COLORS.primaryDark} />
              </View>
              <Text style={bs.singleName}>{selectedStitch.name}</Text>
              <Text style={[bs.qualPrice, { color: COLORS.primaryDark }]}>
                ₹{selectedStitch.base_price.toLocaleString("en-IN")}
              </Text>
            </View>
          )}

          <View style={bs.divider} />

          {/* Quantity stepper */}
          <View style={bs.qtyRow}>
            <Text style={bs.qtyLabel}>Quantity</Text>
            <View style={bs.qtyCtrl}>
              <TouchableOpacity
                style={bs.qtyBtn}
                onPress={() => onQtyChange(qty - 1)}
                disabled={qty <= 1}
              >
                <Ionicons
                  name="remove"
                  size={18}
                  color={qty <= 1 ? COLORS.grayBorder : COLORS.primaryDark}
                />
              </TouchableOpacity>
              <Text style={bs.qtyVal}>{qty}</Text>
              <TouchableOpacity
                style={bs.qtyBtn}
                onPress={() => onQtyChange(qty + 1)}
                disabled={qty >= 99}
              >
                <Ionicons
                  name="add"
                  size={18}
                  color={qty >= 99 ? COLORS.grayBorder : COLORS.primaryDark}
                />
              </TouchableOpacity>
            </View>
          </View>

          {qty > 1 && selectedStitch && (
            <View style={bs.subtotalRow}>
              <Text style={bs.subtotalLabel}>Subtotal ({qty} pieces)</Text>
              <Text style={bs.subtotalVal}>₹{subtotal.toLocaleString("en-IN")}</Text>
            </View>
          )}

          {onOrderNow ? (
            <>
              <TouchableOpacity
                style={[bs.bookBtn, !selectedId && bs.bookBtnDisabled]}
                onPress={onOrderNow}
                activeOpacity={0.9}
                disabled={!selectedId}
              >
                <Ionicons name="flash-outline" size={16} color="#fff" />
                <Text style={bs.bookLabel}>Book Now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[bs.addToCartBtn, !selectedId && bs.bookBtnDisabled]}
                onPress={onBook}
                activeOpacity={0.9}
                disabled={!selectedId}
              >
                <Ionicons name="cart-outline" size={16} color={bs.addToCartText.color as string} />
                <Text style={bs.addToCartText}>Add to Cart</Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[bs.bookBtn, !selectedId && bs.bookBtnDisabled]}
              onPress={onBook}
              activeOpacity={0.9}
              disabled={!selectedId}
            >
              <Text style={bs.bookLabel}>Add to Cart</Text>
              <Ionicons name="arrow-forward" size={16} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={bs.cancelLink} onPress={onClose}>
            <Text style={bs.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

// ─── Main screen ───────────────────────────────────────────────────────────────

export default function SubServicesScreen() {
  const insets = useSafeAreaInsets();
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
    tailorId?: string;
    tailorName?: string;
  }>();

  const categoryName = params.categoryName ?? "Services";
  const catalogCategoryId = Number(params.catalogCategoryId ?? 0);
  const paramTailorId = params.tailorId ? Number(params.tailorId) : undefined;
  const paramTailorName = params.tailorName ?? undefined;
  const cs = getCatStyle(categoryName);

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryTick, setRetryTick] = useState(0);
  const [entries, setEntries] = useState<SidebarEntry[]>([]);
  const [resolvedCategoryId, setResolvedCategoryId] = useState(catalogCategoryId);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [sheetVisible, setSheetVisible] = useState(false);
  const [sheetGroup, setSheetGroup] = useState<StitchGroup | null>(null);
  const [sheetSelectedId, setSheetSelectedId] = useState<number | null>(null);
  const [qty, setQty] = useState(1);
  const [designStyle, setDesignStyle] = useState<StitchingPreferences["design_style"] | undefined>(undefined);
  const [embellishmentLevel, setEmbellishmentLevel] = useState<StitchingPreferences["embellishment_level"] | undefined>(undefined);
  const [designNotes, setDesignNotes] = useState("");

  const selectedEntry = useMemo(
    () => entries.find((e) => e.key === selectedKey) ?? null,
    [entries, selectedKey],
  );

  const stitchGroups = useMemo<StitchGroup[]>(() => {
    if (selectedEntry?.kind !== "line" || !selectedEntry.line) return [];
    const types = [...(selectedEntry.line.stitching_types ?? [])].sort(
      (a, b) => a.display_order - b.display_order,
    );
    const lineImageUrl = selectedEntry.line.image_url ?? null;
    // Each group's own item photo wins over the shared line photo - e.g.
    // "Kurti" and "test" are different groups under the same "Kurti" line
    // and must not show the same picture just because they share a parent.
    // Falls back to the line photo only when none of that group's items
    // have their own photo yet.
    return groupStitchingTypes(types, selectedEntry.name).map((g) => ({
      ...g,
      imageUrl: g.items.find((i) => i.image_url)?.image_url ?? lineImageUrl,
    }));
  }, [selectedEntry]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setLoadError(false);
      try {
        const tree = await fetchCatalogTree();
        if (cancelled) return;

        let category = resolveCatalogCategory(tree, catalogCategoryId, categoryName);

        if (
          !category ||
          ((category.service_lines?.length ?? 0) === 0 &&
            (category.direct_services?.length ?? 0) === 0)
        ) {
          const fbId = category?.id ?? catalogCategoryId;
          const sub = await fetchCatalogSubcategories(fbId);
          if (sub && !cancelled) {
            category = {
              ...(category ?? {
                id: fbId,
                name: categoryName,
                description: null,
                image_url: null,
                display_order: 0,
                direct_services: [],
              }),
              service_lines: sub.service_lines.length ? sub.service_lines : (category?.service_lines ?? []),
              direct_services: sub.direct_services.length ? sub.direct_services : (category?.direct_services ?? []),
            };
          }
        }

        if (cancelled) return;

        const effectiveId = category?.id ?? catalogCategoryId;
        setResolvedCategoryId(effectiveId);

        const lines = [...(category?.service_lines ?? [])].sort(
          (a, b) => a.display_order - b.display_order,
        );
        const directs = [...(category?.direct_services ?? [])].sort(
          (a, b) => a.display_order - b.display_order,
        );

        const built: SidebarEntry[] = [
          ...lines.map((l) => ({ key: `line-${l.id}`, name: l.name, kind: "line" as const, line: l })),
          ...directs.map((d) => ({
            key: `direct-${d.service_id}`,
            name: d.name,
            kind: "direct" as const,
            direct: d,
          })),
        ];

        setEntries(built);
        if (built.length > 0) setSelectedKey(built[0].key);
      } catch {
        if (cancelled) return;
        setEntries([]);
        setLoadError(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [catalogCategoryId, categoryName, retryTick]);

  const navigateToDetail = useCallback((group: StitchGroup) => {
    if (!selectedEntry || selectedEntry.kind !== "line") return;
    const line = selectedEntry.line;
    if (!line) return;
    const firstItem = group.items[0];
    if (!firstItem) return;
    safeRouterPush(router, {
      pathname: "/service-details",
      params: {
        catalogCategoryId: String(resolvedCategoryId),
        categoryName,
        serviceName: group.baseName,
        serviceLineId: String(line.id),
        bookableServiceId: String(firstItem.service_id),
        basePrice: String(group.minPrice),
        imageUrl: line.image_url ?? "",
        description: line.description ?? "",
        filterBaseName: group.baseName,
      },
    } as never);
  }, [selectedEntry, resolvedCategoryId, categoryName, router]);

  const _buildPending = useCallback(
    (stitch: CatalogStitchingType, clampedQty: number) => {
      const line = selectedEntry?.kind === "line" ? selectedEntry.line : undefined;
      const isDes = stitch.name.toLowerCase().includes("designer");
      return {
        bookableServiceId: stitch.service_id,
        serviceLineId: line?.id,
        serviceLineName: line?.name ?? (selectedEntry?.name ?? ""),
        stitchingType: stitch.name,
        categoryId: resolvedCategoryId,
        categoryName,
        basePrice: stitch.base_price,
        displayName: `${sheetGroup?.baseName ?? stitch.name} · ${isDes ? "Designer" : "Normal"}`,
        imageUrl: stitch.image_url ?? line?.image_url ?? null,
        quantity: clampedQty,
      };
    },
    [selectedEntry, resolvedCategoryId, categoryName, sheetGroup],
  );

  const handleBook = useCallback(() => {
    if (!sheetSelectedId || !sheetGroup || !selectedEntry) return;
    setSheetVisible(false);

    const stitch = sheetGroup.items.find((i) => i.service_id === sheetSelectedId);
    if (!stitch) return;

    const clampedQty = Math.min(99, Math.max(1, qty));
    const pending = _buildPending(stitch, clampedQty);

    if (!isAuthenticated) {
      setPendingService(pending);
      setBookingFlowActive(true);
      setPendingRoute("/sub-services", {
        catalogCategoryId: String(resolvedCategoryId),
        categoryName,
      });
      safeRouterPush(router, "/(auth)/login");
      return;
    }

    // Measurement is never collected from the customer - go straight to
    // address selection; measurement is filled later by Bridge/employee at
    // pickup, or by Admin.
    setPendingService(pending);
    setBookingFlowActive(true);
    safeRouterPush(router, "/address");
  }, [
    sheetSelectedId, sheetGroup, selectedEntry, qty, resolvedCategoryId, categoryName,
    isAuthenticated, setPendingService, setBookingFlowActive,
    setPendingRoute, router, _buildPending,
  ]);

  const handleOrderNow = useCallback(() => {
    if (!sheetSelectedId || !sheetGroup || !selectedEntry) return;
    setSheetVisible(false);

    const stitch = sheetGroup.items.find((i) => i.service_id === sheetSelectedId);
    if (!stitch) return;

    const clampedQty = Math.min(99, Math.max(1, qty));
    const pending = _buildPending(stitch, clampedQty);

    if (!isAuthenticated) {
      setPendingService(pending);
      setBuyNowMode(true);
      setPendingRoute("/sub-services", {
        catalogCategoryId: String(resolvedCategoryId),
        categoryName,
      });
      safeRouterPush(router, "/(auth)/login");
      return;
    }

    // Measurement is never collected from the customer - go straight to
    // address selection (buy-now mode), then buy-now-review.
    setPendingService(pending);
    setBuyNowMode(true);
    safeRouterPush(router, { pathname: "/address", params: { mode: "buy-now" } } as never);
  }, [
    sheetSelectedId, sheetGroup, selectedEntry, qty, resolvedCategoryId, categoryName,
    isAuthenticated, setPendingService, setBuyNowMode,
    setPendingRoute, router, _buildPending,
  ]);

  const proceedDirect = useCallback(
    () => {
      const direct = selectedEntry?.direct;
      if (!direct) return;

      const existing = useCartStore.getState().pendingService;
      setPendingService({
        bookableServiceId: direct.service_id,
        categoryId: resolvedCategoryId,
        categoryName,
        serviceLineName: direct.name,
        basePrice: direct.base_price,
        displayName: direct.name,
        imageUrl: direct.image_url,
        tailorId: paramTailorId ?? existing?.tailorId,
        tailorName: paramTailorName ?? existing?.tailorName,
      });

      if (!isAuthenticated) {
        setPendingRoute("/sub-services", {
          catalogCategoryId: String(resolvedCategoryId),
          categoryName,
        });
        router.push("/(auth)/login");
        return;
      }

      // Measurement is never collected from the customer - go straight to
      // address selection.
      setBookingFlowActive(true);
      router.push("/address");
    },
    [
      selectedEntry, resolvedCategoryId, categoryName, paramTailorId, paramTailorName,
      isAuthenticated, setPendingService, setBookingFlowActive, setPendingRoute, router,
    ],
  );

  const proceedDirectOrderNow = useCallback(() => {
    const direct = selectedEntry?.direct;
    if (!direct) return;

    const existing = useCartStore.getState().pendingService;
    setPendingService({
      bookableServiceId: direct.service_id,
      categoryId: resolvedCategoryId,
      categoryName,
      serviceLineName: direct.name,
      basePrice: direct.base_price,
      displayName: direct.name,
      imageUrl: direct.image_url,
      tailorId: paramTailorId ?? existing?.tailorId,
      tailorName: paramTailorName ?? existing?.tailorName,
      quantity: 1,
    });
    setBuyNowMode(true);

    if (!isAuthenticated) {
      setPendingRoute("/sub-services", {
        catalogCategoryId: String(resolvedCategoryId),
        categoryName,
      });
      router.push("/(auth)/login");
      return;
    }

    // Measurement is never collected from the customer - go straight to
    // address selection (buy-now mode), then buy-now-review.
    router.push({ pathname: "/address", params: { mode: "buy-now" } });
  }, [
    selectedEntry, resolvedCategoryId, categoryName, paramTailorId, paramTailorName,
    isAuthenticated, setPendingService, setBuyNowMode,
    setPendingRoute, router,
  ]);

  const renderRight = () => {
    if (loading) {
      return (
        <View style={rp.loadingWrap}>
          {[0, 1, 2].map((i) => <View key={i} style={rp.skeleton} />)}
        </View>
      );
    }

    if (!selectedEntry) {
      return (
        <View style={rp.empty}>
          <Ionicons name="cut-outline" size={28} color={COLORS.grayBorder} />
          <Text style={rp.emptyText}>No services available</Text>
        </View>
      );
    }

    if (selectedEntry.kind === "line") {
      return (
        <Animated.View key={selectedEntry.key} entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={rp.listContent}
          >
            <View style={rp.panelHead}>
              <Text style={rp.panelTitle}>{selectedEntry.name}</Text>
              <Text style={rp.panelSub}>
                {stitchGroups.length === 1 ? "Select a style to book" : `${stitchGroups.length} styles available`}
              </Text>
            </View>

            {stitchGroups.length === 0 ? (
              <View style={rp.empty}>
                <Text style={rp.emptyText}>No variants available</Text>
              </View>
            ) : (
              <View style={rp.grid}>
                {stitchGroups.map((group, idx) => (
                  <Animated.View
                    key={group.baseName}
                    style={rp.gridItem}
                    entering={FadeInRight.delay(idx * 50).duration(180)}
                  >
                    <TypeCard group={group} onPress={() => navigateToDetail(group)} />
                  </Animated.View>
                ))}
              </View>
            )}
          </ScrollView>
        </Animated.View>
      );
    }

    if (selectedEntry.kind === "direct" && selectedEntry.direct) {
      return (
        <Animated.View key={selectedEntry.key} entering={FadeIn.duration(180)} style={{ flex: 1 }}>
          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={rp.listContent}
          >
            <DirectPanel
              service={selectedEntry.direct}
              cs={cs}
              onOrderNow={proceedDirectOrderNow}
              onAddToCart={proceedDirect}
            />
          </ScrollView>
        </Animated.View>
      );
    }

    return null;
  };

  return (
    <View style={[scr.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={scr.header}>
        <TouchableOpacity
          style={scr.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <View style={scr.headerMid}>
          <View style={[scr.headerIcon, { backgroundColor: cs.bg }]}>
            <Ionicons name={cs.icon as any} size={18} color={cs.color} />
          </View>
          <Text style={scr.headerTitle}>{categoryName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Body */}
      <View style={scr.body}>
        {!loading && loadError ? (
          <ErrorState
            message="Could not load services. Please check your connection and try again."
            onRetry={() => setRetryTick((t) => t + 1)}
          />
        ) : !loading && entries.length === 0 ? (
          <View style={scr.fullEmpty}>
            <View style={[scr.emptyIconBox, { backgroundColor: cs.bg }]}>
              <Ionicons name={cs.icon as any} size={36} color={cs.color} />
            </View>
            <Text style={scr.fullEmptyTitle}>No services yet</Text>
            <Text style={scr.fullEmptyDesc}>
              Check back soon - new services are being added.
            </Text>
          </View>
        ) : (
          <>
            {/* Left sidebar */}
            <View style={scr.sidebar}>
              {loading
                ? [0, 1, 2, 3, 4, 5].map((i) => (
                    <View key={i} style={sk.item}>
                      <View style={sk.line} />
                      <View style={[sk.line, { width: "55%", marginTop: 5 }]} />
                    </View>
                  ))
                : (
                    <ScrollView
                      showsVerticalScrollIndicator={false}
                      contentContainerStyle={{ paddingBottom: 32 }}
                    >
                      {entries.map((entry) => (
                        <SidebarItem
                          key={entry.key}
                          entry={entry}
                          selected={selectedKey === entry.key}
                          accentColor={cs.color}
                          onPress={() => setSelectedKey(entry.key)}
                        />
                      ))}
                    </ScrollView>
                  )}
            </View>

            <View style={scr.sideDivider} />

            {/* Right panel */}
            <View style={scr.rightPanel}>{renderRight()}</View>
          </>
        )}
      </View>

      <BookingSheet
        visible={sheetVisible}
        group={sheetGroup}
        selectedId={sheetSelectedId}
        qty={qty}
        onSelectId={setSheetSelectedId}
        onQtyChange={(n) => setQty(Math.min(99, Math.max(1, n)))}
        onBook={handleBook}
        onOrderNow={handleOrderNow}
        onClose={() => setSheetVisible(false)}
      />
    </View>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const scr = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
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
  headerMid: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  headerIcon: { width: 28, height: 28, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  headerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, letterSpacing: -0.2 },
  body: { flex: 1, flexDirection: "row" },
  sidebar: { width: SIDEBAR_W, backgroundColor: COLORS.white },
  sideDivider: { width: StyleSheet.hairlineWidth, backgroundColor: COLORS.grayBorder },
  rightPanel: { flex: 1, backgroundColor: COLORS.offWhite },
  fullEmpty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.lg, gap: SPACING.sm,
  },
  emptyIconBox: {
    width: 64, height: 64, borderRadius: 32,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm,
  },
  fullEmptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, textAlign: "center" },
  fullEmptyDesc: { fontSize: 14, color: COLORS.gray, textAlign: "center", lineHeight: 20 },
});

const sb = StyleSheet.create({
  item: {
    paddingVertical: 13, paddingHorizontal: 10, paddingLeft: 16,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.grayBorder,
    position: "relative",
  },
  accentBar: {
    position: "absolute", left: 0, top: 6, bottom: 6, width: 4,
    borderTopRightRadius: 3, borderBottomRightRadius: 3,
  },
  label: { fontSize: 12.5, fontWeight: "700", color: "#1F2937", lineHeight: 17 },
});

const tc = StyleSheet.create({
  card: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg, padding: 14,
    alignItems: "flex-start", gap: 6,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  iconBox: { width: 48, height: 48, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center", marginBottom: 2 },
  image: { width: "100%", height: 90, borderRadius: RADIUS.md, marginBottom: 2 },
  name: { fontSize: 13, fontWeight: "700", color: COLORS.black, lineHeight: 18 },
  desc: { fontSize: 11, color: COLORS.gray, lineHeight: 15 },
  footer: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 4 },
  price: { fontSize: 12, fontWeight: "800" },
  pill: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: RADIUS.full, backgroundColor: COLORS.grayLight },
  pillText: { fontSize: 10, fontWeight: "600", color: COLORS.gray },
});

const dp = StyleSheet.create({
  root: { gap: 0, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, overflow: "hidden", ...SHADOW.card },

  header: { flexDirection: "row", alignItems: "center", gap: 10, padding: SPACING.md },
  headerIcon: { width: 36, height: 36, borderRadius: RADIUS.md, alignItems: "center", justifyContent: "center" },
  headerImage: { width: 36, height: 36, borderRadius: RADIUS.md },
  headerText: { flex: 1 },
  serviceName: { fontSize: 15, fontWeight: "700", color: COLORS.black, lineHeight: 20 },
  categoryLabel: { fontSize: 11, color: COLORS.gray, marginTop: 1 },
  priceBadge: { paddingHorizontal: 9, paddingVertical: 4, borderRadius: RADIUS.full },
  priceValue: { fontSize: 13, fontWeight: "800" },

  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.grayBorder, marginHorizontal: SPACING.md },

  section: { padding: SPACING.md, gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: "600", color: COLORS.gray, textTransform: "uppercase", letterSpacing: 0.5 },
  descText: { fontSize: 13, color: COLORS.black, lineHeight: 20 },

  infoList: { padding: SPACING.md, gap: 10 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  infoText: { fontSize: 13, color: COLORS.gray, flex: 1 },

  ctaStack: {
    margin: SPACING.md,
    gap: 8,
  },
  orderNowBtn: {
    borderRadius: RADIUS.md,
    height: 46,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    ...Platform.select({
      ios: { shadowColor: "#065F46", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  orderNowText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  addToCartBtn: {
    borderRadius: RADIUS.md,
    height: 42,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    borderWidth: 1.5,
    backgroundColor: "transparent",
  },
  addToCartText: { fontSize: 14, fontWeight: "600" },
});

const rp = StyleSheet.create({
  listContent: { padding: SPACING.md, paddingBottom: 48, gap: 10 },
  panelHead: { marginBottom: 4 },
  panelTitle: { fontSize: 16, fontWeight: "800", color: COLORS.black, letterSpacing: -0.2 },
  panelSub: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  loadingWrap: { padding: SPACING.md, gap: 10 },
  skeleton: { height: 76, borderRadius: RADIUS.lg, backgroundColor: COLORS.grayLight },
  empty: { flex: 1, alignItems: "center", justifyContent: "center", paddingVertical: 48, gap: 8 },
  emptyText: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  gridItem: { width: "47.5%" },
});

const bs = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.5)", justifyContent: "flex-end" },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    paddingHorizontal: SPACING.md, paddingBottom: SPACING.lg, paddingTop: SPACING.md,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2, backgroundColor: COLORS.grayBorder,
    alignSelf: "center", marginBottom: SPACING.md,
  },
  title: { fontSize: 17, fontWeight: "800", color: COLORS.black, letterSpacing: -0.3 },
  subtitle: { fontSize: 13, color: COLORS.gray, marginTop: 2, marginBottom: SPACING.sm },
  divider: { height: StyleSheet.hairlineWidth, backgroundColor: COLORS.grayBorder, marginVertical: SPACING.md },
  optionsWrap: { gap: 8 },
  qualCard: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderRadius: RADIUS.lg, borderWidth: 1.5, borderColor: COLORS.grayBorder, backgroundColor: COLORS.white,
  },
  qualCardSel: { borderColor: COLORS.primaryDark, backgroundColor: "#f0fafb" },
  qualIcon: {
    width: 38, height: 38, borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryLight, alignItems: "center", justifyContent: "center",
  },
  qualName: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  qualDesc: { fontSize: 11, color: COLORS.gray, marginTop: 2 },
  qualPrice: { fontSize: 14, fontWeight: "800" },
  radio: {
    width: 20, height: 20, borderRadius: 10,
    borderWidth: 2, borderColor: COLORS.grayBorder, alignItems: "center", justifyContent: "center",
  },
  radioSel: { borderColor: COLORS.primaryDark },
  radioDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.primaryDark },
  singleRow: {
    flexDirection: "row", alignItems: "center", gap: 10, padding: 12,
    borderRadius: RADIUS.lg, backgroundColor: COLORS.primaryLight,
  },
  singleName: { flex: 1, fontSize: 15, fontWeight: "700", color: COLORS.primaryDark },
  qtyRow: {
    flexDirection: "row", alignItems: "center",
    justifyContent: "space-between", marginBottom: SPACING.sm,
  },
  qtyLabel: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  qtyCtrl: {
    flexDirection: "row", alignItems: "center",
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.full,
    borderWidth: 1, borderColor: COLORS.grayBorder, paddingHorizontal: 4,
  },
  qtyBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  qtyVal: { minWidth: 32, textAlign: "center", fontSize: 16, fontWeight: "800", color: COLORS.black },
  subtotalRow: {
    flexDirection: "row", justifyContent: "space-between",
    paddingVertical: SPACING.sm,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: COLORS.grayBorder, marginBottom: SPACING.sm,
  },
  subtotalLabel: { fontSize: 13, color: COLORS.gray },
  subtotalVal: { fontSize: 15, fontWeight: "800", color: COLORS.primaryDark },
  bookBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 52, borderRadius: RADIUS.md, backgroundColor: COLORS.primaryDark, marginBottom: SPACING.sm,
    ...Platform.select({
      ios: { shadowColor: "#0c6c75", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.22, shadowRadius: 10 },
      android: { elevation: 5 },
    }),
  },
  bookBtnDisabled: { opacity: 0.5 },
  bookLabel: { fontSize: 16, fontWeight: "800", color: "#fff" },
  addToCartBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 48, borderRadius: RADIUS.md,
    borderWidth: 1.5, borderColor: COLORS.primaryDark, marginBottom: SPACING.sm,
  },
  addToCartText: { fontSize: 15, fontWeight: "700", color: COLORS.primaryDark },
  cancelLink: { alignItems: "center", paddingVertical: SPACING.sm },
  cancelText: { fontSize: 14, fontWeight: "600", color: COLORS.gray },
});

const sk = StyleSheet.create({
  item: {
    paddingVertical: 14, paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: COLORS.grayBorder,
  },
  line: { height: 10, borderRadius: 5, backgroundColor: COLORS.grayLight, width: "80%" },
});
