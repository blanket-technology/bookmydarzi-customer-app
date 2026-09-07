import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import React, { memo, useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Modal,
    Pressable,
    StyleSheet,
    Text,
    View,
    useWindowDimensions,
} from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../../constants/theme";
import {
    fetchOrderPhotos,
    stageLabel,
    type OrderProgressPhoto,
} from "../../../services/orderPhotoService";
import { orderDisplayValue } from "../../../types/api";

export interface ProgressGalleryProps {
  orderId: number;
  /** Skip this component's own fetch and render photos already loaded by a parent. */
  photos?: OrderProgressPhoto[] | null;
  onLoaded?: (photos: OrderProgressPhoto[]) => void;
}

const BLUR_HASH = "L6PZfSjE.AyE_3t7t7R**0o#DgR4";

function formatUploadedAt(ts: string | null): string {
  if (!ts) return "";
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const ProgressGallery = memo(({ orderId, photos, onLoaded }: ProgressGalleryProps) => {
  const { width: screenWidth } = useWindowDimensions();
  const [data, setData] = useState<OrderProgressPhoto[]>(photos ?? []);
  const [loading, setLoading] = useState(!photos);
  const [error, setError] = useState<string | null>(null);
  const [viewerIndex, setViewerIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!Number.isFinite(orderId) || orderId <= 0) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetchOrderPhotos(orderId);
      // Backend already orders by sequence then uploaded_at - trust it,
      // don't re-sort (re-sorting risks fighting a tie-break the server
      // already resolved consistently).
      setData(res.photos);
      onLoaded?.(res.photos);
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : "Couldn't load photos.");
    } finally {
      setLoading(false);
    }
  }, [orderId, onLoaded]);

  useEffect(() => {
    if (photos) {
      setData(photos);
      setLoading(false);
      setError(null);
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orderId, photos]);

  if (loading) {
    return (
      <View style={styles.centerBox}>
        <ActivityIndicator size="small" color={COLORS.primary} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="alert-circle-outline" size={20} color={COLORS.error} />
        <Text style={styles.errorText}>{error}</Text>
        <Pressable style={styles.retryBtn} onPress={load}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  if (data.length === 0) {
    return (
      <View style={styles.centerBox}>
        <Ionicons name="images-outline" size={22} color={COLORS.gray} />
        <Text style={styles.emptyText}>No progress photos yet.</Text>
        <Text style={styles.emptySubtext}>
          Your tailor will share photos as stitching progresses.
        </Text>
      </View>
    );
  }

  const viewerPhoto = viewerIndex != null ? data[viewerIndex] : null;

  return (
    <View style={styles.wrap}>
      <FlatList
        data={data}
        keyExtractor={(item) => String(item.id)}
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.list}
        renderItem={({ item, index }) => (
          <Pressable
            style={styles.thumbWrap}
            onPress={() => setViewerIndex(index)}
            accessibilityRole="imagebutton"
            accessibilityLabel={`View photo: ${stageLabel(item.stage)}`}
          >
            <Image
              source={{ uri: item.photo_url }}
              style={styles.thumb}
              placeholder={BLUR_HASH}
              contentFit="cover"
              transition={200}
              cachePolicy="disk"
            />
            <View style={styles.thumbBadge}>
              <Text style={styles.thumbBadgeText} numberOfLines={1}>
                {stageLabel(item.stage)}
              </Text>
            </View>
          </Pressable>
        )}
        // Perf: only render what's near-visible; avoids allocating every
        // full-res thumbnail up front on orders with many photos.
        initialNumToRender={6}
        maxToRenderPerBatch={6}
        windowSize={5}
        removeClippedSubviews
      />

      <Modal
        visible={viewerIndex != null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewerIndex(null)}
      >
        <Pressable style={styles.viewerBackdrop} onPress={() => setViewerIndex(null)}>
          {viewerPhoto ? (
            <View style={styles.viewerContent}>
              <Image
                source={{ uri: viewerPhoto.photo_url }}
                style={[styles.viewerImage, { width: screenWidth - SPACING.xl * 2 }]}
                placeholder={BLUR_HASH}
                contentFit="contain"
                transition={150}
                cachePolicy="disk"
              />
              <View style={styles.viewerMeta}>
                <Text style={styles.viewerStage}>{stageLabel(viewerPhoto.stage)}</Text>
                {viewerPhoto.caption ? (
                  <Text style={styles.viewerCaption}>{orderDisplayValue(viewerPhoto.caption)}</Text>
                ) : null}
                <Text style={styles.viewerTime}>{formatUploadedAt(viewerPhoto.uploaded_at)}</Text>
              </View>
              <Pressable
                style={styles.closeBtn}
                onPress={() => setViewerIndex(null)}
                accessibilityRole="button"
                accessibilityLabel="Close photo viewer"
              >
                <Ionicons name="close" size={22} color={COLORS.white} />
              </Pressable>
            </View>
          ) : null}
        </Pressable>
      </Modal>
    </View>
  );
});

ProgressGallery.displayName = "ProgressGallery";
export default ProgressGallery;

const THUMB_SIZE = 96;

const styles = StyleSheet.create({
  wrap: {
    width: "100%",
  },
  list: {
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
  },
  thumbWrap: {
    width: THUMB_SIZE,
    marginRight: SPACING.sm,
  },
  thumb: {
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.grayLight,
  },
  thumbBadge: {
    position: "absolute",
    bottom: 4,
    left: 4,
    right: 4,
    backgroundColor: "rgba(0,0,0,0.6)",
    borderRadius: RADIUS.xs,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  thumbBadgeText: {
    ...TYPOGRAPHY.label.sm,
    color: COLORS.white,
    textTransform: "none",
    letterSpacing: 0,
    textAlign: "center",
  },
  centerBox: {
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: SPACING.lg,
    gap: SPACING.xs,
  },
  errorText: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.error,
  },
  emptyText: {
    ...TYPOGRAPHY.body.md,
    fontWeight: "600",
    color: COLORS.gray,
  },
  emptySubtext: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.gray,
    textAlign: "center",
  },
  retryBtn: {
    marginTop: SPACING.xs,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: RADIUS.full,
  },
  retryText: {
    ...TYPOGRAPHY.label.md,
    color: COLORS.white,
    textTransform: "none",
    letterSpacing: 0,
  },
  viewerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },
  viewerContent: {
    alignItems: "center",
  },
  viewerImage: {
    height: 420,
    borderRadius: RADIUS.md,
  },
  viewerMeta: {
    marginTop: SPACING.md,
    alignItems: "center",
    paddingHorizontal: SPACING.lg,
  },
  viewerStage: {
    ...TYPOGRAPHY.heading.h3,
    color: COLORS.white,
  },
  viewerCaption: {
    ...TYPOGRAPHY.body.md,
    color: COLORS.white,
    opacity: 0.85,
    marginTop: 4,
    textAlign: "center",
  },
  viewerTime: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.white,
    opacity: 0.6,
    marginTop: 6,
  },
  closeBtn: {
    position: "absolute",
    top: -SPACING.xl,
    right: 0,
    padding: SPACING.sm,
  },
});
