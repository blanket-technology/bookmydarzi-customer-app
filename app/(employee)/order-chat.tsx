/**
 * Employee ↔ Customer chat for a single order.
 * Employees send messages as "staff" role (shows as "Support" to customer).
 * Real-time via WebSocket CHAT_MESSAGE event.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
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
import { COLORS, RADIUS, SPACING } from "../../constants/theme";
import { getOrderStatusMeta, normalizeOrderStatus } from "../../src/constants/orderStatus";
import { getEmployeeOrderForChat } from "../../src/services/employeeService";
import { wsService } from "../../src/services/wsService";
import { useChatStore } from "../../src/store/useChatStore";
import type { OrderChatMessage } from "../../src/types/engagement";

const TEAL = "#149694";

// ─── Employee quick-reply templates ──────────────────────────────────────────
const QUICK_TEMPLATES = [
  "We're on our way to pick up your cloth.",
  "Your cloth has been received at our workshop.",
  "Your garment is being stitched now.",
  "Your order is out for delivery.",
  "Please confirm your availability for pickup.",
  "Our team will arrive between 10 AM – 12 PM.",
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

function RolePill({ role }: { role: string }) {
  const label =
    role === "staff" || role === "employee" ? "Support" :
    role === "tailor" ? "Tailor" : "Customer";
  const color =
    role === "staff" || role === "employee" ? TEAL :
    role === "tailor" ? "#7C3AED" : "#1F2937";
  return (
    <Text style={[styles.senderLabel, { color }]}>{label}</Text>
  );
}

function MessageBubble({ item, myRole }: { item: OrderChatMessage; myRole: "staff" | "user" }) {
  const isMe = item.sender_role === "staff" || item.sender_role === "employee";
  return (
    <View style={[styles.bubbleRow, isMe ? styles.rowMe : styles.rowThem]}>
      {!isMe ? (
        <View style={styles.avatar}>
          <Ionicons name="person-outline" size={14} color={TEAL} />
        </View>
      ) : null}
      <View style={[styles.bubble, isMe ? styles.bubbleMe : styles.bubbleThem]}>
        {!isMe ? <RolePill role={item.sender_role} /> : null}
        <Text style={[styles.bubbleText, isMe && styles.bubbleTextMe]}>{item.message}</Text>
        <Text style={[styles.bubbleTime, isMe && styles.bubbleTimeMe]}>
          {formatTime(item.created_at)}
          {isMe ? <Text style={styles.tick}>{item.is_read ? "  ✓✓" : "  ✓"}</Text> : null}
        </Text>
      </View>
    </View>
  );
}

function InfoChip({ icon, label }: { icon: string; label: string }) {
  return (
    <View style={orderInfoStyles.chip}>
      <Ionicons name={icon as any} size={11} color={COLORS.gray} />
      <Text style={orderInfoStyles.chipText} numberOfLines={1}>{label}</Text>
    </View>
  );
}

function OrderInfoStrip({ order }: { order: any }) {
  const statusLabel = getOrderStatusMeta(normalizeOrderStatus(order.Status ?? order.status ?? "")).employeeLabel;
  const addr = order.address ?? order.Address ?? {};
  const addrLine = [
    addr.address_line_1 ?? addr.AddressLine1 ?? "",
    addr.city ?? addr.City ?? "",
    addr.state ?? addr.State ?? "",
    addr.pincode ?? addr.Pincode ?? "",
  ].filter(Boolean).join(", ");
  const mobile = order.customer?.phone_number ?? order.customer_mobile ?? "";
  const amount = order.FinalAmount ?? order.final_amount ?? order.TotalAmount ?? order.total_amount ?? 0;
  const services = Array.isArray(order.services) ? order.services.join(", ") : "";

  return (
    <View style={orderInfoStyles.strip}>
      <View style={orderInfoStyles.row}>
        <Text style={orderInfoStyles.label}>Status</Text>
        <Text style={orderInfoStyles.value}>{statusLabel}</Text>
      </View>
      {mobile ? (
        <View style={orderInfoStyles.row}>
          <Text style={orderInfoStyles.label}>Mobile</Text>
          <Text style={orderInfoStyles.value}>{mobile}</Text>
        </View>
      ) : null}
      {amount > 0 ? (
        <View style={orderInfoStyles.row}>
          <Text style={orderInfoStyles.label}>Amount</Text>
          <Text style={orderInfoStyles.value}>₹{Number(amount).toLocaleString("en-IN")}</Text>
        </View>
      ) : null}
      {services ? (
        <View style={orderInfoStyles.row}>
          <Text style={orderInfoStyles.label}>Services</Text>
          <Text style={[orderInfoStyles.value, { flex: 1 }]} numberOfLines={2}>{services}</Text>
        </View>
      ) : null}
      {addrLine ? (
        <View style={orderInfoStyles.row}>
          <Text style={orderInfoStyles.label}>Address</Text>
          <Text style={[orderInfoStyles.value, { flex: 1 }]} numberOfLines={2}>{addrLine}</Text>
        </View>
      ) : null}
    </View>
  );
}

const orderInfoStyles = StyleSheet.create({
  strip: {
    backgroundColor: "#F0FDFA",
    borderBottomWidth: 1,
    borderBottomColor: "rgba(20,150,148,0.2)",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: 6,
  },
  row: { flexDirection: "row", gap: 10, alignItems: "flex-start" },
  label: { fontSize: 11, fontWeight: "700", color: TEAL, width: 58, flexShrink: 0 },
  value: { fontSize: 12, color: COLORS.black, fontWeight: "500" },
  chip: {
    flexDirection: "row", alignItems: "center", gap: 3,
    paddingHorizontal: 7, paddingVertical: 2,
    backgroundColor: COLORS.offWhite, borderRadius: RADIUS.full,
    borderWidth: StyleSheet.hairlineWidth, borderColor: COLORS.grayBorder,
  },
  chipText: { fontSize: 10, color: COLORS.gray, fontWeight: "500" },
});

function DateSeparator({ label }: { label: string }) {
  return (
    <View style={styles.dateSep}>
      <View style={styles.sepLine} />
      <Text style={styles.sepText}>{label}</Text>
      <View style={styles.sepLine} />
    </View>
  );
}

export default function EmployeeOrderChatScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams<{ orderId?: string; orderCode?: string; customerName?: string }>();
  const orderId = params.orderId ? Number(params.orderId) : null;
  const orderCode = params.orderCode ?? (orderId ? `#${orderId}` : "");
  const customerName = params.customerName ?? "Customer";

  const listRef = useRef<FlatList<any>>(null);
  const { threads, sending, error, fetchThread, sendMessage, markRead } = useChatStore();
  const thread = orderId !== null ? threads[orderId!] : undefined;
  const messages = thread?.messages ?? [];
  const loading = thread?.loading ?? false;

  const [draft, setDraft] = useState("");
  const [showTemplates, setShowTemplates] = useState(false);
  const [orderDetail, setOrderDetail] = useState<any>(null);
  const [showOrderInfo, setShowOrderInfo] = useState(false);

  // Fetch order details for the info panel
  useEffect(() => {
    if (orderId === null) return;
    getEmployeeOrderForChat(orderId).then(setOrderDetail).catch(() => {});
  }, [orderId]);

  // ── Load thread ─────────────────────────────────────────────────────────────
  useFocusEffect(
    useCallback(() => {
      if (orderId === null) return;
      fetchThread(orderId, true).then(() => markRead(orderId));
    }, [orderId, fetchThread, markRead]),
  );

  // ── WebSocket real-time ─────────────────────────────────────────────────────
  useEffect(() => {
    if (orderId === null) return;
    const unsub = wsService.on("CHAT_MESSAGE", (data) => {
      const msg = data as unknown as OrderChatMessage;
      if (!msg || Number(msg.order_id) !== orderId) return;
      const store = useChatStore.getState();
      const t = store.threads[orderId];
      if (!t) return;
      const exists = t.messages.some((m) => m.id === msg.id);
      if (exists) return;
      useChatStore.setState({
        threads: {
          ...store.threads,
          [orderId]: { ...t, messages: [...t.messages, msg] },
        },
      });
    });
    return unsub;
  }, [orderId]);

  // ── Auto-scroll ──────────────────────────────────────────────────────────────
  useEffect(() => {
    if (messages.length > 0) {
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    }
  }, [messages.length]);

  // ── Send ────────────────────────────────────────────────────────────────────
  const handleSend = async (text?: string) => {
    const msg = (text ?? draft).trim();
    if (!msg || orderId === null) return;
    setDraft("");
    setShowTemplates(false);
    await sendMessage(orderId, msg);
    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  };

  // ── Build list with date separators ──────────────────────────────────────────
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
    return <MessageBubble item={item.item} myRole="staff" />;
  };

  if (orderId === null) {
    return (
      <View style={[styles.root, styles.center, { paddingTop: insets.top }]}>
        <Text style={{ color: COLORS.error }}>Invalid order reference.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={[styles.root, { paddingTop: insets.top }]}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()} hitSlop={12}>
          <Ionicons name="arrow-back" size={22} color={COLORS.black} style={{ marginRight: 1.5 }} />
        </TouchableOpacity>
        <View style={styles.headerMeta}>
          <View style={styles.headerAvatar}>
            <Ionicons name="person-outline" size={16} color={TEAL} />
          </View>
          <View>
            <Text style={styles.headerName}>{customerName}</Text>
            <Text style={styles.headerOrder}>Order {orderCode}</Text>
          </View>
        </View>
        <TouchableOpacity
          style={styles.infoBtn}
          onPress={() => setShowOrderInfo((v) => !v)}
          hitSlop={10}
        >
          <Ionicons
            name={showOrderInfo ? "information-circle" : "information-circle-outline"}
            size={22}
            color={showOrderInfo ? TEAL : COLORS.gray}
          />
        </TouchableOpacity>
      </View>

      {/* Order info strip */}
      {showOrderInfo && orderDetail ? (
        <View style={styles.orderInfoStrip}>
          <OrderInfoStrip order={orderDetail} />
        </View>
      ) : null}

      {/* Chat list */}
      {loading && messages.length === 0 ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
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
                <Ionicons name="chatbubbles-outline" size={32} color={TEAL} />
              </View>
              <Text style={styles.emptyTitle}>No messages yet</Text>
              <Text style={styles.emptySub}>
                Start the conversation - updates you send will appear instantly to the customer.
              </Text>
            </View>
          }
        />
      )}

      {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

      {/* Quick templates dropdown */}
      {showTemplates ? (
        <View style={styles.templateBox}>
          <Text style={styles.templateTitle}>Quick replies</Text>
          <ScrollView style={{ maxHeight: 200 }} showsVerticalScrollIndicator={false}>
            {QUICK_TEMPLATES.map((t) => (
              <Pressable
                key={t}
                style={({ pressed }) => [styles.templateRow, pressed && { opacity: 0.7 }]}
                onPress={() => handleSend(t)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={14} color={TEAL} />
                <Text style={styles.templateText}>{t}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </View>
      ) : null}

      {/* Input bar */}
      <View style={[styles.inputBar, { paddingBottom: Math.max(insets.bottom, SPACING.sm) }]}>
        <TouchableOpacity
          style={[styles.templateBtn, showTemplates && styles.templateBtnActive]}
          onPress={() => setShowTemplates((v) => !v)}
          hitSlop={8}
        >
          <Ionicons name="flash-outline" size={18} color={showTemplates ? TEAL : COLORS.gray} />
        </TouchableOpacity>
        <TextInput
          style={styles.input}
          value={draft}
          onChangeText={setDraft}
          placeholder="Message to customer…"
          placeholderTextColor={COLORS.gray}
          multiline
          onFocus={() => setShowTemplates(false)}
        />
        <TouchableOpacity
          style={[styles.sendBtn, (!draft.trim() || sending) && styles.sendBtnOff]}
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
  center: { flex: 1, alignItems: "center", justifyContent: "center" },

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
  infoBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  orderInfoStrip: {},
  headerMeta: { flex: 1, flexDirection: "row", alignItems: "center", gap: 10 },
  headerAvatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1.5,
    borderColor: "rgba(20,150,148,0.2)",
  },
  headerName: { fontSize: 15, fontWeight: "800", color: COLORS.black },
  headerOrder: { fontSize: 11, color: COLORS.gray, marginTop: 1 },

  listContent: { padding: SPACING.md, flexGrow: 1, paddingBottom: SPACING.lg },

  bubbleRow: { flexDirection: "row", marginBottom: 10, alignItems: "flex-end", gap: 8 },
  rowMe: { justifyContent: "flex-end" },
  rowThem: { justifyContent: "flex-start" },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(20,150,148,0.15)",
    flexShrink: 0,
  },
  bubble: { maxWidth: "78%", borderRadius: 16, padding: 10, paddingHorizontal: 14 },
  bubbleMe: { backgroundColor: TEAL, borderBottomRightRadius: 4 },
  bubbleThem: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: COLORS.grayBorder,
    elevation: 1,
  },
  senderLabel: { fontSize: 10.5, fontWeight: "700", marginBottom: 3 },
  bubbleText: { fontSize: 14, color: COLORS.black, lineHeight: 20 },
  bubbleTextMe: { color: COLORS.white },
  bubbleTime: { fontSize: 10, color: COLORS.gray, marginTop: 4, alignSelf: "flex-end" },
  bubbleTimeMe: { color: "rgba(255,255,255,0.7)" },
  tick: { fontSize: 10 },

  dateSep: { flexDirection: "row", alignItems: "center", marginVertical: 12, gap: 8 },
  sepLine: { flex: 1, height: StyleSheet.hairlineWidth, backgroundColor: COLORS.grayBorder },
  sepText: {
    fontSize: 11, color: COLORS.gray, fontWeight: "600",
    backgroundColor: "#EFF3F7", paddingHorizontal: 4,
  },

  emptyWrap: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 32, paddingTop: 40 },
  emptyIcon: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
    borderWidth: 1.5, borderColor: "rgba(20,150,148,0.15)",
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black, marginBottom: 6 },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: "center", lineHeight: 19 },

  errorBanner: {
    fontSize: 12, color: COLORS.error, textAlign: "center",
    paddingVertical: 4, backgroundColor: "#FEE2E2",
  },

  templateBox: {
    backgroundColor: COLORS.white,
    borderTopWidth: 1,
    borderTopColor: COLORS.grayBorder,
    paddingHorizontal: SPACING.md,
    paddingTop: 8,
    paddingBottom: 4,
  },
  templateTitle: {
    fontSize: 11, fontWeight: "700", color: COLORS.gray,
    textTransform: "uppercase", letterSpacing: 0.5, marginBottom: 4,
  },
  templateRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 9,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  templateText: { flex: 1, fontSize: 13, color: COLORS.black, lineHeight: 18 },

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
  templateBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: COLORS.offWhite,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  templateBtnActive: { backgroundColor: COLORS.primaryLight, borderColor: "rgba(20,150,148,0.3)" },
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
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: TEAL, alignItems: "center", justifyContent: "center",
  },
  sendBtnOff: { opacity: 0.4 },
});
