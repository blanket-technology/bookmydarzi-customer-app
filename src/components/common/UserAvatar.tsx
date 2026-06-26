import React, { memo } from "react";
import { View, Text, StyleSheet, type StyleProp, type ViewStyle } from "react-native";
import { Image } from "expo-image";
import { useAuthStore } from "../../../store/useAuthStore";
import { normalizeProfileImageUrl } from "../../utils/profileImage";
import { COLORS, SHADOW } from "../../../constants/theme";

export function getUserInitials(
  firstName?: string,
  lastName?: string,
  name?: string,
): string {
  const first = firstName?.trim()?.[0];
  const last = lastName?.trim()?.[0];
  if (first && last) return `${first}${last}`.toUpperCase();
  if (first) return first.toUpperCase();
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return parts[0][0].toUpperCase();
  }
  return "U";
}

type UserAvatarProps = {
  /** Diameter in px (default 40). */
  size?: number;
  /** Optional URI override (e.g. local preview while uploading). */
  imageUri?: string | null;
  style?: StyleProp<ViewStyle>;
};

function UserAvatarComponent({ size = 40, imageUri, style }: UserAvatarProps) {
  const user = useAuthStore((s) => s.user);
  const resolvedUri =
    imageUri !== undefined && imageUri !== null
      ? imageUri.startsWith("file://") || imageUri.startsWith("content://")
        ? imageUri
        : normalizeProfileImageUrl(imageUri)
      : normalizeProfileImageUrl(user?.profile_image ?? null);
  const initials = getUserInitials(user?.first_name, user?.last_name, user?.name);
  const radius = size / 2;

  return (
    <View
      style={[
        styles.circle,
        {
          width: size,
          height: size,
          borderRadius: radius,
        },
        style,
      ]}
    >
      {resolvedUri ? (
        <Image
          key={resolvedUri}
          source={{ uri: resolvedUri }}
          style={{ width: size, height: size, borderRadius: radius }}
          contentFit="cover"
        />
      ) : (
        <Text style={[styles.initials, { fontSize: Math.round(size * 0.38) }]}>
          {initials}
        </Text>
      )}
    </View>
  );
}

export const UserAvatar = memo(UserAvatarComponent);

const styles = StyleSheet.create({
  circle: {
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
    ...SHADOW.card,
  },
  initials: {
    fontWeight: "700",
    color: COLORS.primaryDark,
  },
});
