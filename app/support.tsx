/**
 * Help & Support - single entry point into chat_v2 (AI-first, escalates to
 * a human agent in the same thread). Ticket creation has been retired in
 * favour of one Support conversation per customer/order; past tickets stay
 * viewable for continuity but no new ones can be raised from here.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useRouter, useLocalSearchParams } from "expo-router";
import React, { useCallback } from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import ScreenHeader from "../src/components/common/ScreenHeader";
import { SUPPORT_CATEGORIES, type SupportCategoryKey } from "../src/constants/supportIssues";
import { useSupportStore } from "../src/store/useSupportStore";
import type { SupportTicketListItem } from "../src/types/engagement";
import { useAuthStore } from "../store/useAuthStore";

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
  const { orderId } = useLocalSearchParams<{ orderId?: string }>();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const { tickets, loading, error, fetchTickets } = useSupportStore();

  useFocusEffect(
    useCallback(() => {
      if (!isAuthenticated) return;
      fetchTickets();
    }, [isAuthenticated, fetchTickets]),
  );

  // Arrived from a specific order's "Get help" button - skip the category
  // grid entirely, we already know it's order-related.
  React.useEffect(() => {
    if (orderId) {
      router.replace({ pathname: "/support-issue-picker" as never, params: { orderId } });
    }
  }, [orderId, router]);

  const selectCategory = (key: SupportCategoryKey) => {
    if (key === "order") {
      router.push("/support-order-picker" as never);
      return;
    }
    router.push({ pathname: "/support-chat" as never, params: { issueCategory: key } });
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

  if (orderId) return null;

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Support" />

      <ScrollView
        contentContainerStyle={{ padding: SPACING.lg, paddingBottom: insets.bottom + 32 }}
        showsVerticalScrollIndicator={false}
      >
        {/* ── What do you need help with? ── */}
        <Text style={styles.promptTitle}>What do you need help with?</Text>
        <View style={styles.categoryGrid}>
          {SUPPORT_CATEGORIES.map((cat) => (
            <TouchableOpacity
              key={cat.key}
              style={styles.categoryCard}
              activeOpacity={0.85}
              onPress={() => selectCategory(cat.key)}
            >
              <View style={styles.categoryIconBox}>
                <Ionicons name={cat.icon} size={22} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.categoryLabel}>{cat.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <TouchableOpacity
          style={styles.faqRow}
          onPress={() => router.push("/faq" as never)}
          activeOpacity={0.8}
        >
          <Ionicons name="help-circle-outline" size={18} color={COLORS.primaryDark} />
          <Text style={styles.faqRowText}>Browse frequently asked questions</Text>
          <Ionicons name="chevron-forward" size={16} color={COLORS.gray} />
        </TouchableOpacity>

        {/* ── Past tickets (read-only, kept for continuity) ── */}
        {loading && tickets.length === 0 ? (
          <ActivityIndicator size="small" color={COLORS.primary} style={{ marginTop: 24 }} />
        ) : tickets.length > 0 ? (
          <>
            <Text style={styles.sectionTitle}>Past requests</Text>
            {tickets.map(renderTicket)}
          </>
        ) : null}
        {error ? <Text style={styles.errorText}>{error}</Text> : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },
  promptTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: COLORS.black,
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  categoryCard: {
    width: "48%",
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    gap: SPACING.sm,
  },
  categoryIconBox: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#e6f7f7",
    alignItems: "center",
    justifyContent: "center",
  },
  categoryLabel: { fontSize: 13, fontWeight: "700", color: COLORS.black },
  faqRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  faqRowText: { flex: 1, fontSize: 13, fontWeight: "600", color: COLORS.black },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.gray,
    marginTop: SPACING.xl,
    marginBottom: SPACING.sm,
    textTransform: "uppercase",
    letterSpacing: 0.3,
  },
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
  errorText: { fontSize: 13, color: COLORS.error, textAlign: "center", marginTop: SPACING.md },
});
