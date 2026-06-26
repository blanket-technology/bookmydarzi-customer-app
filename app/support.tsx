/**
 * Help & Support — /api/v1/support
 * Tabs: my tickets (raise + view) and FAQs.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
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
import { useSupportStore } from "../src/store/useSupportStore";
import { useAuthStore } from "../store/useAuthStore";
import type { SupportCategory, SupportTicketListItem } from "../src/types/engagement";

const CATEGORIES: SupportCategory[] = ["general", "order", "payment", "delivery", "account"];

const STATUS_COLORS: Record<string, { bg: string; fg: string }> = {
  open: { bg: "#FEF3C7", fg: "#92400E" },
  in_progress: { bg: "#DBEAFE", fg: "#1E40AF" },
  resolved: { bg: COLORS.successLight, fg: COLORS.success },
  closed: { bg: COLORS.grayLight, fg: COLORS.gray },
};

function statusLabel(s: string): string {
  return s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function SupportScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const {
    tickets,
    faqs,
    loading,
    saving,
    error,
    fetchTickets,
    fetchFaqs,
    raiseTicket,
  } = useSupportStore();

  const [tab, setTab] = useState<"tickets" | "faqs">("tickets");
  const navigateToFaq = () => router.push("/faq" as never);
  const [modalOpen, setModalOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState<SupportCategory>("general");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      fetchTickets();
      fetchFaqs();
    }, [isAuthenticated, fetchTickets, fetchFaqs]),
  );

  const handleCreate = async () => {
    if (subject.trim().length < 3 || message.trim().length < 1) return;
    const ticket = await raiseTicket({
      subject: subject.trim(),
      message: message.trim(),
      category,
    });
    if (ticket) {
      setModalOpen(false);
      setSubject("");
      setMessage("");
      setCategory("general");
      router.push({ pathname: "/support-ticket" as never, params: { ticketId: String(ticket.id) } });
    }
  };

  const renderTicket = (t: SupportTicketListItem) => {
    const colors = STATUS_COLORS[t.status] ?? STATUS_COLORS.open;
    return (
      <TouchableOpacity
        key={t.id}
        style={styles.ticketCard}
        activeOpacity={0.85}
        onPress={() =>
          router.push({ pathname: "/support-ticket" as never, params: { ticketId: String(t.id) } })
        }
      >
        <View style={styles.ticketTop}>
          <Text style={styles.ticketSubject} numberOfLines={1}>
            {t.subject}
          </Text>
          <View style={[styles.statusPill, { backgroundColor: colors.bg }]}>
            <Text style={[styles.statusPillText, { color: colors.fg }]}>
              {statusLabel(t.status)}
            </Text>
          </View>
        </View>
        <Text style={styles.ticketMeta}>
          {t.ticket_code ? `${t.ticket_code} · ` : ""}
          {statusLabel(t.category)}
        </Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={styles.tabRow}>
        {(["tickets", "faqs"] as const).map((key) => (
          <TouchableOpacity
            key={key}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>
              {key === "tickets" ? "My Tickets" : "FAQs"}
            </Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.tab]}
          onPress={navigateToFaq}
        >
          <Text style={[styles.tabText, { color: COLORS.primaryDark }]}>Browse FAQs ›</Text>
        </TouchableOpacity>
      </View>

      {tab === "tickets" ? (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 96 }}
          showsVerticalScrollIndicator={false}
        >
          {loading && tickets.length === 0 ? (
            <ActivityIndicator size="large" color={COLORS.primary} style={{ marginTop: 40 }} />
          ) : tickets.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="help-buoy-outline" size={48} color={COLORS.grayBorder} />
              <Text style={styles.emptyTitle}>No support tickets</Text>
              <Text style={styles.emptySub}>Raise a ticket and our team will help you out.</Text>
            </View>
          ) : (
            tickets.map(renderTicket)
          )}
          {error ? <Text style={styles.errorText}>{error}</Text> : null}
        </ScrollView>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 24 }}
          showsVerticalScrollIndicator={false}
        >
          {faqs.length === 0 ? (
            <View style={styles.center}>
              <Ionicons name="document-text-outline" size={48} color={COLORS.grayBorder} />
              <Text style={styles.emptyTitle}>No FAQs available</Text>
            </View>
          ) : (
            faqs.map((f) => (
              <TouchableOpacity
                key={f.id}
                style={styles.faqCard}
                activeOpacity={0.9}
                onPress={() => setExpandedFaq(expandedFaq === f.id ? null : f.id)}
              >
                <View style={styles.faqQuestionRow}>
                  <Text style={styles.faqQuestion}>{f.question}</Text>
                  <Ionicons
                    name={expandedFaq === f.id ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={COLORS.gray}
                  />
                </View>
                {expandedFaq === f.id ? <Text style={styles.faqAnswer}>{f.answer}</Text> : null}
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      {tab === "tickets" ? (
        <TouchableOpacity
          style={[styles.fab, { bottom: insets.bottom + SPACING.lg }]}
          onPress={() => setModalOpen(true)}
          activeOpacity={0.9}
        >
          <Ionicons name="add" size={22} color={COLORS.white} />
          <Text style={styles.fabText}>New ticket</Text>
        </TouchableOpacity>
      ) : null}

      <Modal visible={modalOpen} transparent animationType="slide" onRequestClose={() => setModalOpen(false)}>
        <KeyboardAvoidingView
          style={styles.modalRoot}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={[styles.modalCard, { paddingBottom: insets.bottom + SPACING.md }]}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>Raise a ticket</Text>

            <Text style={styles.fieldLabel}>Subject</Text>
            <TextInput
              style={styles.input}
              value={subject}
              onChangeText={setSubject}
              placeholder="Brief summary"
              placeholderTextColor={COLORS.gray}
            />

            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryRow}>
              {CATEGORIES.map((c) => (
                <TouchableOpacity
                  key={c}
                  style={[styles.catChip, category === c && styles.catChipActive]}
                  onPress={() => setCategory(c)}
                >
                  <Text style={[styles.catChipText, category === c && styles.catChipTextActive]}>
                    {statusLabel(c)}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.fieldLabel}>Message</Text>
            <TextInput
              style={[styles.input, styles.textArea]}
              value={message}
              onChangeText={setMessage}
              placeholder="Describe your issue…"
              placeholderTextColor={COLORS.gray}
              multiline
            />

            <View style={styles.modalActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setModalOpen(false)}>
                <Text style={styles.cancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.submitBtn, (saving || subject.trim().length < 3 || !message.trim()) && styles.submitBtnDisabled]}
                onPress={handleCreate}
                disabled={saving || subject.trim().length < 3 || !message.trim()}
              >
                <Text style={styles.submitText}>{saving ? "Submitting…" : "Submit"}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
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
  headerTitle: { fontSize: 18, fontWeight: "800", color: COLORS.black },
  tabRow: { flexDirection: "row", backgroundColor: COLORS.white, paddingHorizontal: SPACING.lg },
  tab: { flex: 1, alignItems: "center", paddingVertical: SPACING.md, borderBottomWidth: 2, borderBottomColor: "transparent" },
  tabActive: { borderBottomColor: COLORS.primaryDark },
  tabText: { fontSize: 14, fontWeight: "600", color: COLORS.gray },
  tabTextActive: { color: COLORS.primaryDark, fontWeight: "700" },
  ticketCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  ticketTop: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
  ticketSubject: { flex: 1, fontSize: 14, fontWeight: "700", color: COLORS.black },
  statusPill: { borderRadius: RADIUS.full, paddingHorizontal: 10, paddingVertical: 3 },
  statusPillText: { fontSize: 11, fontWeight: "700" },
  ticketMeta: { fontSize: 12, color: COLORS.gray, marginTop: 6 },
  faqCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  faqQuestionRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SPACING.sm },
  faqQuestion: { flex: 1, fontSize: 14, fontWeight: "600", color: COLORS.black },
  faqAnswer: { fontSize: 13, color: COLORS.gray, marginTop: SPACING.sm, lineHeight: 19 },
  fab: {
    position: "absolute",
    right: SPACING.lg,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 18,
    paddingVertical: 12,
    ...SHADOWCardLike(),
  },
  fabText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
  center: { alignItems: "center", justifyContent: "center", padding: SPACING.xl, gap: SPACING.sm, marginTop: 40 },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  errorText: { fontSize: 13, color: COLORS.error, textAlign: "center", marginTop: SPACING.md },
  modalRoot: { flex: 1, justifyContent: "flex-end", backgroundColor: COLORS.overlay },
  modalCard: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.grayBorder,
    alignSelf: "center",
    marginBottom: SPACING.md,
  },
  modalTitle: { fontSize: 17, fontWeight: "800", color: COLORS.black, marginBottom: SPACING.md },
  fieldLabel: { fontSize: 13, fontWeight: "600", color: COLORS.black, marginBottom: 6, marginTop: SPACING.sm },
  input: {
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 48,
    fontSize: 14,
    color: COLORS.black,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  textArea: { height: 110, paddingTop: 12, textAlignVertical: "top" },
  categoryRow: { flexDirection: "row", flexWrap: "wrap", gap: SPACING.sm },
  catChip: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.grayLight,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  catChipActive: { backgroundColor: COLORS.primaryDark, borderColor: COLORS.primaryDark },
  catChipText: { fontSize: 12, fontWeight: "600", color: COLORS.gray },
  catChipTextActive: { color: COLORS.white },
  modalActions: { flexDirection: "row", gap: SPACING.sm, marginTop: SPACING.lg },
  cancelBtn: {
    flex: 1,
    height: 48,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  cancelText: { fontSize: 14, fontWeight: "600", color: COLORS.gray },
  submitBtn: {
    flex: 2,
    height: 48,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.primaryDark,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: { opacity: 0.5 },
  submitText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
});

function SHADOWCardLike() {
  return Platform.select({
    ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
    android: { elevation: 6 },
    default: {},
  });
}
