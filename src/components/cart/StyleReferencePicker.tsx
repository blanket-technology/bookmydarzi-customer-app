import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { ActivityIndicator, Image, LayoutAnimation, Platform, StyleSheet, Text, TouchableOpacity, UIManager, View } from "react-native";
import { COLORS, RADIUS } from "../../../constants/theme";

if (Platform.OS === "android" && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export interface StyleReferencePickerProps {
  /** Local preview uri (shown immediately after picking, before upload
   * finishes) or the final uploaded https:// url - either way, "a photo is
   * attached" from this component's point of view. */
  uri: string | null;
  onPick: () => void;
  onRemove: () => void;
  /** True while the picked photo is uploading in the background (the
   * screen's own handlePickStyleReference does pick+upload; this only
   * reflects that state for the thumbnail spinner). */
  uploading?: boolean;
}

/**
 * Optional style-reference upload, collapsed by default (matches Swiggy/
 * Blinkit/Urban Company "optional add-on" pattern) - a one-line prompt that
 * expands into the upload UI only on tap, and collapses back into a compact
 * confirmation row once a photo is attached.
 */
export default function StyleReferencePicker({ uri, onPick, onRemove, uploading = false }: StyleReferencePickerProps) {
  const [expanded, setExpanded] = useState(false);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  if (uri) {
    return (
      <View style={styles.addedRow}>
        <View>
          <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
          {uploading ? (
            <View style={styles.thumbOverlay}>
              <ActivityIndicator size="small" color="#fff" />
            </View>
          ) : null}
        </View>
        <View style={styles.addedTextWrap}>
          <View style={styles.addedTitleRow}>
            <Ionicons
              name={uploading ? "cloud-upload-outline" : "checkmark-circle"}
              size={13}
              color={uploading ? "#0c6c75" : "#16a34a"}
            />
            <Text style={styles.addedTitle}>
              {uploading ? "Uploading style reference…" : "Style reference added"}
            </Text>
          </View>
          <View style={styles.addedActions}>
            <TouchableOpacity onPress={onPick} hitSlop={8} disabled={uploading}>
              <Text style={[styles.actionLink, uploading && styles.actionLinkDisabled]}>Change photo</Text>
            </TouchableOpacity>
            <Text style={styles.actionDivider}>·</Text>
            <TouchableOpacity onPress={onRemove} hitSlop={8} disabled={uploading}>
              <Text
                style={[
                  styles.actionLink,
                  styles.removeLink,
                  uploading && styles.actionLinkDisabled,
                ]}
              >
                Remove
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.promptRow}
        onPress={toggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons name="image-outline" size={14} color="#0c6c75" />
        <Text style={styles.promptText}>Want to add a style reference?</Text>
        <View style={styles.promptCta}>
          <Text style={styles.promptCtaText}>{expanded ? "Close" : "Add Photo"}</Text>
          <Ionicons
            name={expanded ? "chevron-up" : "chevron-forward"}
            size={13}
            color="#0c6c75"
          />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <TouchableOpacity style={styles.uploadBox} onPress={onPick} activeOpacity={0.8}>
          <Ionicons name="cloud-upload-outline" size={18} color="#0c6c75" />
          <Text style={styles.uploadBoxText}>Upload a photo or sketch of the look you want</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
  },
  promptText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: COLORS.gray,
  },
  promptCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  promptCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0c6c75",
  },
  uploadBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderWidth: 1.5,
    borderColor: "#0c6c75",
    borderStyle: "dashed",
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F0FDFB",
    marginBottom: 4,
  },
  uploadBoxText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#0c6c75",
  },

  addedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  thumb: {
    width: 36,
    height: 36,
    borderRadius: RADIUS.sm,
    backgroundColor: COLORS.grayLight,
  },
  thumbOverlay: {
    ...StyleSheet.absoluteFill,
    borderRadius: RADIUS.sm,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  addedTextWrap: { flex: 1, gap: 3 },
  addedTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  addedTitle: { fontSize: 12.5, fontWeight: "700", color: COLORS.black },
  addedActions: { flexDirection: "row", alignItems: "center", gap: 6 },
  actionLink: { fontSize: 11.5, fontWeight: "600", color: "#0c6c75" },
  actionLinkDisabled: { opacity: 0.5 },
  actionDivider: { fontSize: 11.5, color: COLORS.grayBorder },
  removeLink: { color: COLORS.error },
});
