import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { COLORS } from "../../constants/theme";
import { useAutoHideOpacity } from "../../src/hooks/useAutoHideOpacity";
import { useAppLanguage } from "../../src/i18n/useAppLanguage";
import type { PopularServiceRow } from "../../src/types/homeApi";
import { normalizeProfileImageUrl } from "../../src/utils/profileImage";

// This carousel renders inside the homepage's already-padded `sheet`
// container (paddingHorizontal: horizontalPad, 20 on phones) - the sheet
// supplies the left/right gutter for every section already, so this
// component must not add its own copy of it (that previously stacked two
// gutters, pushing the whole carousel further right than every other
// section - title, banner carousel, category row - which all correctly
// treat the parent's padding as their only inset). H_PAD here is used purely
// as the known outer-gutter value for card-width math (mirrors how
// BannerCarousel derives bannerCardWidth), never as extra FlatList padding.
const H_PAD = 20;
const CARD_GAP = 12;
const CARD_RADIUS = 20;
const HERO_HEIGHT = 104;
const CARD_HEIGHT = 268;
/** Non-hero portion (title/desc/price/CTA) of the card - constant regardless
 * of hero height, so a taller vertical-layout hero doesn't also stretch the
 * text/button area unnecessarily. */
const VERTICAL_BODY_HEIGHT = CARD_HEIGHT - HERO_HEIGHT;
const ICON_SIZE = 52;

/** ~46% of the available (already-gutter-subtracted) width - two cards visible side by side */
export function getPopularCardWidth(screenWidth: number): number {
  return Math.floor((screenWidth - H_PAD * 2) * 0.46);
}


type CardTheme = {
  key: "teal" | "purple" | "rose" | "green" | "amber";
  heroGradient: [string, string, string];
  accent: string;
  buttonGradient: [string, string];
  iconGradient: [string, string];
  priceGradient: [string, string];
  ringGlow: string;
};

const THEMES: Record<string, CardTheme> = {
  teal: {
    key: "teal",
    heroGradient: ["#d4f5f3", "#e8faf9", "#f4fdfc"],
    accent: "#149694",
    buttonGradient: ["#0c6c75", "#1aa3b0"],
    iconGradient: ["#0c6c75", "#149694"],
    priceGradient: ["#0c6c75", "#1aa3b0"],
    ringGlow: "rgba(20, 150, 148, 0.18)",
  },
  purple: {
    key: "purple",
    heroGradient: ["#ebe4ff", "#f3edff", "#faf7ff"],
    accent: "#7C3AED",
    buttonGradient: ["#6D28D9", "#8B5CF6"],
    iconGradient: ["#6D28D9", "#7C3AED"],
    priceGradient: ["#6D28D9", "#8B5CF6"],
    ringGlow: "rgba(124, 58, 237, 0.18)",
  },
  rose: {
    key: "rose",
    heroGradient: ["#ffe8ea", "#fff1f2", "#fff8f8"],
    accent: "#E11D48",
    buttonGradient: ["#BE123C", "#F43F5E"],
    iconGradient: ["#BE123C", "#E11D48"],
    priceGradient: ["#BE123C", "#F43F5E"],
    ringGlow: "rgba(225, 29, 72, 0.16)",
  },
  green: {
    key: "green",
    heroGradient: ["#d8fbe8", "#ecfdf5", "#f6fef9"],
    accent: "#059669",
    buttonGradient: ["#047857", "#10B981"],
    iconGradient: ["#047857", "#059669"],
    priceGradient: ["#047857", "#10B981"],
    ringGlow: "rgba(5, 150, 105, 0.16)",
  },
  amber: {
    key: "amber",
    heroGradient: ["#fef0c7", "#fffbeb", "#fffef7"],
    accent: "#D97706",
    buttonGradient: ["#B45309", "#F59E0B"],
    iconGradient: ["#B45309", "#D97706"],
    priceGradient: ["#B45309", "#F59E0B"],
    ringGlow: "rgba(217, 119, 6, 0.16)",
  },
};

const CATEGORY_ICONS: Record<string, { icon: string; theme: CardTheme["key"] }> = {
  mens: { icon: "cut-outline", theme: "teal" },
  men: { icon: "cut-outline", theme: "teal" },
  womens: { icon: "cut-outline", theme: "purple" },
  women: { icon: "cut-outline", theme: "purple" },
  kids: { icon: "cut-outline", theme: "rose" },
  alterations: { icon: "cut-outline", theme: "green" },
  wedding: { icon: "cut-outline", theme: "amber" },
};

function getCardTheme(categoryName: string): CardTheme {
  const key = categoryName.trim().toLowerCase();
  const match = CATEGORY_ICONS[key];
  if (match) return THEMES[match.theme];
  if (key.includes("women") || key.includes("ladies")) return THEMES.purple;
  if (key.includes("kid")) return THEMES.rose;
  if (key.includes("alter")) return THEMES.green;
  return THEMES.teal;
}

function getCategoryIcon(categoryName: string): string {
  const key = categoryName.trim().toLowerCase();
  return CATEGORY_ICONS[key]?.icon ?? "shirt-outline";
}
export function getPopularSnapInterval(screenWidth: number): number {
  return getPopularCardWidth(screenWidth) + CARD_GAP;
}

const POPULAR_LIST_HEIGHT = CARD_HEIGHT + 28;

function resolveServiceImageUrl(url: string | null | undefined): string | null {
  const resolved = normalizeProfileImageUrl(url);
  if (!resolved || resolved.includes("example.com")) return null;
  return resolved;
}

function DotGrid({ color }: { color: string }) {
  const dots = useMemo(() => Array.from({ length: 16 }, (_, i) => i), []);
  return (
    <View style={dotGridStyles.wrap} pointerEvents="none">
      {dots.map((i) => (
        <View key={i} style={[dotGridStyles.dot, { backgroundColor: color }]} />
      ))}
    </View>
  );
}

export function PopularSectionHeader() {
  const { t } = useAppLanguage();
  return (
    <View style={headerStyles.row}>
      <View style={headerStyles.titleRow}>
        <View style={headerStyles.accent} />
        <View style={headerStyles.titleCol}>
          <Text style={headerStyles.title}>{t("home.popularServices")}</Text>
          <Text style={headerStyles.sub}>{t("home.tapToExplore")}</Text>
        </View>
      </View>
    </View>
  );
}

export function PopularServicesEmpty() {
  const { width } = useWindowDimensions();
  const cardWidth = getPopularCardWidth(width);

  return (
    <View style={[emptyStyles.wrap, { width: cardWidth * 2 + CARD_GAP }]}>
      <LinearGradient colors={["#d4f5f3", "#f4fdfc"]} style={emptyStyles.card}>
        <View style={emptyStyles.iconRing}>
          <Ionicons name="sparkles-outline" size={26} color="#149694" />
        </View>
        <Text style={emptyStyles.title}>No popular services yet</Text>
        <Text style={emptyStyles.sub}>
          Fresh picks will appear here soon.
        </Text>
      </LinearGradient>
    </View>
  );
}

export interface PopularServicesSectionProps {
  services: PopularServiceRow[];
  rating: number | null;
  /** Whole-card tap - parent decides where this goes (kept generic, not hardcoded here). */
  onPress: (row: PopularServiceRow) => void;
  /** "Book Now" button tap - parent decides the destination (e.g. service details). */
  onPrimaryAction: (row: PopularServiceRow) => void;
  /**
   * "carousel" (default) - horizontal snap-scrolling row with arrows/dots.
   * "vertical" - full-width cards stacked top to bottom, no arrows/dots/snap
   * (per manager feedback: Popular Services should read top-to-bottom like
   * the rest of the homepage, not scroll sideways).
   */
  layout?: "carousel" | "vertical";
  /**
   * Cap how many cards render before a "View All Services" footer button
   * takes over (vertical layout only) - keeps the homepage section short
   * instead of listing every popular service inline. Omit to show all.
   */
  maxItems?: number;
  /** Required when maxItems is set and services.length exceeds it. */
  onViewAll?: () => void;
}

export function PopularServicesSection({
  services,
  rating,
  onPress,
  onPrimaryAction,
  layout = "carousel",
  maxItems,
  onViewAll,
}: PopularServicesSectionProps) {
  const { width } = useWindowDimensions();
  const cardWidth = getPopularCardWidth(width);
  const snapInterval = getPopularSnapInterval(width);
  const [activeIndex, setActiveIndex] = useState(0);
  const listRef = useRef<FlatList<PopularServiceRow>>(null);

  // Arrows fade out after a moment of scroll inactivity and fade back in
  // the instant the user touches/scrolls the carousel again.
  const { opacity: arrowOpacity, notifyActivity } = useAutoHideOpacity();
  const arrowFadeStyle = useAnimatedStyle(() => ({ opacity: arrowOpacity.value }));

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const index = Math.round(x / snapInterval);
      setActiveIndex(Math.max(0, Math.min(index, services.length - 1)));
      notifyActivity();
    },
    [snapInterval, services.length, notifyActivity],
  );

  // Same left/right chevron-arrow pattern as the homepage Services carousel
  // (ServicesCarousel in app/(tabs)/index.tsx) - one card per tap, driven off
  // the same activeIndex the scroll-position dots already track.
  const canScrollPrev = activeIndex > 0;
  const canScrollNext = activeIndex < services.length - 1;

  const scrollByCard = useCallback(
    (direction: 1 | -1) => {
      notifyActivity();
      const nextIndex = Math.max(
        0,
        Math.min(activeIndex + direction, services.length - 1),
      );
      listRef.current?.scrollToOffset({
        offset: nextIndex * snapInterval,
        animated: true,
      });
      setActiveIndex(nextIndex);
    },
    [activeIndex, services.length, snapInterval, notifyActivity],
  );

  const renderItem = useCallback(
    ({ item }: { item: PopularServiceRow }) => (
      <PopularServiceCard
        row={item}
        rating={rating}
        onPress={onPress}
        onPrimaryAction={onPrimaryAction}
        cardWidth={cardWidth}
      />
    ),
    [cardWidth, onPress, onPrimaryAction, rating],
  );

  if (services.length === 0) {
    return (
      <View>
        <PopularSectionHeader />
        <View style={sectionStyles.emptyPad}>
          <PopularServicesEmpty />
        </View>
      </View>
    );
  }

  if (layout === "vertical") {
    // Full-width, no carousel gutter math needed - each card just fills the
    // parent's own width (the parent already sits inside the homepage's
    // padded sheet, same as every other section). Taller than the carousel
    // card since it's no longer squeezed to ~46% of the screen - the hero
    // photo would look cramped at the carousel's compact height when
    // stretched across the full width.
    const fullCardWidth = width - H_PAD * 2;
    const verticalHeroHeight = 200;
    const verticalCardHeight = VERTICAL_BODY_HEIGHT + verticalHeroHeight;
    const visibleServices =
      maxItems != null ? services.slice(0, maxItems) : services;
    const hasMore = maxItems != null && services.length > maxItems;
    return (
      <View>
        <PopularSectionHeader />
        <View style={sectionStyles.verticalStack}>
          {visibleServices.map((row, i) => (
            <PopularServiceCard
              key={`pop-${row.bookableServiceId || row.sub.Id || i}-${row.category.Id}-${i}`}
              row={row}
              rating={rating}
              onPress={onPress}
              onPrimaryAction={onPrimaryAction}
              cardWidth={fullCardWidth}
              cardHeight={verticalCardHeight}
              heroHeight={verticalHeroHeight}
              noRightMargin
            />
          ))}
        </View>
        {hasMore && onViewAll ? (
          <TouchableOpacity
            style={sectionStyles.viewAllBtn}
            onPress={onViewAll}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityLabel="View all services"
          >
            <Text style={sectionStyles.viewAllText}>View All Services</Text>
            <Ionicons name="arrow-forward" size={15} color={COLORS.primaryDark} />
          </TouchableOpacity>
        ) : null}
      </View>
    );
  }

  // Available content width is the screen width minus the sheet's own
  // left+right gutter (this carousel adds none of its own - see H_PAD
  // comment above). Right-pad the list content so a partial next card can
  // still peek in, with a floor of one gutter's worth so the last full card
  // never sits flush against the sheet's right edge.
  const availableWidth = width - H_PAD * 2;
  const trailingPad = Math.max(H_PAD, availableWidth - cardWidth * 2 - CARD_GAP);

  return (
    <View>
      <PopularSectionHeader />
      <View style={sectionStyles.carouselWrap}>
      <FlatList
        ref={listRef}
        data={services}
        horizontal
        nestedScrollEnabled
        style={{ height: POPULAR_LIST_HEIGHT }}
        showsHorizontalScrollIndicator={false}
        keyExtractor={(row, index) =>
          `pop-${row.bookableServiceId || row.sub.Id || index}-${row.category.Id}-${index}`
        }
        renderItem={renderItem}
        onScroll={onScroll}
        scrollEventThrottle={16}
        onTouchStart={notifyActivity}
        snapToInterval={snapInterval}
        snapToAlignment="start"
        decelerationRate="fast"
        disableIntervalMomentum
        contentContainerStyle={[
          sectionStyles.listPad,
          { paddingRight: trailingPad },
        ]}
        initialNumToRender={3}
        maxToRenderPerBatch={4}
        windowSize={5}
        removeClippedSubviews={Platform.OS === "android"}
        getItemLayout={(_, index) => ({
          length: snapInterval,
          offset: snapInterval * index,
          index,
        })}
      />
      {services.length > 1 ? (
        <>
          {canScrollPrev ? (
            <Animated.View style={[sectionStyles.arrow, sectionStyles.arrowLeft, arrowFadeStyle]}>
              <TouchableOpacity
                style={sectionStyles.arrowHit}
                onPress={() => scrollByCard(-1)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Previous popular services"
              >
                <Ionicons name="chevron-back" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </Animated.View>
          ) : null}
          {canScrollNext ? (
            <Animated.View style={[sectionStyles.arrow, sectionStyles.arrowRight, arrowFadeStyle]}>
              <TouchableOpacity
                style={sectionStyles.arrowHit}
                onPress={() => scrollByCard(1)}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel="Next popular services"
              >
                <Ionicons name="chevron-forward" size={18} color={COLORS.primary} />
              </TouchableOpacity>
            </Animated.View>
          ) : null}
        </>
      ) : null}
      </View>
      {services.length > 1 ? (
        <View style={sectionStyles.dotsRow}>
          {services.map((row, i) => (
            <View
              key={`dot-${row.sub.Id}`}
              style={[
                sectionStyles.dot,
                i === activeIndex && sectionStyles.dotActive,
              ]}
            />
          ))}
        </View>
      ) : null}
    </View>
  );
}

export interface PopularServiceCardProps {
  row: PopularServiceRow;
  rating: number | null;
  /** Whole-card tap - parent decides where this goes. */
  onPress: (row: PopularServiceRow) => void;
  /** "Book Now" button tap - parent decides the destination (e.g. service details). Generic on purpose - this card never hardcodes navigation. */
  onPrimaryAction: (row: PopularServiceRow) => void;
  navigating?: boolean;
  cardWidth?: number;
  /** Omit the built-in right margin (meant for horizontal carousel spacing)
   * when the card is used full-width in a vertical stack instead. */
  noRightMargin?: boolean;
  /** Override the default carousel-sized card/hero height - the vertical
   * homepage layout uses a taller card since it's full-width instead of
   * ~46% of the screen. */
  cardHeight?: number;
  heroHeight?: number;
}

function PopularServiceCardComponent({
  row,
  rating,
  onPress,
  onPrimaryAction,
  navigating = false,
  cardWidth: cardWidthProp,
  noRightMargin = false,
  cardHeight = CARD_HEIGHT,
  heroHeight = HERO_HEIGHT,
}: PopularServiceCardProps) {
  const { width: screenWidth } = useWindowDimensions();
  const cardWidth = cardWidthProp ?? getPopularCardWidth(screenWidth);

  const { sub: item, category } = row;
  const theme = getCardTheme(category.Name);
  const iconName = getCategoryIcon(category.Name);
  const imageUri = useMemo(
    () => resolveServiceImageUrl(item.ImageUrl),
    [item.ImageUrl],
  );
  const hasImage = imageUri != null;
  const showRating = rating != null && rating > 0;

  const subtitle = useMemo(
    () =>
      item.Description?.trim() ||
      category.Description?.trim() ||
      "Expert tailoring with premium finish",
    [item.Description, category.Description],
  );

  const { t } = useAppLanguage();

  const scale = useSharedValue(1);
  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const [previewVisible, setPreviewVisible] = useState(false);

  const handlePress = useCallback(() => {
    onPress(row);
  }, [onPress, row]);

  const handlePrimaryAction = useCallback(() => {
    onPrimaryAction(row);
  }, [onPrimaryAction, row]);

  // Hold-to-preview the full service photo - tap keeps the normal navigation
  // flow untouched, long-press only opens an overlay (no theme-fallback
  // "image" to preview when the service has no real photo yet).
  const handleLongPress = useCallback(() => {
    if (hasImage) setPreviewVisible(true);
  }, [hasImage]);

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        { width: cardWidth, height: cardHeight, marginRight: noRightMargin ? 0 : CARD_GAP },
        cardAnim,
      ]}
    >
      <Pressable
        style={[styles.card, { height: cardHeight }]}
        onPress={handlePress}
        onLongPress={handleLongPress}
        delayLongPress={350}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 22, stiffness: 360 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 300 });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.Name}, from ${item.BasePrice} rupees`}
      >
        <View style={[styles.hero, { height: heroHeight }]}>
          {hasImage ? (
            <>
              <Image
                source={{ uri: imageUri! }}
                style={StyleSheet.absoluteFill}
                contentFit="cover"
                transition={200}
                cachePolicy="memory-disk"
              />
              <LinearGradient
                colors={["transparent", "rgba(0,0,0,0.45)"]}
                style={StyleSheet.absoluteFill}
              />
            </>
          ) : (
            <>
              <LinearGradient
                colors={theme.heroGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={[styles.wave1, { backgroundColor: theme.ringGlow }]} />
              <View style={[styles.wave2, { backgroundColor: theme.ringGlow }]} />
              <DotGrid color={`${theme.accent}22`} />
              <View style={styles.iconStack}>
                <View style={[styles.dashedRing, { borderColor: `${theme.accent}44` }]} />
                <View style={[styles.glowRing, { backgroundColor: theme.ringGlow }]} />
                <LinearGradient colors={theme.iconGradient} style={styles.iconCircle}>
                  <Ionicons
                    name={iconName as keyof typeof Ionicons.glyphMap}
                    size={28}
                    color={COLORS.white}
                  />
                </LinearGradient>
              </View>
            </>
          )}

          {showRating ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating!.toFixed(1)}</Text>
            </View>
          ) : null}

          <LinearGradient
            colors={theme.priceGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.priceBadge}
          >
            <Text style={styles.priceBadgeText} numberOfLines={1}>
              from ₹{item.BasePrice.toLocaleString("en-IN")}
            </Text>
          </LinearGradient>
        </View>

        <View style={styles.body}>
          <View style={styles.categorySlot}>
            <Text
              style={[styles.categoryLabel, { color: theme.accent }]}
              numberOfLines={1}
            >
              {category.Name.toUpperCase()}
            </Text>
          </View>

          <View style={styles.titleSlot}>
            <Text style={styles.title} numberOfLines={2}>
              {item.Name}
            </Text>
          </View>

          <View style={styles.descSlot}>
            <Text style={styles.desc} numberOfLines={2}>
              {subtitle}
            </Text>
          </View>

          <View style={styles.spacer} />

          <LinearGradient
            colors={theme.buttonGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.cta}
          >
            <Pressable
              style={styles.ctaInnerFull}
              onPress={handlePrimaryAction}
              accessibilityRole="button"
              accessibilityLabel={`Book ${item.Name} now`}
            >
              {navigating ? (
                <ActivityIndicator size="small" color={COLORS.white} />
              ) : (
                <>
                  <Ionicons name="flash-outline" size={15} color={COLORS.white} />
                  <Text style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit>
                    {t("common.bookNow")}
                  </Text>
                </>
              )}
            </Pressable>
          </LinearGradient>
        </View>
      </Pressable>

      {hasImage ? (
        <Modal
          visible={previewVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setPreviewVisible(false)}
          statusBarTranslucent
        >
          <Pressable
            style={previewStyles.backdrop}
            onPress={() => setPreviewVisible(false)}
          >
            <Image
              source={{ uri: imageUri! }}
              style={previewStyles.image}
              contentFit="contain"
              transition={150}
              cachePolicy="memory-disk"
            />
            <View style={previewStyles.captionWrap}>
              <Text style={previewStyles.caption} numberOfLines={2}>
                {item.Name}
              </Text>
            </View>
          </Pressable>
        </Modal>
      ) : null}
    </Animated.View>
  );
}

export const PopularServiceCard = memo(PopularServiceCardComponent);

const previewStyles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  image: {
    width: "92%",
    height: "70%",
  },
  captionWrap: {
    position: "absolute",
    bottom: 48,
    paddingHorizontal: 24,
  },
  caption: {
    color: COLORS.white,
    fontSize: 16,
    fontWeight: "700",
    textAlign: "center",
  },
});

const sectionStyles = StyleSheet.create({
  carouselWrap: {
    position: "relative",
  },
  verticalStack: {
    gap: CARD_GAP,
  },
  viewAllBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    marginTop: CARD_GAP,
    height: 46,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: COLORS.primaryDark,
    backgroundColor: "rgba(20, 150, 148, 0.06)",
  },
  viewAllText: {
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
  arrow: {
    position: "absolute",
    top: POPULAR_LIST_HEIGHT / 2 - 16,
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
  arrowLeft: { left: 4 },
  arrowRight: { right: 4 },
  arrowHit: {
    width: "100%",
    height: "100%",
    alignItems: "center",
    justifyContent: "center",
  },
  listPad: {
    // No paddingLeft here - the parent `sheet` container already supplies
    // the section's left gutter, so the first card starts flush with it.
    paddingBottom: 2,
  },
  emptyPad: {
    // No horizontal padding - same reasoning as listPad above.
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: 12,
    marginBottom: 2,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#D1D5DB",
  },
  dotActive: {
    width: 20,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#149694",
  },
});

const headerStyles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 14,
    // No horizontal padding - the parent `sheet` container already supplies
    // the section's left/right gutter, matching every other section title.
    gap: 8,
  },
  titleRow: {
    flex: 1,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
  },
  titleCol: { flex: 1 },
  accent: {
    width: 4,
    height: 22,
    borderRadius: 2,
    backgroundColor: "#149694",
    marginTop: 3,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: "#111827",
    letterSpacing: -0.3,
  },
  sub: {
    fontSize: 12,
    color: "#6B7280",
    marginTop: 2,
    lineHeight: 16,
  },
});

const emptyStyles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    marginBottom: 4,
  },
  card: {
    borderRadius: CARD_RADIUS,
    paddingVertical: 24,
    paddingHorizontal: 20,
    alignItems: "center",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(12, 108, 117, 0.12)",
  },
  iconRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
    elevation: 3,
  },
  title: {
    fontSize: 15,
    fontWeight: "700",
    color: "#111827",
    marginBottom: 6,
    textAlign: "center",
  },
  sub: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 18,
  },
});

const dotGridStyles = StyleSheet.create({
  wrap: {
    position: "absolute",
    right: 10,
    top: 14,
    width: 48,
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 5,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
  },
});

const styles = StyleSheet.create({
  cardOuter: {
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.1,
        shadowRadius: 14,
      },
      android: { elevation: 6 },
    }),
  },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: CARD_RADIUS,
    overflow: "hidden",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0, 0, 0, 0.05)",
    flexDirection: "column",
  },
  hero: {
    width: "100%",
    height: HERO_HEIGHT,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    position: "relative",
  },
  wave1: {
    position: "absolute",
    width: 110,
    height: 110,
    borderRadius: 55,
    top: -36,
    left: -28,
    opacity: 0.6,
  },
  wave2: {
    position: "absolute",
    width: 72,
    height: 72,
    borderRadius: 36,
    bottom: 8,
    right: -18,
    opacity: 0.5,
  },
  iconStack: {
    alignItems: "center",
    justifyContent: "center",
    width: 78,
    height: 78,
  },
  dashedRing: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  glowRing: {
    position: "absolute",
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  iconCircle: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    alignItems: "center",
    justifyContent: "center",
    zIndex: 2,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.14,
        shadowRadius: 8,
      },
      android: { elevation: 5 },
    }),
  },
  ratingBadge: {
    position: "absolute",
    top: 10,
    right: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: "rgba(255, 255, 255, 0.9)",
    borderRadius: 10,
    paddingHorizontal: 7,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: "rgba(255, 255, 255, 0.95)",
    zIndex: 10,
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
  ratingText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#374151",
  },
  priceBadge: {
    position: "absolute",
    left: 10,
    bottom: 10,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
    zIndex: 10,
    maxWidth: "90%",
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.22,
        shadowRadius: 6,
      },
      android: { elevation: 4 },
    }),
  },
  priceBadgeText: {
    fontSize: 11,
    fontWeight: "800",
    color: COLORS.white,
  },
  body: {
    flex: 1,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 10,
    justifyContent: "flex-start",
  },
  categorySlot: {
    minHeight: 14,
    justifyContent: "center",
    marginBottom: 4,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  titleSlot: {
    minHeight: 36,
    maxHeight: 44,
    justifyContent: "flex-start",
    marginBottom: 4,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
    lineHeight: 20,
  },
  descSlot: {
    minHeight: 30,
    maxHeight: 34,
    justifyContent: "flex-start",
    marginBottom: 2,
  },
  desc: {
    fontSize: 12.5,
    color: "#9CA3AF",
    lineHeight: 16,
  },
  spacer: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 2,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 12,
    height: 42,
    paddingHorizontal: 12,
    width: "100%",
    marginTop: 4,
    ...Platform.select({
      ios: {
        shadowColor: "#0c6c75",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
      },
      android: { elevation: 4 },
    }),
  },
  ctaText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.white,
    flexShrink: 1,
  },
  ctaInnerFull: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    width: "100%",
    height: "100%",
  },
});
