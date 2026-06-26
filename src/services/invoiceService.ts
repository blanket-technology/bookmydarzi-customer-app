/**
 * Invoice download — GET /api/v1/orders/{order_id}/invoice
 *
 * The endpoint streams a PDF (application/pdf) and requires the Bearer token, so
 * the JSON `request()` helper cannot be used. We download to the app cache with
 * the auth header, then hand the file to the OS share/preview sheet.
 *
 * Requires `expo-file-system` and `expo-sharing` (run:
 *   npx expo install expo-file-system expo-sharing
 * then rebuild the dev client).
 */

import { getAccessToken } from "../../services/api";
import { buildApiV1Url } from "../config/api";

// expo-file-system and expo-sharing are loaded lazily (only when the user taps
// "Download invoice") so the rest of the app keeps working on a dev client that
// hasn't been rebuilt with these native modules yet.
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

/** Build the absolute, authenticated invoice URL for an order. */
export function getInvoiceUrl(orderId: number): string {
  return buildApiV1Url(`/orders/${orderId}/invoice`);
}

/** Read a FastAPI error body that was downloaded to a file and extract `detail`. */
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
    // body was not JSON (e.g. an actual PDF or empty) — fall back to generic message
  }
  return "";
}

/**
 * Download the order invoice PDF and open the share/preview sheet.
 * Returns the local file URI on success.
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
  const fileUri = `${FileSystem.cacheDirectory ?? ""}invoice-${safeName}.pdf`;

  const result = await FileSystem.downloadAsync(url, fileUri, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/pdf" },
  });

  if (result.status !== 200) {
    // On error the body is a JSON error payload (written to the file) — surface
    // the backend's actual reason rather than a generic status message.
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

  const canShare = await Sharing.isAvailableAsync();
  if (canShare) {
    await Sharing.shareAsync(result.uri, {
      mimeType: "application/pdf",
      dialogTitle: "Invoice",
      UTI: "com.adobe.pdf",
    });
  }

  return result.uri;
}
