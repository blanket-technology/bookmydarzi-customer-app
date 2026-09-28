import * as FileSystem from "expo-file-system/legacy";

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
 * what the picker originally returned.
 *
 * Bug fix (v2): the first version of this fix used expo-file-system's new
 * File/Directory class API (`new File(uri).copy(...)`), but that
 * constructor is documented to accept only file:/// URIs - passed a
 * content:// URI (exactly the case this function exists to handle), it
 * silently failed to produce a usable copy, so the original
 * "Unsupported FormDataPart implementation" crash kept happening even
 * after this fix landed. Switched to the older expo-file-system/legacy
 * copyAsync(), whose `from` param is explicitly documented to accept a
 * content:// / SAF URI - already proven to work in this codebase
 * (invoiceService.ts uses this same legacy import for its own file
 * handling).
 */
export async function toLocalFileUri(uri: string): Promise<string> {
  if (uri.startsWith("file://")) return uri;

  const extension = uri.split(".").pop()?.split("?")[0]?.toLowerCase() || "jpg";
  const destination = `${FileSystem.cacheDirectory ?? ""}upload-${Date.now()}.${extension}`;
  await FileSystem.copyAsync({ from: uri, to: destination });
  return destination;
}
