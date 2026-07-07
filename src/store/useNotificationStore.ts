import { create } from "zustand";
import type { AppNotification } from "../types/engagement";
import {
  getUnreadCount,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from "../services/notificationService";

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  total: number;
  page: number;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  lastFetched: number | null;

  fetchNotifications: (forceRefresh?: boolean) => Promise<void>;
  fetchUnreadCount: () => Promise<void>;
  markRead: (id: number) => Promise<void>;
  markAllRead: () => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

const CACHE_TTL_MS = 60 * 1000;

export const useNotificationStore = create<NotificationState>((set, get) => ({
  notifications: [],
  unreadCount: 0,
  total: 0,
  page: 1,
  loading: false,
  refreshing: false,
  error: null,
  lastFetched: null,

  fetchNotifications: async (forceRefresh = false) => {
    const { lastFetched, loading } = get();
    const cacheValid = lastFetched !== null && Date.now() - lastFetched < CACHE_TTL_MS;
    if (cacheValid && !forceRefresh) return;
    if (loading) return;

    set(forceRefresh ? { refreshing: true, error: null } : { loading: true, error: null });
    try {
      const result = await listNotifications(1, 30);
      set({
        notifications: result.notifications,
        unreadCount: result.unread_count,
        total: result.total,
        page: result.page,
        loading: false,
        refreshing: false,
        lastFetched: Date.now(),
      });
    } catch (err) {
      set({
        loading: false,
        refreshing: false,
        error: err instanceof Error ? err.message : "Failed to load notifications",
      });
    }
  },

  fetchUnreadCount: async () => {
    try {
      const count = await getUnreadCount();
      set({ unreadCount: count });
    } catch {
      // Badge count is non-critical - ignore failures
    }
  },

  markRead: async (id) => {
    const prev = get().notifications;
    set({
      notifications: prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      unreadCount: Math.max(0, get().unreadCount - (prev.find((n) => n.id === id && !n.is_read) ? 1 : 0)),
    });
    try {
      await markNotificationRead(id);
    } catch {
      // Revert on failure
      set({ notifications: prev });
    }
  },

  markAllRead: async () => {
    const prev = get().notifications;
    set({ notifications: prev.map((n) => ({ ...n, is_read: true })), unreadCount: 0 });
    try {
      await markAllNotificationsRead();
    } catch {
      set({ notifications: prev });
    }
  },

  clearError: () => set({ error: null }),
  reset: () =>
    set({
      notifications: [],
      unreadCount: 0,
      total: 0,
      page: 1,
      loading: false,
      refreshing: false,
      error: null,
      lastFetched: null,
    }),
}));
