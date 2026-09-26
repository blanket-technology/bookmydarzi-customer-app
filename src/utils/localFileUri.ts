import { Directory, File, Paths } from "expo-file-system";

/**
 * expo-image-picker's launchImageLibraryAsync can return a content:// URI
 * on Android (Google's system photo picker, the default backend since
 * Android 13, but reachable on older versions too depending on the
 * device/gallery app) instead of a plain file:// path. React Native's
 * fetch/FormData implementation cannot reliably attach a content:// URI as
 * a multipart part - it fails with "Unsupported FormDataPart
 * implementation" before the request is even sent. Camera captures
 * (launchCameraAsync) normally hand back a real file:// path already, so
 * this only bites gallery-picker flows.
 *
 * Fix: copy the picked asset into the app's own cache directory first -
 * this always yields a real file:// path FormData can attach regardless of
 * what the picker originally returned. Call this on every URI from
 * launchImageLibraryAsync before building a multipart upload; camera-only
 * URIs can skip it (the file:// check below makes it a no-op either way).
 */
export async function toLocalFileUri(uri: string): Promise<string> {
  if (uri.startsWith("file://")) return uri;

  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const source = new File(uri);
  const destination = new File(new Directory(Paths.cache), `upload-${Date.now()}.${extension}`);
  await source.copy(destination);
  return destination.uri;
}
