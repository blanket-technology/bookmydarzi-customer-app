/**
 * Order-scoped chat — customer ↔ BMD support/bridge
 * Real-time via WebSocket (CHAT_MESSAGE event); falls back to REST polling.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { parsePositiveId } from "../src/services/paymentService";
import { wsService } from "../src/services/wsService";
import { useChatStore } from "../src/store/useChatStore";
import type { OrderChatMessage } from "../src/types/engagement";

// ─── Quick-reply chips (Blinkit / Amazon style) ───────────────────────────────
const QUICK_REPLIES = [
  "Where is my order?",
  "When will you pick up?",
  "I need to cancel",
  "Payment query",
  "Measurement help",
  "Delivery delay",
];

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const today = new Date();
  if (d.toDateString() === today.toDateString()) return "Today";
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === yesterday.toDateString()) return "Yesterday";
  return d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
}

// ─── Message bubble ───────────────────────────────────────────────────────────
function MessageBubble({ item }: { item: OrderChatMessage }) {
  const mine = item.sender_role === "user" || item.sender_role === "customer";
  const isBot = item.sender_role === "staff" || item.sender_role === "employee";

  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      {!mine ? (
        <View style={styles.avatar}>
          <Ionicons name="headset-outline" size={14} color={COLORS.primaryDark} />
        </View>
      ) : null}
      <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
        {!mine ? (
          <Text style={styles.senderLabel}>{isBot ? "BMD Support" : "Support"}</Text>
        ) : null}
        <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.message}</Text>
        <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
          {formatTime(item.created_at)}
          {mine ? (
            <Text style={styles.readTick}> {item.is_read ? "  ✓✓" : "  ✓"}</Text>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

// ─── Date separator ───────────────────────────────────────────────────────────
function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSep}>
      <View style={styles.dateSepLine} />
      <Text style={styles.dateSepText}>{label}</Text>
      <View style={styles.dateSepLine} />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────
export default function OrderChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList<any>>(null);
  const orderId = parsePositiveId(useLocalSearchParams<{ orderId?: string }>().orderId);

  const { threads, sending, error, fetchThread, sendMessage, markRead } = useChatStore();
  const thread = orderId !== null ? threads[orderId] : undefined;
  const messages = thread?.messages ?? [];
  const loading = thread?.loading ?? false;

  const [draft, setDraft] = useState("");
  const [showQuickReplies, setShowQuickReplies] = useState(true);

  // ── Load + poll ────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (orderId === null) return;
      fetchThread(orderId, true).then(() => markRead(orderId));
    }, [orderId, fetchThread, markRead]),
  );

  // ── WebSocket real-time ────────────────────────────────────────────────────
  useEffect(() => {
    if (orderId === null) return;
    const unsub = wsService.on("CHAT_MESSAGE", (data) => {
      const msg = data as unknown as OrderChatMessage;
      if (!msg || Number(msg.order_id) !== orderId) return;

      const store = useChatStore.getState();
      const t = store.threads[orderId];
      if (!t) return;
      // Deduplicate by id
      const exists = t.messages.some((m) => m.id === msg.id);
      if (exists) return;
      store.threads[orderId] = { ...t, messages: [...t.messages, msg] };
      // Trigger re-render by calling a no-op that causes set
      useChatStore.setState({ threads: { ...store.threads } });
    });
    return unsub;
  }, [orderId]);

  // ── Auto-scroll on new messages ────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  // ── Send ───────────────────────────────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const msg = (text ?? draft).trim();
    if (!msg || orderId === null) return;
    setDraft("");
    setShowQuickReplies(false);
    await sendMessage(orderId, msg);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  // ── Render items with date separators ─────────────────────────────────────
  const flatData = React.useMemo(() => {
    const result: Array<{ type: "date"; label: string } | { type: "msg"; item: OrderChatMessage }> = [];
    let lastDate = "";
    for (const m of messages) {
      const label = formatDate(m.created_at);
      if (label && label !== lastDate) {
        result.push({ type: "date", label });
        lastDate = label;
      }
      result.push({ type: "msg", item: m });
    }
    return result;
  }, [messages]);

  const renderItem = ({ item }: { item: typeof flatData[number] }) => {
    if (item.type === "date") return <DateSeparator label={item.label} />;
    return <MessageBubble item={item.item} />;
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <View style={styles.headerAvatar}>
            <Ionicons name="headset-outline" size={16} color={COLORS.primaryDark} />
          </View>
          <View>
            <Text style={styles.headerTitle}>Chat</Text>
            <Text style={styles.headerOnline}>● Online · typically replies instantly</Text>
          </View>
        </View>
        <View style={{ width: 40 }} />
      </View>

      {/* Order tag */}
      {orderId !== null ? (
        <View style={styles.orderTag}>
          <Ionicons name="receipt-outline" size={12} color={COLORS.primaryDark} />
          <Text style={styles.orderTagText}>Order #{orderId}</Text>
        </View>
      ) : null}

      {/* Messages */}
      {orderId === null ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Invalid order reference.</Text>
        </View>
      ) : loading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={flatData}
          keyExtractor={(item, i) =>
            item.type === "date" ? `date-${item.label}-${i}` : String(item.item.id)
          }
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.emptyWrap}>
              <View style={styles.emptyIcon}>
                <Ionicons name="chatbubbles-outline" size={36} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.emptyTitle}>How can we help?</Text>
              <Text style={styles.emptySub}>
                Send us a message about your order. Our support team responds instantly.
              </Text>
            </View>
          }
        />
      )}

      {/* Quick-reply chips */}
      {showQuickReplies && messages.length === 0 && orderId !== null ? (
        <View style={styles.quickWrap}>
          <Text style={styles.quickLabel}>Quick questions</Text>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.quickRow}
          >
            {QUICK_REPLIES.map((q) => (
              <Pressable
                key={q}
                style={({ pressed }) => [styles.quickChip, pressed && styles.quickChipPressed]}
                onPress={() => handleSend(q)}
              >
                <Text style={styles.quickChipText}>{q}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={COLORS.gray}
          multiline
          editable={orderId !== null}
          onFocus={() => setShowQuickReplies(false)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={() => handleSend()}
          disabled={!draft.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={17} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#EFF3F7" },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: SPACING.md,
    paddingVertical: 10,
    backgroundColor: COLORS.white,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
    gap: SPACING.sm,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.offWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(12,108,117,0.2)",
  },
  headerTitle: { fontSize: 15, fontWeight: "800", color: COLORS.black },
  headerOnline: { fontSize: 11, color: "#16A34A", fontWeight: "600", marginTop: 1 },

  orderTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: COLORS.primaryLight,
    paddingHorizontal: SPACING.lg,
    paddingVertical: 5,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "rgba(12,108,117,0.1)",
  },
  orderTagText: { fontSize: 11, fontWeight: "700", color: COLORS.primaryDark },

  listContent: { padding: SPACING.md, flexGrow: 1, paddingBottom: SPACING.lg },

  bubbleRow: { flexDirection: "row", marginBottom: SPACING.sm, alignItems: "flex-end", gap: 8 },
  rowMine: { justifyContent: "flex-end" },
  rowTheirs: { justifyContent: "flex-start" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.15)",
    flexShrink: 0,
  },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  bubbleMine: {
    backgroundColor: COLORS.primaryDark,
    borderBottomRightRadius: 4,
  },
  bubbleTheirs: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.grayBorder,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  senderLabel: { fontSize: 10.5, fontWeight: "700", color: COLORS.primaryDark, marginBottom: 3 },
  bubbleText: { fontSize: 14, color: COLORS.black, lineHeight: 20 },
  bubbleTextMine: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.gray, marginTop: 4, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.7)" },
  readTick: { fontSize: 10 },

  dateSep: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: SPACING.md,
    gap: 8,
  },
  dateSepLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.grayBorder },
  dateSepText: {
    fontSize: 11,
    color: COLORS.gray,
    fontWeight: "600",
    backgroundColor: "#EFF3F7",
    paddingHorizontal: 4,
  },

  quickWrap: {
    backgroundColor: COLORS.white,
    paddingTop: SPACING.sm,
    paddingBottom: 6,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: COLORS.grayBorder,
  },
  quickLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: COLORS.gray,
    textTransform: "uppercase",
    letterSpacing: 0.5,
    paddingHorizontal: SPACING.md,
    marginBottom: 6,
  },
  quickRow: { paddingHorizontal: SPACING.md, gap: 8 },
  quickChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.25)",
  },
  quickChipPressed: { opacity: 0.7 },
  quickChipText: { fontSize: 12, fontWeight: "600", color: COLORS.primaryDark },

  inputBar: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingTop: SPACING.sm,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
  },
  input: {
    flex: 1,
    maxHeight: 110,
    minHeight: 44,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.45 },

  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: SPACING.xl, paddingTop: 40 },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
    borderWidth: 1.5,
    borderColor: "rgba(12,108,117,0.15)",
  },
  emptyTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: "center", lineHeight: 20 },
  errorText: { fontSize: 14, color: COLORS.error, textAlign: "center" },
  errorBanner: {
    fontSize: 12,
    color: COLORS.error,
    textAlign: "center",
    paddingVertical: 4,
    backgroundColor: "#FEE2E2",
  },
});
