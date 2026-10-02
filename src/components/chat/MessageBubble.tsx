import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import type { LocalChatMessage } from "../../store/useSupportChatStore";
import { AttachmentPreview } from "./AttachmentPreview";
import { renderMarkdown } from "./renderMarkdown";

const KNOWN_MESSAGE_TYPES = new Set(["text", "image"]);

interface Props {
  message: LocalChatMessage;
  isOwn: boolean;
  /** Present only when this message failed to send - renders a retry tap
   * target next to the delivery indicator. */
  onRetry?: () => void;
  /** False when the previous message in the list is from the same sender
   * within the grouping window - hides the repeated avatar/sender label
   * and tightens vertical spacing (message grouping, Intercom/Uber-style). */
  showSenderMeta?: boolean;
  /** True once the agent/staff side's read receipt (session-level
   * last_read_seq) covers this message's seq. Only meaningful for isOwn
   * messages - there is no per-message read flag, so this is derived by
   * the caller from the session's peerReadUpToSeq. */
  isRead?: boolean;
  /** Real name of the agent currently on this session, if any - shown on
   * their message bubbles instead of the generic "Support Agent" label
   * once known, matching what the header/typing indicator already show. */
  agentName?: string | null;
  /** Called with a chip's `value` when the customer taps a quick-reply chip
   * under this message - the caller sends it exactly like a typed message. */
  onQuickReply?: (value: string) => void;
}

export function MessageBubble({ message, isOwn, onRetry, showSenderMeta = true, isRead = false, agentName, onQuickReply }: Props) {
  const isSystem = message.sender_type === "system";
  const isAI = message.sender_type === "ai";
  const isPending = isOwn && message.deliveryStatus === "pending";
  const isFailed = isOwn && message.deliveryStatus === "failed";
  const imageUrl = message.message_type === "image" ? message.metadata?.attachment_id : undefined;
  const isUnsupportedType = !KNOWN_MESSAGE_TYPES.has(message.message_type) && !imageUrl;

  if (isSystem) {
    return (
      <View style={styles.systemContainer}>
        <Text style={styles.systemText}>{message.body}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.row, isOwn ? styles.rowRight : styles.rowLeft, !showSenderMeta && styles.rowGrouped]}>
      {!isOwn && (
        <View style={[styles.avatar, isAI ? styles.avatarAI : styles.avatarAgent, !showSenderMeta && styles.avatarHidden]}>
          {showSenderMeta && <Text style={styles.avatarText}>{isAI ? "AI" : "A"}</Text>}
        </View>
      )}
      <View style={{ maxWidth: "75%" }}>
        <View
          style={[
            styles.bubble,
            { maxWidth: "100%" },
            isOwn ? styles.bubbleOwn : isAI ? styles.bubbleAI : styles.bubbleOther,
            isFailed && styles.bubbleFailed,
          ]}
        >
          {!isOwn && showSenderMeta && (
            <Text style={[styles.senderLabel, isAI ? styles.aiLabel : styles.agentLabel]}>
              {isAI ? "BookMyDarzi AI" : agentName || "Support Agent"}
            </Text>
          )}
          {imageUrl ? (
            <AttachmentPreview uri={imageUrl} status={isFailed ? "failed" : isPending ? "uploading" : "success"} />
          ) : null}
          {message.body ? (
            !isOwn && (isAI || message.sender_type === "agent") ? (
              // AI/agent replies commonly include basic markdown (**bold**,
              // lists) - render it instead of showing literal asterisks.
              // Customer's own messages are always plain text (never
              // markdown-authored), so they skip this entirely.
              <View style={[imageUrl && { marginTop: 6 }]}>
                {renderMarkdown(message.body, [styles.bodyText, styles.bodyTextOther])}
              </View>
            ) : (
              <Text
                style={[
                  styles.bodyText,
                  isOwn ? styles.bodyTextOwn : styles.bodyTextOther,
                  imageUrl && { marginTop: 6 },
                ]}
              >
                {message.body}
              </Text>
            )
          ) : isUnsupportedType ? (
            <Text style={[styles.bodyText, isOwn ? styles.bodyTextOwn : styles.bodyTextOther, styles.unsupportedText]}>
              This message type isn&apos;t supported yet. Please check the app for updates.
            </Text>
          ) : null}
          <View style={styles.metaRow}>
            {isPending && (
              <Ionicons name="time-outline" size={11} color="rgba(255,255,255,0.7)" style={styles.metaIcon} />
            )}
            {isFailed && (
              <Ionicons name="alert-circle" size={11} color="#fecaca" style={styles.metaIcon} />
            )}
            <Text style={[styles.timestamp, isOwn ? styles.timestampOwn : styles.timestampOther]}>
              {isPending ? "Sending..." : isFailed ? "Not delivered" : _formatTime(message.created_at)}
            </Text>
            {isOwn && !isPending && !isFailed && (
              <Ionicons
                name={isRead ? "checkmark-done" : "checkmark"}
                size={13}
                color={isRead ? "#7dd3fc" : "rgba(255,255,255,0.7)"}
                style={styles.metaIcon}
              />
            )}
          </View>
        </View>
        {isFailed && onRetry && (
          <TouchableOpacity onPress={onRetry} style={styles.retryBtn} hitSlop={8}>
            <Ionicons name="refresh" size={12} color="#dc2626" />
            <Text style={styles.retryText}>Retry</Text>
          </TouchableOpacity>
        )}
        {!isOwn && isAI && onQuickReply && Array.isArray(message.metadata?.quick_replies) && (
          <View style={styles.quickReplyRow}>
            {message.metadata.quick_replies.map((chip: { label: string; value: string }, i: number) => (
              <TouchableOpacity
                key={i}
                style={styles.quickReplyChip}
                onPress={() => onQuickReply(chip.value)}
                activeOpacity={0.7}
              >
                <Text style={styles.quickReplyText}>{chip.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </View>
    </View>
  );
}

function _formatTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  } catch {
    return "";
  }
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", marginVertical: 3, paddingHorizontal: 12, alignItems: "flex-end" },
  rowRight: { justifyContent: "flex-end" },
  rowLeft: { justifyContent: "flex-start" },
  rowGrouped: { marginVertical: 1 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: "center", justifyContent: "center", marginRight: 6, marginBottom: 2 },
  avatarHidden: { backgroundColor: "transparent" },
  avatarAI: { backgroundColor: "#7c3aed" },
  avatarAgent: { backgroundColor: "#0a8c8c" },
  avatarText: { color: "#fff", fontSize: 9, fontWeight: "800" },
  bubble: { borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9, elevation: 1 },
  bubbleOwn: { backgroundColor: "#0a8c8c", borderBottomRightRadius: 4 },
  bubbleAI: { backgroundColor: "#f3f0ff", borderBottomLeftRadius: 4 },
  bubbleOther: { backgroundColor: "#f0f0f0", borderBottomLeftRadius: 4 },
  bubbleFailed: { opacity: 0.75 },
  senderLabel: { fontSize: 10, fontWeight: "700", marginBottom: 2 },
  aiLabel: { color: "#7c3aed" },
  agentLabel: { color: "#0a8c8c" },
  // flexShrink lets the bubble's Text actually shrink to the parent's
  // maxWidth for a single very long unbroken token (long URL, base64-like
  // string) - without it such a token could push the bubble/row wider than
  // intended instead of wrapping within the 75%-max-width container.
  bodyText: { fontSize: 14, lineHeight: 20, flexShrink: 1 },
  bodyTextOwn: { color: "#fff" },
  bodyTextOther: { color: "#1a1a1a" },
  unsupportedText: { fontStyle: "italic", opacity: 0.7 },
  metaRow: { flexDirection: "row", alignItems: "center", justifyContent: "flex-end", marginTop: 3, gap: 3 },
  metaIcon: { marginRight: 1 },
  timestamp: { fontSize: 10 },
  timestampOwn: { color: "rgba(255,255,255,0.7)", textAlign: "right" },
  timestampOther: { color: "#999", textAlign: "right" },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "flex-end",
    gap: 3,
    marginTop: 2,
    alignSelf: "flex-end",
  },
  retryText: { fontSize: 11, fontWeight: "700", color: "#dc2626" },
  systemContainer: { alignItems: "center", marginVertical: 8, paddingHorizontal: 24 },
  systemText: { fontSize: 12, color: "#999", fontStyle: "italic", textAlign: "center" },
  quickReplyRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginTop: 6 },
  quickReplyChip: {
    borderWidth: 1.5,
    borderColor: "#0a8c8c",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  quickReplyText: { fontSize: 12.5, fontWeight: "700", color: "#0a8c8c" },
});
