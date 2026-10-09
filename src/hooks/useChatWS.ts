import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { resolveApiOrigin } from "../../services/api";
import { useAuthStore } from "../../store/useAuthStore";
import { useToastStore } from "../store/useToastStore";
import type { ChatMessage } from "../services/chatV2Service";
import { useSupportChatStore } from "../store/useSupportChatStore";

/** How long to wait for the backend to echo back a sent message (as a
 * message_created frame carrying the same client_id) before marking it
 * failed. Generous enough to tolerate normal network latency, short enough
 * that a genuinely lost message doesn't sit silently "pending" forever. */
const SEND_ACK_TIMEOUT_MS = 10000;

export function useChatWS(sessionUuid: string | null) {
  const ws = useRef<WebSocket | null>(null);
  const reconnectDelay = useRef(1000);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);
  const consecutiveFailures = useRef(0);
  // connect() calls itself (via socket.onclose's reconnect timer) before
  // its own useCallback has finished being assigned on the first render -
  // react-hooks/immutability (React Compiler) flags this as "accessed
  // before declared" since it can't statically prove the closure always
  // resolves to the latest version. Indirecting through a ref (updated
  // right after connect is defined below) sidesteps that entirely and is
  // the standard pattern for a self-reconnecting callback.
  const connectRef = useRef<() => void>(() => {});
  // client_id -> ack timer, so a late/duplicate ack or a resend can clear
  // the right timer without racing a stale one from a previous attempt.
  const pendingAcks = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
  // Fallback "AI stopped typing" timer - cleared and reset on every
  // ai_typing event so overlapping dispatches never race each other, and
  // cleared immediately once the AI's actual reply arrives.
  const aiTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    appendMessage,
    markMessageStatus,
    setTypingUsers,
    setWsStatus,
    setSession,
    setAgentName,
    setCsatPrompt,
    setPeerReadUpToSeq,
  } = useSupportChatStore();

  const clearAckTimer = useCallback((clientId: string) => {
    const timer = pendingAcks.current.get(clientId);
    if (timer) {
      clearTimeout(timer);
      pendingAcks.current.delete(clientId);
    }
  }, []);

  const handleFrame = useCallback(
    (frame: Record<string, any>) => {
      if (!sessionUuid) return;
      if (__DEV__) console.log("[ChatWS] recv", frame.event, frame);
      switch (frame.event) {
        case "message_created":
          if (frame.message) {
            const msg = frame.message as ChatMessage;
            if (msg.client_id) clearAckTimer(msg.client_id);
            if (msg.sender_type === "ai" && aiTypingTimer.current) {
              // The AI's actual reply arrived - stop showing "typing"
              // immediately rather than waiting out the fallback timer
              // (which exists only in case the reply never arrives).
              clearTimeout(aiTypingTimer.current);
              aiTypingTimer.current = null;
              setTypingUsers([]);
            }
            appendMessage(msg, sessionUuid);
          }
          break;

        case "ai_typing":
          if (aiTypingTimer.current) clearTimeout(aiTypingTimer.current);
          setTypingUsers([-1]);
          aiTypingTimer.current = setTimeout(() => {
            aiTypingTimer.current = null;
            setTypingUsers([]);
          }, 8000);
          break;

        case "typing_indicator": {
          // The backend broadcasts typing_indicator to every subscriber of
          // the session, including the sender themselves - without this
          // self-id check, the customer's own typing_start echoes straight
          // back and renders as if the AI/agent were typing while THEY are
          // the one typing.
          const selfId = Number(useAuthStore.getState().user?.id);
          if (frame.user_id === selfId) break;
          setTypingUsers(frame.is_typing ? [frame.user_id] : []);
          break;
        }

        case "read_receipt_updated": {
          // Only the counterparty's receipt matters for "Read" on our own
          // bubbles - our own read_receipt echoes back here too (we're in
          // the same session broadcast group), and applying our own
          // last_read_seq to our own messages would be meaningless.
          const selfId = Number(useAuthStore.getState().user?.id);
          if (frame.user_id !== selfId && typeof frame.last_read_seq === "number") {
            setPeerReadUpToSeq(frame.last_read_seq);
          }
          break;
        }

        case "session_status_changed":
          if (frame.status) setSession({ status: frame.status }, sessionUuid);
          break;

        case "session_assigned":
          setSession({ status: "assigned" }, sessionUuid);
          if (frame.agent_name) setAgentName(frame.agent_name);
          break;

        case "session_resolved":
          setSession({ status: "resolved" }, sessionUuid);
          if (frame.csat_prompt) setCsatPrompt(true);
          break;

        case "send_failed":
          if (frame.client_id) {
            clearAckTimer(frame.client_id);
            markMessageStatus(frame.client_id, "failed");
          }
          break;

        case "rate_limited": {
          // No client_id on this frame (chat_ws.py's rate limiter fires
          // before the message is parsed) - fail whichever message is
          // still pending so its Retry button becomes available instead of
          // it silently sitting "Sending..." until the ack timeout.
          const pending = useSupportChatStore.getState().messages.find((m) => m.deliveryStatus === "pending");
          if (pending?.client_id) {
            clearAckTimer(pending.client_id);
            markMessageStatus(pending.client_id, "failed");
          }
          useToastStore.getState().show(frame.message ?? "Too many messages. Please slow down.", "error");
          break;
        }

        case "pong":
          break;
      }
    },
    [sessionUuid, appendMessage, clearAckTimer, markMessageStatus, setTypingUsers, setSession, setAgentName, setCsatPrompt, setPeerReadUpToSeq],
  );

  // Sends over the current socket if open, tracking pending/failed status
  // in the store either way - shared by the public sendMessage() and the
  // auto-resend-on-reconnect path in connect()'s onopen handler below.
  const dispatchSend = useCallback(
    (body: string, clientId: string, messageType = "text", attachmentId?: string) => {
      clearAckTimer(clientId);
      markMessageStatus(clientId, "pending");

      const isOpen = ws.current?.readyState === WebSocket.OPEN;
      if (__DEV__) {
        console.log("[ChatWS] send", { clientId, isOpen, readyState: ws.current?.readyState, sessionUuid });
      }
      if (isOpen) {
        ws.current!.send(JSON.stringify({
          event: "send_message",
          session_uuid: sessionUuid,
          body,
          client_id: clientId,
          message_type: messageType,
          ...(attachmentId ? { attachment_id: attachmentId } : {}),
        }));
      }

      // Always arm the ack timer, even when the socket isn't open right
      // now - a message must never sit in "pending" forever. If the
      // socket is closed, this is what turns it into "failed" (with a
      // Retry button) after SEND_ACK_TIMEOUT_MS instead of relying purely
      // on a future reconnect that may not happen soon, or at all.
      const timer = setTimeout(() => {
        pendingAcks.current.delete(clientId);
        markMessageStatus(clientId, "failed");
      }, SEND_ACK_TIMEOUT_MS);
      pendingAcks.current.set(clientId, timer);
      return isOpen;
    },
    [sessionUuid, clearAckTimer, markMessageStatus],
  );

  const connect = useCallback(() => {
    if (!sessionUuid || !mounted.current) return;

    // Never leave a previous socket alive when opening a new one - the old
    // one would keep delivering frames (duplicate messages) with nothing
    // holding a reference to close it. Its onclose is ignored below because
    // ws.current no longer points at it.
    const previous = ws.current;
    if (previous) {
      ws.current = null;
      try {
        previous.close();
      } catch {
        // already closed
      }
    }

    // Read token from the auth store's in-memory state - always current,
    // no async SecureStore read needed.
    const token = useAuthStore.getState().accessToken;
    if (!token) {
      // Not logged in - don't attempt connection
      return;
    }

    setWsStatus("connecting");

    const origin = resolveApiOrigin().replace(/^http/, "ws");
    // Token sent in a post-connect auth frame, not the URL (keeps it out of logs).
    const url = `${origin}/api/v1/ws/chat/${sessionUuid}`;
    if (__DEV__) console.log("[ChatWS] connecting", url);
    const socket = new WebSocket(url);
    ws.current = socket;

    socket.onopen = () => {
      if (__DEV__) console.log("[ChatWS] onopen");
      if (!mounted.current) return;
      try { socket.send(JSON.stringify({ type: "auth", token })); } catch {}
      reconnectDelay.current = 1000;
      consecutiveFailures.current = 0;
      setWsStatus("connected");
      const hb = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ event: "ping", ts: Date.now() }));
        }
      }, 20000);
      (socket as any)._heartbeat = hb;

      // Auto-resend anything that never got acked before the connection
      // dropped (queued while offline, or in flight when the socket died).
      // Reads the store directly rather than depending on `messages` here
      // to avoid reconnecting the socket every time a new message arrives.
      const { messages } = useSupportChatStore.getState();
      for (const m of messages) {
        if ((m.deliveryStatus === "pending" || m.deliveryStatus === "failed") && m.client_id) {
          dispatchSend(m.body ?? "", m.client_id, m.message_type, m.metadata?.attachment_id);
        }
      }
    };

    socket.onmessage = (e) => {
      try {
        handleFrame(JSON.parse(e.data));
      } catch {
        // ignore malformed frames
      }
    };

    socket.onclose = (e) => {
      if (__DEV__) console.log("[ChatWS] onclose", { code: e.code, reason: e.reason });
      clearInterval((socket as any)._heartbeat);
      // A socket that was replaced (session switch / re-connect) or torn
      // down on unmount must not schedule a reconnect of its own - doing so
      // opened a second live socket next to the current one.
      if (ws.current !== socket) return;
      if (!mounted.current) return;
      setWsStatus("disconnected");
      consecutiveFailures.current += 1;
      reconnectTimer.current = setTimeout(() => {
        reconnectDelay.current = Math.min(reconnectDelay.current * 2, 30000);
        // After repeated failures the access token may simply have expired
        // (it is only refreshed when some HTTP call 401s). Make one cheap
        // authenticated call first so the refresh flow runs and connect()
        // picks up the fresh token from the auth store.
        if (consecutiveFailures.current >= 2) {
          useAuthStore
            .getState()
            .fetchProfile()
            .catch(() => {})
            .finally(() => {
              if (mounted.current) connectRef.current();
            });
          return;
        }
        connectRef.current();
      }, reconnectDelay.current);
    };

    socket.onerror = (e) => {
      if (__DEV__) console.log("[ChatWS] onerror", e);
      socket.close();
    };
  }, [sessionUuid, handleFrame, setWsStatus, dispatchSend]);

  useLayoutEffect(() => {
    connectRef.current = connect;
  });

  useEffect(() => {
    mounted.current = true;
    if (sessionUuid) connect();
    return () => {
      mounted.current = false;
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
      if (aiTypingTimer.current) {
        clearTimeout(aiTypingTimer.current);
        aiTypingTimer.current = null;
      }
      const current = ws.current;
      ws.current = null;
      current?.close();
    };
  }, [sessionUuid, connect]);

  // Public send: marks the message pending immediately even if the socket
  // is closed (offline) rather than silently dropping it - the caller's
  // optimistic message stays visible with a pending/failed indicator
  // instead of vanishing, and connect()'s onopen will auto-resend it.
  const sendMessage = useCallback(
    (body: string, clientId: string, messageType = "text", attachmentId?: string) =>
      dispatchSend(body, clientId, messageType, attachmentId),
    [dispatchSend],
  );

  const sendTypingStart = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify({ event: "typing_start", session_uuid: sessionUuid }));
  }, [sessionUuid]);

  const sendTypingStop = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN)
      ws.current.send(JSON.stringify({ event: "typing_stop", session_uuid: sessionUuid }));
  }, [sessionUuid]);

  const sendReadReceipt = useCallback(
    (lastSeq: number) => {
      if (ws.current?.readyState === WebSocket.OPEN)
        ws.current.send(JSON.stringify({ event: "read_receipt", session_uuid: sessionUuid, last_read_seq: lastSeq }));
    },
    [sessionUuid],
  );

  // Explicit user-triggered retry for a failed message (e.g. a "Retry"
  // tap on a failed bubble) - same underlying send as the automatic
  // reconnect resend, just triggered on demand instead of on socket open.
  const retryMessage = useCallback(
    (body: string, clientId: string, messageType = "text", attachmentId?: string) =>
      dispatchSend(body, clientId, messageType, attachmentId),
    [dispatchSend],
  );

  useEffect(() => {
    const acks = pendingAcks.current;
    return () => {
      acks.forEach((timer) => clearTimeout(timer));
      acks.clear();
      if (aiTypingTimer.current) clearTimeout(aiTypingTimer.current);
    };
  }, []);

  return { sendMessage, sendTypingStart, sendTypingStop, sendReadReceipt, retryMessage };
}
