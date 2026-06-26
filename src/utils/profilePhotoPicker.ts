import * as ImagePicker from "expo-image-picker";

export const PROFILE_PHOTO_PICKER_REBUILD_MSG =
  "Install a fresh dev build that includes expo-image-picker:\n\n  eas build --profile development --platform android\n\nThen uninstall the old app, install the new APK, and run:\n  npx expo start --dev-client -c";

export class ProfilePhotoPickerUnavailableError extends Error {
  constructor(message = PROFILE_PHOTO_PICKER_REBUILD_MSG) {
    super(message);
    this.name = "ProfilePhotoPickerUnavailableError";
  }
}

type ImagePickerApi = typeof ImagePicker;

/** Metro/CJS interop: named exports may be on `.default`. */
function resolveImagePicker(): ImagePickerApi {
  if (typeof ImagePicker.requestMediaLibraryPermissionsAsync === "function") {
    return ImagePicker;
  }
  const nested = (ImagePicker as { default?: ImagePickerApi }).default;
  if (nested && typeof nested.requestMediaLibraryPermissionsAsync === "function") {
    return nested;
  }
  throw new ProfilePhotoPickerUnavailableError();
}

function isNativeModuleError(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err);
  return (
    msg.includes("ExponentImagePicker") ||
    msg.includes("native module") ||
    msg.includes("Native module")
  );
}

/**
 * Open the gallery and return a local image URI, or null if cancelled.
 */
export async function pickProfilePhotoFromLibrary(): Promise<string | null> {
  try {
    const picker = resolveImagePicker();

    const perm = await picker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      throw new Error("PERMISSION_DENIED");
    }

    const result = await picker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || !result.assets?.[0]?.uri) {
      return null;
    }

    return result.assets[0].uri;
  } catch (err: unknown) {
    if (err instanceof ProfilePhotoPickerUnavailableError) {
      throw err;
    }
    if (isNativeModuleError(err)) {
      throw new ProfilePhotoPickerUnavailableError();
    }
    throw err;
  }
}
