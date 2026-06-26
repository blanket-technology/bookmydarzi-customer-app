import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import React, { memo, useCallback, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from "react-native-reanimated";
import { COLORS } from "../../constants/theme";
import type { PopularServiceRow } from "../../src/types/homeApi";
import { normalizeProfileImageUrl } from "../../src/utils/profileImage";

const H_PAD = 16;
const CARD_GAP = 12;
const CARD_RADIUS = 24;
const HERO_HEIGHT = 120;
const CARD_HEIGHT = 390;
const ICON_SIZE = 64;

/** ~46% screen width — two cards visible side by side */
export function getPopularCardWidth(screenWidth: number): number {
  return Math.floor(screenWidth * 0.46);
}

export function getPopularSnapInterval(screenWidth: number): number {
  return getPopularCardWidth(screenWidth) + CARD_GAP;
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
  return (
    <View style={headerStyles.row}>
      <View style={headerStyles.titleRow}>
        <View style={headerStyles.accent} />
        <View style={headerStyles.titleCol}>
          <Text style={headerStyles.title}>Popular Services</Text>
          <Text style={headerStyles.sub}>Tap to explore & customize</Text>
        </View>
      </View>
      <View style={headerStyles.topRatedPill}>
        <Text style={headerStyles.topRatedText}>✨ Top Rated</Text>
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
  onPress: (row: PopularServiceRow) => void;
}

export function PopularServicesSection({
  services,
  rating,
  onPress,
}: PopularServicesSectionProps) {
  const { width } = useWindowDimensions();
  const cardWidth = getPopularCardWidth(width);
  const snapInterval = getPopularSnapInterval(width);
  const [activeIndex, setActiveIndex] = useState(0);

  const onScroll = useCallback(
    (e: NativeSyntheticEvent<NativeScrollEvent>) => {
      const x = e.nativeEvent.contentOffset.x;
      const index = Math.round(x / snapInterval);
      setActiveIndex(Math.max(0, Math.min(index, services.length - 1)));
    },
    [snapInterval, services.length],
  );

  const renderItem = useCallback(
    ({ item }: { item: PopularServiceRow }) => (
      <PopularServiceCard
        row={item}
        rating={rating}
        onPress={onPress}
        cardWidth={cardWidth}
      />
    ),
    [cardWidth, onPress, rating],
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

  const trailingPad = Math.max(H_PAD, width - H_PAD - cardWidth * 2 - CARD_GAP);

  return (
    <View>
      <PopularSectionHeader />
      <FlatList
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
  onPress: (row: PopularServiceRow) => void;
  navigating?: boolean;
  cardWidth?: number;
}

function PopularServiceCardComponent({
  row,
  rating,
  onPress,
  navigating = false,
  cardWidth: cardWidthProp,
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

  const scale = useSharedValue(1);
  const cardAnim = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = useCallback(() => {
    onPress(row);
  }, [onPress, row]);

  return (
    <Animated.View
      style={[
        styles.cardOuter,
        { width: cardWidth, height: CARD_HEIGHT, marginRight: CARD_GAP },
        cardAnim,
      ]}
    >
      <Pressable
        style={[styles.card, { height: CARD_HEIGHT }]}
        onPress={handlePress}
        onPressIn={() => {
          scale.value = withSpring(0.97, { damping: 22, stiffness: 360 });
        }}
        onPressOut={() => {
          scale.value = withSpring(1, { damping: 18, stiffness: 300 });
        }}
        accessibilityRole="button"
        accessibilityLabel={`${item.Name}, from ${item.BasePrice} rupees`}
      >
        <View style={styles.hero}>
          <LinearGradient
            colors={theme.heroGradient}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={StyleSheet.absoluteFill}
          />

          <View style={[styles.wave1, { backgroundColor: theme.ringGlow }]} />
          <View style={[styles.wave2, { backgroundColor: theme.ringGlow }]} />
          <DotGrid color={`${theme.accent}22`} />

          {showRating ? (
            <View style={styles.ratingBadge}>
              <Ionicons name="star" size={10} color="#F59E0B" />
              <Text style={styles.ratingText}>{rating!.toFixed(1)}</Text>
            </View>
          ) : null}

          <View style={styles.iconStack}>
            <View
              style={[styles.dashedRing, { borderColor: `${theme.accent}44` }]}
            />
            <View
              style={[styles.glowRing, { backgroundColor: theme.ringGlow }]}
            />
            {hasImage ? (
              <Image
                source={{ uri: imageUri! }}
                style={styles.heroImage}
                resizeMode="cover"
              />
            ) : (
              <LinearGradient
                colors={theme.iconGradient}
                style={styles.iconCircle}
              >
                <Ionicons
                  name={iconName as keyof typeof Ionicons.glyphMap}
                  size={28}
                  color={COLORS.white}
                />
              </LinearGradient>
            )}
          </View>

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
            {navigating ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <>
                <Ionicons name="eye-outline" size={15} color={COLORS.white} />
                <Text style={styles.ctaText} numberOfLines={1} adjustsFontSizeToFit>
                  View & Add to Cart
                </Text>
              </>
            )}
          </LinearGradient>
        </View>
      </Pressable>
    </Animated.View>
  );
}

export const PopularServiceCard = memo(PopularServiceCardComponent);

const sectionStyles = StyleSheet.create({
  listPad: {
    paddingLeft: H_PAD,
    paddingBottom: 2,
  },
  emptyPad: {
    paddingHorizontal: H_PAD,
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
    paddingHorizontal: H_PAD,
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
  topRatedPill: {
    backgroundColor: "rgba(20, 150, 148, 0.1)",
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 7,
    marginTop: 1,
  },
  topRatedText: {
    fontSize: 11,
    fontWeight: "700",
    color: "#149694",
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
    width: 96,
    height: 96,
  },
  dashedRing: {
    position: "absolute",
    width: 96,
    height: 96,
    borderRadius: 48,
    borderWidth: 1.5,
    borderStyle: "dashed",
  },
  glowRing: {
    position: "absolute",
    width: 78,
    height: 78,
    borderRadius: 39,
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
  heroImage: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    zIndex: 2,
    borderWidth: 2,
    borderColor: COLORS.white,
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
    paddingHorizontal: 14,
    paddingTop: 12,
    paddingBottom: 12,
    justifyContent: "flex-start",
  },
  categorySlot: {
    minHeight: 16,
    justifyContent: "center",
    marginBottom: 6,
  },
  categoryLabel: {
    fontSize: 10,
    fontWeight: "600",
    letterSpacing: 0.8,
  },
  titleSlot: {
    minHeight: 40,
    maxHeight: 48,
    justifyContent: "flex-start",
    marginBottom: 6,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: "#111827",
    letterSpacing: -0.3,
    lineHeight: 22,
  },
  descSlot: {
    minHeight: 34,
    maxHeight: 40,
    justifyContent: "flex-start",
    marginBottom: 2,
  },
  desc: {
    fontSize: 14,
    color: "#9CA3AF",
    lineHeight: 18,
  },
  spacer: {
    flexGrow: 1,
    flexShrink: 1,
    minHeight: 6,
    maxHeight: 18,
  },
  cta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    borderRadius: 14,
    height: 50,
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
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
    flexShrink: 1,
  },
});
