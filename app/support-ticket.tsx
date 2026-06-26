/**
 * Support ticket thread — /api/v1/support/tickets/{id}
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
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
import { useSupportStore } from "../src/store/useSupportStore";

function formatTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString([], { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });
}

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SupportTicketScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const ticketId = parsePositiveId(useLocalSearchParams<{ ticketId?: string }>().ticketId);

  const { activeTicket, loadingTicket, saving, error, fetchTicket, reply } = useSupportStore();
  const [draft, setDraft] = useState("");

  useFocusEffect(
    useCallback(() => {
      if (ticketId !== null) fetchTicket(ticketId);
    }, [ticketId, fetchTicket]),
  );

  const isClosed =
    activeTicket?.status === "closed" || activeTicket?.status === "resolved";

  const handleReply = async () => {
    const text = draft.trim();
    if (!text || ticketId === null) return;
    setDraft("");
    const ok = await reply(ticketId, text);
    if (!ok) setDraft(text);
  };

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {activeTicket?.subject ?? "Ticket"}
          </Text>
          {activeTicket ? (
            <Text style={styles.headerSub}>
              {activeTicket.ticket_code ? `${activeTicket.ticket_code} · ` : ""}
              {statusLabel(activeTicket.status)}
            </Text>
          ) : null}
        </View>
        <View style={{ width: 40 }} />
      </View>

      {loadingTicket && !activeTicket ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : ticketId === null ? (
        <View style={styles.center}>
          <Text style={styles.errorTitle}>Invalid ticket reference.</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: SPACING.lg }}
          showsVerticalScrollIndicator={false}
        >
          {(activeTicket?.messages ?? []).map((m) => {
            const mine = m.sender_role === "user" || m.sender_role === "customer";
            return (
              <View
                key={m.id}
                style={[styles.bubbleRow, mine ? styles.bubbleRowMine : styles.bubbleRowTheirs]}
              >
                <View style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleTheirs]}>
                  {!mine ? <Text style={styles.senderRole}>Support</Text> : null}
                  <Text style={[styles.bubbleText, mine && styles.bubbleTextMine]}>{m.message}</Text>
                  <Text style={[styles.bubbleTime, mine && styles.bubbleTimeMine]}>
                    {formatTime(m.created_at)}
                  </Text>
                </View>
              </View>
            );
          })}
          {error ? <Text style={styles.errorTitle}>{error}</Text> : null}
        </ScrollView>
      )}

      {!isClosed && ticketId !== null ? (
        <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
          <TextInput
            style={styles.input}
            value={draft}
            onChangeText={setDraft}
            placeholder="Write a reply…"
            placeholderTextColor={COLORS.gray}
            multiline
          />
          <TouchableOpacity
            style={[styles.sendBtn, (!draft.trim() || saving) && styles.sendBtnDisabled]}
            onPress={handleReply}
            disabled={!draft.trim() || saving}
          >
            {saving ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Ionicons name="send" size={18} color={COLORS.white} />
            )}
          </TouchableOpacity>
        </View>
      ) : isClosed ? (
        <View style={[styles.closedBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
          <Text style={styles.closedText}>This ticket is {statusLabel(activeTicket?.status ?? "closed")}.</Text>
        </View>
      ) : null}
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
  bubbleRow: { flexDirection: "row", marginBottom: SPACING.sm },
  bubbleRowMine: { justifyContent: "flex-end" },
  bubbleRowTheirs: { justifyContent: "flex-start" },
  bubble: { maxWidth: "85%", borderRadius: RADIUS.lg, padding: SPACING.sm, paddingHorizontal: 12 },
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
  closedBar: {
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
  },
  closedText: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm },
  errorTitle: { fontSize: 14, color: COLORS.error, textAlign: "center" },
});
