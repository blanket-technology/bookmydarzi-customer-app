import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  useWindowDimensions,
  View,
  type ListRenderItemInfo,
  type NativeSyntheticEvent,
  type NativeScrollEvent,
} from "react-native";
import Animated, { FadeIn, FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS } from "../constants/theme";
import {
  fetchCatalogTree,
  resolveServiceNavParams,
} from "../src/services/catalogService";
import {
  fetchLookbook,
  LOOKBOOK_CATEGORIES,
  type LookbookItem,
} from "../src/services/lookbookService";
import { safeRouterPush } from "../src/utils/safeNavigation";

const COLS = 2;
const GRID_PAD = 12;
const ITEM_GAP = 8;

const CATEGORY_ICONS: Record<string, keyof typeof Ionicons.glyphMap> = {
  all: "sparkles-outline",
  mens: "shirt-outline",
  womens: "woman-outline",
  kids: "happy-outline",
  wedding: "heart-outline",
  alterations: "construct-outline",
};

// ─── Skeleton grid shown while a category's photos are loading ─────────────

function SkeletonTile({ index, itemWidth }: { index: number; itemWidth: number }) {
  const isOdd = index % 2 !== 0;
  const height = isOdd ? itemWidth * 1.35 : itemWidth * 1.1;
  return (
    <Animated.View
      entering={FadeIn.delay(index * 30).duration(300)}
      style={[galleryStyles.item, galleryStyles.skeleton, { width: itemWidth, height }]}
    />
  );
}

function SkeletonGrid({ itemWidth }: { itemWidth: number }) {
  const rows = Array.from({ length: 6 });
  return (
    <View style={styles.grid}>
      {rows.map((_, rowIdx) => (
        <View key={rowIdx} style={styles.gridRow}>
          <SkeletonTile index={rowIdx * 2} itemWidth={itemWidth} />
          <SkeletonTile index={rowIdx * 2 + 1} itemWidth={itemWidth} />
        </View>
      ))}
    </View>
  );
}

// ─── Gallery tile ────────────────────────────────────────────────────────────

function GalleryItem({
  item,
  onTap,
  index,
  itemWidth,
}: {
  item: LookbookItem;
  onTap: (item: LookbookItem) => void;
  index: number;
  itemWidth: number;
}) {
  const [imgError, setImgError] = useState(false);
  const isOdd = index % 2 !== 0;
  const height = isOdd ? itemWidth * 1.35 : itemWidth * 1.1;

  return (
    <Animated.View
      entering={FadeInDown.delay(Math.min(index, 10) * 40).duration(350)}
      style={[galleryStyles.item, { width: itemWidth, height }]}
    >
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={() => onTap(item)}
        android_ripple={{ color: "rgba(0,0,0,0.08)" }}
      >
        {imgError ? (
          <LinearGradient
            colors={["#d4f5f3", "#e8faf9"]}
            style={[StyleSheet.absoluteFill, galleryStyles.placeholder]}
          >
            <Ionicons name="image-outline" size={28} color="#149694" />
          </LinearGradient>
        ) : (
          <Image
            source={{ uri: item.image_url }}
            style={StyleSheet.absoluteFill}
            contentFit="cover"
            transition={200}
            cachePolicy="memory-disk"
            onError={() => setImgError(true)}
          />
        )}
        <LinearGradient
          colors={["transparent", "rgba(0,0,0,0.52)"]}
          style={galleryStyles.overlay}
        >
          {item.title ? (
            <Text style={galleryStyles.itemTitle} numberOfLines={2}>
              {item.title}
            </Text>
          ) : null}
          <View style={galleryStyles.metaRow}>
            {item.category_tag ? (
              <View style={galleryStyles.tagPill}>
                <Text style={galleryStyles.tagText}>
                  {item.category_tag.charAt(0).toUpperCase() + item.category_tag.slice(1)}
                </Text>
              </View>
            ) : null}
            {item.service_id ? (
              <View style={galleryStyles.bookableBadge}>
                <Ionicons name="bag-add-outline" size={11} color={COLORS.white} />
              </View>
            ) : null}
          </View>
        </LinearGradient>
      </Pressable>
    </Animated.View>
  );
}

// ─── Lightbox - swipeable, pinch-to-zoom-free but with a working "Book this
// look" CTA that resolves the photo's tagged service_id against the live
// catalog tree. Previously the lookbook was a dead end: browse-only, no path
// from "I like this" to "book this" despite item.service_id already being
// returned by the API and completely unused. ─────────────────────────────────

function Lightbox({
  items,
  initialIndex,
  onClose,
}: {
  items: LookbookItem[];
  initialIndex: number;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const listRef = useRef<FlatList<LookbookItem>>(null);
  const [activeIndex, setActiveIndex] = useState(initialIndex);
  const [booking, setBooking] = useState(false);
  const router = useRouter();
  // Reactive, unlike the removed module-level Dimensions.get("window")
  // snapshot - this updates on rotation/foldable-fold instead of paging
  // math and page/image sizing silently going stale after the first read.
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();

  const activeItem = items[activeIndex];

  const handleMomentumEnd = useCallback((e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const idx = Math.round(e.nativeEvent.contentOffset.x / screenWidth);
    setActiveIndex(idx);
  }, [screenWidth]);

  const renderPage = useCallback(
    ({ item }: ListRenderItemInfo<LookbookItem>) => (
      <View style={[lightboxStyles.page, { width: screenWidth, height: screenHeight }]}>
        <Image
          source={{ uri: item.image_url }}
          style={[lightboxStyles.img, { width: screenWidth, height: screenHeight * 0.72 }]}
          contentFit="contain"
          transition={150}
        />
      </View>
    ),
    [screenWidth, screenHeight],
  );

  const handleBookThisLook = useCallback(async () => {
    if (!activeItem?.service_id) return;
    setBooking(true);
    try {
      const tree = await fetchCatalogTree();
      const params = resolveServiceNavParams(tree, activeItem.service_id);
      if (!params) {
        setBooking(false);
        return;
      }
      onClose();
      safeRouterPush(router, { pathname: "/service-details", params } as never);
    } finally {
      setBooking(false);
    }
  }, [activeItem, onClose, router]);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={lightboxStyles.overlay}>
        <FlatList
          ref={listRef}
          data={items}
          keyExtractor={(it) => String(it.id)}
          renderItem={renderPage}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          initialScrollIndex={initialIndex}
          getItemLayout={(_, i) => ({ length: screenWidth, offset: screenWidth * i, index: i })}
          onMomentumScrollEnd={handleMomentumEnd}
        />

        <View style={[lightboxStyles.topBar, { paddingTop: insets.top + 8 }]}>
          {items.length > 1 ? (
            <View style={lightboxStyles.counterPill}>
              <Text style={lightboxStyles.counterText}>
                {activeIndex + 1} / {items.length}
              </Text>
            </View>
          ) : (
            <View />
          )}
          <TouchableOpacity style={lightboxStyles.closeBtn} onPress={onClose} hitSlop={10}>
            <Ionicons name="close" size={20} color={COLORS.white} />
          </TouchableOpacity>
        </View>

        {(activeItem?.title || activeItem?.caption || activeItem?.service_id) ? (
          <View style={[lightboxStyles.bottomSheet, { paddingBottom: insets.bottom + 16 }]}>
            {activeItem?.title ? (
              <Text style={lightboxStyles.captionTitle}>{activeItem.title}</Text>
            ) : null}
            {activeItem?.caption ? (
              <Text style={lightboxStyles.captionText}>{activeItem.caption}</Text>
            ) : null}
            {activeItem?.service_id ? (
              <TouchableOpacity
                style={lightboxStyles.bookBtn}
                onPress={handleBookThisLook}
                disabled={booking}
                activeOpacity={0.88}
              >
                <Ionicons name="bag-add-outline" size={17} color={COLORS.black} />
                <Text style={lightboxStyles.bookBtnText}>
                  {booking ? "Loading…" : "Book this look"}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function LookbookScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { width: screenWidth } = useWindowDimensions();
  const itemWidth = (screenWidth - GRID_PAD * 2 - ITEM_GAP) / COLS;
  const [activeCategory, setActiveCategory] = useState("all");
  const [items, setItems] = useState<LookbookItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  // Per-category cache, keyed by category - a flat `items` array with a
  // single "have we loaded" flag can't actually serve cached data back for
  // a category once you've switched away, since there was nowhere to keep
  // its items. Switching back to an already-viewed category now restores
  // instantly instead of re-fetching + reshowing a loading state.
  const cacheRef = useRef<Record<string, LookbookItem[]>>({});

  const load = useCallback(async (cat: string) => {
    const cached = cacheRef.current[cat];
    if (cached) {
      setItems(cached);
      return;
    }
    setLoading(true);
    setError(false);
    try {
      const data = await fetchLookbook(cat === "all" ? undefined : cat);
      setItems(data);
      cacheRef.current[cat] = data;
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(activeCategory);
  }, [activeCategory, load]);

  const handleCategoryChange = useCallback(
    (key: string) => {
      if (key === activeCategory) return;
      setActiveCategory(key);
      setItems(cacheRef.current[key] ?? []);
    },
    [activeCategory],
  );

  const renderItem = useCallback(
    ({ item, index }: { item: LookbookItem; index: number }) => (
      <GalleryItem item={item} onTap={() => setLightboxIndex(index)} index={index} itemWidth={itemWidth} />
    ),
    [itemWidth],
  );

  const bookableCount = useMemo(() => items.filter((i) => i.service_id).length, [items]);

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.black} style={{ marginRight: 1.5 }} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>Style Lookbook</Text>
          <Text style={styles.headerSub}>
            {loading
              ? "Garments crafted by BMD"
              : bookableCount > 0
                ? `${bookableCount} ready to book`
                : "Garments crafted by BMD"}
          </Text>
        </View>
        <View style={styles.backBtn} />
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.catRow}
      >
        {LOOKBOOK_CATEGORIES.map((cat) => {
          const active = cat.key === activeCategory;
          return (
            <Pressable
              key={cat.key}
              onPress={() => handleCategoryChange(cat.key)}
              style={[styles.catChip, active && styles.catChipActive]}
            >
              <Ionicons
                name={CATEGORY_ICONS[cat.key] ?? "pricetag-outline"}
                size={14}
                color={active ? COLORS.white : COLORS.gray}
              />
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                {cat.label}
              </Text>
            </Pressable>
          );
        })}
      </ScrollView>

      {loading ? (
        <SkeletonGrid itemWidth={itemWidth} />
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="image-outline" size={44} color={COLORS.grayBorder} />
          <Text style={styles.centerTitle}>Couldn&apos;t load lookbook</Text>
          <TouchableOpacity onPress={() => void load(activeCategory)}>
            <Text style={styles.retryText}>Tap to retry</Text>
          </TouchableOpacity>
        </View>
      ) : items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="sparkles-outline" size={44} color={COLORS.grayBorder} />
          <Text style={styles.centerTitle}>No items yet</Text>
          <Text style={styles.centerSub}>Check back soon for inspiration!</Text>
        </View>
      ) : (
        <FlatList
          data={items}
          numColumns={COLS}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          showsVerticalScrollIndicator={false}
          initialNumToRender={8}
          maxToRenderPerBatch={10}
          windowSize={6}
        />
      )}

      {lightboxIndex !== null ? (
        <Lightbox
          items={items}
          initialIndex={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.white,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 6 },
      android: { elevation: 3 },
    }),
  },
  headerText: { alignItems: "center" },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.black, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  catRow: {
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 8,
    flexDirection: "row",
    alignItems: "center",
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: COLORS.white,
    borderWidth: 1.5,
    borderColor: COLORS.grayBorder,
  },
  catChipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  catChipText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },
  catChipTextActive: { color: COLORS.white },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingHorizontal: 32,
  },
  centerTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  centerSub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  retryText: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark, marginTop: 4 },
  grid: { padding: GRID_PAD },
  gridRow: { gap: ITEM_GAP, marginBottom: ITEM_GAP },
});

const galleryStyles = StyleSheet.create({
  item: {
    borderRadius: 16,
    overflow: "hidden",
    backgroundColor: "#F3F4F6",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.1, shadowRadius: 8 },
      android: { elevation: 3 },
    }),
  },
  skeleton: {
    backgroundColor: "#EAEAEA",
  },
  placeholder: {
    alignItems: "center",
    justifyContent: "center",
  },
  overlay: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    padding: 10,
    justifyContent: "flex-end",
    gap: 4,
  },
  itemTitle: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.white,
    lineHeight: 16,
  },
  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  tagPill: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(255,255,255,0.22)",
    borderRadius: 999,
    paddingHorizontal: 7,
    paddingVertical: 3,
  },
  tagText: {
    fontSize: 10,
    fontWeight: "600",
    color: COLORS.white,
  },
  bookableBadge: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: COLORS.primary,
    alignItems: "center",
    justifyContent: "center",
  },
});

const lightboxStyles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.94)",
  },
  page: {
    alignItems: "center",
    justifyContent: "center",
  },
  img: {},
  topBar: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
  },
  counterPill: {
    backgroundColor: "rgba(255,255,255,0.16)",
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  counterText: {
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.white,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
  },
  bottomSheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 24,
    paddingTop: 18,
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderTopLeftRadius: RADIUS.xxl,
    borderTopRightRadius: RADIUS.xxl,
    alignItems: "center",
  },
  captionTitle: {
    fontSize: 16,
    fontWeight: "700",
    color: COLORS.white,
    textAlign: "center",
  },
  captionText: {
    fontSize: 13,
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    lineHeight: 19,
  },
  bookBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: COLORS.white,
    borderRadius: 999,
    paddingHorizontal: 22,
    paddingVertical: 12,
    marginTop: 10,
  },
  bookBtnText: {
    fontSize: 14,
    fontWeight: "800",
    color: COLORS.black,
  },
});
