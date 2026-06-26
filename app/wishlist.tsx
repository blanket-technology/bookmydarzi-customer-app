/**
 * Wishlist / Favourites — GET/DELETE /api/v1/wishlist
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { useWishlistStore } from "../src/store/useWishlistStore";
import { useAuthStore } from "../store/useAuthStore";
import type { WishlistItem, WishlistItemType } from "../src/types/engagement";

const FILTERS: { key: "all" | WishlistItemType; label: string }[] = [
  { key: "all", label: "All" },
  { key: "service", label: "Services" },
  { key: "tailor", label: "Tailors" },
];

export default function WishlistScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { items, loading, error, fetchWishlist, remove } = useWishlistStore();
  const [filter, setFilter] = useState<"all" | WishlistItemType>("all");

  useFocusEffect(
    useCallback(() => {
      if (isAuthenticated) fetchWishlist(undefined, true);
    }, [isAuthenticated, fetchWishlist]),
  );

  const visible = filter === "all" ? items : items.filter((i) => i.item_type === filter);

  const openItem = (item: WishlistItem) => {
    if (item.item_type === "service" && item.service_id != null) {
      router.push({
        pathname: "/service-details" as never,
        params: { id: String(item.service_id), serviceId: String(item.service_id) },
      });
    }
  };

  const renderItem = ({ item }: { item: WishlistItem }) => (
    <TouchableOpacity style={styles.card} onPress={() => openItem(item)} activeOpacity={0.85}>
      {item.image_url ? (
        <Image source={{ uri: item.image_url }} style={styles.thumb} />
      ) : (
        <View style={[styles.thumb, styles.thumbFallback]}>
          <Ionicons
            name={item.item_type === "tailor" ? "person" : "cut-outline"}
            size={22}
            color={COLORS.primaryDark}
          />
        </View>
      )}
      <View style={styles.cardContent}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {item.name ?? (item.item_type === "tailor" ? "Tailor" : "Service")}
        </Text>
        <Text style={styles.cardType}>
          {item.item_type === "tailor" ? "Tailor" : "Service"}
        </Text>
        {item.price != null ? (
          <Text style={styles.cardPrice}>From ₹{Math.round(item.price)}</Text>
        ) : null}
      </View>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => remove(item.id)}
        hitSlop={10}
      >
        <Ionicons name="heart" size={22} color={COLORS.error} />
      </TouchableOpacity>
    </TouchableOpacity>
  );

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Wishlist</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.filterRow}>
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f.key}
            style={[styles.filterChip, filter === f.key && styles.filterChipActive]}
            onPress={() => setFilter(f.key)}
          >
            <Text style={[styles.filterText, filter === f.key && styles.filterTextActive]}>
              {f.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading && items.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : error && items.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={44} color={COLORS.error} />
          <Text style={styles.errorTitle}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={() => fetchWishlist(undefined, true)}>
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : visible.length === 0 ? (
        <View style={styles.center}>
          <Ionicons name="heart-outline" size={48} color={COLORS.grayBorder} />
          <Text style={styles.emptyTitle}>Your wishlist is empty</Text>
          <Text style={styles.emptySub}>Tap the heart on a service or tailor to save it here.</Text>
        </View>
      ) : (
        <FlatList
          data={visible}
          keyExtractor={(i) => String(i.id)}
          renderItem={renderItem}
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
          refreshControl={
            <RefreshControl
              refreshing={loading}
              onRefresh={() => fetchWishlist(undefined, true)}
              colors={[COLORS.primary]}
              tintColor={COLORS.primary}
            />
          }
        />
      )}
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
    backgroundColor: COLORS.offWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.black },
  filterRow: {
    flexDirection: "row",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
  },
  filterChip: {
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  filterChipActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  filterText: { fontSize: 13, fontWeight: "600", color: COLORS.gray },
  filterTextActive: { color: COLORS.white },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  thumb: { width: 60, height: 60, borderRadius: RADIUS.sm, backgroundColor: COLORS.grayLight },
  thumbFallback: { alignItems: "center", justifyContent: "center" },
  cardContent: { flex: 1 },
  cardTitle: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  cardType: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  cardPrice: { fontSize: 13, fontWeight: "700", color: COLORS.primaryDark, marginTop: 4 },
  removeBtn: { padding: SPACING.sm },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  errorTitle: { fontSize: 14, color: COLORS.error, textAlign: "center" },
  retryBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: 20,
    paddingHorizontal: 24,
    paddingVertical: 10,
    marginTop: SPACING.sm,
  },
  retryText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
});
