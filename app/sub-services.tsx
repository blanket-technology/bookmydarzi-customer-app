import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Image,
  Dimensions,
  Platform,
  Modal,
  Pressable,
} from "react-native";
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { LinearGradient } from "expo-linear-gradient";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../store/useAuthStore";
import { useCartStore } from "../src/store/useCartStore";
import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import SubServiceCardSkeleton from "../src/components/skeletons/SubServiceCardSkeleton";
import {
  fetchCatalogSubcategories,
  fetchCatalogTree,
  resolveCatalogCategory,
} from "../src/services/catalogService";
import {
  resolveCatalogListItemImageUrl,
  resolveDirectServiceImageUrl,
  resolveServiceLineImageUrl,
} from "../src/utils/serviceImage";
import type {
  CatalogDirectService,
  CatalogServiceLine,
} from "../src/types/catalogApi";

// ---------------------------------------------------------------------------
// Layout constants
// ---------------------------------------------------------------------------
const { width: SCREEN_WIDTH } = Dimensions.get("window");
const GRID_PADDING = SPACING.lg;
const GRID_GAP = SPACING.md;
const CARD_WIDTH = (SCREEN_WIDTH - GRID_PADDING * 2 - GRID_GAP) / 2;

// ---------------------------------------------------------------------------
// Icon / colour map
// ---------------------------------------------------------------------------
const CATEGORY_ICONS: Record<
  string,
  { icon: string; color: string; bg: string; gradient: [string, string] }
> = {
  mens:                 { icon: "shirt-outline",     color: "#0c6c75", bg: "#e0f7f8", gradient: ["#e0f7f8", "#b2edf2"] },
  men:                  { icon: "shirt-outline",     color: "#0c6c75", bg: "#e0f7f8", gradient: ["#e0f7f8", "#b2edf2"] },
  womens:               { icon: "woman-outline",     color: "#7C3AED", bg: "#EDE9FE", gradient: ["#EDE9FE", "#d8b4fe"] },
  women:                { icon: "woman-outline",     color: "#7C3AED", bg: "#EDE9FE", gradient: ["#EDE9FE", "#d8b4fe"] },
  kids:                 { icon: "happy-outline",     color: "#DC2626", bg: "#FEE2E2", gradient: ["#FEE2E2", "#fca5a5"] },
  "custom alterations": { icon: "construct-outline", color: "#065F46", bg: "#D1FAE5", gradient: ["#D1FAE5", "#6ee7b7"] },
  alterations:          { icon: "construct-outline", color: "#065F46", bg: "#D1FAE5", gradient: ["#D1FAE5", "#6ee7b7"] },
  wedding:              { icon: "heart-outline",     color: "#C9A84C", bg: "#F5E6C0", gradient: ["#F5E6C0", "#fde68a"] },
};

function getCategoryStyle(name: string) {
  const key = name.toLowerCase();
  return (
    CATEGORY_ICONS[key] ?? {
      icon: "cut-outline",
      color: "#B45309",
      bg: "#FEF3C7",
      gradient: ["#FEF3C7", "#fde68a"] as [string, string],
    }
  );
}

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

// ---------------------------------------------------------------------------
// Service Option Modal — shown when user taps a sub-service card
// ---------------------------------------------------------------------------
interface ServiceOptionModalProps {
  visible: boolean;
  item: { name: string; base_price: number } | null;
  categoryName: string;
  onAddMeasurement: () => void;
  onAddByTailor: () => void;
  onClose: () => void;
}

function ServiceOptionModal({
  visible,
  item,
  categoryName,
  onAddMeasurement,
  onAddByTailor,
  onClose,
}: ServiceOptionModalProps) {
  const catStyle = getCategoryStyle(categoryName);

  if (!item) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={modal.backdrop} onPress={onClose}>
        <Pressable style={modal.sheet} onPress={(e) => e.stopPropagation()}>
          {/* Handle bar */}
          <View style={modal.handle} />

          {/* Service info */}
          <View style={modal.serviceRow}>
            <View style={[modal.serviceIcon, { backgroundColor: catStyle.bg }]}>
              <Ionicons name={catStyle.icon as any} size={22} color={catStyle.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={modal.serviceName} numberOfLines={1}>
                {item.name}
              </Text>
              <Text style={modal.servicePrice}>
                Starting ₹{item.base_price.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>

          <Text style={modal.question}>How would you like to proceed?</Text>

          {/* Option 1 — Add measurement */}
          <TouchableOpacity style={modal.optionCard} onPress={onAddMeasurement} activeOpacity={0.8}>
            <LinearGradient
              colors={["#0c6c75", "#1aa3b0"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={modal.optionGradient}
            >
              <View style={modal.optionIcon}>
                <Ionicons name="resize-outline" size={22} color={COLORS.white} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={modal.optionTitle}>Add Measurement</Text>
                <Text style={modal.optionDesc}>
                  Enter your measurements for a perfect fit
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color="rgba(255,255,255,0.7)" />
            </LinearGradient>
          </TouchableOpacity>

          {/* Option 2 — Add by our tailor */}
          <TouchableOpacity style={modal.optionCard} onPress={onAddByTailor} activeOpacity={0.8}>
            <View style={modal.optionCardInner}>
              <View style={[modal.optionIcon, { backgroundColor: COLORS.primaryLight }]}>
                <Ionicons name="person-outline" size={22} color={COLORS.primaryDark} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={[modal.optionTitle, { color: COLORS.black }]}>
                  Add by Our Tailor
                </Text>
                <Text style={[modal.optionDesc, { color: COLORS.gray }]}>
                  Our tailor will take your measurements at home
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={COLORS.gray} />
            </View>
          </TouchableOpacity>

          {/* Cancel */}
          <TouchableOpacity style={modal.cancelBtn} onPress={onClose}>
            <Text style={modal.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const modal = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: SPACING.lg,
    paddingBottom: SPACING.xl,
    paddingTop: SPACING.md,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.grayBorder,
    alignSelf: "center",
    marginBottom: SPACING.lg,
  },
  serviceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    marginBottom: SPACING.lg,
    paddingBottom: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  serviceIcon: {
    width: 48,
    height: 48,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
  },
  serviceName: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: 2,
  },
  servicePrice: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
  question: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: SPACING.md,
  },
  optionCard: {
    borderRadius: RADIUS.lg,
    marginBottom: SPACING.sm,
    overflow: "hidden",
    ...SHADOW.card,
  },
  optionGradient: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
    borderRadius: RADIUS.lg,
  },
  optionCardInner: {
    flexDirection: "row",
    alignItems: "center",
    padding: SPACING.md,
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  optionIcon: {
    width: 44,
    height: 44,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  optionTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
    marginBottom: 2,
  },
  optionDesc: {
    fontSize: 12,
    color: "rgba(255,255,255,0.8)",
    lineHeight: 16,
  },
  cancelBtn: {
    marginTop: SPACING.sm,
    alignItems: "center",
    paddingVertical: SPACING.md,
  },
  cancelText: {
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.gray,
  },
});

// ---------------------------------------------------------------------------
// Premium grid card
// ---------------------------------------------------------------------------
interface CatalogListItem {
  key: string;
  name: string;
  description?: string | null;
  price: number;
  kind: "line" | "direct";
  imageUrl?: string | null;
  line?: CatalogServiceLine;
  direct?: CatalogDirectService;
}

interface SubServiceCardProps {
  item: CatalogListItem;
  index: number;
  categoryName: string;
  onPress: (item: CatalogListItem) => void;
}

function SubServiceCard({ item, index, categoryName, onPress }: SubServiceCardProps) {
  const catStyle = getCategoryStyle(categoryName);
  const imageUrl = useMemo(() => resolveCatalogListItemImageUrl(item), [item]);
  const hasImage = Boolean(imageUrl);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setImageFailed(false);
  }, [imageUrl]);

  useEffect(() => {
    if (!__DEV__ || index >= 3) return;
    console.log("[SubServices] Sub Service:", {
      name: item.name,
      kind: item.kind,
      rawImageUrl: item.imageUrl ?? item.line?.image_url ?? item.direct?.image_url ?? null,
    });
    console.log("[SubServices] Image URL:", imageUrl);
  }, [imageUrl, index, item]);

  const scale = useSharedValue(1);
  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    // Outer: entrance animation only
    <Animated.View
      entering={FadeInDown.delay(index * 70).duration(400).springify()}
      style={styles.cardWrapper}
    >
      {/* Inner: press-scale transform only */}
      <Animated.View style={animStyle}>
        <AnimatedTouchable
          activeOpacity={1}
          onPressIn={() => { scale.value = withSpring(0.95, { damping: 15 }); }}
          onPressOut={() => { scale.value = withSpring(1, { damping: 15 }); }}
          onPress={() => onPress(item)}
          style={styles.card}
        >
          {/* Image / icon area */}
          <View style={styles.imageContainer}>
            {hasImage && !imageFailed ? (
              <Image
                source={{ uri: imageUrl! }}
                style={styles.cardImage}
                resizeMode="cover"
                onError={() => setImageFailed(true)}
              />
            ) : (
              <LinearGradient
                colors={catStyle.gradient as [string, string]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.iconGradient}
              >
                <View style={[styles.iconCircle, { backgroundColor: catStyle.bg }]}>
                  <Ionicons name={catStyle.icon as any} size={30} color={catStyle.color} />
                </View>
              </LinearGradient>
            )}
            <View style={styles.priceBadge}>
              <Text style={styles.priceBadgeText}>
                ₹{item.price.toLocaleString("en-IN")}
              </Text>
            </View>
          </View>

          {/* Text content */}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={2}>
              {item.name}
            </Text>
            {item.description ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                {item.description}
              </Text>
            ) : item.kind === "line" ? (
              <Text style={styles.cardDesc} numberOfLines={2}>
                Normal & Designer stitching
              </Text>
            ) : null}
            <View style={styles.ctaRow}>
              <Text style={styles.ctaLabel}>Book Now</Text>
              <View style={[styles.ctaArrow, { backgroundColor: catStyle.bg }]}>
                <Ionicons name="arrow-forward" size={12} color={catStyle.color} />
              </View>
            </View>
          </View>
        </AnimatedTouchable>
      </Animated.View>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Header banner
// ---------------------------------------------------------------------------
function HeaderBanner({
  categoryName,
  count,
  isAuthenticated,
  onLoginPress,
}: {
  categoryName: string;
  count: number;
  isAuthenticated: boolean;
  onLoginPress: () => void;
}) {
  const catStyle = getCategoryStyle(categoryName);

  return (
    <Animated.View entering={FadeIn.duration(400)} style={styles.bannerWrapper}>
      <LinearGradient
        colors={["#0c6c75", "#1aa3b0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.banner}
      >
        <View style={styles.bannerCircle1} />
        <View style={styles.bannerCircle2} />
        <View style={styles.bannerContent}>
          <View style={[styles.bannerIconBox, { backgroundColor: catStyle.bg }]}>
            <Ionicons name={catStyle.icon as any} size={26} color={catStyle.color} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.bannerTitle}>{categoryName}</Text>
            <Text style={styles.bannerSub}>
              {count} service{count !== 1 ? "s" : ""} available
            </Text>
          </View>
          {!isAuthenticated && (
            <TouchableOpacity style={styles.loginChip} onPress={onLoginPress}>
              <Text style={styles.loginChipText}>Login to book</Text>
            </TouchableOpacity>
          )}
        </View>
      </LinearGradient>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main screen
// ---------------------------------------------------------------------------
export default function SubServicesScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { setPendingService, setPendingRoute } = useCartStore();

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

  const catStyle = getCategoryStyle(categoryName);

  const [loading, setLoading] = useState(true);
  const [listItems, setListItems] = useState<CatalogListItem[]>([]);
  const [resolvedCategoryId, setResolvedCategoryId] = useState(catalogCategoryId);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedDirect, setSelectedDirect] =
    useState<CatalogDirectService | null>(null);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      console.log(
        `[SubServices] Selected Category ID=${catalogCategoryId} name="${categoryName}"`,
      );

      try {
        const tree = await fetchCatalogTree();
        if (cancelled) return;

        console.log(
          `[SubServices] catalog tree — categories=${tree.categories.length} ids=[${tree.categories.map((c) => c.id).join(",")}]`,
        );

        let category = resolveCatalogCategory(
          tree,
          catalogCategoryId,
          categoryName,
        );

        if (
          !category ||
          ((category.service_lines?.length ?? 0) === 0 &&
            (category.direct_services?.length ?? 0) === 0)
        ) {
          const fallbackId = category?.id ?? catalogCategoryId;
          const subcategoryFallback = await fetchCatalogSubcategories(fallbackId);
          if (subcategoryFallback && !cancelled) {
            category = {
              ...(category ?? {
                id: fallbackId,
                name: categoryName,
                description: null,
                image_url: null,
                display_order: 0,
                direct_services: [],
              }),
              service_lines: subcategoryFallback.service_lines.length
                ? subcategoryFallback.service_lines
                : (category?.service_lines ?? []),
              direct_services: subcategoryFallback.direct_services.length
                ? subcategoryFallback.direct_services
                : (category?.direct_services ?? []),
            };
          }
        }

        const effectiveCategoryId = category?.id ?? catalogCategoryId;
        if (!cancelled) setResolvedCategoryId(effectiveCategoryId);

        const lines = [...(category?.service_lines ?? [])].sort(
          (a, b) => a.display_order - b.display_order,
        );
        const direct = [...(category?.direct_services ?? [])].sort(
          (a, b) => a.display_order - b.display_order,
        );

        const mapped: CatalogListItem[] = [
          ...lines.map((line) => {
            const imageUrl = resolveServiceLineImageUrl(line);
            return {
              key: `line-${line.id}`,
              name: line.name,
              description: null,
              price: line.starting_price,
              kind: "line" as const,
              imageUrl,
              line,
            };
          }),
          ...direct.map((service) => {
            const imageUrl = resolveDirectServiceImageUrl(service);
            return {
              key: `direct-${service.service_id}`,
              name: service.name,
              description: null,
              price: service.base_price,
              kind: "direct" as const,
              imageUrl,
              direct: service,
            };
          }),
        ];

        console.log(
          `[SubServices] image mapping — withImage=${mapped.filter((i) => i.imageUrl).length}/${mapped.length}`,
        );
        mapped.slice(0, 3).forEach((item) => {
          console.log("[SubServices] Sub Service:", item);
          console.log("[SubServices] Image URL:", item.imageUrl);
        });

        console.log(
          `[SubServices] resolved category id=${effectiveCategoryId} name="${category?.name ?? "NOT FOUND"}" — lines=${lines.length} direct=${direct.length} mapped=${mapped.length}`,
        );

        if (!cancelled) setListItems(mapped);
      } catch (err) {
        console.error(
          `[SubServices] load failed for categoryId=${catalogCategoryId}:`,
          err instanceof Error ? err.message : err,
        );
        if (!cancelled) setListItems([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [catalogCategoryId, categoryName]);

  useEffect(() => {
    console.log(
      `[SubServices] final rendered data length=${listItems.length} loading=${loading}`,
    );
  }, [listItems.length, loading]);

  const itemCount = useMemo(() => listItems.length, [listItems.length]);

  const handleListItemPress = (item: CatalogListItem) => {
    if (item.kind === "line" && item.line) {
      router.push({
        pathname: "/stitching-type",
        params: {
          catalogCategoryId: String(resolvedCategoryId),
          serviceLineId: String(item.line.id),
          categoryName,
          serviceLineName: item.line.name,
          ...(paramTailorId ? { tailorId: String(paramTailorId) } : {}),
          ...(paramTailorName ? { tailorName: paramTailorName } : {}),
        },
      });
      return;
    }

    if (item.kind === "direct" && item.direct) {
      setSelectedDirect(item.direct);
      setModalVisible(true);
    }
  };

  const proceedWithDirectService = (goToMeasurement: boolean) => {
    if (!selectedDirect) return;
    setModalVisible(false);

    const bookableServiceId = selectedDirect.service_id;
    const existingCart = useCartStore.getState().pendingService;
    const resolvedTailorId = paramTailorId ?? existingCart?.tailorId;
    const resolvedTailorName = paramTailorName ?? existingCart?.tailorName;

    setPendingService({
      bookableServiceId,
      categoryId: resolvedCategoryId,
      categoryName,
      serviceLineName: selectedDirect.name,
      basePrice: selectedDirect.base_price,
      displayName: selectedDirect.name,
      tailorId: resolvedTailorId,
      tailorName: resolvedTailorName,
    });

    if (!isAuthenticated) {
      setPendingRoute("/sub-services", {
        catalogCategoryId: String(resolvedCategoryId),
        categoryName,
      });
      router.push("/(auth)/login");
      return;
    }

    if (goToMeasurement) {
      router.push({
        pathname: "/measurement",
        params: {
          bookableServiceId: String(bookableServiceId),
          serviceLineName: selectedDirect.name,
          basePrice: String(selectedDirect.base_price),
        },
      });
    } else {
      router.push({
        pathname: "/measurement",
        params: {
          bookableServiceId: String(bookableServiceId),
          serviceLineName: selectedDirect.name,
          basePrice: String(selectedDirect.base_price),
          tailorVisit: "1",
        },
      });
    }
  };

  const handleAddMeasurement = () => {
    proceedWithDirectService(true);
  };

  const handleAddByTailor = () => {
    proceedWithDirectService(false);
  };

  const renderItem = ({ item, index }: { item: CatalogListItem; index: number }) => (
    <SubServiceCard
      item={item}
      index={index}
      categoryName={categoryName}
      onPress={handleListItemPress}
    />
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Top navigation header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={[styles.headerIcon, { backgroundColor: catStyle.bg }]}>
            <Ionicons name={catStyle.icon as any} size={18} color={catStyle.color} />
          </View>
          <Text style={styles.headerTitle}>{categoryName}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Content */}
      {loading ? (
        <View style={styles.skeletonGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <SubServiceCardSkeleton key={`sk-${i}`} />
          ))}
        </View>
      ) : listItems.length === 0 ? (
        <View style={styles.empty}>
          <Animated.View entering={FadeInDown.duration(500)} style={styles.emptyIconBox}>
            <Ionicons name="cut-outline" size={44} color={catStyle.color} />
          </Animated.View>
          <Animated.Text entering={FadeInDown.delay(100).duration(500)} style={styles.emptyTitle}>
            No services yet
          </Animated.Text>
          <Animated.Text entering={FadeInDown.delay(180).duration(500)} style={styles.emptyDesc}>
            Check back soon — new services are being added.
          </Animated.Text>
        </View>
      ) : (
        <FlatList
          data={listItems}
          keyExtractor={(item) => item.key}
          renderItem={renderItem}
          numColumns={2}
          columnWrapperStyle={styles.row}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.listContent}
          ListHeaderComponent={
            <HeaderBanner
              categoryName={categoryName}
              count={itemCount}
              isAuthenticated={isAuthenticated}
              onLoginPress={() => router.push("/(auth)/login")}
            />
          }
        />
      )}

      <ServiceOptionModal
        visible={modalVisible}
        item={
          selectedDirect
            ? {
                name: selectedDirect.name,
                base_price: selectedDirect.base_price,
              }
            : null
        }
        categoryName={categoryName}
        onAddMeasurement={handleAddMeasurement}
        onAddByTailor={handleAddByTailor}
        onClose={() => setModalVisible(false)}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
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
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: COLORS.grayLight,
    alignItems: "center", justifyContent: "center",
  },
  headerCenter: { flexDirection: "row", alignItems: "center", gap: SPACING.sm },
  headerIcon: {
    width: 32, height: 32, borderRadius: RADIUS.md,
    alignItems: "center", justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black, letterSpacing: -0.2 },

  bannerWrapper: {
    marginHorizontal: GRID_PADDING,
    marginTop: SPACING.lg,
    marginBottom: SPACING.md,
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    ...SHADOW.card,
  },
  banner: { borderRadius: RADIUS.xl, padding: SPACING.lg, overflow: "hidden" },
  bannerCircle1: {
    position: "absolute", width: 140, height: 140, borderRadius: 70,
    backgroundColor: "rgba(255,255,255,0.07)", top: -40, right: -30,
  },
  bannerCircle2: {
    position: "absolute", width: 90, height: 90, borderRadius: 45,
    backgroundColor: "rgba(255,255,255,0.05)", bottom: -20, left: 20,
  },
  bannerContent: { flexDirection: "row", alignItems: "center", gap: SPACING.md },
  bannerIconBox: {
    width: 52, height: 52, borderRadius: RADIUS.lg,
    alignItems: "center", justifyContent: "center",
  },
  bannerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.white, letterSpacing: -0.3 },
  bannerSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginTop: 2 },
  loginChip: {
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: RADIUS.full,
    paddingHorizontal: 12, paddingVertical: 6,
  },
  loginChipText: { fontSize: 12, fontWeight: "700", color: COLORS.white },

  listContent: { paddingBottom: 48 },
  row: { justifyContent: "space-between", paddingHorizontal: GRID_PADDING, marginBottom: 0 },

  cardWrapper: { width: CARD_WIDTH, marginBottom: GRID_GAP },
  card: {
    width: "100%", backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl, overflow: "hidden", ...SHADOW.card,
  },
  imageContainer: { width: "100%", height: 110, position: "relative" },
  cardImage: { width: "100%", height: "100%" },
  iconGradient: { width: "100%", height: "100%", alignItems: "center", justifyContent: "center" },
  iconCircle: {
    width: 60, height: 60, borderRadius: 30,
    alignItems: "center", justifyContent: "center", ...SHADOW.card,
  },
  priceBadge: {
    position: "absolute", bottom: 8, right: 8,
    backgroundColor: "rgba(12, 108, 117, 0.92)",
    borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3,
  },
  priceBadgeText: { fontSize: 11, fontWeight: "700", color: COLORS.white, letterSpacing: 0.2 },

  cardBody: { padding: SPACING.md, paddingTop: SPACING.sm + 2 },
  cardTitle: {
    fontSize: 14, fontWeight: "700", color: COLORS.black,
    lineHeight: 19, marginBottom: 4, letterSpacing: -0.1,
  },
  cardDesc: { fontSize: 11, color: COLORS.gray, lineHeight: 15, marginBottom: SPACING.sm },
  ctaRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 2 },
  ctaLabel: { fontSize: 12, fontWeight: "700", color: COLORS.primaryDark },
  ctaArrow: { width: 22, height: 22, borderRadius: 11, alignItems: "center", justifyContent: "center" },

  skeletonGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: GRID_PADDING,
    paddingTop: SPACING.lg,
    gap: GRID_GAP,
  },
  empty: {
    flex: 1, alignItems: "center", justifyContent: "center",
    paddingHorizontal: SPACING.xl, gap: SPACING.sm,
  },
  emptyIconBox: {
    width: 88, height: 88, borderRadius: 44,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center", marginBottom: SPACING.sm,
  },
  emptyTitle: { fontSize: 18, fontWeight: "700", color: COLORS.black, textAlign: "center" },
  emptyDesc: { fontSize: 14, color: COLORS.gray, textAlign: "center", lineHeight: 20 },
});
