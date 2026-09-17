import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import { Image as ExpoImage } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Image,
  ImageBackground,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleProp,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  useWindowDimensions,
  View,
  ViewStyle
} from "react-native";
import Animated, {
  Extrapolation,
  FadeInDown,
  interpolate,
  runOnJS,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
  type SharedValue,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PopularServicesSection,
} from "../../components/home/PopularServiceCard";
import { COLORS, RADIUS, SPACING } from "../../constants/theme";
import ErrorState from "../../src/components/common/ErrorState";
import HomeSkeleton from "../../src/components/skeletons/HomeSkeleton";
import SkeletonBox from "../../src/components/skeletons/SkeletonBox";
import { useAutoHideOpacity } from "../../src/hooks/useAutoHideOpacity";
import { useHomeExitBackHandler } from "../../src/hooks/useHomeExitBackHandler";
import { usePullToRefresh } from "../../src/hooks/usePullToRefresh";
import { useAppLanguage } from "../../src/i18n/useAppLanguage";
import {
  fetchActiveCustomerOrders,
  fetchCompletedCustomerOrders,
} from "../../src/services/customerOrderService";
import {
  getCurrentGpsCoords,
  reverseGeocodeCoords,
} from "../../src/services/locationService";
import { fetchLookbook, type LookbookItem } from "../../src/services/lookbookService";
import { useAddressStore } from "../../src/store/useAddressStore";
import { useCartStore } from "../../src/store/useCartStore";
import { useHomeStore } from "../../src/store/useHomeStore";
import { useNotificationStore } from "../../src/store/useNotificationStore";
import { ORDER_DISPLAY_FALLBACK } from "../../src/types/api";
import type { CustomerOrderListItem } from "../../src/types/customerOrders";
import type { ApiBanner, ApiServiceCategory, PopularServiceRow } from "../../src/types/homeApi";
import {
  formatHomeHeaderLocation,
  getDefaultAddress,
} from "../../src/utils/addressDisplay";
import { fetchCatalogTree } from "../../src/services/catalogService";
import { resolveCatalogCategoryId } from "../../src/utils/catalogCategoryMap";
import {
  formatCustomerOrderStatusLabel,
  isCompletedCustomerOrderStatus,
} from "../../src/utils/customerOrderStatus";
import { navigateToServiceDetails } from "../../src/utils/navigateToServiceDetails";
import { normalizeProfileImageUrl } from "../../src/utils/profileImage";
import { useAuthStore } from "../../store/useAuthStore";

const H_PAD = 20;
const SHEET_RADIUS = 32;
const BANNER_SIDE_INSET = 4;
const BANNER_GAP = 12;
const BANNER_RADIUS = 24;
const HEADER_TEAL = "#149694";
const HEADER_GRADIENT: [string, string] = [HEADER_TEAL, "#0c6c75"];
const SEARCH_OVERLAP = 4;
// Category avatar size (circle + image). Uniform across all categories.
const CATEGORY_SIZE = 72;
const CATEGORY_GAP = 6;
const CATEGORY_BORDER_WIDTH = 1.5;
const CATEGORY_BORDER_COLOR = "rgba(20, 150, 148, 0.35)";

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
  return { bg: "#F3F4F6", text: "#6B7280", label: formatted || "-" };
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
function BannerCarousel({
  banners,
  onPress,
  style,
}: {
  banners: ApiBanner[];
  onPress: (banner: ApiBanner) => void;
  style?: StyleProp<ViewStyle>;
}) {
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
    <Animated.View entering={FadeInDown.delay(100).duration(400)} style={[carousel.wrap, style]}>
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
                <TouchableOpacity style={carousel.cta} activeOpacity={0.88} onPress={() => onPress(item)}>
                  {/* <Text style={styles.ctaBtnText}>Explore</Text> */}
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
  imageBg: { minHeight: 128, justifyContent: "flex-end" },
  imageRadius: { borderRadius: BANNER_RADIUS },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(8, 50, 55, 0.55)",
    borderRadius: BANNER_RADIUS,
  },
  content: { padding: SPACING.md, zIndex: 1 },
  title: {
    fontSize: 17,
    fontWeight: "800",
    color: "#FFFFFF",
    lineHeight: 21,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 12,
    color: "rgba(255,255,255,0.88)",
    lineHeight: 16,
    marginBottom: SPACING.sm,
  },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.full,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  ctaText: { fontSize: 12, fontWeight: "700", color: HEADER_TEAL },
  dots: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginTop: 8,
    gap: 5,
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
// Category icons - horizontal row
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

const ServiceCategoryItem = React.memo(function ServiceCategoryItem({
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
            // Uniform chip treatment for BOTH image and icon categories - a
            // consistent tinted background + border so image-backed circles and
            // icon-only ones read as the same size/shape, instead of image ones
            // filling edge-to-edge while icon ones show a small centered glyph.
            { backgroundColor: imageUrl ? "#F1F5F5" : style.bg, borderWidth: CATEGORY_BORDER_WIDTH, borderColor: CATEGORY_BORDER_COLOR },
          ]}
        >
          {imageUrl ? (
            <ExpoImage
              source={{ uri: imageUrl }}
              style={categoryItem.circleImage}
              contentFit="cover"
              transition={200}
              cachePolicy="memory-disk"
            />
          ) : (
            <Ionicons name={iconName} size={34} color={style.color} />
          )}
        </View>
      </View>
      <Text style={categoryItem.label} numberOfLines={2}>
        {category.Name}
      </Text>
    </TouchableOpacity>
  );
});

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
// "Our Services" carousel - snap scrolling, prev/next arrows, and a subtle
// center-scale on the focused card.
// ---------------------------------------------------------------------------
const AnimatedFlatList = Animated.createAnimatedComponent(FlatList<ApiServiceCategory>);

function ServicesCarousel({
  categories,
  itemWidth,
  itemGap,
  onPress,
}: {
  categories: ApiServiceCategory[];
  itemWidth: number;
  itemGap: number;
  onPress: (cat: ApiServiceCategory) => void;
}) {
  const listRef = useRef<FlatList<ApiServiceCategory>>(null);
  const scrollX = useSharedValue(0);
  const stride = itemWidth + itemGap;
  const maxOffset = Math.max(0, stride * categories.length - stride);

  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(categories.length > 1);

  // Arrows fade out after a moment of scroll inactivity and fade back in
  // the instant the user touches/scrolls the carousel again.
  const { opacity: arrowOpacity, notifyActivity } = useAutoHideOpacity();
  const arrowFadeStyle = useAnimatedStyle(() => ({ opacity: arrowOpacity.value }));

  const updateArrowState = useCallback(
    (offsetX: number) => {
      setCanScrollPrev(offsetX > stride * 0.3);
      setCanScrollNext(offsetX < maxOffset - stride * 0.3);
    },
    [stride, maxOffset],
  );

  const onScroll = useAnimatedScrollHandler({
    onScroll: (e) => {
      scrollX.value = e.contentOffset.x;
      runOnJS(updateArrowState)(e.contentOffset.x);
      runOnJS(notifyActivity)();
    },
  });

  const scrollByCard = useCallback(
    (direction: 1 | -1) => {
      notifyActivity();
      const current = scrollX.value;
      const target = Math.min(Math.max(current + direction * stride, 0), maxOffset);
      listRef.current?.scrollToOffset({ offset: target, animated: true });
    },
    [scrollX, stride, maxOffset, notifyActivity],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: ApiServiceCategory; index: number }) => (
      <CarouselCategoryItem
        category={item}
        itemWidth={itemWidth}
        index={index}
        stride={stride}
        scrollX={scrollX}
        onPress={onPress}
      />
    ),
    [itemWidth, stride, scrollX, onPress],
  );

  if (categories.length === 0) return null;

  return (
    <View style={carouselStyles.wrap}>
      <AnimatedFlatList
        ref={listRef}
        data={categories}
        horizontal
        nestedScrollEnabled
        showsHorizontalScrollIndicator={false}
        snapToInterval={stride}
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={{ gap: itemGap, paddingHorizontal: 2 }}
        keyExtractor={(cat, i) => `carousel-${cat.Id ?? cat.Name}-${i}`}
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onTouchStart={notifyActivity}
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
      />

      {/* Edge fade - hints there's more content without a hard cut. */}
      <LinearGradient
        colors={["#F7F3EE", "rgba(247,243,238,0)"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[carouselStyles.edgeFade, carouselStyles.edgeFadeLeft]}
        pointerEvents="none"
      />
      <LinearGradient
        colors={["rgba(247,243,238,0)", "#F7F3EE"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={[carouselStyles.edgeFade, carouselStyles.edgeFadeRight]}
        pointerEvents="none"
      />

      {categories.length > 1 ? (
        <>
          {canScrollPrev ? (
            <Animated.View style={[carouselStyles.arrow, carouselStyles.arrowLeft, arrowFadeStyle]}>
              <TouchableOpacity
                style={carouselStyles.arrowHit}
                onPress={() => scrollByCard(-1)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Previous services"
              >
                <Ionicons name="chevron-back" size={18} color={HEADER_TEAL} />
              </TouchableOpacity>
            </Animated.View>
          ) : null}
          {canScrollNext ? (
            <Animated.View style={[carouselStyles.arrow, carouselStyles.arrowRight, arrowFadeStyle]}>
              <TouchableOpacity
                style={carouselStyles.arrowHit}
                onPress={() => scrollByCard(1)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Next services"
              >
                <Ionicons name="chevron-forward" size={18} color={HEADER_TEAL} />
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </>
      ) : null}
    </View>
  );
}

/** Individual carousel item - adds a subtle scale-up while centered in the viewport. */
const CarouselCategoryItem = React.memo(function CarouselCategoryItem({
  category,
  itemWidth,
  index,
  stride,
  scrollX,
  onPress,
}: {
  category: ApiServiceCategory;
  itemWidth: number;
  index: number;
  stride: number;
  scrollX: SharedValue<number>;
  onPress: (cat: ApiServiceCategory) => void;
}) {
  const itemStyle = useAnimatedStyle(() => {
    const itemCenter = index * stride;
    const scale = interpolate(
      scrollX.value,
      [itemCenter - stride, itemCenter, itemCenter + stride],
      [0.94, 1, 0.94],
      Extrapolation.CLAMP,
    );
    return { transform: [{ scale }] };
  });

  return (
    <Animated.View style={itemStyle}>
      <ServiceCategoryItem category={category} itemWidth={itemWidth} onPress={onPress} />
    </Animated.View>
  );
});

const carouselStyles = StyleSheet.create({
  wrap: {
    position: "relative",
  },
  edgeFade: {
    position: "absolute",
    top: 0,
    bottom: 24, // clears the label row so text under the fade stays legible
    width: 20,
  },
  edgeFadeLeft: { left: 0 },
  edgeFadeRight: { right: 0 },
  arrow: {
    position: "absolute",
    top: CATEGORY_SIZE / 2 - 16,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.12, shadowRadius: 6 },
      android: { elevation: 4 },
    }),
  },
  arrowLeft: { left: -4 },
  arrowRight: { right: -4 },
  arrowHit: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
});

// ---------------------------------------------------------------------------
// Search result card - compact grid tile matching the same TypeCard style
// already used inside a category's own garment grid (sub-services.tsx), so
// search results look like a natural extension of browsing rather than a
// separate, heavier UI. Small photo, small text, price + a one-line "Book"
// pill - never the large carousel-style Popular Services card.
// ---------------------------------------------------------------------------
function SearchResultCard({
  row,
  onPress,
}: {
  row: PopularServiceRow;
  onPress: (row: PopularServiceRow) => void;
}) {
  const style = getCategoryStyle(row.category.Name);
  const imageUri = resolveServiceImageUrl(row.sub.ImageUrl);
  return (
    <TouchableOpacity
      style={searchCard.card}
      onPress={() => onPress(row)}
      activeOpacity={0.78}
    >
      {imageUri ? (
        <Image source={{ uri: imageUri }} style={searchCard.image} resizeMode="cover" />
      ) : (
        <View style={[searchCard.iconBox, { backgroundColor: style.bg }]}>
          <Ionicons name={style.icon as keyof typeof Ionicons.glyphMap} size={26} color={style.color} />
        </View>
      )}
      <Text style={searchCard.name} numberOfLines={2}>{row.sub.Name}</Text>
      <Text style={searchCard.category} numberOfLines={1}>{row.category.Name}</Text>
      <View style={searchCard.footer}>
        <Text style={searchCard.price}>from ₹{row.sub.BasePrice.toLocaleString("en-IN")}</Text>
        <View style={searchCard.pill}>
          <Text style={searchCard.pillText}>Book →</Text>
        </View>
      </View>
    </TouchableOpacity>
  );
}

function resolveServiceImageUrl(url: string | null | undefined): string | null {
  const resolved = normalizeProfileImageUrl(url);
  if (!resolved || resolved.includes("example.com")) return null;
  return resolved;
}

const searchCard = StyleSheet.create({
  card: {
    width: "100%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: 14,
    alignItems: "flex-start",
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.07, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  iconBox: {
    width: "100%",
    height: 90,
    borderRadius: RADIUS.md,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 2,
  },
  image: { width: "100%", height: 90, borderRadius: RADIUS.md, marginBottom: 2 },
  name: { fontSize: 13, fontWeight: "700", color: COLORS.black, lineHeight: 18 },
  category: { fontSize: 11, color: COLORS.gray, lineHeight: 15 },
  footer: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", width: "100%", marginTop: 4 },
  price: { fontSize: 12, fontWeight: "800", color: COLORS.primaryDark },
  pill: { paddingHorizontal: 6, paddingVertical: 3, borderRadius: RADIUS.full, backgroundColor: `${COLORS.primaryDark}18` },
  pillText: { fontSize: 10, fontWeight: "700", color: COLORS.primaryDark },
});

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
  const serviceName =
    order.serviceTitle && order.serviceTitle !== ORDER_DISPLAY_FALLBACK
      ? order.serviceTitle
      : order.serviceSubtitle && order.serviceSubtitle !== ORDER_DISPLAY_FALLBACK
        ? order.serviceSubtitle
        : "Tailoring Service";
  const orderIdLabel =
    order.bookingId && order.bookingId !== ORDER_DISPLAY_FALLBACK
      ? order.bookingId
      : order.id > 0
        ? `#${order.id}`
        : null;
  const dateLabel = (() => {
    if (!order.scheduledLabel || order.scheduledLabel === ORDER_DISPLAY_FALLBACK) return null;
    const parsed = new Date(order.scheduledLabel);
    if (Number.isNaN(parsed.getTime())) return null;
    const short = parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
    const prefix = isCompletedCustomerOrderStatus(order.status) ? "Delivered" : "Expected";
    return `${prefix} ${short}`;
  })();
  const amountLabel =
    order.amountPaidDisplay && order.amountPaidDisplay !== ORDER_DISPLAY_FALLBACK
      ? order.amountPaidDisplay
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
          {/* Status badge removed (Bug Report cycle 1, item 5.1). */}
        </View>

        {orderIdLabel ? (
          <Text style={recent.meta} numberOfLines={1}>
            Order ID: {orderIdLabel}
          </Text>
        ) : null}
        {dateLabel ? (
          <Text style={recent.meta} numberOfLines={1}>
            {dateLabel}
          </Text>
        ) : null}

        {amountLabel ? <Text style={recent.amount}>{amountLabel}</Text> : null}
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

// ---------------------------------------------------------------------------
// Popular services placeholder - shown while enrichment (bookable-service-id
// resolution against the catalog tree) is still in flight, so the section
// doesn't just pop in empty and then abruptly fill after the rest of the
// homepage has already rendered.
// ---------------------------------------------------------------------------
function PopularSectionSkeleton() {
  return (
    <View style={popularSkeletonStyles.row}>
      {[0, 1].map((i) => (
        <View key={i} style={popularSkeletonStyles.card}>
          <SkeletonBox width="100%" height={110} borderRadius={RADIUS.md} />
          <SkeletonBox width="80%" height={13} style={{ marginTop: 10 }} />
          <SkeletonBox width="50%" height={11} style={{ marginTop: 6 }} />
        </View>
      ))}
    </View>
  );
}

const popularSkeletonStyles = StyleSheet.create({
  row: { flexDirection: "row", gap: SPACING.md },
  card: { flex: 1, backgroundColor: COLORS.white, borderRadius: RADIUS.lg, padding: SPACING.sm },
});

// ---------------------------------------------------------------------------
// Voice-search button removed (Bug Report cycle 1, item 14.1).
// ---------------------------------------------------------------------------
// Typing-effect greeting - types the greeting once on mount, then stops
// (no blinking cursor). Falls back to showing the full text immediately
// when the OS's reduce-motion setting is on.
// ---------------------------------------------------------------------------
function TypingGreeting({ text, style }: { text: string; style: object }) {
  const reduceMotion = useReducedMotion();
  const [visibleChars, setVisibleChars] = useState(reduceMotion ? text.length : 0);
  const hasPlayedRef = useRef(false);

  useEffect(() => {
    if (reduceMotion || hasPlayedRef.current) {
      setVisibleChars(text.length);
      return;
    }
    hasPlayedRef.current = true;
    setVisibleChars(0);

    let i = 0;
    const stepMs = 32; // ~subtle, finishes a short greeting in well under a second
    const timer = setInterval(() => {
      i += 1;
      setVisibleChars(i);
      if (i >= text.length) clearInterval(timer);
    }, stepMs);

    return () => clearInterval(timer);
    // Only re-run if the greeting text itself changes (e.g. user loads after
    // mount) - hasPlayedRef still guards against re-triggering on re-renders.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, reduceMotion]);

  return <Text style={style}>{text.slice(0, visibleChars)}</Text>;
}

// ---------------------------------------------------------------------------
// Main Home Screen
// ---------------------------------------------------------------------------
export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { width: screenWidth } = useWindowDimensions();
  const router = useRouter();
  const navigation = useNavigation();
  const { t } = useAppLanguage();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const user = useAuthStore((s) => s.user);
  const authHydrated = useAuthStore((s) => s._hasHydrated);

  useHomeExitBackHandler();

  useEffect(() => {
    const unsub = navigation.addListener("tabPress" as any, () => {
      setSearchQuery("");
      setSearchExpanded(false);
    });
    return unsub;
  }, [navigation]);

  const cartItemCount = useCartStore((s) => s.itemCount);
  const { unreadCount: notifUnreadCount, fetchUnreadCount } = useNotificationStore();

  const {
    banners,
    serviceCategories,
    popularServices,
    specialOffers,
    featuredTailors,
    loading: homeLoading,
    popularLoading,
    error,
    loadHomeData,
    clearError,
  } = useHomeStore();

  const { addresses, fetchAddresses } = useAddressStore();
  const [searchQuery, setSearchQuery] = useState("");
  const [searchExpanded, setSearchExpanded] = useState(false);
  const searchInputRef = useRef<TextInput>(null);
  // Catalog tree resolves the real bookableServiceId for a searched
  // subcategory (home API subcategories carry ServiceLine.Id, not the
  // bookable ServiceSubCategory.Id - see enrichPopularServices.ts). Fetched
  // once and cached in-memory by fetchCatalogTree itself, so this just
  // needs a place to hold the resolved result for synchronous lookups
  // while typing.
  const [catalogTree, setCatalogTree] = useState<Awaited<ReturnType<typeof fetchCatalogTree>> | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetchCatalogTree()
      .then((tree) => {
        if (!cancelled) setCatalogTree(tree);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const handleToggleSearch = useCallback(() => {
    setSearchExpanded((prev) => {
      const next = !prev;
      if (next) {
        requestAnimationFrame(() => searchInputRef.current?.focus());
      } else {
        setSearchQuery("");
      }
      return next;
    });
  }, []);

  // Auto-close the search bar when leaving the home screen (Bug Report cycle 1,
  // item 15.1) - the cleanup runs on blur, so navigating away or opening another
  // screen always resets it instead of leaving it stuck open on return.
  const collapseSearch = useCallback(() => {
    setSearchExpanded(false);
    setSearchQuery("");
    searchInputRef.current?.blur();
  }, []);
  useFocusEffect(
    useCallback(() => {
      return () => collapseSearch();
    }, [collapseSearch]),
  );
  const [recentOrders, setRecentOrders] = useState<CustomerOrderListItem[]>([]);
  const [lookbookPreview, setLookbookPreview] = useState<LookbookItem[]>([]);
  const [detectedLocation, setDetectedLocation] = useState<string | null>(null);
  const recentOrdersLastFetched = useRef<number>(0);

  const loadRecentOrders = useCallback(async (force = false) => {
    if (!isAuthenticated) {
      setRecentOrders([]);
      recentOrdersLastFetched.current = 0;
      return;
    }
    // Skip re-fetch if data is less than 60 seconds old (tab switches)
    if (!force && Date.now() - recentOrdersLastFetched.current < 60_000) return;
    try {
      const [active, completed] = await Promise.all([
        fetchActiveCustomerOrders({ limit: 10 }),
        fetchCompletedCustomerOrders({ limit: 10 }),
      ]);
      const merged = new Map<number, CustomerOrderListItem>();
      for (const order of [...active.items, ...completed.items]) {
        if (order.id > 0) merged.set(order.id, order);
      }
      const sorted = Array.from(merged.values()).sort((a, b) => b.id - a.id);
      setRecentOrders(sorted.slice(0, 4));
      recentOrdersLastFetched.current = Date.now();
    } catch {
      // A transient failure (slow backend, momentary network drop) must
      // not wipe out orders already loaded from a prior successful fetch -
      // that would flip an authenticated returning customer back to the
      // "new user" sections. Leave recentOrders and the throttle timestamp
      // untouched so the very next focus/refresh retries instead of being
      // skipped by the 60s throttle above.
    }
  }, [isAuthenticated]);

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        void useCartStore
          .getState()
          .refreshCart({ silent: true, allowCreate: false })
          .catch(() => {});
      }
    }, [isAuthenticated]),
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
  }, [loadHomeData]);


  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) {
        fetchAddresses();
        loadRecentOrders();
        void fetchUnreadCount();
      } else {
        setRecentOrders([]);
      }
    }, [isAuthenticated, fetchAddresses, loadRecentOrders, fetchUnreadCount]),
  );

  useEffect(() => {
    fetchLookbook().then((items) => setLookbookPreview(items.slice(0, 5))).catch(() => {});
  }, []);

  const { refreshing, handleRefresh } = usePullToRefresh(
    useCallback(async () => {
      await loadHomeData(true);
      if (isAuthenticated) {
        await fetchAddresses();
        await loadRecentOrders(true);
      }
    }, [isAuthenticated, fetchAddresses, loadHomeData, loadRecentOrders]),
  );

  const defaultAddress = useMemo(
    () => getDefaultAddress(addresses),
    [addresses],
  );

  // Auto-detect the user's current area on first load when they have no
  // saved address yet, mirroring Zomato/Blinkit's "detecting location"
  // header behaviour. Silent best-effort: permission denial or GPS/geocode
  // failure just leaves the existing "Add delivery address" copy in place,
  // never blocks or shows an error for this passive header hint.
  useEffect(() => {
    if (!authHydrated || !isAuthenticated || defaultAddress || detectedLocation) return;
    let cancelled = false;
    (async () => {
      try {
        const coords = await getCurrentGpsCoords();
        const geo = await reverseGeocodeCoords(coords.latitude, coords.longitude);
        const label = [geo.line2 || geo.line1, geo.city].filter(Boolean).join(", ");
        if (!cancelled && label) setDetectedLocation(label);
      } catch {
        // Silent - passive header hint only, address.tsx owns the real
        // permission-prompt/error UX when the user explicitly sets a location.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authHydrated, isAuthenticated, defaultAddress, detectedLocation]);

  const locationLine = useMemo(() => {
    const formatted = formatHomeHeaderLocation(defaultAddress);
    if (formatted) return formatted;
    if (detectedLocation) return detectedLocation;
    return isAuthenticated ? "Add delivery address" : "Sign in for location";
  }, [defaultAddress, detectedLocation, isAuthenticated]);

  const notificationCount = Math.min(notifUnreadCount, 9);

  const welcomeGreeting = useMemo(() => {
    const first = user?.first_name?.trim();
    if (first) return `Hi, ${first}`;
    const full = (
      user?.name ?? `${user?.first_name ?? ""} ${user?.last_name ?? ""}`.trim()
    ).trim();
    if (full) {
      const short = full.split(/\s+/)[0];
      if (short) return `Hi, ${short}`;
    }
    return "Hi there";
  }, [user]);

  const popularList = popularServices;

  const avgTailorRating = useMemo(() => {
    if (!featuredTailors.length) return null;
    const total = featuredTailors.reduce((sum, t) => sum + (t.rating ?? 0), 0);
    return total / featuredTailors.length;
  }, [featuredTailors]);

  const q = searchQuery.toLowerCase().trim();

  // Search matches at garment level (e.g. "Lehenga", "Blouse") - the same
  // level a customer thinks in and the same level every other browsing path
  // on this screen already uses (category tiles, Popular Services). It does
  // NOT drop down to individual Normal/Designer variants: those are a
  // quality choice made on the booking screen itself, not a distinct
  // garment, and surfacing both as separate search cards for the same item
  // (often literally named "Normal Stitching" / "Designer Stitching" - a
  // placeholder pair, not a real garment name) reads as duplicate junk
  // results. Cards use the service line's own photo (already set for nearly
  // every line in the catalog) rather than an individual variant's, which is
  // usually unset. Tapping a result reuses navigateToServiceDetails exactly
  // as Popular Services/category browsing do - same screen, same
  // quality-selection UI, same order/payment flow - never a shortcut into
  // checkout with a guessed variant.
  //
  // Sourced from catalogTree (GET /catalog/categories/tree): the /home API's
  // SubCategories already stops at this same tier, but catalogTree also
  // carries direct_services (garments with no service-line parent) and is
  // guaranteed fresh in the same request that resolves bookable ids.
  const searchResults: PopularServiceRow[] = useMemo(() => {
    if (q.length <= 1 || !catalogTree) return [];
    const rows: PopularServiceRow[] = [];

    for (const cat of catalogTree.categories) {
      const catMatches = cat.name.toLowerCase().includes(q);
      const catRow: ApiServiceCategory = {
        Id: cat.id,
        Name: cat.name,
        Description: cat.description,
        ImageUrl: cat.image_url,
        DisplayOrder: cat.display_order,
        SubCategories: [],
      };

      for (const line of cat.service_lines ?? []) {
        const activeVariants = (line.stitching_types ?? []).filter(
          (item) => item.is_active !== false,
        );
        if (activeVariants.length === 0) continue;
        if (!catMatches && !line.name.toLowerCase().includes(q)) continue;

        const cheapest = activeVariants.reduce((min, item) =>
          item.base_price < min.base_price ? item : min,
        );
        rows.push({
          sub: {
            Id: line.id,
            Name: line.name,
            Description: line.description ?? null,
            ImageUrl: line.image_url ?? cheapest.image_url ?? null,
            BasePrice: line.starting_price || cheapest.base_price,
            DisplayOrder: line.display_order,
          },
          category: catRow,
          bookableServiceId: cheapest.service_id,
        });
      }

      for (const item of cat.direct_services ?? []) {
        if (item.is_active === false) continue;
        if (!catMatches && !item.name.toLowerCase().includes(q)) continue;
        rows.push({
          sub: {
            Id: item.service_id,
            Name: item.name,
            Description: item.description ?? null,
            ImageUrl: item.image_url,
            BasePrice: item.base_price,
            DisplayOrder: item.display_order,
          },
          category: catRow,
          bookableServiceId: item.service_id,
        });
      }
    }

    return rows;
  }, [q, catalogTree]);

  const isSearching = q.length > 1;
  const noResults = isSearching && searchResults.length === 0;

  const sortedServiceCategories = useMemo(
    () =>
      [...serviceCategories].sort(
        (a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0),
      ),
    [serviceCategories],
  );

  // Responsive gutter/content-width: phones keep the fixed H_PAD gutter;
  // tablets/large screens get a wider gutter and the sheet content is
  // capped so text lines and cards don't stretch edge-to-edge.
  const isTablet = screenWidth >= 768;
  const isSmallPhone = screenWidth < 360;
  const horizontalPad = isTablet ? Math.max(H_PAD, screenWidth * 0.06) : H_PAD;
  const contentMaxWidth = isTablet ? 720 : screenWidth;

  // Responsive section-gap scale: extends the same screenWidth-derived
  // approach used for horizontalPad/contentMaxWidth above to vertical
  // rhythm, instead of hardcoding a pixel gap per section. Small phones get
  // a slightly tighter rhythm, tablets a slightly roomier one; both stay
  // proportional to the existing SPACING scale rather than inventing new
  // values. Tightened per feedback that the previous gap (SPACING.md+xs =
  // 20px) read as too much empty space between sections.
  const sectionGap = isTablet
    ? SPACING.md
    : isSmallPhone
      ? SPACING.sm
      : SPACING.sm + SPACING.xs;

  const categoryItemWidth = useMemo(() => {
    const count = Math.max(serviceCategories.length, 1);
    const width = Math.min(screenWidth, contentMaxWidth);
    const available = width - horizontalPad * 2;
    // A card only needs to hug its avatar circle - NOT stretch across the row.
    // Stretching left big empty gaps between the small centred circles. Pin the
    // card width tight to the circle (+ a few px so the 2-line label can wrap)
    // so the circles cluster together, and show ~4.2 per screen once there are
    // more than fit comfortably. The FlatList is horizontally scrollable, so a
    // narrow row simply doesn't fill the width - that's the intended look.
    const contentWidth = CATEGORY_SIZE + 8; // circle + minimal label gutter
    if (count <= 4) {
      return contentWidth;
    }
    return Math.max(contentWidth, Math.floor(available / 4.2));
  }, [screenWidth, contentMaxWidth, horizontalPad, serviceCategories.length]);

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
        pathname: "/order-details" as never,
        params: { orderId: String(orderId) },
      });
    },
    [router],
  );

  const handleSeeAllOrders = useCallback(() => {
    router.push("/(tabs)/orders");
  }, [router]);

  const handleBannerPress = useCallback(
    (banner: ApiBanner) => {
      // Try to match a category from RedirectUrl (e.g. "/sub-services?categoryId=2" or "category/2")
      if (banner.RedirectUrl) {
        const match = banner.RedirectUrl.match(/(\d+)/);
        if (match) {
          const categoryId = Number(match[1]);
          const cat = serviceCategories.find((c) => c.Id === categoryId);
          if (cat) {
            router.push({
              pathname: "/sub-services",
              params: { catalogCategoryId: String(cat.Id), categoryName: cat.Name },
            });
            return;
          }
        }
      }
      // Default: navigate to first service category
      if (serviceCategories.length > 0) {
        const first = [...serviceCategories].sort(
          (a, b) => (a.DisplayOrder ?? 0) - (b.DisplayOrder ?? 0),
        )[0];
        router.push({
          pathname: "/sub-services",
          params: { catalogCategoryId: String(first.Id), categoryName: first.Name },
        });
      }
    },
    [router, serviceCategories],
  );

  // Auth state is restored asynchronously from SecureStore on app start
  // (see useAuthStore's onRehydrateStorage). Until that resolves, isAuthenticated
  // is always false, which would otherwise flash the signed-out header/sections
  // for a returning user. Hold a blank teal header in place instead - same
  // shape as the real header, so nothing visibly jumps once content appears.
  if (!authHydrated) {
    return (
      <View style={styles.root}>
        <LinearGradient
          colors={HEADER_GRADIENT}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[
            styles.headerGradient,
            { paddingTop: insets.top + SPACING.sm, paddingHorizontal: horizontalPad },
          ]}
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      {/* Teal header */}
      <LinearGradient
        colors={HEADER_GRADIENT}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={[
          styles.headerGradient,
          { paddingTop: insets.top + SPACING.sm, paddingHorizontal: horizontalPad },
        ]}
      >
        <View
          style={[
            styles.headerRow,
            { maxWidth: contentMaxWidth, alignSelf: "center", width: "100%" },
            // Logged-out only: signInCard is taller than the search button
            // (icon + 2 lines of text + CTA vs a plain 40px icon), so
            // flex-start pinned the search icon awkwardly high against it -
            // center them instead. Logged-in's location block is roughly
            // icon-height, so it keeps the original top alignment.
            !isAuthenticated && { alignItems: "center" },
          ]}
        >
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
                <Text style={styles.signInTitle} numberOfLines={1}>Sign in for location</Text>
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
            <TouchableOpacity
              style={[styles.searchIconBtn, searchExpanded && styles.searchIconBtnActive]}
              activeOpacity={0.85}
              onPress={handleToggleSearch}
              accessibilityRole="button"
              accessibilityLabel={searchExpanded ? "Close search" : "Search"}
            >
              <Ionicons name={searchExpanded ? "close" : "search-outline"} size={20} color="#FFFFFF" />
            </TouchableOpacity>

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

            {isAuthenticated ? (
              <TouchableOpacity style={styles.bellBtn} activeOpacity={0.85} onPress={() => router.push("/notifications" as any)}>
                <Ionicons name="notifications-outline" size={22} color="#FFFFFF" />
                {notificationCount > 0 ? (
                  <View style={styles.bellBadge}>
                    <Text style={styles.bellBadgeText}>{notificationCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
            ) : null}
          </View>
        </View>

        {/* Expanding search dropdown - hidden until the header search icon is tapped */}
        {searchExpanded ? (
          <Animated.View
            entering={FadeInDown.duration(220)}
            style={styles.searchDropdown}
          >
            <View style={styles.searchBar}>
              <Ionicons name="search-outline" size={20} color={COLORS.gray} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder="Search services, categories..."
                placeholderTextColor="#9CA3AF"
                value={searchQuery}
                onChangeText={setSearchQuery}
                returnKeyType="search"
                autoFocus
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
              ) : null}
              {/* Voice-search mic icon removed (Bug Report cycle 1, item 14.1). */}
            </View>
          </Animated.View>
        ) : null}
      </LinearGradient>

      <Animated.ScrollView
        style={styles.scrollView}
        showsVerticalScrollIndicator={false}
        overScrollMode="never"
        contentContainerStyle={{ paddingTop: SEARCH_OVERLAP }}
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
            {
              paddingBottom: insets.bottom + SPACING.xl,
              paddingHorizontal: horizontalPad,
              maxWidth: contentMaxWidth,
              alignSelf: "center",
              width: "100%",
            },
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
          ) : homeLoading && serviceCategories.length === 0 && banners.length === 0 ? (
            <HomeSkeleton />
          ) : isSearching ? (
            <Animated.View entering={FadeInDown.duration(300)} style={[styles.block, { marginBottom: 18 }]}>
              {noResults ? (
                <View style={styles.emptySearch}>
                  <Ionicons name="search-outline" size={40} color={COLORS.grayBorder} />
                  <Text style={styles.emptySearchTitle}>No Results Found</Text>
                  <Text style={styles.emptySearchSub}>
                    No services match &quot;{searchQuery}&quot;
                  </Text>
                </View>
              ) : (
                <>
                  <Text style={styles.sectionTitle}>
                    Results ({searchResults.length})
                  </Text>
                  <View style={styles.searchGrid}>
                    {searchResults.map((row, i) => (
                      <Animated.View
                        key={`search-${row.category.Id}-${row.sub.Id}-${i}`}
                        entering={FadeInDown.delay(Math.min(i, 8) * 40).duration(300)}
                        style={{ width: "47.5%" }}
                      >
                        <SearchResultCard row={row} onPress={handlePopularPress} />
                      </Animated.View>
                    ))}
                  </View>
                </>
              )}
            </Animated.View>
          ) : (
            <>
              {/* 1. Greeting */}
              <Animated.View entering={FadeInDown.delay(0).duration(320)} style={styles.greetBlock}>
                <TypingGreeting text={welcomeGreeting} style={styles.greetHeadline} />
                <Text style={styles.greetTagline}>Your clothes. Our tailors. Your door.</Text>
              </Animated.View>

              {/* 2. Hero card */}
              <Animated.View entering={FadeInDown.delay(30).duration(360)}>
                <LinearGradient
                  colors={["#0a3d3d", "#0F766E"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.heroCard}
                >
                  <View style={styles.heroBadge}>
                    <Ionicons name="home-outline" size={10} color="rgba(255,255,255,0.9)" style={{ marginRight: 4 }} />
                    <Text style={styles.heroBadgeText}>Doorstep tailoring</Text>
                  </View>
                  <Text style={styles.heroHeadline}>
                    Expert stitching picked up from home and delivered back, perfectly fitted.
                  </Text>
                  <TouchableOpacity
                    style={styles.heroBtn}
                    activeOpacity={0.88}
                    onPress={() => router.push("/browse" as any)}
                  >
                    <Text style={styles.heroBtnText}>How it works </Text>
                    <Ionicons name="arrow-forward" size={15} color="#0F766E" />
                  </TouchableOpacity>
                </LinearGradient>
              </Animated.View>

              {/* Logged-in users: show product sections immediately after hero */}
              {isAuthenticated ? (
                <>
                  {sortedServiceCategories.length > 0 ? (
                    <Animated.View entering={FadeInDown.delay(60).duration(350)} style={[styles.block, { marginTop: sectionGap }]}>
                      <View style={styles.sectionHeaderRow}>
                        <View style={styles.sectionTitleGroup}>
                          <Ionicons name="cut-outline" size={16} color={HEADER_TEAL} />
                          <Text style={styles.sectionTitleInline}>{t("home.ourServices")}</Text>
                        </View>
                        <Text style={styles.sectionSubCaption}>{t("home.tapCategory")}</Text>
                      </View>
                      <ServicesCarousel
                        categories={sortedServiceCategories}
                        itemWidth={categoryItemWidth}
                        itemGap={CATEGORY_GAP}
                        onPress={handleCategoryPress}
                      />
                    </Animated.View>
                  ) : null}
                  {banners.length > 0 ? (
                    <BannerCarousel banners={banners} onPress={handleBannerPress} style={{ marginTop: sectionGap }} />
                  ) : null}
                  {popularList.length > 0 ? (
                    <Animated.View entering={FadeInDown.delay(100).duration(350)} style={[styles.popularBlock, { marginTop: sectionGap }]}>
                      <PopularServicesSection
                        services={popularList}
                        rating={avgTailorRating}
                        onPress={handlePopularPress}
                        onPrimaryAction={handlePopularPress}
                        layout="vertical"
                        maxItems={4}
                        onViewAll={() => router.push("/all-services" as any)}
                      />
                    </Animated.View>
                  ) : popularLoading ? (
                    <View style={[styles.popularBlock, { marginTop: sectionGap }]}>
                      <PopularSectionSkeleton />
                    </View>
                  ) : null}
                </>
              ) : null}

              {/* 4. Service categories - shown above for logged-in users */}
              {!isAuthenticated && sortedServiceCategories.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(80).duration(350)} style={[styles.block, { marginTop: sectionGap }]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleGroup}>
                      <Ionicons name="cut-outline" size={16} color={HEADER_TEAL} />
                      <Text style={styles.sectionTitleInline}>Our Services</Text>
                    </View>
                    <Text style={styles.sectionSubCaption }>Explore Services</Text>
                  </View>
                  <ServicesCarousel
                    categories={sortedServiceCategories}
                    itemWidth={categoryItemWidth}
                    itemGap={CATEGORY_GAP}
                    onPress={handleCategoryPress}
                  />
                </Animated.View>
              ) : null}

              {/* 7. Banner carousel - shown above for logged-in users */}
              {!isAuthenticated && banners.length > 0 ? (
                <BannerCarousel banners={banners} onPress={handleBannerPress} style={{ marginTop: sectionGap }} />
              ) : null}

              {/* 8. Popular services - shown above for logged-in users */}
              {!isAuthenticated && popularList.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(140).duration(350)} style={[styles.popularBlock, { marginTop: sectionGap }]}>
                  <PopularServicesSection
                    services={popularList}
                    rating={avgTailorRating}
                    onPress={handlePopularPress}
                    onPrimaryAction={handlePopularPress}
                    layout="vertical"
                    maxItems={4}
                    onViewAll={() => router.push("/all-services" as any)}
                  />
                </Animated.View>
              ) : !isAuthenticated && popularLoading ? (
                <View style={[styles.popularBlock, { marginTop: sectionGap }]}>
                  <PopularSectionSkeleton />
                </View>
              ) : null}

              {/* 12. Style Inspiration - all users */}
              {lookbookPreview.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(210).duration(350)} style={[styles.block, { marginTop: sectionGap }]}>
                  <View style={styles.sectionHeaderRow}>
                    <View style={styles.sectionTitleGroup}>
                      <Ionicons name="sparkles-outline" size={16} color={HEADER_TEAL} />
                      <Text style={styles.sectionTitleInline}>{t("home.styleInspiration")}</Text>
                    </View>
                    <TouchableOpacity
                      onPress={() => router.push("/lookbook" as any)}
                      activeOpacity={0.8}
                      hitSlop={8}
                    >
                      <Text style={styles.seeAllLink}>{t("common.seeAll")}</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.lookbookRow}
                    nestedScrollEnabled
                  >
                    {lookbookPreview.map((item, idx) => (
                      <TouchableOpacity
                        key={item.id}
                        style={styles.lookbookThumb}
                        onPress={() => router.push("/lookbook" as any)}
                        activeOpacity={0.88}
                      >
                        <Image
                          source={{ uri: item.image_url }}
                          style={StyleSheet.absoluteFill}
                          resizeMode="cover"
                        />
                        <LinearGradient
                          colors={["transparent", "rgba(0,0,0,0.55)"]}
                          style={styles.lookbookOverlay}
                        >
                          {item.title ? (
                            <Text style={styles.lookbookLabel} numberOfLines={1}>
                              {item.title}
                            </Text>
                          ) : null}
                        </LinearGradient>
                      </TouchableOpacity>
                    ))}
                    <TouchableOpacity
                      style={styles.lookbookSeeAll}
                      onPress={() => router.push("/lookbook" as any)}
                      activeOpacity={0.88}
                    >
                      <LinearGradient
                        colors={["#0c6c75", "#149694"]}
                        style={StyleSheet.absoluteFill}
                      />
                      <Ionicons name="grid-outline" size={22} color="#FFFFFF" />
                      <Text style={styles.lookbookSeeAllText}>See{"\n"}All</Text>
                    </TouchableOpacity>
                  </ScrollView>
                </Animated.View>
              ) : null}

              {/* 13. Recent orders - returning users */}
              {recentOrders.length > 0 ? (
                <Animated.View entering={FadeInDown.delay(160).duration(350)} style={[styles.block, { marginTop: sectionGap }]}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={styles.sectionTitleInline}>{t("home.recentOrders")}</Text>
                    <TouchableOpacity onPress={handleSeeAllOrders} activeOpacity={0.8} hitSlop={8}>
                      <Text style={styles.seeAllLink}>{t("common.seeAll")}</Text>
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

              {/* 14. Support - always last on the page */}
              <Animated.View entering={FadeInDown.delay(230).duration(350)} style={[styles.supportCard, { marginTop: sectionGap }]}>
                <View style={styles.supportLeft}>
                  <Text style={styles.supportTitle}>{t("home.needHelp")}</Text>
                  <Text style={styles.supportSub}>{t("home.hereForYou")}</Text>
                </View>
                <View style={styles.supportBtns}>
                  <TouchableOpacity
                    style={styles.supportBtn}
                    activeOpacity={0.8}
                    onPress={() => router.push("/support-chat" as any)}
                  >
                    <View style={[styles.supportBtnCircle, { backgroundColor: "#E8FFF0" }]}>
                      <Ionicons name="chatbubble-ellipses-outline" size={18} color="#25D366" />
                    </View>
                    <Text style={styles.supportBtnLabel}>Chat</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.supportBtn}
                    activeOpacity={0.8}
                    onPress={() => router.push("/support" as any)}
                  >
                    <View style={[styles.supportBtnCircle, { backgroundColor: "#E6F7F7" }]}>
                      <Ionicons name="call-outline" size={18} color={HEADER_TEAL} />
                    </View>
                    <Text style={styles.supportBtnLabel}>Call</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>
            </>
          )}
        </View>
      </Animated.ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  // Cream, not teal - the sheet's rounded top corners leave a sliver of
  // root's own background visible just outside the curve on both sides;
  // matching it to the sheet color (not the header's teal) makes that
  // sliver blend invisibly instead of showing as a mismatched teal edge.
  root: { flex: 1, backgroundColor: "#F7F3EE" },
  headerGradient: { paddingBottom: SPACING.md },
  headerRow: { flexDirection: "row", alignItems: "flex-start", justifyContent: "space-between", gap: SPACING.md },
  locationBlock: { flex: 1, flexDirection: "row", alignItems: "flex-start", gap: 8 },
  signInCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 12, backgroundColor: "rgba(255,255,255,0.96)", borderRadius: 18, paddingVertical: 12, paddingHorizontal: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.65)", ...SOFT_SHADOW },
  signInCardPressed: { opacity: 0.92, transform: [{ scale: 0.985 }] },
  signInIconWrap: { width: 42, height: 42, borderRadius: 14, backgroundColor: "#E6F7F7", alignItems: "center", justifyContent: "center" },
  signInTextWrap: { flex: 1, minWidth: 0 },
  signInTitle: { fontSize: 15, fontWeight: "800", color: HEADER_TEAL, marginBottom: 2, letterSpacing: -0.2 },
  signInSubtitle: { fontSize: 12, fontWeight: "500", color: "#6B7280" },
  signInCta: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: "#E6F7F7", paddingHorizontal: 12, paddingVertical: 7, borderRadius: RADIUS.full, flexShrink: 0 },
  signInCtaText: { fontSize: 13, fontWeight: "700", color: HEADER_TEAL },
  locationTextWrap: {},
  locationLabel: { fontSize: 11, fontWeight: "500", color: "rgba(255,255,255,0.75)", marginBottom: 2 },
  locationValue: { fontSize: 14, fontWeight: "700", color: "#FFFFFF", lineHeight: 18, letterSpacing: -0.2 },
  headerActions: { flexDirection: "row", alignItems: "center", gap: 8 },
  cartBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  cartBadge: { position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#FF4757", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: HEADER_TEAL },
  cartBadgeText: { fontSize: 9, fontWeight: "800", color: "#FFFFFF", lineHeight: 11 },
  bellBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  bellBadge: { position: "absolute", top: -3, right: -3, minWidth: 16, height: 16, borderRadius: 8, backgroundColor: "#FF4757", alignItems: "center", justifyContent: "center", paddingHorizontal: 3, borderWidth: 1.5, borderColor: HEADER_TEAL },
  bellBadgeText: { fontSize: 9, fontWeight: "800", color: "#FFFFFF", lineHeight: 11 },
  searchIconBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "rgba(255,255,255,0.18)", alignItems: "center", justifyContent: "center" },
  searchIconBtnActive: { backgroundColor: "rgba(255,255,255,0.32)" },
  searchDropdown: { paddingTop: SPACING.md },
  searchBar: { flexDirection: "row", alignItems: "center", backgroundColor: COLORS.white, borderRadius: RADIUS.full, paddingHorizontal: 16, height: 50, gap: 10, ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.10, shadowRadius: 16 }, android: { elevation: 8 } }) },
  searchInput: { flex: 1, fontSize: 15, color: COLORS.black, paddingVertical: 0 },
  voiceBtn: { width: 34, height: 34, borderRadius: 17, backgroundColor: "#F0FDFC", alignItems: "center", justifyContent: "center", borderWidth: 1, borderColor: "#C7F0EE" },
  searchClearBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  scrollView: { flex: 1 },
  sheet: { backgroundColor: "#F7F3EE", borderTopLeftRadius: SHEET_RADIUS, borderTopRightRadius: SHEET_RADIUS, paddingHorizontal: H_PAD, paddingTop: 16, ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.06, shadowRadius: 12 }, android: { elevation: 8 } }) },
  // No margin here on purpose - every section controls its own spacing via
  // the inline `sectionGap` margin at its call site. A baked-in marginBottom
  // here previously stacked with that inline margin, doubling the visible
  // gap between sections wherever both were applied together.
  block: {},

  // ── Search results ────────────────────────────────────────────────────────
  sectionTitle: { fontSize: 16, fontWeight: "800", color: "#111827", marginBottom: 14, letterSpacing: -0.3 },
  emptySearch: { alignItems: "center", paddingVertical: 40, gap: 10 },
  emptySearchTitle: { fontSize: 17, fontWeight: "700", color: "#111827" },
  emptySearchSub: { fontSize: 14, color: "#6B7280", textAlign: "center" },
  searchGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },

  // ── Greeting ──────────────────────────────────────────────────────────────
  greetBlock: { marginBottom: SPACING.sm },
  greetHeadline: { fontSize: 17, fontWeight: "800", color: "#0D1410", lineHeight: 21, letterSpacing: -0.3 },
  greetTagline: { fontSize: 12, fontWeight: "500", color: "#6B7280", marginTop: 2, lineHeight: 16, letterSpacing: 0.1 },

  // ── Hero card ─────────────────────────────────────────────────────────────
  heroCard: { borderRadius: 20, padding: SPACING.md, overflow: "hidden" },
  heroBadge: { flexDirection: "row", alignItems: "center", alignSelf: "flex-start", backgroundColor: "rgba(255,255,255,0.18)", borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.3)", marginBottom: 10 },
  heroBadgeText: { fontSize: 9, fontWeight: "700", color: "rgba(255,255,255,0.9)", letterSpacing: 1.2, textTransform: "uppercase" },
  heroHeadline: { fontSize: 18, fontWeight: "800", color: "#FFFFFF", lineHeight: 23, letterSpacing: -0.3, marginBottom: 14 },
  heroBtn: { alignSelf: "flex-start", backgroundColor: "#FFFFFF", borderRadius: RADIUS.full, paddingHorizontal: 16, paddingVertical: 9, flexDirection: "row", alignItems: "center", gap: 5 },
  heroBtnText: { fontSize: 13, fontWeight: "700", color: "#0F766E" },

  // ── Trust strip ───────────────────────────────────────────────────────────
  trustCard: { backgroundColor: "#FFFFFF", borderRadius: 18, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 10 }, android: { elevation: 3 } }) },
  trustRow: { flexDirection: "row", alignItems: "flex-start", gap: 12, paddingHorizontal: 14, paddingVertical: 12 },
  trustDivider: { height: 1, backgroundColor: "#F3F4F6", marginHorizontal: 14 },
  trustIconWrap: { width: 30, height: 30, borderRadius: 9, backgroundColor: "#E6F7F7", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1 },
  trustTitle: { fontSize: 13, fontWeight: "700", color: "#111827", marginBottom: 1 },
  trustSub: { fontSize: 11.5, color: "#6B7280", lineHeight: 15 },

  // ── Section headers ───────────────────────────────────────────────────────
  sectionHeaderRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  sectionTitleGroup: { flexDirection: "row", alignItems: "center", gap: 5 },
  sectionTitleInline: { fontSize: 15, fontWeight: "800", color: "#111827", letterSpacing: -0.3 },
  sectionSubCaption: { fontSize: 11, color: "#9CA3AF", fontWeight: "500" },
  seeAllLink: { fontSize: 12, fontWeight: "600", color: HEADER_TEAL },

  // ── About card ────────────────────────────────────────────────────────────
  aboutCard: { backgroundColor: "#F0FDFB", borderRadius: 20, padding: 14, borderWidth: 1, borderColor: "#C7F0EE", borderTopWidth: 3, borderTopColor: "#0F766E" },
  aboutTitleRow: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  aboutTitleAccent: { width: 3, height: 16, borderRadius: 2, backgroundColor: "#0F766E" },
  aboutTitle: { fontSize: 11, fontWeight: "700", color: "#0F766E", letterSpacing: 1.2, textTransform: "uppercase" },
  aboutHeadline: { fontSize: 20, fontWeight: "800", color: "#0D1410", lineHeight: 25, letterSpacing: -0.5, marginBottom: 8 },
  aboutDesc: { fontSize: 13, color: "#374151", lineHeight: 19, marginBottom: 12 },
  aboutPropsCol: { gap: 8, marginBottom: 12 },
  aboutProp: { flexDirection: "row", alignItems: "flex-start", gap: 10 },
  aboutPropIcon: { width: 24, height: 24, borderRadius: 7, backgroundColor: "#D1FAF7", alignItems: "center", justifyContent: "center", marginTop: 1, flexShrink: 0 },
  aboutPropText: { flex: 1, fontSize: 13, color: "#1F2937", lineHeight: 19, fontWeight: "500" },
  aboutDivider: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10 },
  aboutDividerLine: { flex: 1, height: 1, backgroundColor: "#C7F0EE" },
  aboutDividerLabel: { fontSize: 10, fontWeight: "700", color: "#0F766E", letterSpacing: 0.8, textTransform: "uppercase" },

  // ── Order journey ─────────────────────────────────────────────────────────
  journeyRow: { flexDirection: "row", alignItems: "flex-start" },
  journeyStep: { flex: 1, alignItems: "center", gap: 4 },
  journeyNode: { width: 34, height: 34, borderRadius: 17, backgroundColor: HEADER_TEAL, alignItems: "center", justifyContent: "center" },
  journeyNodeNum: { position: "absolute", top: -4, right: -4, width: 14, height: 14, borderRadius: 7, backgroundColor: "#FFFFFF", borderWidth: 1.5, borderColor: HEADER_TEAL, alignItems: "center", justifyContent: "center" },
  journeyNodeNumText: { fontSize: 7, fontWeight: "900", color: HEADER_TEAL, lineHeight: 9 },
  journeyConnector: { width: 16, height: 1.5, backgroundColor: "#9FEAE8", marginTop: 17 },
  journeyLabel: { fontSize: 9, fontWeight: "600", color: "#374151", textAlign: "center", lineHeight: 12 },

  // ── Launch banner ─────────────────────────────────────────────────────────
  launchBannerWrap: { borderRadius: 20, overflow: "hidden", ...Platform.select({ ios: { shadowColor: "#0a5c63", shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.18, shadowRadius: 14 }, android: { elevation: 6 } }) },
  launchBanner: { borderRadius: 20, paddingHorizontal: 20, paddingTop: 18, paddingBottom: 20 },
  launchTopRow: { flexDirection: "row", alignItems: "center", marginBottom: 10 },
  launchBadge: { backgroundColor: "rgba(255,255,255,0.22)", borderRadius: RADIUS.full, paddingHorizontal: 12, paddingVertical: 5, borderWidth: 1, borderColor: "rgba(255,255,255,0.35)" },
  launchBadgeText: { fontSize: 12, fontWeight: "700", color: "#FFFFFF" },
  launchTitle: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", lineHeight: 28, letterSpacing: -0.4, marginBottom: 6 },
  launchSub: { fontSize: 13, color: "rgba(255,255,255,0.85)", marginBottom: 16, lineHeight: 18 },
  launchFeatureRow: { flexDirection: "row", gap: 16, flexWrap: "wrap" },
  launchFeature: { flexDirection: "row", alignItems: "center", gap: 5 },
  launchFeatureText: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.9)" },

  // ── Popular block ─────────────────────────────────────────────────────────
  popularBlock: {},

  // ── Why BMD scenarios ─────────────────────────────────────────────────────
  whyBlock: {},
  whyScenarioCard: { backgroundColor: "#FFFFFF", borderRadius: 14, padding: 16, marginBottom: 10, borderLeftWidth: 3, borderLeftColor: "#B87333", borderWidth: 1, borderColor: "#F3F0EB", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 6 }, android: { elevation: 2 } }) },
  whyScenarioTitle: { fontSize: 14, fontWeight: "700", color: "#111827", lineHeight: 20, marginBottom: 4 },
  whyScenarioSub: { fontSize: 13, color: "#4B5563", lineHeight: 19 },

  // ── FAQs ──────────────────────────────────────────────────────────────────
  faqBlock: {},
  faqItem: { backgroundColor: "#FFFFFF", borderRadius: 14, marginBottom: 8, borderWidth: 1, borderColor: "#E5E7EB", overflow: "hidden", ...Platform.select({ ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.04, shadowRadius: 6 }, android: { elevation: 2 } }) },
  faqQuestion: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", padding: 16, gap: 12 },
  faqQuestionText: { flex: 1, fontSize: 14, fontWeight: "700", color: "#111827", lineHeight: 20 },
  faqAnswer: { fontSize: 13, color: "#4B5563", lineHeight: 20, paddingHorizontal: 16, paddingBottom: 16 },

  // ── Bottom CTA ────────────────────────────────────────────────────────────
  ctaCard: { borderRadius: 24, paddingHorizontal: 24, paddingVertical: 28 },
  ctaLabel: { fontSize: 10, fontWeight: "700", color: "#B87333", letterSpacing: 1.5, textTransform: "uppercase", marginBottom: 10 },
  ctaHeadline: { fontSize: 22, fontWeight: "800", color: "#FFFFFF", lineHeight: 28, letterSpacing: -0.4, marginBottom: 6 },
  ctaSub: { fontSize: 13, color: "rgba(255,255,255,0.75)", marginBottom: 20, lineHeight: 18 },
  ctaBtn: { height: 50, backgroundColor: "#FFFFFF", borderRadius: RADIUS.full, alignItems: "center", justifyContent: "center", marginBottom: 10 },
  ctaBtnText: { fontSize: 15, fontWeight: "700", color: "#0F766E" },
  ctaNote: { fontSize: 11, color: "rgba(255,255,255,0.5)", textAlign: "center" },

  // ── Support row ───────────────────────────────────────────────────────────
  lookbookRow: { paddingLeft: 2, paddingRight: 8, gap: 10 },
  lookbookThumb: {
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#E5E7EB",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  lookbookOverlay: {
    position: "absolute",
    left: 0, right: 0, bottom: 0,
    padding: 8,
    justifyContent: "flex-end",
    height: 60,
  },
  lookbookLabel: { fontSize: 11, fontWeight: "700", color: "#FFFFFF" },
  lookbookSeeAll: {
    width: 80,
    height: 160,
    borderRadius: 16,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    ...Platform.select({
      ios: { shadowColor: "#0c6c75", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.18, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  lookbookSeeAllText: { fontSize: 12, fontWeight: "800", color: "#FFFFFF", textAlign: "center", lineHeight: 16 },
  supportCard: { backgroundColor: "#FFFFFF", borderRadius: 16, padding: 16, flexDirection: "row", alignItems: "center", borderWidth: 1, borderColor: "#E5E7EB" },
  supportLeft: { flex: 1 },
  supportTitle: { fontSize: 14, fontWeight: "700", color: "#111827", marginBottom: 2 },
  supportSub: { fontSize: 12, color: "#9CA3AF" },
  supportBtns: { flexDirection: "row", gap: 12 },
  supportBtn: { alignItems: "center", gap: 4 },
  supportBtnCircle: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  supportBtnLabel: { fontSize: 10, fontWeight: "600", color: "#6B7280" },

  // ── Recent orders ─────────────────────────────────────────────────────────
  recentList: { gap: 0 },

  // ── Offer cards (keep for compat) ─────────────────────────────────────────
  offerBadge: { backgroundColor: "#FEF3C7", borderRadius: RADIUS.full, paddingHorizontal: 8, paddingVertical: 3 },
  offerBadgeText: { fontSize: 10, fontWeight: "700", color: "#92400E" },
  offerCard: { width: 200, borderRadius: 16, overflow: "hidden" },
  offerCardGradient: { padding: 16, minHeight: 120, justifyContent: "flex-end" },
  offerDiscountBadge: { position: "absolute", top: 12, right: 12, backgroundColor: "#FFFFFF", borderRadius: 8, paddingHorizontal: 6, paddingVertical: 2 },
  offerDiscountText: { fontSize: 11, fontWeight: "800", color: "#0F766E" },
  offerTitle: { fontSize: 15, fontWeight: "800", color: "#FFFFFF", marginBottom: 4 },
  offerDesc: { fontSize: 12, color: "rgba(255,255,255,0.85)", marginBottom: 4 },
  offerExpiry: { fontSize: 10, color: "rgba(255,255,255,0.7)", fontWeight: "500" },
  popularListPad: { paddingLeft: H_PAD, paddingRight: H_PAD, paddingBottom: 4 },
  welcomeBlock: {},
  welcomeGreetingRow: {},
  welcomeGreeting: {},
  welcomeHeadline: {},
  welcomeTagRow: {},
  welcomeTag: {},
  welcomeTagText: {},
  welcomeTagDot: {},
  welcomeSubline: {},
  welcomeBlock2: {},
});
