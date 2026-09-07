/**
 * Skeleton placeholder for the home screen while data is loading.
 * Mirrors the home screen layout so the transition feels seamless.
 */
import React from "react";
import { ScrollView, View, StyleSheet } from "react-native";
import SkeletonShimmer from "../SkeletonShimmer";
import { useSafeAreaInsets } from "react-native-safe-area-context";

const H_PAD = 20;

function CardSkeleton() {
  return (
    <View style={sk.card}>
      <SkeletonShimmer circle size={48} style={{ marginBottom: 10 }} />
      <SkeletonShimmer width="70%" height={13} borderRadius={7} style={{ marginBottom: 6 }} />
      <SkeletonShimmer width="50%" height={11} borderRadius={6} />
    </View>
  );
}

function BannerSkeleton() {
  return <SkeletonShimmer width="100%" height={160} borderRadius={20} style={{ marginBottom: 16 }} />;
}

function CategoryRowSkeleton() {
  return (
    <View style={sk.categoryRow}>
      {Array.from({ length: 5 }).map((_, i) => (
        <View key={i} style={sk.catItem}>
          <SkeletonShimmer circle size={60} style={{ marginBottom: 8 }} />
          <SkeletonShimmer width={52} height={11} borderRadius={6} />
        </View>
      ))}
    </View>
  );
}

export default function HomeSkeleton() {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={sk.root}
      scrollEnabled={false}
      contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
    >
      {/* Header */}
      <View style={[sk.header, { paddingTop: insets.top + 16 }]}>
        <View style={{ flex: 1, gap: 6 }}>
          <SkeletonShimmer width={140} height={13} borderRadius={7} />
          <SkeletonShimmer width={100} height={18} borderRadius={9} />
        </View>
        <SkeletonShimmer circle size={40} />
      </View>

      {/* Search bar */}
      <View style={sk.searchBar}>
        <SkeletonShimmer width="100%" height={46} borderRadius={14} />
      </View>

      {/* Banner carousel */}
      <View style={sk.section}>
        <BannerSkeleton />
      </View>

      {/* Categories */}
      <View style={sk.section}>
        <SkeletonShimmer width={140} height={16} borderRadius={8} style={{ marginBottom: 14 }} />
        <CategoryRowSkeleton />
      </View>

      {/* Service cards grid */}
      <View style={sk.section}>
        <SkeletonShimmer width={120} height={16} borderRadius={8} style={{ marginBottom: 14 }} />
        <View style={sk.cardGrid}>
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </View>
      </View>
    </ScrollView>
  );
}

const sk = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: "#F5F7FA",
    paddingHorizontal: H_PAD,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  searchBar: {
    marginBottom: 20,
  },
  section: {
    marginBottom: 24,
  },
  categoryRow: {
    flexDirection: "row",
    gap: 16,
  },
  catItem: {
    alignItems: "center",
  },
  cardGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  card: {
    width: "47%",
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
  },
});
