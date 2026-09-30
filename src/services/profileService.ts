import { request, API_V1_BASE_URL, getAccessToken } from "../../services/api";
import { normalizeProfileImageUrl } from "../utils/profileImage";
import { toLocalFileUri } from "../utils/localFileUri";
import {
  normalizeTenDigitMobile,
  parseMobileFromProfileApi,
} from "../utils/userPhone";
import type { Measurements, ProfileUpdatePayload } from "../types";

export interface ProfileUpdateResult {
  savedPhone: string;
  raw: unknown;
}

/** JSON profile fields only - never send multipart here. Uses shared `request()` auth + refresh. */
export async function updateProfile(
  _userId: string,
  payload: ProfileUpdatePayload,
): Promise<ProfileUpdateResult> {
  const body: Record<string, unknown> = {};
  if (payload.first_name !== undefined) body.first_name = payload.first_name;
  if (payload.last_name !== undefined) body.last_name = payload.last_name;
  if (payload.email !== undefined) body.email = payload.email;
  const phoneRaw =
    payload.mobile ?? payload.phone ?? payload.Mobile ?? payload.phone_number;
  if (phoneRaw !== undefined) {
    const digits = normalizeTenDigitMobile(phoneRaw);
    if (digits) {
      // Same snake_case style as email / first_name on PATCH.
      body.mobile = digits;
    }
  }
  if (payload.gender !== undefined) body.gender = payload.gender;
  if (payload.address !== undefined) body.address = payload.address;
  if (payload.profile_image !== undefined) body.profile_image = payload.profile_image;

  const res = await request<unknown>("/users/profile", { method: "PATCH", body });
  const raw = (res as { data?: unknown })?.data ?? res;
  return { savedPhone: parseMobileFromProfileApi(raw), raw };
}

/** Soft-deletes the current user's own account (DELETE /users/me - backend
 * sets IsDeleted=True, IsActive=False; see delete_own_account in
 * app/services/users/user_management_service.py). Irreversible from the
 * customer's side - the caller must log the user out immediately after. */
export async function deleteAccount(): Promise<void> {
  await request<unknown>("/users/me", { method: "DELETE" });
}

export interface ReferralCode {
  code: string;
  referred_count: number;
  status: "unused" | "pending" | "rewarded";
}

/** The current user's own referral code - created lazily server-side on
 * first request (see get_or_create_referral_code in
 * app/services/referrals/referral_service.py). */
export async function getMyReferralCode(): Promise<ReferralCode> {
  return request<ReferralCode>("/users/me/referral-code");
}

/** Redeems a friend's referral code, once per account ever. Both sides'
 * Rs.100-off reward fires automatically once THIS user's first order
 * completes - nothing further to claim here. */
export async function applyReferralCode(code: string): Promise<{ message: string }> {
  return request<{ message: string }>("/users/me/apply-referral-code", {
    method: "POST",
    body: { code: code.trim().toUpperCase() },
  });
}

export async function updateMeasurements(
  _userId: string,
  measurements: Measurements,
): Promise<Measurements> {
  const res = await request<Measurements | { data: Measurements }>(
    "/users/measurements",
    { method: "PUT", body: measurements as unknown as Record<string, unknown> },
  );
  return (res as any).data ?? res;
}

function imageFileFromUri(localUri: string): { uri: string; name: string; type: string } {
  const extension = localUri.split(".").pop()?.split("?")[0]?.toLowerCase();
  if (extension === "png") {
    return { uri: localUri, name: "file.png", type: "image/png" };
  }
  if (extension === "webp") {
    return { uri: localUri, name: "file.webp", type: "image/webp" };
  }
  return { uri: localUri, name: "file.jpg", type: "image/jpeg" };
}

function parseUploadError(data: unknown, status: number): string {
  const detail = (data as { detail?: string | { msg?: string }[] })?.detail;
  if (Array.isArray(detail)) {
    return detail.map((d) => d?.msg ?? String(d)).join("\n");
  }
  if (typeof detail === "string") return detail;
  return (
    (data as { message?: string })?.message ?? `Upload failed (${status})`
  );
}

function extractUploadedImageUrl(res: unknown): string | null {
  const raw = (res as { data?: unknown })?.data ?? res;
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const nested = r.user;
  const fromUser =
    nested && typeof nested === "object"
      ? (nested as Record<string, unknown>).profile_image ??
        (nested as Record<string, unknown>).profile_image_url
      : null;

  const url =
    fromUser ??
    r.profile_image ??
    r.profile_image_url ??
    r.ProfileImageUrl ??
    r.ProfileImage ??
    r.avatar ??
    r.url;

  return typeof url === "string" && url.trim().length > 0 ? url.trim() : null;
}

/** Bearer auth on multipart upload; retries once after token refresh (same as `request()`). */
async function authenticatedMultipartFetch(
  endpoint: string,
  form: FormData,
): Promise<Response> {
  let token = await getAccessToken();
  if (!token) throw new Error("Please log in to update your profile photo.");

  const url = `${API_V1_BASE_URL}${endpoint}`;
  const doFetch = (accessToken: string) =>
    fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/json",
      },
      body: form,
    });

  let response = await doFetch(token);

  if (response.status === 401) {
    try {
      await request("/users/profile");
    } catch {
      throw new Error("Session expired. Please log in again.");
    }
    token = await getAccessToken();
    if (!token) throw new Error("Session expired. Please log in again.");
    response = await doFetch(token);
  }

  return response;
}

/** POST /users/profile/photo - multipart field `file` only. */
async function uploadProfilePhotoFile(localUri: string): Promise<string | null> {
  const normalizedUri = await toLocalFileUri(localUri);
  const form = new FormData();
  form.append("file", imageFileFromUri(normalizedUri) as unknown as Blob);

  const response = await authenticatedMultipartFetch("/users/profile/photo", form);
  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(parseUploadError(data, response.status));
  }

  return extractUploadedImageUrl(data);
}

/**
 * Upload image file, optionally PATCH JSON profile_image URL.
 * Returns normalized image URL for immediate UI sync, or null if only GET can provide it.
 */
export async function uploadProfileAvatar(
  localUri: string,
  userId = "",
): Promise<string | null> {
  const imageUrl = await uploadProfilePhotoFile(localUri);
  const patchUrl = imageUrl ? normalizeProfileImageUrl(imageUrl) : null;

  if (patchUrl) {
    await updateProfile(userId, { profile_image: patchUrl });
    return patchUrl;
  }

  return null;
}
