/**
 * Order-scoped chat — /api/v1/chat/orders/{orderId}/messages
 * Customer ↔ assigned tailor messaging for a single order.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import { parsePositiveId } from "../src/services/paymentService";
import { useChatStore } from "../src/store/useChatStore";
import type { OrderChatMessage } from "../src/types/engagement";

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export default function OrderChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const listRef = useRef<FlatList<OrderChatMessage>>(null);
  const orderId = parsePositiveId(useLocalSearchParams<{ orderId?: string }>().orderId);

  const { threads, sending, error, fetchThread, sendMessage, markRead } = useChatStore();
  const thread = orderId !== null ? threads[orderId] : undefined;
  const messages = thread?.messages ?? [];
  const loading = thread?.loading ?? false;

  const [draft, setDraft] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (orderId === null) return;
      fetchThread(orderId, true).then(() => markRead(orderId));
    }, [orderId, fetchThread, markRead]),
  );

  const handleSend = async () => {
    const text = draft.trim();
    if (!text || orderId === null) return;
    setDraft("");
    const ok = await sendMessage(orderId, text);
    if (ok) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    } else {
      setDraft(text);
    }
  };

  const renderItem = ({ item }: { item: OrderChatMessage }) => {
    const mine = item.sender_role === "user" || item.sender_role === "customer";
    return (
      <View style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}>
        <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
          {!mine ? (
            <Text style={styles.senderRole}>
              {item.sender_role === "tailor" ? "Tailor" : "Support"}
            </Text>
          ) : null}
          <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{item.message}</Text>
          <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
            {formatTime(item.created_at)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 0}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle}>Chat with tailor</Text>
          {orderId !== null ? <Text style={styles.headerSub}>Order #{orderId}</Text> : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {orderId === null ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Invalid order reference.</Text>
        </View>
      ) : loading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          ref={listRef}
          data={messages}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons name="chatbubbles-outline" size={48} color={COLORS.grayBorder} />
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>
                Send a message to your tailor about this order.
              </Text>
            </View>
          }
        />
      )}

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Type a message…"
          placeholderTextColor={COLORS.gray}
          multiline
          editable={orderId !== null}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={!draft.trim() || sending}
        >
          {sending ? (
            <ActivityIndicator size="small" color={COLORS.white} />
          ) : (
            <Ionicons name="send" size={18} color={COLORS.white} />
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: COLORS.offWhite,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 16, fontWeight: "800", color: COLORS.black },
  headerSub: { fontSize: 12, color: COLORS.gray, marginTop: 1 },
  listContent: { padding: SPACING.lg, flexGrow: 1 },
  bubbleRow: { flexDirection: "row", marginBottom: SPACING.sm },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "80%", borderRadius: RADIUS.lg, padding: SPACING.sm, paddingHorizontal: 12 },
  bubbleMine: { backgroundColor: COLORS.primaryDark, borderBottomRightRadius: 4 },
  bubbleTheirs: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  senderRole: { fontSize: 11, fontWeight: "700", color: COLORS.primaryDark, marginBottom: 2 },
  bubbleText: { fontSize: 14, color: COLORS.black, lineHeight: 19 },
  bubbleTextMine: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.gray, marginTop: 4, alignSelf: "flex-end" },
  bubbleTimeMine: { color: "rgba(255,255,255,0.75)" },
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
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.lg,
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    paddingBottom: 12,
    fontSize: 14,
    color: COLORS.black,
  },
  sendBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  sendBtnDisabled: { opacity: 0.5 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  errorTitle: { fontSize: 14, color: COLORS.error, textAlign: "center" },
  errorBanner: {
    fontSize: 12,
    color: COLORS.error,
    textAlign: "center",
    paddingVertical: 4,
    backgroundColor: COLORS.errorLight,
  },
});
