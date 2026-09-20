import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { ActivityIndicator, Image, StyleSheet, Text, TouchableOpacity, View } from "react-native";

export type AttachmentUploadStatus = "uploading" | "success" | "failed";

interface Props {
  uri: string;
  status: AttachmentUploadStatus;
  progress?: number;
  onRetry?: () => void;
  onCancel?: () => void;
}

/** Shown in the composer while an image attachment is uploading/failed,
 * and reused (read-only, no cancel/retry) by MessageBubble to render a
 * sent image message. */
export function AttachmentPreview({ uri, status, progress, onRetry, onCancel }: Props) {
  return (
    <View style={styles.wrap}>
      <Image source={{ uri }} style={styles.image} resizeMode="cover" />
      {status === "uploading" && (
        <View style={styles.overlay}>
          <ActivityIndicator size="small" color="#fff" />
          {typeof progress === "number" && (
            <Text style={styles.progressText}>{Math.round(progress * 100)}%</Text>
          )}
        </View>
      )}
      {status === "failed" && (
        <View style={[styles.overlay, styles.overlayFailed]}>
          <Ionicons name="alert-circle" size={20} color="#fff" />
          {onRetry && (
            <TouchableOpacity onPress={onRetry} style={styles.retryBtn} hitSlop={8}>
              <Ionicons name="refresh" size={12} color="#fff" />
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
      {onCancel && status !== "success" && (
        <TouchableOpacity onPress={onCancel} style={styles.cancelBtn} hitSlop={8}>
          <Ionicons name="close" size={12} color="#fff" />
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: 160,
    height: 160,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#e5e7eb",
  },
  image: { width: "100%", height: "100%" },
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.35)",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  overlayFailed: { backgroundColor: "rgba(185,28,28,0.55)" },
  progressText: { color: "#fff", fontSize: 12, fontWeight: "700" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(0,0,0,0.3)",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  retryText: { color: "#fff", fontSize: 11, fontWeight: "700" },
  cancelBtn: {
    position: "absolute",
    top: 6,
    right: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: "rgba(0,0,0,0.5)",
    alignItems: "center",
    justifyContent: "center",
  },
});
