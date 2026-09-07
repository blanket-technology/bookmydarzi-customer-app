import { create } from "zustand";
import {
    getOrderChatUnreadCount,
    getOrderThread,
    markOrderChatRead,
    sendOrderMessage,
} from "../services/chatService";
import type { OrderChatMessage } from "../types/engagement";

interface OrderThreadState {
  messages: OrderChatMessage[];
  unreadCount: number;
  loading: boolean;
  lastFetched: number | null;
}

interface ChatState {
  /** Per-order chat threads keyed by order id */
  threads: Record<number, OrderThreadState>;
  sending: boolean;
  error: string | null;

  fetchThread: (orderId: number, forceRefresh?: boolean) => Promise<void>;
  sendMessage: (orderId: number, message: string) => Promise<boolean>;
  markRead: (orderId: number) => Promise<void>;
  refreshUnread: (orderId: number) => Promise<void>;
  getMessages: (orderId: number) => OrderChatMessage[];
  clearError: () => void;
  reset: () => void;
}

const CACHE_TTL_MS = 30 * 1000;

const emptyThread: OrderThreadState = {
  messages: [],
  unreadCount: 0,
  loading: false,
  lastFetched: null,
};

export const useChatStore = create<ChatState>((set, get) => ({
  threads: {},
  sending: false,
  error: null,

  fetchThread: async (orderId, forceRefresh = false) => {
    const existing = get().threads[orderId] ?? emptyThread;
    const cacheValid =
      existing.lastFetched !== null && Date.now() - existing.lastFetched < CACHE_TTL_MS;
    if (cacheValid && !forceRefresh) return;
    if (existing.loading) return;

    set((state) => ({
      threads: { ...state.threads, [orderId]: { ...existing, loading: true } },
      error: null,
    }));
    try {
      const thread = await getOrderThread(orderId);
      set((state) => ({
        threads: {
          ...state.threads,
          [orderId]: {
            messages: thread.messages,
            unreadCount: thread.unread_count,
            loading: false,
            lastFetched: Date.now(),
          },
        },
      }));
    } catch (err) {
      set((state) => ({
        threads: {
          ...state.threads,
          [orderId]: { ...(state.threads[orderId] ?? emptyThread), loading: false },
        },
        error: err instanceof Error ? err.message : "Failed to load chat",
      }));
    }
  },

  sendMessage: async (orderId, message) => {
    set({ sending: true, error: null });
    try {
      const msg = await sendOrderMessage(orderId, message);
      set((state) => {
        const t = state.threads[orderId] ?? emptyThread;
        // WS event may have already added this message - dedup by id
        const alreadyAdded = t.messages.some((m) => m.id === msg.id);
        return {
          sending: false,
          threads: {
            ...state.threads,
            [orderId]: { ...t, messages: alreadyAdded ? t.messages : [...t.messages, msg] },
          },
        };
      });
      return true;
    } catch (err) {
      set({
        sending: false,
        error: err instanceof Error ? err.message : "Failed to send message",
      });
      return false;
    }
  },

  markRead: async (orderId) => {
    set((state) => {
      const t = state.threads[orderId] ?? emptyThread;
      return {
        threads: {
          ...state.threads,
          [orderId]: {
            ...t,
            unreadCount: 0,
            messages: t.messages.map((m) => ({ ...m, is_read: true })),
          },
        },
      };
    });
    try {
      await markOrderChatRead(orderId);
    } catch {
      // non-critical
    }
  },

  refreshUnread: async (orderId) => {
    try {
      const count = await getOrderChatUnreadCount(orderId);
      set((state) => {
        const t = state.threads[orderId] ?? emptyThread;
        return { threads: { ...state.threads, [orderId]: { ...t, unreadCount: count } } };
      });
    } catch {
      // non-critical
    }
  },

  getMessages: (orderId) => get().threads[orderId]?.messages ?? [],
  clearError: () => set({ error: null }),
  reset: () => set({ threads: {}, sending: false, error: null }),
}));
