import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useMemo, useState } from "react";
import {
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import Animated, {
    FadeIn,
    useAnimatedStyle,
    useSharedValue,
    withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, RADIUS, SPACING } from "../constants/theme";
import ScreenHeader from "../src/components/common/ScreenHeader";

// ─── Static FAQ data ──────────────────────────────────────────────────────────

type FaqCategory =
  | "all"
  | "booking"
  | "payments"
  | "services"
  | "account"
  | "delivery";

interface FaqItem {
  id: number;
  category: Exclude<FaqCategory, "all">;
  question: string;
  answer: string;
}

const CATEGORY_LABELS: Record<FaqCategory, string> = {
  all: "All",
  booking: "Booking",
  payments: "Payments",
  services: "Services",
  delivery: "Delivery",
  account: "Account",
};

const CATEGORY_ICONS: Record<FaqCategory, string> = {
  all: "apps-outline",
  booking: "calendar-outline",
  payments: "card-outline",
  services: "cut-outline",
  delivery: "bicycle-outline",
  account: "person-outline",
};

const FAQS: FaqItem[] = [
  // ── Booking ──
  {
    id: 1,
    category: "booking",
    question: "How do I book a tailoring service?",
    answer:
      "Browse our services from the Home screen, pick a service (e.g., Normal Stitching), choose your measurements, add it to the cart, select a delivery address, and tap 'Pay Now' to confirm your booking.",
  },
  {
    id: 2,
    category: "booking",
    question: "Can I book multiple services in one order?",
    answer:
      "Yes! Add as many services as you need to your cart before checking out. Each service can have its own measurements and person name.",
  },
  {
    id: 3,
    category: "booking",
    question: "Can I cancel my booking?",
    answer:
      "You can cancel an order before it is accepted by a tailor. Once a tailor is assigned, cancellations are subject to our cancellation policy. Raise a support ticket from the Help & Support section if you need assistance.",
  },
  {
    id: 4,
    category: "booking",
    question: "How do I track my order status?",
    answer:
      "Go to the 'Orders' tab to see all your orders and their current status - from Pending to In Progress, Ready, and Delivered.",
  },
  {
    id: 5,
    category: "booking",
    question: "What if I need to change my order details after booking?",
    answer:
      "Minor changes may be possible before the tailor starts work. Please contact our support team as soon as possible by raising a ticket under Help & Support.",
  },

  // ── Payments ──
  {
    id: 6,
    category: "payments",
    question: "When do I need to pay for my order?",
    answer:
      "The full order amount is charged when you book, if paying online, or collected as a single payment at delivery if you choose Cash on Delivery. There's no separate advance or balance payment to track.",
  },
  {
    id: 7,
    category: "payments",
    question: "Can I pay a Cash on Delivery order online instead?",
    answer:
      "Yes - open the order from Order Details and choose to pay the full amount online any time before delivery, instead of paying cash when it arrives.",
  },
  {
    id: 8,
    category: "payments",
    question: "What payment methods are accepted?",
    answer:
      "We accept all major payment methods via Razorpay - including UPI, credit/debit cards, net banking, and popular wallets.",
  },
  {
    id: 9,
    category: "payments",
    question: "My payment failed. What should I do?",
    answer:
      "If a payment fails, no amount is deducted. You can retry from the Order Details screen. If the amount was debited but the order is not confirmed, please contact support - we will resolve it within 24 hours.",
  },
  {
    id: 10,
    category: "payments",
    question: "How do refunds work?",
    answer:
      "Approved refunds are processed within 5–7 business days to your original payment method. You can view your refund status under Order Details.",
  },
  {
    id: 11,
    category: "payments",
    question: "Is my payment information secure?",
    answer:
      "Yes. All payments are processed by Razorpay, a PCI-DSS compliant gateway. BookMyDarzi never stores your card or UPI details.",
  },

  // ── Services ──
  {
    id: 12,
    category: "services",
    question: "What types of stitching services do you offer?",
    answer:
      "We offer a wide range - including normal stitching, designer stitching, alterations, kids' clothing, ethnic wear, and more. Browse all services on the Home screen.",
  },
  {
    id: 13,
    category: "services",
    question: "Do I need to provide measurements?",
    answer:
      "For most stitching services, measurements are required for the best fit. You can save your measurements under your profile and reuse them across orders.",
  },
  {
    id: 14,
    category: "services",
    question: "What if I am not satisfied with the finished garment?",
    answer:
      "We offer free alterations for any stitching mistakes on our part. If the issue is unresolved, you can raise a support ticket or request a refund through the app.",
  },
  {
    id: 15,
    category: "services",
    question: "Can I send my own fabric for stitching?",
    answer:
      "Yes, you can provide your own fabric. The tailor will collect it at the time of pickup or you can hand it over at a scheduled location.",
  },

  // ── Delivery ──
  {
    id: 16,
    category: "delivery",
    question: "How long does delivery take?",
    answer:
      "Standard orders are typically ready in 5–7 business days. Estimated delivery is shown on the Order Details screen based on the service type.",
  },
  {
    id: 17,
    category: "delivery",
    question: "Do you deliver to my location?",
    answer:
      "We currently serve Delhi NCR and selected pin codes. You can check serviceability by entering your address in the address form - a green badge confirms coverage.",
  },
  {
    id: 18,
    category: "delivery",
    question: "Can I change my delivery address after booking?",
    answer:
      "Address changes before the tailor is assigned may be possible. Please contact support immediately via the Help & Support section.",
  },
  {
    id: 19,
    category: "delivery",
    question: "How will the tailor collect and return my clothes?",
    answer:
      "Our tailor will visit your saved address for pickup. Once done, the garment is delivered back to the same address unless changed via support.",
  },

  // ── Account ──
  {
    id: 20,
    category: "account",
    question: "How do I update my profile details?",
    answer:
      "Go to the 'Profile' tab, tap the edit icon next to your name, update your details, and tap 'Save Changes'.",
  },
  {
    id: 21,
    category: "account",
    question: "How do I save or update my measurements?",
    answer:
      "Go to Profile → My Measurements. You can add measurements for different people (yourself, family members) and select them when adding a service to cart.",
  },
  {
    id: 22,
    category: "account",
    question: "Can I have multiple delivery addresses?",
    answer:
      "Yes. Go to Profile → Saved Addresses to add, edit, or remove addresses. You can set one as the default.",
  },
  {
    id: 23,
    category: "account",
    question: "How do I delete my account?",
    answer:
      "Please raise a support ticket under Help & Support with the subject 'Account Deletion Request'. Our team will process it within 7 business days.",
  },
  {
    id: 24,
    category: "account",
    question: "I forgot my password / cannot log in.",
    answer:
      "Tap 'Forgot Password' on the login screen to receive an OTP on your registered mobile number and reset your credentials.",
  },
];

// ─── Accordion item component ─────────────────────────────────────────────────

function FaqRow({
  item,
  isExpanded,
  onToggle,
}: {
  item: FaqItem;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const rotation = useSharedValue(isExpanded ? 1 : 0);
  React.useEffect(() => {
    rotation.value = withTiming(isExpanded ? 1 : 0, { duration: 220 });
  }, [isExpanded, rotation]);

  const chevronStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value * 180}deg` }],
  }));

  return (
    <TouchableOpacity
      style={styles.faqCard}
      activeOpacity={0.88}
      onPress={onToggle}
    >
      <View style={styles.faqRow}>
        <Text style={styles.faqQuestion}>{item.question}</Text>
        <Animated.View style={chevronStyle}>
          <Ionicons name="chevron-down" size={18} color={COLORS.primaryDark} />
        </Animated.View>
      </View>
      {isExpanded && (
        <Animated.Text
          entering={FadeIn.duration(180)}
          style={styles.faqAnswer}
        >
          {item.answer}
        </Animated.Text>
      )}
    </TouchableOpacity>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function FaqScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const [activeCategory, setActiveCategory] = useState<FaqCategory>("all");
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return FAQS.filter((f) => {
      const catMatch =
        activeCategory === "all" || f.category === activeCategory;
      const textMatch =
        !q || f.question.toLowerCase().includes(q) || f.answer.toLowerCase().includes(q);
      return catMatch && textMatch;
    });
  }, [activeCategory, search]);

  const categories = Object.keys(CATEGORY_LABELS) as FaqCategory[];

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      {/* Header */}
      <ScreenHeader title="FAQs" />

      {/* Hero banner */}
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="help-circle" size={32} color={COLORS.primaryDark} />
        </View>
        <Text style={styles.heroTitle}>How can we help?</Text>
        <Text style={styles.heroSub}>
          Browse common questions or search for a specific topic.
        </Text>
      </View>

      {/* Search bar */}
      <View style={styles.searchWrap}>
        <Ionicons name="search-outline" size={18} color={COLORS.gray} style={styles.searchIcon} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search questions…"
          placeholderTextColor={COLORS.gray}
          value={search}
          onChangeText={(t) => {
            setSearch(t);
            setExpandedId(null);
          }}
          returnKeyType="search"
          clearButtonMode="while-editing"
        />
        {search.length > 0 && Platform.OS === "android" ? (
          <TouchableOpacity onPress={() => setSearch("")} hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={COLORS.gray} />
          </TouchableOpacity>
        ) : null}
      </View>

      {/* Category chips - 3-per-row equal-width grid */}
      <View style={styles.categoryGrid}>
        {categories.map((cat) => {
          const active = activeCategory === cat;
          return (
            <TouchableOpacity
              key={cat}
              style={[styles.catChip, active && styles.catChipActive]}
              onPress={() => {
                setActiveCategory(cat);
                setExpandedId(null);
              }}
              activeOpacity={0.8}
            >
              <Ionicons
                name={CATEGORY_ICONS[cat] as any}
                size={14}
                color={active ? COLORS.white : COLORS.primaryDark}
              />
              <Text style={[styles.catChipText, active && styles.catChipTextActive]}>
                {CATEGORY_LABELS[cat]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* FAQ list */}
      <ScrollView
        contentContainerStyle={[
          styles.listContent,
          { paddingBottom: insets.bottom + 32 },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {filtered.length === 0 ? (
          <View style={styles.emptyWrap}>
            <Ionicons
              name="search-circle-outline"
              size={52}
              color={COLORS.grayBorder}
            />
            <Text style={styles.emptyTitle}>No results found</Text>
            <Text style={styles.emptySub}>
              Try a different keyword or browse all categories.
            </Text>
            <TouchableOpacity
              style={styles.clearBtn}
              onPress={() => {
                setSearch("");
                setActiveCategory("all");
              }}
            >
              <Text style={styles.clearBtnText}>Clear filters</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.resultCount}>
              {filtered.length} question{filtered.length !== 1 ? "s" : ""}
            </Text>
            {filtered.map((item) => (
              <FaqRow
                key={item.id}
                item={item}
                isExpanded={expandedId === item.id}
                onToggle={() =>
                  setExpandedId(expandedId === item.id ? null : item.id)
                }
              />
            ))}
          </>
        )}

        {/* Bottom CTA */}
        <View style={styles.ctaBanner}>
          <Ionicons
            name="chatbubble-ellipses-outline"
            size={22}
            color={COLORS.primaryDark}
          />
          <View style={{ flex: 1 }}>
            <Text style={styles.ctaTitle}>Still need help?</Text>
            <Text style={styles.ctaSub}>
              Our support team usually responds within a few hours.
            </Text>
          </View>
          <TouchableOpacity
            style={styles.ctaBtn}
            onPress={() => router.push("/support" as never)}
            activeOpacity={0.85}
          >
            <Text style={styles.ctaBtnText}>Contact Us</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite },

  hero: {
    alignItems: "center",
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    backgroundColor: COLORS.white,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  heroIcon: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.sm,
  },
  heroTitle: {
    fontSize: 20,
    fontWeight: "800",
    color: COLORS.black,
    marginBottom: 4,
  },
  heroSub: {
    fontSize: 13,
    color: COLORS.gray,
    textAlign: "center",
  },

  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: COLORS.white,
    marginHorizontal: SPACING.lg,
    marginTop: SPACING.md,
    borderRadius: RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    paddingHorizontal: SPACING.md,
    height: 46,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 4,
      },
      android: { elevation: 2 },
    }),
  },
  searchIcon: { marginRight: 8 },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.black,
    height: "100%",
  },

  categoryGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    paddingHorizontal: SPACING.lg,
    paddingTop: SPACING.md,
    paddingBottom: SPACING.sm,
    gap: 8,
  },
  catChip: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    // Each chip is exactly 1/3 of the row (2 gaps of 8px each in a 3-col row)
    flexBasis: "30%",
    flexGrow: 1,
    height: 40,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  catChipActive: {
    backgroundColor: COLORS.primaryDark,
    borderColor: COLORS.primaryDark,
  },
  catChipText: { fontSize: 12, fontWeight: "600", color: COLORS.gray },
  catChipTextActive: { color: COLORS.white, fontWeight: "700" },

  listContent: { paddingHorizontal: SPACING.lg, paddingTop: 4 },

  resultCount: {
    fontSize: 12,
    color: COLORS.gray,
    fontWeight: "600",
    marginBottom: SPACING.sm,
  },

  faqCard: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 3,
      },
      android: { elevation: 1 },
    }),
  },
  faqRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  faqQuestion: {
    flex: 1,
    fontSize: 14,
    fontWeight: "700",
    color: COLORS.black,
    lineHeight: 20,
  },
  faqAnswer: {
    fontSize: 13,
    color: COLORS.gray,
    lineHeight: 20,
    marginTop: SPACING.sm,
  },

  emptyWrap: {
    alignItems: "center",
    paddingVertical: SPACING.xxl,
    gap: SPACING.sm,
  },
  emptyTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  emptySub: { fontSize: 13, color: COLORS.gray, textAlign: "center" },
  clearBtn: {
    marginTop: SPACING.sm,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.full,
    backgroundColor: COLORS.primaryLight,
  },
  clearBtnText: {
    fontSize: 13,
    fontWeight: "700",
    color: COLORS.primaryDark,
  },

  ctaBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.md,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginTop: SPACING.md,
    borderWidth: 1,
    borderColor: "#b2e8ed",
  },
  ctaTitle: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  ctaSub: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  ctaBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.md,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  ctaBtnText: { fontSize: 12, fontWeight: "700", color: COLORS.white },
});
