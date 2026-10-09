/**
 * Notifications API - /api/v1/notifications/*
 *
 * In-app notification feed plus push device-token registration.
 * The feed endpoints are pure REST; push token registration is best-effort and
 * only meaningful once a native push module (e.g. expo-notifications) is wired.
 */

import { request } from "../../services/api";
import type {
  AppNotification,
  DevicePlatform,
  DeviceTokenResult,
  NotificationListResult,
} from "../types/engagement";

const BASE = "/notifications";

function unwrap(res: any): any {
  return res?.data ?? res;
}

function mapNotification(raw: any): AppNotification {
  return {
    id: Number(raw?.id ?? raw?.Id ?? 0),
    title: String(raw?.title ?? raw?.Title ?? ""),
    body: String(raw?.body ?? raw?.Body ?? ""),
    type: String(raw?.type ?? raw?.Type ?? "system"),
    data: (raw?.data ?? raw?.Data ?? null) as Record<string, unknown> | null,
    is_read: Boolean(raw?.is_read ?? raw?.IsRead ?? false),
    read_at: raw?.read_at ?? raw?.ReadAt ?? null,
    created_at: String(raw?.created_at ?? raw?.CreatedAt ?? ""),
  };
}

/** GET /notifications - paginated feed with unread count */
export async function listNotifications(
  page = 1,
  limit = 20,
  unreadOnly = false,
): Promise<NotificationListResult> {
  const query = `?page=${page}&limit=${limit}${unreadOnly ? "&unread_only=true" : ""}`;
  const res = await request<any>(`${BASE}${query}`);
  const data = unwrap(res);
  const list = Array.isArray(data?.notifications) ? data.notifications : [];
  return {
    notifications: list.map(mapNotification),
    total: Number(data?.total ?? list.length),
    unread_count: Number(data?.unread_count ?? 0),
    page: Number(data?.page ?? page),
    limit: Number(data?.limit ?? limit),
  };
}

/** GET /notifications/unread-count - badge count */
export async function getUnreadCount(): Promise<number> {
  const res = await request<any>(`${BASE}/unread-count`);
  const data = unwrap(res);
  return Number(data?.unread_count ?? 0);
}

/** PATCH /notifications/{id}/read */
export async function markNotificationRead(id: number): Promise<AppNotification | null> {
  const res = await request<any>(`${BASE}/${id}/read`, { method: "PATCH" });
  const data = unwrap(res);
  return data ? mapNotification(data) : null;
}

/** POST /notifications/read-all - returns number updated */
export async function markAllNotificationsRead(): Promise<number> {
  const res = await request<any>(`${BASE}/read-all`, { method: "POST" });
  const data = unwrap(res);
  return Number(data?.updated ?? 0);
}

/** POST /notifications/device-tokens - register a push token (best-effort) */
export async function registerDeviceToken(
  token: string,
  platform: DevicePlatform = "android",
): Promise<DeviceTokenResult | null> {
  if (!token || token.trim().length < 8) return null;
  const res = await request<any>(`${BASE}/device-tokens`, {
    method: "POST",
    body: { token: token.trim(), platform },
  });
  const data = unwrap(res);
  if (!data) return null;
  return {
    id: Number(data?.id ?? data?.Id ?? 0),
    platform: String(data?.platform ?? data?.Platform ?? platform),
    is_active: Boolean(data?.is_active ?? data?.IsActive ?? true),
    created_at: String(data?.created_at ?? data?.CreatedAt ?? ""),
  };
}

/** DELETE /notifications/device-tokens - unregister a push token */
export async function unregisterDeviceToken(token: string): Promise<void> {
  if (!token) return;
  await request(`${BASE}/device-tokens`, {
    method: "DELETE",
    body: { token: token.trim() },
    // Best-effort and often called during logout - fail fast rather than
    // holding the logout behind the full retry backoff.
    skipRetry: true,
  });
}
