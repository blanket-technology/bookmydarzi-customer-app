import { create } from "zustand";
import type { ChatSession, ChatMessage } from "../services/chatV2Service";
import * as chatService from "../services/chatV2Service";

/** Local-only delivery state for an optimistically-appended message.
 * Not sent by the backend - set/cleared entirely on the client. */
export type PendingDeliveryStatus = "pending" | "sent" | "failed";

export type LocalChatMessage = ChatMessage & {
  deliveryStatus?: PendingDeliveryStatus;
};

interface SupportChatState {
  /** The session this store's state currently belongs to. Every mutating
   * action that's triggered from a WS frame or an async response must
   * check this against the uuid it was scoped to before applying - a
   * previous session's late-arriving event must never write into a newer
   * session's state (this is the client-side half of the "wrong
   * conversation" fix; get_or_create_session on the backend is the other
   * half). Bumped by initSession()/reset() only. */
  sessionUuid: string | null;
  session: ChatSession | null;
  messages: LocalChatMessage[];
  loading: boolean;
  wsStatus: "disconnected" | "connecting" | "connected";
  typingUsers: number[];   // -1 = AI typing
  error: string | null;
  csatPrompt: boolean;
  agentName: string | null;
  /** Highest seq the agent/staff side has read up to (from
   * read_receipt_updated) - used to render "Read" vs "Delivered" on the
   * customer's own messages. Session-level, not per-message, matching what
   * the backend actually tracks (READ_RECEIPTS is one row per user per
   * session, not a per-message flag). */
  peerReadUpToSeq: number;

  initSession: (orderId?: number, issueCategory?: string) => Promise<ChatSession | null>;
  /** Open an existing session directly by uuid (e.g. from a support push
   * notification). Unlike initSession it never creates a session - it loads
   * the one the notification pointed at. */
  openSessionByUuid: (sessionUuid: string) => Promise<ChatSession | null>;
  loadHistory: (beforeSeq?: number) => Promise<void>;
  /** Append/merge a message that belongs to `forSessionUuid`. Silently
   * ignored if the store has since moved on to a different session. */
  appendMessage: (msg: ChatMessage, forSessionUuid: string) => void;
  markMessageStatus: (clientId: string, status: PendingDeliveryStatus) => void;
  removeMessage: (clientId: string) => void;
  setTypingUsers: (users: number[]) => void;
  setWsStatus: (status: SupportChatState["wsStatus"]) => void;
  setCsatPrompt: (show: boolean) => void;
  setSession: (patch: Partial<ChatSession>, forSessionUuid: string) => void;
  setAgentName: (name: string) => void;
  setPeerReadUpToSeq: (seq: number) => void;
  requestHuman: () => Promise<void>;
  submitCsat: (score: number) => Promise<void>;
  clearError: () => void;
  reset: () => void;
}

export const useSupportChatStore = create<SupportChatState>((set, get) => ({
  sessionUuid: null,
  session: null,
  messages: [],
  loading: false,
  wsStatus: "disconnected",
  typingUsers: [],
  error: null,
  csatPrompt: false,
  agentName: null,
  peerReadUpToSeq: 0,

  initSession: async (orderId, issueCategory) => {
    set({ loading: true, error: null, messages: [], agentName: null, sessionUuid: null, peerReadUpToSeq: 0 });
    try {
      const session = await chatService.getOrCreateSession(orderId, issueCategory);
      const { messages } = await chatService.getMessages(session.uuid, 50);
      // Another initSession() may have started and finished while this one
      // was in flight (e.g. rapid remount) - only apply this result if
      // nothing newer has already taken over.
      if (get().sessionUuid !== null && get().sessionUuid !== session.uuid) return get().session;
      set({ session, messages, loading: false, sessionUuid: session.uuid });
      return session;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Failed to start chat" });
      return null;
    }
  },

  openSessionByUuid: async (sessionUuid) => {
    set({ loading: true, error: null, messages: [], agentName: null, sessionUuid: null, peerReadUpToSeq: 0 });
    try {
      const session = await chatService.getSession(sessionUuid);
      const { messages } = await chatService.getMessages(session.uuid, 50);
      // Guard against a newer init/open having taken over while in flight.
      if (get().sessionUuid !== null && get().sessionUuid !== session.uuid) return get().session;
      set({ session, messages, loading: false, sessionUuid: session.uuid });
      return session;
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Failed to open chat" });
      return null;
    }
  },

  loadHistory: async (beforeSeq) => {
    const { session, messages, sessionUuid } = get();
    if (!session) return;
    try {
      const { messages: older } = await chatService.getMessages(session.uuid, 50, beforeSeq);
      if (get().sessionUuid !== sessionUuid) return;
      set({ messages: [...older, ...messages] });
    } catch {
      // non-fatal
    }
  },

  appendMessage: (msg, forSessionUuid) => {
    if (get().sessionUuid !== forSessionUuid) return;
    set((state) => {
      const exists = state.messages.some(
        (m) => m.id === msg.id || (msg.client_id && m.client_id === msg.client_id),
      );
      if (exists) {
        return {
          messages: state.messages.map((m) =>
            m.client_id && m.client_id === msg.client_id
              ? { ...m, ...msg, deliveryStatus: "sent" as const }
              : m,
          ),
        };
      }
      return { messages: [...state.messages, msg] };
    });
  },

  markMessageStatus: (clientId, status) => {
    set((state) => ({
      messages: state.messages.map((m) =>
        m.client_id === clientId ? { ...m, deliveryStatus: status } : m,
      ),
    }));
  },

  removeMessage: (clientId) => {
    set((state) => ({
      messages: state.messages.filter((m) => m.client_id !== clientId),
    }));
  },

  setTypingUsers: (users) => set({ typingUsers: users }),
  setWsStatus: (status) => set({ wsStatus: status }),
  setCsatPrompt: (show) => set({ csatPrompt: show }),

  setSession: (patch, forSessionUuid) => {
    if (get().sessionUuid !== forSessionUuid) return;
    set((state) => ({
      session: state.session ? { ...state.session, ...patch } : state.session,
    }));
  },

  setAgentName: (name) => set({ agentName: name }),
  setPeerReadUpToSeq: (seq) =>
    set((state) => ({ peerReadUpToSeq: Math.max(state.peerReadUpToSeq, seq) })),

  requestHuman: async () => {
    const { session } = get();
    if (!session) return;
    try {
      await chatService.requestHuman(session.uuid);
      // Status update will arrive via WS session_status_changed event
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Could not connect to agent" });
    }
  },

  submitCsat: async (score) => {
    const { session } = get();
    if (!session) return;
    try {
      await chatService.rateSession(session.uuid, score);
      set({ csatPrompt: false });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : "Failed to submit rating" });
    }
  },

  clearError: () => set({ error: null }),

  reset: () =>
    set({
      sessionUuid: null,
      session: null,
      messages: [],
      loading: false,
      wsStatus: "disconnected",
      typingUsers: [],
      error: null,
      csatPrompt: false,
      agentName: null,
      peerReadUpToSeq: 0,
    }),
}));
