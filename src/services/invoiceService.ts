/**
 * Invoice download - GET /api/v1/orders/{order_id}/invoice
 *
 * Downloads the PDF with the auth header, then saves it to a user-selected
 * folder via Android's Storage Access Framework (SAF). Falls back to the
 * system share sheet on iOS or when SAF is unavailable.
 */

import { getAccessToken } from "../../services/api";
import { buildApiV1Url } from "../config/api";

async function loadNativeModules() {
  try {
    const FileSystem = await import("expo-file-system/legacy");
    const Sharing = await import("expo-sharing");
    return { FileSystem, Sharing };
  } catch {
    throw new Error(
      "Invoice download needs a new app build. Rebuild the dev client after installing expo-file-system and expo-sharing.",
    );
  }
}

export function getInvoiceUrl(orderId: number): string {
  return buildApiV1Url(`/orders/${orderId}/invoice`);
}

async function readErrorDetail(
  FileSystem: { readAsStringAsync: (uri: string) => Promise<string> },
  fileUri: string,
): Promise<string> {
  try {
    const body = await FileSystem.readAsStringAsync(fileUri);
    const parsed = JSON.parse(body);
    const detail = parsed?.detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail[0]?.msg) return String(detail[0].msg);
    if (typeof parsed?.message === "string") return parsed.message;
  } catch {
    // body was not JSON - fall back to generic message
  }
  return "";
}

/**
 * Download the invoice PDF and save it to a user-chosen folder via SAF
 * (Android). Falls back to the system share sheet if SAF is unavailable.
 * Returns the final saved URI on success.
 */
export async function downloadAndShareInvoice(
  orderId: number,
  orderNumber?: string | null,
): Promise<string> {
  const { FileSystem, Sharing } = await loadNativeModules();

  const token = await getAccessToken();
  if (!token) {
    throw new Error("Please log in again to download your invoice.");
  }

  const url = getInvoiceUrl(orderId);
  const safeName = (orderNumber ?? `order-${orderId}`).replace(/[^a-zA-Z0-9._-]/g, "_");
  const cacheUri = `${FileSystem.cacheDirectory ?? ""}invoice-${safeName}.pdf`;

  // Step 1: download to cache with auth header
  const result = await FileSystem.downloadAsync(url, cacheUri, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
  });

  if (result.status !== 200) {
    const detail = await readErrorDetail(FileSystem, result.uri);
    if (result.status === 404) {
      throw new Error(detail || "Invoice is not available for this order yet.");
    }
    if (result.status === 401 || result.status === 403) {
      throw new Error(detail || "You are not allowed to download this invoice.");
    }
    if (result.status === 422) {
      throw new Error(detail || "Invoice isn't available for this order yet.");
    }
    throw new Error(detail || `Could not download invoice (status ${result.status}).`);
  }

  // Step 2: try SAF (Android) - lets user pick their Downloads folder directly
  try {
    const saf = (FileSystem as any).StorageAccessFramework;
    if (saf && typeof saf.requestDirectoryPermissionsAsync === "function") {
      const permissions = await saf.requestDirectoryPermissionsAsync();
      if (permissions.granted) {
        const destUri: string = await saf.createFileAsync(
          permissions.directoryUri,
          `invoice-${safeName}.pdf`,
          "application/pdf",
        );
        const base64Content: string = await FileSystem.readAsStringAsync(result.uri, {
          encoding: "base64" as any,
        });
        await FileSystem.writeAsStringAsync(destUri, base64Content, {
          encoding: "base64" as any,
        });
        return destUri;
      }
      // User cancelled the folder picker - fall through to sharing
    }
  } catch {
    // SAF not available on this device/OS version - fall through to sharing
  }

  // Step 3: fallback - open share / preview sheet (iOS or SAF unavailable)
  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Save Invoice",
      UTI: "com.adobe.pdf",
    });
  }

  return result.uri;
}
