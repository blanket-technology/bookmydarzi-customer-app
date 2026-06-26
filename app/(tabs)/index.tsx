import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  FlatList,
  RefreshControl,
  Dimensions,
  Image,
  ImageBackground,
  Platform,
  Pressable,
  useWindowDimensions,
  ActivityIndicator,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useFocusEffect } from "@react-navigation/native";
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";

import { useAuthStore } from "../../store/useAuthStore";
import { useHomeStore } from "../../src/store/useHomeStore";
import { useAddressStore } from "../../src/store/useAddressStore";
import { usePullToRefresh } from "../../src/hooks/usePullToRefresh";
import { useHomeExitBackHandler } from "../../src/hooks/useHomeExitBackHandler";
import { useCartStore } from "../../src/store/useCartStore";
import type { PopularServiceRow } from "../../src/types/homeApi";
import {
  PopularServicesSection,
} from "../../components/home/PopularServiceCard";
import { navigateToServiceDetails } from "../../src/utils/navigateToServiceDetails";
import ErrorState from "../../src/components/common/ErrorState";
import { COLORS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import {
  formatHomeHeaderLocation,
  getDefaultAddress,
} from "../../src/utils/addressDisplay";
import {
  fetchActiveCustomerOrders,
  fetchCompletedCustomerOrders,
} from "../../src/services/customerOrderService";
import { formatCustomerOrderStatusLabel } from "../../src/utils/customerOrderStatus";
import { ORDER_DISPLAY_FALLBACK } from "../../src/types/api";
import type { CustomerOrderListItem } from "../../src/types/customerOrders";
import type {
  ApiServiceCategory,
  ApiSubCategory,
  ApiBanner,
} from "../../src/types/homeApi";
import { resolveCatalogCategoryId } from "../../src/utils/catalogCategoryMap";
import { normalizeProfileImageUrl } from "../../src/utils/profileImage";

const SCREEN_WIDTH = Dimensions.get("window").width;
const H_PAD = 20;
const SHEET_RADIUS = 32;
const BANNER_SIDE_INSET = 4;
const BANNER_GAP = 12;
const BANNER_RADIUS = 24;
const HEADER_TEAL = "#149694";
const HEADER_GRADIENT: [string, string] = [HEADER_TEAL, "#0c6c75"];
const SEARCH_OVERLAP = 28;
// Category avatar size (circle + image). Uniform across all categories.
const CATEGORY_SIZE = 72;
const CATEGORY_GAP = 12;
const CATEGORY_BORDER_WIDTH = 2.5;
const CATEGORY_BORDER_COLOR = "rgba(20, 150, 148, 0.82)";

const SOFT_SHADOW = {
  shadowColor: "#000",
  shadowOffset: { width: 0, height: 4 },
  shadowOpacity: 0.08,
  shadowRadius: 12,
  elevation: 4,
};

function resolveCategoryImageUrl(url: string | null | undefined): string | null {
  const resolved = normalizeProfileImageUrl(url);
  if (!resolved || resolved.includes("example.com")) return null;
  return resolved;
}

function isValidImageUrl(url: string | null | undefined): boolean {
  return resolveCategoryImageUrl(url) != null;
}

function findServiceImageUrl(
  serviceTitle: string,
  categories: ApiServiceCategory[],
): string | null {
  const needle = serviceTitle.trim().toLowerCase();
  if (!needle || needle === ORDER_DISPLAY_FALLBACK.toLowerCase()) return null;

  for (const cat of categories) {
    for (const sub of cat.SubCategories ?? []) {
      const subName = sub.Name.trim().toLowerCase();
      if (subName === needle || needle.includes(subName) || subName.includes(needle)) {
        if (isValidImageUrl(sub.ImageUrl)) {
          return resolveCategoryImageUrl(sub.ImageUrl);
        }
      }
    }
    const catName = cat.Name.trim().toLowerCase();
    if (catName === needle || needle.includes(catName)) {
      if (isValidImageUrl(cat.ImageUrl)) {
        return resolveCategoryImageUrl(cat.ImageUrl);
      }
    }
  }
  return null;
}

type StatusBadgeStyle = { bg: string; text: string; label: string };

function getRecentOrderStatusStyle(status: string, statusLabel: string): StatusBadgeStyle {
  const normalized = status.trim().toLowerCase().replace(/\s+/g, "_");

  if (normalized.includes("cancel")) {
    return { bg: "#FEE2E2", text: "#DC2626", label: "Cancelled" };
  }
  if (
    normalized.includes("complete") ||
    normalized.includes("delivered") ||
    normalized.includes("done")
  ) {
    return { bg: "#D1FAE5", text: "#059669", label: "Completed" };
  }
  if (normalized.includes("progress") || normalized.includes("in_progress")) {
    return { bg: "#EDE9FE", text: "#7C3AED", label: "In Progress" };
  }
  if (normalized.includes("confirm")) {
    return { bg: "#DBEAFE", text: "#2563EB", label: "Confirmed" };
  }
  if (normalized.includes("pending")) {
    return { bg: "#FFEDD5", text: "#EA580C", label: "Pending" };
  }

  const formatted = formatCustomerOrderStatusLabel(statusLabel || status);
  return { bg: "#F3F4F6", text: "#6B7280", label: formatted || "—" };
}

/** Extract duration text from API description when present (e.g. "1-2 days"). */
function extractDurationLabel(
  ...sources: (string | null | undefined)[]
): string | null {
  for (const src of sources) {
    const text = (src ?? "").trim();
    if (!text) continue;
    const match = text.match(/\b\d+\s*[-–]\s*\d+\s*days?\b/i);
    if (match) return match[0].replace(/\s+/g, " ");
    const single = text.match(/\b\d+\s*days?\b/i);
    if (single) return single[0];
  }
  return null;
}

// ---------------------------------------------------------------------------
// Banner carousel
// ---------------------------------------------------------------------------
function BannerCarousel({ banners }: { banners: ApiBanner[] }) {
  const { width: screenWidth } = useWindowDimensions();
  const [activeIndex, setActiveIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const bannerCardWidth = screenWidth - (H_PAD + BANNER_SIDE_INSET) * 2;
  const bannerStride = bannerCardWidth + BANNER_GAP;

  const snapOffsets = useMemo(
    () => banners.map((_, index) => index * bannerStride),
    [banners, bannerStride],
  );

  useEffect(() => {
    if (banners.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => {
        const next = (prev + 1) % banners.length;
        flatListRef.current?.scrollToIndex({ index: next, animated: true });
        return next;
      });
    }, 3500);
    return () => clearInterval(timer);
  }, [banners.length]);

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: Array<{ index: number | null }> }) => {
      const index = viewableItems[0]?.index;
      if (index != null) {
        setActiveIndex(index);
      }
    },
  ).current;

  const viewabilityConfig = useRef({
    itemVisiblePercentThreshold: 50,
  }).current;

  const getItemLayout = useCallback(
    (_: unknown, index: number) => ({
      length: bannerCardWidth,
      offset: BANNER_SIDE_INSET + bannerStride * index,
      index,
    }),
    [bannerCardWidth, bannerStride],
  );

  const onScrollToIndexFailed = useCallback(
    (info: { index: number }) => {
      flatListRef.current?.scrollToOffset({
        offset: info.index * bannerStride,
        animated: true,
      });
    },
    [bannerStride],
  );

  if (banners.length === 0) return null;

  return (
    <Animated.View entering={FadeInDown.delay(100).duration(400)} style={carousel.wrap}>
      <FlatList
        ref={flatListRef}
        style={carousel.list}
        contentContainerStyle={[
          carousel.listContent,
          { paddingHorizontal: BANNER_SIDE_INSET },
        ]}
        data={banners}
        horizontal
        snapToOffsets={snapOffsets}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        bounces={false}
        showsHorizontalScrollIndicator={false}
        removeClippedSubviews={false}
        keyExtractor={(item, i) => `banner-${item.Id ?? i}`}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        getItemLayout={getItemLayout}
        onScrollToIndexFailed={onScrollToIndexFailed}
        ItemSeparatorComponent={
          banners.length > 1
            ? () => <View style={{ width: BANNER_GAP }} />
            : undefined
        }
        renderItem={({ item }) => {
          const imageUri = resolveCategoryImageUrl(item.ImageUrl);
          const hasImage = imageUri != null;
          const content = (
            <>
              <View style={carousel.overlay} />
              <View style={carousel.content}>
                <Text style={carousel.title} numberOfLines={2}>
                  {item.Title}
                </Text>
                {item.Subtitle ? (
                  <Text style={carousel.subtitle} numberOfLines={2}>
                    {item.Subtitle}
                  </Text>
                ) : null}
                <TouchableOpacity style={carousel.cta} activeOpacity={0.88}>
                  <Text style={carousel.ctaText}>Explore</Text>
                  <Ionicons name="arrow-forward" size={14} color={COLORS.primaryDark} />
                </TouchableOpacity>
              </View>
            </>
          );

          return (
            <View style={[carousel.slide, { width: bannerCardWidth }]}>
              {hasImage ? (
                <ImageBackground
                  source={{ uri: imageUri! }}
                  style={carousel.imageBg}
                  imageStyle={carousel.imageRadius}
                  resizeMode="cover"
                >
                  {content}
                </ImageBackground>
              ) : (
                <LinearGradient
                  colors={["#0a5c63", "#149694", "#1aa3b0"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={carousel.imageBg}
                >
                  {content}
                </LinearGradient>
              )}
            </View>
          );
        }}
      />

      {banners.length > 1 ? (
        <View style={carousel.dots}>
          {banners.map((_, i) => (
            <TouchableOpacity
              key={`dot-${i}`}
              onPress={() => {
                flatListRef.current?.scrollToIndex({ index: i, animated: true });
                setActiveIndex(i);
              }}
              style={[carousel.dot, i === activeIndex && carousel.dotActive]}
            />
          ))}
        </View>
      ) : null}
    </Animated.View>
  );
}

const carousel = StyleSheet.create({
  wrap: {
    marginTop: 10,
    marginBottom: 22,
    width: "100%",
  },
  list: {
    width: "100%",
  },
  listContent: {
    alignItems: "center",
  },
  slide: {
    overflow: "hidden",
    borderRadius: BANNER_RADIUS,
    backgroundColor: COLORS.white,
    ...Platform.select({
      ios: {
        shadowColor: "#0a5c63",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.13,
        shadowRadius: 14,
      },
      android: { elevation: 5 },
    }),
  },
  imageBg: { minHeight: 176, justifyContent: "flex-end" },
  imageRadius: { borderRadius: BANNER_RADIUS },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 50, 55, 0.55)",
    borderRadius: BANNER_RADIUS,
  },
  content: { padding: SPACING.lg, zIndex: 1 },
  title: {
    fontSize: 22,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 28,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 13,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 19,
    marginBottom: SPACING.md,
  },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 10,
  },
  ctaText: { fontSize: 13, fontWeight: "700", color: HEADER_TEAL },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    width: 20,
    backgroundColor: HEADER_TEAL,
  },
});

// ---------------------------------------------------------------------------
// Category icons — horizontal row
// ---------------------------------------------------------------------------
const CATEGORY_ICONS: Record<string, { icon: string; color: string; bg: string }> = {
  mens: { icon: "shirt-outline", color: "#0c6c75", bg: "#E0F7F8" },
  men: { icon: "shirt-outline", color: "#0c6c75", bg: "#E0F7F8" },
  womens: { icon: "woman-outline", color: "#7C3AED", bg: "#EDE9FE" },
  women: { icon: "woman-outline", color: "#7C3AED", bg: "#EDE9FE" },
  kids: { icon: "happy-outline", color: "#DC2626", bg: "#FEE2E2" },
  "custom alterations": { icon: "construct-outline", color: "#065F46", bg: "#D1FAE5" },
  alterations: { icon: "construct-outline", color: "#065F46", bg: "#D1FAE5" },
  wedding: { icon: "heart-outline", color: "#C9A84C", bg: "#F5E6C0" },
};

function getCategoryStyle(name: string) {
  const key = name.trim().toLowerCase();
  if (CATEGORY_ICONS[key]) return CATEGORY_ICONS[key];
  if (key.includes("men") && !key.includes("women")) return CATEGORY_ICONS.mens;
  if (key.includes("women") || key.includes("ladies")) return CATEGORY_ICONS.womens;
  if (key.includes("kid")) return CATEGORY_ICONS.kids;
  if (key.includes("alter")) return CATEGORY_ICONS.alterations;
  return { icon: "shirt-outline", color: "#B45309", bg: "#FEF3C7" };
}

function ServiceCategoryItem({
  category,
  itemWidth,
  onPress,
}: {
  category: ApiServiceCategory;
  itemWidth: number;
  onPress: (cat: ApiServiceCategory) => void;
}) {
  const style = getCategoryStyle(category.Name);
  const imageUrl = resolveCategoryImageUrl(category.ImageUrl);
  const iconName = (style.icon || "shirt-outline") as keyof typeof Ionicons.glyphMap;

  return (
    <TouchableOpacity
      style={[categoryItem.wrap, { width: itemWidth }]}
      activeOpacity={0.82}
      onPress={() => onPress(category)}
    >
      <View style={categoryItem.avatarShell}>
        <View
          style={[
            categoryItem.circle,
            !imageUrl ? { backgroundColor: style.bg } : null,
          ]}
        >
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              style={categoryItem.circleImage}
              resizeMode="cover"
            />
          ) : (
            <Ionicons name={iconName} size={28} color={style.color} />
          )}
        </View>
      </View>
      <Text style={categoryItem.label} numberOfLines={2}>
        {category.Name}
      </Text>
    </TouchableOpacity>
  );
}

const categoryItem = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "flex-start",
  },
  avatarShell: {
    width: CATEGORY_SIZE,
    height: CATEGORY_SIZE,
    borderRadius: CATEGORY_SIZE / 2,
    marginBottom: 8,
    alignSelf: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.2,
        shadowRadius: 11,
      },
      android: { elevation: 6 },
    }),
  },
  circle: {
    width: CATEGORY_SIZE,
    height: CATEGORY_SIZE,
    borderRadius: CATEGORY_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    borderWidth: CATEGORY_BORDER_WIDTH,
    borderColor: CATEGORY_BORDER_COLOR,
  },
  circleImage: {
    width: "100%",
    height: "100%",
  },
  label: {
    width: "100%",
    fontSize: 12,
    fontWeight: "700",
    color: "#111827",
    textAlign: "center",
    lineHeight: 15,
    minHeight: 30,
    alignSelf: "center",
  },
});

// ---------------------------------------------------------------------------
// Search result row (compact category)
// ---------------------------------------------------------------------------
function SearchCategoryRow({
  category,
  index,
  onPress,
}: {
  category: ApiServiceCategory;
  index: number;
  onPress: (cat: ApiServiceCategory) => void;
}) {
  const style = getCategoryStyle(category.Name);
  return (
    <Animated.View entering={FadeInDown.delay(index * 40).duration(300)}>
      <TouchableOpacity style={searchRow.row} onPress={() => onPress(category)} activeOpacity={0.85}>
        <View style={[searchRow.icon, { backgroundColor: style.bg }]}>
          <Ionicons name={style.icon as keyof typeof Ionicons.glyphMap} size={22} color={style.color} />
        </View>
        <View style={searchRow.text}>
          <Text style={searchRow.title}>{category.Name}</Text>
          <Text style={searchRow.sub}>
            {(category.SubCategories?.length ?? 0)} services
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={18} color={COLORS.grayBorder} />
      </TouchableOpacity>
    </Animated.View>
  );
}

function RecentOrderListItem({
  order,
  imageUrl,
  categoryStyle,
  onPress,
}: {
  order: CustomerOrderListItem;
  imageUrl: string | null;
  categoryStyle: { icon: string; color: string; bg: string };
  onPress: (orderId: number) => void;
}) {
  const statusStyle = getRecentOrderStatusStyle(order.status, order.statusLabel);
  const serviceName =
    order.serviceTitle && order.serviceTitle !== ORDER_DISPLAY_FALLBACK
      ? order.serviceTitle
      : order.serviceSubtitle;
  const orderIdLabel =
    order.bookingId && order.bookingId !== ORDER_DISPLAY_FALLBACK
      ? order.bookingId
      : order.id > 0
        ? `#${order.id}`
        : ORDER_DISPLAY_FALLBACK;
  const dateLabel =
    order.scheduledLabel && order.scheduledLabel !== ORDER_DISPLAY_FALLBACK
      ? order.scheduledLabel
      : null;

  return (
    <TouchableOpacity
      style={recent.row}
      activeOpacity={0.88}
      onPress={() => onPress(order.id)}
    >
      {imageUrl ? (
        <Image source={{ uri: imageUrl }} style={recent.thumb} resizeMode="cover" />
      ) : (
        <View style={[recent.thumbFallback, { backgroundColor: categoryStyle.bg }]}>
          <Ionicons
            name={categoryStyle.icon as keyof typeof Ionicons.glyphMap}
            size={22}
            color={categoryStyle.color}
          />
        </View>
      )}

      <View style={recent.body}>
        <View style={recent.topLine}>
          <Text style={recent.serviceName} numberOfLines={1}>
            {serviceName}
          </Text>
          <View style={[recent.statusBadge, { backgroundColor: statusStyle.bg }]}>
            <Text style={[recent.statusText, { color: statusStyle.text }]} numberOfLines={1}>
              {statusStyle.label}
            </Text>
          </View>
        </View>

        <Text style={recent.meta} numberOfLines={1}>
          Order ID: {orderIdLabel}
        </Text>
        {dateLabel ? (
          <Text style={recent.meta} numberOfLines={1}>
            {dateLabel}
          </Text>
        ) : null}

        <Text style={recent.amount}>{order.amountPaidDisplay}</Text>
      </View>

      <Ionicons name="chevron-forward" size={18} color="#C4C9D0" style={recent.arrow} />
    </TouchableOpacity>
  );
}

const recent = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 11,
    gap: 12,
    ...SOFT_SHADOW,
  },
  thumb: {
    width: 48,
    height: 48,
    borderRadius: 12,
    backgroundColor: COLORS.grayLight,
  },
  thumbFallback: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { flex: 1, minWidth: 0 },
  topLine: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    marginBottom: 3,
  },
  serviceName: {
    flex: 1,
    fontSize: 14,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.15,
  },
  statusBadge: {
    borderRadius: RADIUS.full,
    paddingHorizontal: 7,
    paddingVertical: 3,
    maxWidth: 96,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "700",
  },
  meta: {
    fontSize: 11,
    color: "#9CA3AF",
    lineHeight: 15,
  },
  amount: {
    fontSize: 13,
    fontWeight: "800",
    color: HEADER_TEAL,
    marginTop: 4,
  },
  arrow: {
    marginLeft: 2,
  },
});

const searchRow = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    gap: SPACING.md,
    ...SOFT_SHADOW,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1 },
  title: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  sub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
});

// ---------------------------------------------------------------------------
// Voice search action — UI placeholder until speech-to-text is integrated
// ---------------------------------------------------------------------------
function VoiceSearchButton() {
  const scale = useSharedValue(1);

  const animStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handleVoicePress = () => {
    // TODO: Integrate voice search — launch speech recognition and set search query
  };

  return (
    <Animated.View style={animStyle}>
      <Pressable
        onPress={handleVoicePress}
        onPressIn={() => {
          scale.value = withSpring(0.9, { damping: 18, stiffness: 320 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 320 });
        }}
        style={styles.voiceBtn}
        hitSlop={6}
        accessibilityRole="button"
        accessibilityLabel="Voice search"
      >
        <Ionicons name="mic-outline" size={19} color={COLORS.primaryDark} />
      </Pressable>
    </Animated.View>
  );
}

// ---------------------------------------------------------------------------
// Main Home Screen
// ---------------------------------------------------------------------------
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);

  useHomeExitBackHandler();

  const cartItemCount = useCartStore((s) => s.itemCount);

  const {
    banners,
    serviceCategories,
    popularServices,
    specialOffers,
    featuredTailors,
    error,
    loadHomeData,
    clearError,
  } = useHomeStore();

  const { addresses, fetchAddresses } = useAddressStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [recentOrders, setRecentOrders] = useState<CustomerOrderListItem[]>([]);

  const loadRecentOrders = useCallback(async () => {
    if (!isAuthenticated) {
      setRecentOrders([]);
      return;
    }
    try {
      const [active, completed] = await Promise.all([
        fetchActiveCustomerOrders(),
        fetchCompletedCustomerOrders(),
      ]);
      const merged = new Map<number, CustomerOrderListItem>();
      for (const order of [...active, ...completed]) {
        if (order.id > 0) merged.set(order.id, order);
      }
      const sorted = Array.from(merged.values()).sort((a, b) => b.id - a.id);
      setRecentOrders(sorted.slice(0, 4));
      console.log(
        `[HomeScreen] recent orders loaded: active=${active.length} completed=${completed.length} showing=${Math.min(sorted.length, 4)}`,
      );
    } catch (err) {
      console.warn(
        "[HomeScreen] recent orders failed:",
        err instanceof Error ? err.message : err,
      );
      setRecentOrders([]);
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated && user?.role === "user") {
        void useCartStore
          .getState()
          .refreshCart({ silent: true, allowCreate: false })
          .catch(() => {});
      }
    }, [isAuthenticated, user?.role]),
  );

  const handleCategoryPress = useCallback(
    async (cat: ApiServiceCategory) => {
      let catalogCategoryId = cat.Id;
      if (!catalogCategoryId) {
        catalogCategoryId = await resolveCatalogCategoryId(
          cat.Name,
          serviceCategories,
        );
      }
      console.log(
        `[catalogCategoryMap] ${cat.Name} | ${catalogCategoryId} | ${catalogCategoryId > 0 ? "Success" : "Failed"}`,
      );
      console.log(
        `[HomeScreen] category press — name="${cat.Name}" homeId=${cat.Id} catalogCategoryId=${catalogCategoryId}`,
      );
      router.push({
        pathname: "/sub-services",
        params: {
          catalogCategoryId: String(catalogCategoryId),
          categoryName: cat.Name,
        },
      });
    },
    [router, serviceCategories],
  );

  const handlePopularPress = useCallback(
    (row: PopularServiceRow) => {
      void navigateToServiceDetails(router, row, serviceCategories);
    },
    [router, serviceCategories],
  );

  useEffect(() => {
    loadHomeData();
  }, []);

  useEffect(() => {
    console.log("API Categories", serviceCategories.length);
    console.log("Store Categories", serviceCategories.length);
    console.log("Rendered Categories", serviceCategories.length);
    console.log("API Popular", popularServices.length);
    console.log("Rendered Popular", popularServices.length);
    console.log(
      `[HomeScreen] render inputs — categories=${serviceCategories.length} popularServices=${popularServices.length} banners=${banners.length}`,
    );
    if (popularServices.length > 0) {
      console.log(
        `[HomeScreen] popularServices sample:`,
        JSON.stringify(
          popularServices.slice(0, 3).map((row) => ({
            name: row.sub.Name,
            price: row.sub.BasePrice,
            category: row.category.Name,
          })),
        ),
      );
    }
  }, [serviceCategories.length, popularServices, banners.length]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchAddresses();
        loadRecentOrders();
      } else {
        setRecentOrders([]);
      }
    }, [isAuthenticated, fetchAddresses, loadRecentOrders]),
  );

  const { refreshing, handleRefresh } = usePullToRefresh(
    useCallback(async () => {
      await loadHomeData(true);
      if (isAuthenticated) {
        await fetchAddresses();
        await loadRecentOrders();
      }
    }, [isAuthenticated, fetchAddresses, loadHomeData, loadRecentOrders]),
  );

  const defaultAddress = useMemo(
    () => getDefaultAddress(addresses),
    [addresses],
  );
  const locationLine = useMemo(() => {
    const formatted = formatHomeHeaderLocation(defaultAddress);
    if (formatted) return formatted;
    return isAuthenticated ? "Add delivery address" : "Sign in for location";
  }, [defaultAddress, isAuthenticated]);

  const notificationCount = Math.min(specialOffers.length, 9);

  const welcomeGreeting = useMemo(() => {
    const first = user?.first_name?.trim();
    if (first) return `Hi, ${first}! 👋`;
    const full = (
      user?.name ?? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()
    ).trim();
    if (full) {
      const short = full.split(/\s+/)[0];
      if (short) return `Hi, ${short}! 👋`;
    }
    return "Hi there! 👋";
  }, [user]);

  const popularList = popularServices;

  const avgTailorRating = useMemo(() => {
    if (!featuredTailors.length) return null;
    const total = featuredTailors.reduce((sum, t) => sum + (t.rating ?? 0), 0);
    return total / featuredTailors.length;
  }, [featuredTailors]);

  const q = searchQuery.toLowerCase().trim();
  const filteredCategories =
    q.length > 1
      ? serviceCategories.filter(
          (c) =>
            c.Name.toLowerCase().includes(q) ||
            c.SubCategories?.some((s) => s.Name.toLowerCase().includes(q)),
        )
      : serviceCategories;

  const isSearching = q.length > 1;
  const noResults = isSearching && filteredCategories.length === 0;

  const sortedServiceCategories = useMemo(
    () =>
      [...serviceCategories].sort(
        (a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0),
      ),
    [serviceCategories],
  );

  const categoryItemWidth = useMemo(() => {
    const count = Math.max(serviceCategories.length, 1);
    const width = screenWidth > 0 ? screenWidth : SCREEN_WIDTH;
    const available = width - H_PAD * 2;
    if (count <= 4) {
      return (available - CATEGORY_GAP * (count - 1)) / count;
    }
    return Math.max(CATEGORY_SIZE + 16, Math.floor(available / 4.2));
  }, [screenWidth, serviceCategories.length]);

  const handleSignInForLocation = useCallback(() => {
    router.push("/(auth)/login");
  }, [router]);

  const handleLocationPress = () => {
    if (!isAuthenticated) {
      handleSignInForLocation();
      return;
    }
    router.push("/address");
  };

  const handleRecentOrderPress = useCallback(
    (orderId: number) => {
      router.push({
        pathname: "/order-summary" as never,
        params: { orderId: String(orderId) },
      });
    },
    [router],
  );

  const handleSeeAllOrders = useCallback(() => {
    router.push("/(tabs)/orders");
  }, [router]);

  return (
    <View style={styles.root}>
      {/* Teal header */}
      <LinearGradient
        colors={HEADER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[styles.headerGradient, { paddingTop: insets.top + SPACING.sm }]}
      >
        <View style={styles.headerRow}>
          {!isAuthenticated ? (
            <Pressable
              style={({ pressed }) => [
                styles.signInCard,
                pressed && styles.signInCardPressed,
              ]}
              onPress={handleSignInForLocation}
              accessibilityRole="button"
              accessibilityLabel="Sign in for location"
            >
              <View style={styles.signInIconWrap}>
                <Ionicons name="location" size={20} color={HEADER_TEAL} />
              </View>
              <View style={styles.signInTextWrap}>
                <Text style={styles.signInTitle}>Sign in for location</Text>
                <Text style={styles.signInSubtitle} numberOfLines={1}>
                  Unlock nearby tailoring services
                </Text>
              </View>
              <View style={styles.signInCta}>
                <Text style={styles.signInCtaText}>Sign In</Text>
                <Ionicons
                  name="arrow-forward"
                  size={14}
                  color={HEADER_TEAL}
                />
              </View>
            </Pressable>
          ) : (
            <TouchableOpacity
              style={styles.locationBlock}
              activeOpacity={0.85}
              onPress={handleLocationPress}
            >
              <Ionicons name="location" size={18} color="#FFFFFF" />
              <View style={styles.locationTextWrap}>
                <Text style={styles.locationLabel}>Current Location</Text>
                <Text style={styles.locationValue} numberOfLines={2}>
                  {locationLine}
                </Text>
              </View>
            </TouchableOpacity>
          )}

          <View style={styles.headerActions}>
            {isAuthenticated ? (
              <TouchableOpacity
                style={styles.cartBtn}
                activeOpacity={0.85}
                onPress={() => router.push("/(tabs)/cart")}
                accessibilityLabel="Open cart"
              >
                <Ionicons name="cart-outline" size={22} color="#FFFFFF" />
                {cartItemCount > 0 ? (
                  <View style={styles.cartBadge}>
                    <Text style={styles.cartBadgeText}>
                      {cartItemCount > 99 ? "99+" : cartItemCount}
                    </Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}

            <TouchableOpacity style={styles.bellBtn} activeOpacity={0.85}>
              <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
              {notificationCount > 0 ? (
                <View style={styles.bellBadge}>
                  <Text style={styles.bellBadgeText}>{notificationCount}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          </View>
        </View>
      </LinearGradient>

      {/* Search — overlaps header + sheet */}
      <View style={[styles.searchFloat, { top: insets.top + (isAuthenticated ? 92 : 100) }]}>
        <View style={styles.searchBar}>
          <Ionicons name="search-outline" size={20} color={COLORS.gray} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search services, categories..."
            placeholderTextColor="#9CA3AF"
            value={searchQuery}
            onChangeText={setSearchQuery}
            returnKeyType="search"
          />
          {searchQuery.length > 0 ? (
            <TouchableOpacity
              style={styles.searchClearBtn}
              onPress={() => setSearchQuery("")}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel="Clear search"
            >
              <Ionicons name="close-circle" size={18} color={COLORS.gray} />
            </TouchableOpacity>
          ) : (
            <VoiceSearchButton />
          )}
        </View>
      </View>

      <ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingTop: SEARCH_OVERLAP + 56 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={COLORS.primary}
            progressViewOffset={insets.top + 120}
          />
        }
      >
        <View
          style={[
            styles.sheet,
            { paddingBottom: insets.bottom + SPACING.xl },
          ]}
        >
          {error ? (
            <ErrorState
              message={error}
              onRetry={() => {
                clearError();
                loadHomeData(true);
              }}
            />
          ) : isSearching ? (
            <Animated.View entering={FadeInDown.duration(300)} style={styles.block}>
              {noResults ? (
                <View style={styles.emptySearch}>
                  <Ionicons name="search-outline" size={40} color={COLORS.grayBorder} />
                  <Text style={styles.emptySearchTitle}>No Results Found</Text>
                  <Text style={styles.emptySearchSub}>
                    No categories match "{searchQuery}"
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>
                    Results ({filteredCategories.length})
                  </Text>
                  {filteredCategories.map((cat, i) => (
                    <SearchCategoryRow
                      key={`search-${cat.Id ?? i}`}
                      category={cat}
                      index={i}
                      onPress={handleCategoryPress}
                    />
                  ))}
                </>
              )}
            </Animated.View>
          ) : (
            <>
              <Animated.View
                entering={FadeInDown.delay(20).duration(350)}
                style={styles.welcomeBlock}
              >
                <Text style={styles.welcomeGreeting}>{welcomeGreeting}</Text>
                <Text style={styles.welcomeHeadline}>
                  What would you like to get stitched today?
                </Text>
              </Animated.View>

              {sortedServiceCategories.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(40).duration(350)} style={styles.block}>
                  <ScrollView
                    horizontal
                    nestedScrollEnabled
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.servicesRow}
                  >
                    {sortedServiceCategories.map((cat, index) => (
                      <ServiceCategoryItem
                        key={`svc-${cat.Id ?? cat.Name}-${index}`}
                        category={cat}
                        itemWidth={categoryItemWidth}
                        onPress={handleCategoryPress}
                      />
                    ))}
                  </ScrollView>
                </Animated.View>
              ) : null}

              {banners.length > 0 ? <BannerCarousel banners={banners} /> : null}

              {popularList.length > 0 ? (
                <Animated.View
                  entering={FadeInDown.delay(120).duration(350)}
                  style={styles.popularBlock}
                >
                  <PopularServicesSection
                    services={popularList}
                    rating={avgTailorRating}
                    onPress={handlePopularPress}
                  />
                </Animated.View>
              ) : null}

              {recentOrders.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(160).duration(350)} style={styles.block}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitleInline}>Recent Orders</Text>
                    <TouchableOpacity
                      onPress={handleSeeAllOrders}
                      activeOpacity={0.8}
                      hitSlop={8}
                    >
                      <Text style={styles.seeAllLink}>See All</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.recentList}>
                    {recentOrders.map((item) => {
                      const imageUrl = findServiceImageUrl(item.serviceTitle, serviceCategories);
                      const categoryStyle = getCategoryStyle(
                        item.serviceSubtitle !== ORDER_DISPLAY_FALLBACK
                          ? item.serviceSubtitle
                          : item.serviceTitle,
                      );
                      return (
                        <RecentOrderListItem
                          key={`recent-${item.id}`}
                          order={item}
                          imageUrl={imageUrl}
                          categoryStyle={categoryStyle}
                          onPress={handleRecentOrderPress}
                        />
                      );
                    })}
                  </View>
                </Animated.View>
              ) : null}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: HEADER_GRADIENT[0],
  },
  headerGradient: {
    paddingHorizontal: H_PAD,
    paddingBottom: SEARCH_OVERLAP + 38,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.md,
  },
  locationBlock: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  signInCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(255,255,255,0.96)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.65)",
    ...SOFT_SHADOW,
  },
  signInCardPressed: {
    opacity: 0.92,
    transform: [{ scale: 0.985 }],
  },
  signInIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#E6F7F7",
    alignItems: "center",
    justifyContent: "center",
  },
  signInTextWrap: {
    flex: 1,
    minWidth: 0,
  },
  signInTitle: {
    fontSize: 15,
    fontWeight: "800",
    color: HEADER_TEAL,
    marginBottom: 2,
    letterSpacing: -0.2,
  },
  signInSubtitle: {
    fontSize: 12,
    fontWeight: "500",
    color: "#6B7280",
  },
  signInCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#E6F7F7",
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
  },
  signInCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: HEADER_TEAL,
  },
  locationTextWrap: { flex: 1 },
  locationLabel: {
    fontSize: 11,
    fontWeight: "400",
    color: "rgba(255,255,255,0.88)",
    marginBottom: 3,
  },
  locationValue: {
    fontSize: 16,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 21,
    letterSpacing: -0.2,
  },
  headerActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  cartBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  cartBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF6A00",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: HEADER_GRADIENT[0],
  },
  cartBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  bellBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  bellBadge: {
    position: "absolute",
    top: 2,
    right: 2,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#FF6A00",
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 4,
    borderWidth: 1.5,
    borderColor: HEADER_GRADIENT[0],
  },
  bellBadgeText: { fontSize: 10, fontWeight: "800", color: "#FFFFFF" },
  searchFloat: {
    position: "absolute",
    left: H_PAD,
    right: H_PAD,
    zIndex: 10,
  },
  searchBar: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 16,
    height: 54,
    gap: 10,
    ...SOFT_SHADOW,
    ...Platform.select({
      ios: {
        shadowOpacity: 0.12,
        shadowRadius: 16,
      },
      android: { elevation: 6 },
    }),
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.black,
    paddingVertical: 0,
  },
  voiceBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(12, 108, 117, 0.12)",
  },
  searchClearBtn: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: "#F0F1F3",
    alignItems: "center",
    justifyContent: "center",
  },
  scrollView: {
    flex: 1,
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingHorizontal: H_PAD,
    paddingTop: 22,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.06,
        shadowRadius: 12,
      },
      android: { elevation: 2 },
    }),
  },
  block: {
    marginBottom: 22,
  },
  welcomeBlock: {
    marginTop: 4,
    marginBottom: 16,
  },
  welcomeGreeting: {
    fontSize: 15,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 6,
    letterSpacing: -0.1,
  },
  welcomeHeadline: {
    fontSize: 10,
    fontWeight: "800",
    color: "#111827",
    lineHeight: 14,
    letterSpacing: -0.2,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    marginBottom: 14,
    letterSpacing: -0.35,
  },
  sectionHeaderRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitleInline: {
    fontSize: 17,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.35,
  },
  seeAllLink: {
    fontSize: 13,
    fontWeight: "700",
    color: HEADER_TEAL,
  },
  servicesRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: CATEGORY_GAP,
    paddingRight: 4,
  },
  popularBlock: {
    marginBottom: 24,
    marginTop: 4,
  },
  popularListPad: {
    paddingLeft: H_PAD,
    paddingRight: H_PAD,
    paddingBottom: 2,
  },
  recentList: {
    gap: 0,
  },
  emptySearch: {
    alignItems: "center",
    paddingVertical: 48,
    gap: SPACING.sm,
  },
  emptySearchTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.black,
  },
  emptySearchSub: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
  },
});
