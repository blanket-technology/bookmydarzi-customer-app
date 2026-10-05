import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    KeyboardAvoidingView, Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useChatWS } from "../../hooks/useChatWS";
import { useNetworkStatus } from "../../hooks/useNetworkStatus";
import { uploadChatAttachment } from "../../services/chatV2Service";
import type { LocalChatMessage } from "../../store/useSupportChatStore";
import { useSupportChatStore } from "../../store/useSupportChatStore";
import { useToastStore } from "../../store/useToastStore";
import { ChatSkeleton } from "./ChatSkeleton";
import { CsatModal } from "./CsatModal";
import { DateSeparator, formatDateSeparator } from "./DateSeparator";
import { MessageBubble } from "./MessageBubble";
import { PinnedOrderCard } from "./PinnedOrderCard";
import { StarterChips } from "./StarterChips";
import { MessageInput } from "./MessageInput";
import { TypingIndicator } from "./TypingIndicator";
const genId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

/** Consecutive messages from the same sender within this window collapse
 * their avatar/sender-label (message grouping - Intercom/Uber Support
 * style, not a chronological "same minute" rule). */
const GROUP_WINDOW_MS = 5 * 60 * 1000;

type DisplayItem =
  | { kind: "date"; key: string; label: string }
  | { kind: "message"; key: string; message: LocalChatMessage; showSenderMeta: boolean };

function buildDisplayItems(messages: LocalChatMessage[]): DisplayItem[] {
  const items: DisplayItem[] = [];
  let lastDateLabel: string | null = null;
  let prevMessage: LocalChatMessage | null = null;

  for (const message of messages) {
    const dateLabel = formatDateSeparator(message.created_at);
    if (dateLabel && dateLabel !== lastDateLabel) {
      items.push({ kind: "date", key: `date-${dateLabel}-${message.id}`, label: dateLabel });
      lastDateLabel = dateLabel;
      prevMessage = null; // force sender meta after a date break
    }

    const sameSender =
      prevMessage != null &&
      prevMessage.sender_type === message.sender_type &&
      prevMessage.sender_id === message.sender_id &&
      Math.abs(new Date(message.created_at).getTime() - new Date(prevMessage.created_at).getTime()) < GROUP_WINDOW_MS;

    items.push({
      kind: "message",
      key: `${message.id}-${message.client_id ?? ""}`,
      message,
      showSenderMeta: message.sender_type === "system" || !sameSender,
    });
    prevMessage = message;
  }
  return items;
}

interface Props {
  orderId?: number;
  issueCategory?: string;
  /** Open an existing session directly by its uuid (e.g. from a support push
   * notification), instead of get-or-creating one by order. Takes precedence
   * over orderId when set. */
  sessionUuid?: string;
  onClose?: () => void;
}

// ── Offline banner - distinct from wsStatus, which only knows the socket is
// down, not WHY. Device-level connectivity (airplane mode, no signal) is a
// different, more informative signal to show than a permanently-spinning
// send button with no explanation. ──────────────────────────────────────────
function OfflineBanner() {
  return (
    <View style={[banner.root, { backgroundColor: "#fef2f2", borderColor: "#fecaca" }]}>
      <Ionicons name="cloud-offline-outline" size={16} color="#b91c1c" style={{ marginRight: 6 }} />
      <Text style={[banner.text, { color: "#991b1b" }]}>
        You&apos;re offline - messages will send once you&apos;re back online.
      </Text>
    </View>
  );
}

// ── Status banner at top of messages ────────────────────────────────────────
function StatusBanner({ status, agentName }: { status: string; agentName: string | null }) {
  if (status === "pending_human") {
    return (
      <View style={[banner.root, { backgroundColor: "#fffbeb", borderColor: "#fde68a" }]}>
        <ActivityIndicator size="small" color="#d97706" style={{ marginRight: 8 }} />
        <Text style={[banner.text, { color: "#92400e" }]}>
          Finding you an agent - expected response within 2 days.
        </Text>
      </View>
    );
  }
  if (status === "assigned") {
    return (
      <View style={[banner.root, { backgroundColor: "#ecfdf5", borderColor: "#6ee7b7" }]}>
        <Ionicons name="checkmark-circle" size={16} color="#059669" style={{ marginRight: 6 }} />
        <Text style={[banner.text, { color: "#065f46" }]}>
          {agentName ? `${agentName} is here to help` : "A support agent has joined"}
        </Text>
      </View>
    );
  }
  if (status === "resolved") {
    return (
      <View style={[banner.root, { backgroundColor: "#f1f5f9", borderColor: "#e2e8f0" }]}>
        <Ionicons name="checkmark-done" size={16} color="#64748b" style={{ marginRight: 6 }} />
        <Text style={[banner.text, { color: "#475569" }]}>Conversation resolved</Text>
      </View>
    );
  }
  return null;
}

const banner = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    marginHorizontal: 12,
    marginTop: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
  },
  text: { fontSize: 13, fontWeight: "600", flex: 1 },
});

// ── "Talk to our agent" CTA ──────────────────────────────────────────────────
function TalkToAgentBar({ onPress }: { onPress: () => void }) {
  return (
    <TouchableOpacity style={agentBar.root} onPress={onPress} activeOpacity={0.85}>
      <Ionicons name="headset-outline" size={16} color="#0a8c8c" />
      <Text style={agentBar.text}>Not satisfied? Talk to our agent</Text>
      <Ionicons name="chevron-forward" size={14} color="#0a8c8c" />
    </TouchableOpacity>
  );
}

const agentBar = StyleSheet.create({
  root: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: "#e6f7f7",
    borderTopWidth: 1,
    borderTopColor: "#b2e2e2",
  },
  text: { flex: 1, fontSize: 13, fontWeight: "600", color: "#0a8c8c" },
});

// ── Main screen ─────────────────────────────────────────────────────────────
export function SupportChatScreen({ orderId, issueCategory, sessionUuid: initialSessionUuid, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const {
    session,
    messages,
    loading,
    loadingHistory,
    hasMoreHistory,
    wsStatus,
    typingUsers,
    csatPrompt,
    error,
    agentName,
    peerReadUpToSeq,
    initSession,
    openSessionByUuid,
    reset,
    appendMessage,
    setTypingUsers,
    setWsStatus,
    setCsatPrompt,
    submitCsat,
    submitMessageFeedback,
    requestHuman,
    loadHistory,
  } = useSupportChatStore();
  const { isConnected, isResolved } = useNetworkStatus();
  const isOffline = isResolved && !isConnected;
  // KeyboardAvoidingView's "padding" behavior on iOS only pads for the
  // keyboard itself - it has no idea this screen renders its own in-screen
  // header (no native nav header) above the KAV's content, so without an
  // offset the keyboard could cover roughly the header's height worth of
  // the input bar/last messages. Measure the header's actual rendered
  // height instead of guessing a fixed number, since it's content-driven
  // (text/padding), not fixed-height.
  const [headerHeight, setHeaderHeight] = useState(0);

  const listRef = useRef<FlatList<DisplayItem>>(null);
  const sessionUuid = session?.uuid ?? null;
  const { sendMessage, sendTypingStart, sendTypingStop, retryMessage, sendReadReceipt } = useChatWS(sessionUuid);

  // Reset + init on mount. When opened from a support notification we have the
  // session uuid directly - open that exact session; otherwise get-or-create by
  // order as before.
  useEffect(() => {
    reset();
    if (initialSessionUuid) {
      openSessionByUuid(initialSessionUuid);
    } else {
      initSession(orderId, issueCategory);
    }
  }, []);

  // Auto-scroll on new messages - but NOT when the length grew because
  // loadHistory() just prepended older messages (handleLoadMore sets this
  // ref first), since that should keep the user's current scroll position,
  // not yank them back down to the newest message they were scrolling away
  // from to go find.
  const skipNextAutoScrollRef = useRef(false);
  const pendingAutoScrollRef = useRef(false);
  useEffect(() => {
    if (skipNextAutoScrollRef.current) {
      skipNextAutoScrollRef.current = false;
      return;
    }
    if (messages.length > 0) {
      pendingAutoScrollRef.current = true;
    }
  }, [messages.length]);

  // Fires once FlatList's own layout pass for the new content has actually
  // settled - a fixed setTimeout delay was racing against layout on slower
  // devices or messages with an image (AttachmentPreview loads async), so
  // scrollToEnd could fire before the new content's height was accounted
  // for and land short of the true bottom.
  const handleContentSizeChange = useCallback(() => {
    if (pendingAutoScrollRef.current) {
      pendingAutoScrollRef.current = false;
      listRef.current?.scrollToEnd({ animated: true });
    }
  }, []);

  const handleLoadMore = useCallback(() => {
    if (!hasMoreHistory || loadingHistory || messages.length === 0) return;
    const oldestSeq = messages[0]?.seq;
    if (!oldestSeq || oldestSeq <= 0) return;
    skipNextAutoScrollRef.current = true;
    loadHistory(oldestSeq);
  }, [hasMoreHistory, loadingHistory, messages, loadHistory]);

  // Mark read up to the latest non-own message whenever the visible list
  // grows - lets the admin thread show "customer has read this".
  useEffect(() => {
    const incoming = messages.filter((m) => m.sender_type !== "customer" && m.seq > 0);
    if (incoming.length === 0) return;
    const lastSeq = Math.max(...incoming.map((m) => m.seq));
    sendReadReceipt(lastSeq);
  }, [messages, sendReadReceipt]);

  const handleSend = useCallback(
    (text: string) => {
      if (!sessionUuid) return;
      const clientId = genId();
      const optimistic: LocalChatMessage = {
        id: -Date.now(),
        session_uuid: sessionUuid,
        seq: -1,
        sender_type: "customer",
        sender_id: null,
        body: text,
        message_type: "text",
        client_id: clientId,
        metadata: null,
        created_at: new Date().toISOString(),
        deliveryStatus: "pending",
      };
      appendMessage(optimistic, sessionUuid);
      sendMessage(text, clientId);
    },
    [sessionUuid, appendMessage, sendMessage],
  );

  const handleRetry = useCallback(
    (message: LocalChatMessage) => {
      if (!message.client_id) return;
      retryMessage(
        message.body ?? "",
        message.client_id,
        message.message_type,
        message.metadata?.attachment_id,
      );
    },
    [retryMessage],
  );

  const handleSendImage = useCallback(
    async (uri: string) => {
      if (!sessionUuid) return;
      // Previously un-caught: a failed upload (network blip, file too
      // large, backend rejecting the attachment) threw here with no
      // optimistic bubble ever appended and no feedback at all - the
      // customer's tap on the image just did nothing, unlike a failed text
      // send, which shows a retryable bubble. Show the same toast pattern
      // used elsewhere in this app for a failed action.
      let uploaded: { url: string };
      try {
        uploaded = await uploadChatAttachment(uri);
      } catch (err) {
        useToastStore.getState().show(
          err instanceof Error ? err.message : "Couldn't send image. Please try again.",
          "error",
        );
        return;
      }
      const clientId = genId();
      const optimistic: LocalChatMessage = {
        id: -Date.now(),
        session_uuid: sessionUuid,
        seq: -1,
        sender_type: "customer",
        sender_id: null,
        body: null,
        message_type: "image",
        client_id: clientId,
        metadata: { attachment_id: uploaded.url },
        created_at: new Date().toISOString(),
        deliveryStatus: "pending",
      };
      appendMessage(optimistic, sessionUuid);
      sendMessage("", clientId, "image", uploaded.url);
    },
    [sessionUuid, appendMessage, sendMessage],
  );

  const handleRequestAgent = useCallback(async () => {
    await requestHuman();
    // requestHuman() already catches its own failure and sets the store's
    // `error` field (useSupportChatStore.ts) - but the screen only ever
    // rendered that field on the initial "no session yet" error screen, so
    // a failure here (network blip asking for a human agent) previously
    // failed completely silently once a session already existed. Surface
    // it the same way handleSendImage's failure now does.
    const latestError = useSupportChatStore.getState().error;
    if (latestError) {
      useToastStore.getState().show(latestError, "error");
      useSupportChatStore.getState().clearError();
    }
  }, [requestHuman]);

  const sessionStatus = session?.status ?? "ai_handling";
  const isAIHandling = sessionStatus === "ai_handling" || sessionStatus === "open";
  const hasAiReplied = messages.some((m) => m.sender_type === "ai");
  const isClosed = sessionStatus === "resolved" || sessionStatus === "closed";
  const showAgentBar = isAIHandling && hasAiReplied;
  const displayItems = useMemo(() => buildDisplayItems(messages), [messages]);

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: "#fff", paddingTop: insets.top }}>
        <ChatSkeleton />
      </View>
    );
  }

  if (error && !session) {
    return (
      <View style={[styles.centered, { paddingTop: insets.top }]}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryBtn}
          onPress={() => {
            reset();
            if (initialSessionUuid) openSessionByUuid(initialSessionUuid);
            else initSession(orderId, issueCategory);
          }}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.container, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? insets.top + headerHeight : 0}
    >
      {/* Header */}
      <View style={styles.header} onLayout={(e) => setHeaderHeight(e.nativeEvent.layout.height)}>
        {onClose && (
          <TouchableOpacity onPress={onClose} style={styles.backBtn} hitSlop={12}>
            <Ionicons name="arrow-back" size={22} color="#1a1a1a" />
          </TouchableOpacity>
        )}
        <View style={styles.headerCenter}>
          <View style={[
            styles.statusDot,
            { backgroundColor: wsStatus === "connected" ? "#22c55e" : "#d1d5db" },
          ]} />
          <View>
            <Text style={styles.headerTitle}>BMD Support</Text>
            <Text style={[
              styles.headerSub,
              {
                color: isAIHandling ? "#7c3aed"
                  : sessionStatus === "pending_human" ? "#d97706"
                  : sessionStatus === "assigned" ? "#059669"
                  : "#6b7280",
              },
            ]}>
              {isAIHandling
                ? "AI Assistant • replies instantly"
                : sessionStatus === "pending_human"
                ? "Finding an agent..."
                : sessionStatus === "assigned"
                ? (agentName ?? "Support Agent")
                : "Resolved"}
            </Text>
          </View>
        </View>
      </View>

      {orderId && (
        <PinnedOrderCard
          orderId={orderId}
          issueCategory={issueCategory ?? session?.issue_category}
          onChangeOrder={() => router.push("/support-order-picker" as never)}
        />
      )}

      {/* Session status banner */}
      {isOffline ? <OfflineBanner /> : <StatusBanner status={sessionStatus} agentName={agentName} />}

      {/* Message list */}
      <FlatList
        ref={listRef}
        data={displayItems}
        keyExtractor={(item) => item.key}
        renderItem={({ item }) =>
          item.kind === "date" ? (
            <DateSeparator label={item.label} />
          ) : (
            <MessageBubble
              message={item.message}
              isOwn={item.message.sender_type === "customer"}
              showSenderMeta={item.showSenderMeta}
              isRead={item.message.sender_type === "customer" && item.message.seq <= peerReadUpToSeq}
              onRetry={item.message.deliveryStatus === "failed" ? () => handleRetry(item.message) : undefined}
              agentName={agentName}
              onQuickReply={handleSend}
              onFeedback={(isHelpful) => submitMessageFeedback(item.message.id, isHelpful)}
            />
          )
        }
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onStartReached={handleLoadMore}
        onContentSizeChange={handleContentSizeChange}
        onStartReachedThreshold={0.3}
        ListHeaderComponent={
          loadingHistory ? (
            <View style={styles.historyLoadingWrap}>
              <ActivityIndicator size="small" color="#0a8c8c" />
            </View>
          ) : null
        }
        ListEmptyComponent={
          <View style={styles.emptyWrap}>
            <Ionicons name="chatbubbles-outline" size={40} color="#d1d5db" />
            <Text style={styles.emptyTitle}>Hi there! 👋</Text>
            <Text style={styles.emptySub}>
              Ask me anything about your order, payment, or our services.
              {"\n"}I&apos;m here to help instantly.
            </Text>
            <StarterChips hasOrderContext={!!orderId} onSelect={handleSend} />
          </View>
        }
        ListFooterComponent={
          typingUsers.length > 0 ? (
            <TypingIndicator isAgent={!typingUsers.includes(-1)} agentName={agentName} />
          ) : null
        }
      />

      {/* Talk to agent bar - shown after AI has replied */}
      {showAgentBar && <TalkToAgentBar onPress={handleRequestAgent} />}

      {/* Input - padded for the bottom safe area (home indicator on iOS,
          on-screen nav bar on Android) so the composer never sits flush
          against, or gets crowded by, the device's own navigation
          controls. KeyboardAvoidingView already handles pushing this up
          when the keyboard opens; this only matters when it's closed. */}
      <View style={{ paddingBottom: insets.bottom }}>
        <MessageInput
          onSend={handleSend}
          onSendImage={handleSendImage}
          onTypingStart={sendTypingStart}
          onTypingStop={sendTypingStop}
          sessionStatus={sessionStatus}
          wsConnected={wsStatus === "connected"}
          disabled={isClosed}
        />
      </View>

      <CsatModal
        visible={csatPrompt}
        onSubmit={(score) => submitCsat(score)}
        onDismiss={() => setCsatPrompt(false)}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#fff" },
  centered: { flex: 1, alignItems: "center", justifyContent: "center", padding: 24 },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
    elevation: 2,
    gap: 10,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#f5f5f5",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  headerTitle: { fontSize: 14, fontWeight: "800", color: "#1a1a1a" },
  headerSub: { fontSize: 11, fontWeight: "600", marginTop: 1 },

  listContent: { paddingHorizontal: 12, paddingTop: 8, paddingBottom: 4, flexGrow: 1 },
  historyLoadingWrap: { paddingVertical: 12, alignItems: "center" },

  emptyWrap: { alignItems: "center", paddingTop: 60, paddingHorizontal: 32, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: "800", color: "#1a1a1a", marginTop: 8 },
  emptySub: { fontSize: 13, color: "#6b7280", textAlign: "center", lineHeight: 20 },

  loadingText: { marginTop: 12, color: "#888", fontSize: 14 },
  errorText: { color: "#ef4444", fontSize: 14, textAlign: "center", marginBottom: 16 },
  retryBtn: { backgroundColor: "#0a8c8c", borderRadius: 10, paddingHorizontal: 24, paddingVertical: 10 },
  retryText: { color: "#fff", fontWeight: "700" },
});
