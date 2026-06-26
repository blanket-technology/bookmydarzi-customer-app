// /**
//  * Review / Checkout Screen
//  *
//  * Loads cart from GET /api/v1/cart, shows order summary, and places order via
//  * POST /api/v1/cart/checkout with ₹99 advance booking payment.
//  */
// import { Ionicons } from "@expo/vector-icons";
// import { useFocusEffect } from "@react-navigation/native";
// import { LinearGradient } from "expo-linear-gradient";
// import { useRouter } from "expo-router";
// import React, { useCallback, useRef, useState } from "react";
// import {
//   ActivityIndicator,
//   Alert,
//   ScrollView,
//   StyleSheet,
//   Text,
//   TouchableOpacity,
//   View,
// } from "react-native";
// import Animated, { FadeInDown } from "react-native-reanimated";
// import { useSafeAreaInsets } from "react-native-safe-area-context";

// import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
// import { useAddressStore } from "../src/store/useAddressStore";
// import { useCartStore } from "../src/store/useCartStore";
// import { useOrderStore } from "../src/store/useOrderStore";
// import type { CartServiceEntry } from "../src/types/cart";
// import { resolveCheckoutAddressId } from "../src/utils/checkoutNavigation";

// function formatMoney(amount: number): string {
//   return `₹${amount.toLocaleString("en-IN")}`;
// }

// export default function ReviewScreen() {
//   const insets = useSafeAreaInsets();
//   const router = useRouter();

//   const entries = useCartStore((s) => s.entries);
//   const itemCount = useCartStore((s) => s.itemCount);
//   const billing = useCartStore((s) => s.billing);

//   const subtotal = billing.itemTotal;
//   const gst = billing.cgstAmount + billing.sgstAmount;
//   const grandTotal = billing.totalAmount;

//   const advanceAmount = billing.advanceAmount;

//   const selectedAddressId = useCartStore((s) => s.selectedAddressId);
//   const setAddressId = useCartStore((s) => s.setAddressId);
//   const loading = useCartStore((s) => s.loading);
//   const mutating = useCartStore((s) => s.mutating);
//   const refreshCart = useCartStore((s) => s.refreshCart);
//   const checkout = useCartStore((s) => s.checkout);

//   const { addresses, fetchAddresses } = useAddressStore();
//   const [showPaymentInfo, setShowPaymentInfo] = useState(false);

//   useFocusEffect(
//     useCallback(() => {
//       void refreshCart({ silent: true, allowCreate: false }).catch(() => {});
//       void fetchAddresses().then(() => {
//         if (!useCartStore.getState().selectedAddressId) {
//           const resolved = resolveCheckoutAddressId();
//           if (resolved) setAddressId(resolved);
//         }
//       });
//     }, [fetchAddresses, refreshCart, setAddressId]),
//   );

//   const [submitting, setSubmitting] = useState(false);
//   const isSubmittingRef = useRef(false);

//   const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
//   const payAmount = advanceAmount;

//   if (!loading && (itemCount === 0 || entries.length === 0)) {
//     return (
//       <View style={[styles.root, { paddingTop: insets.top }]}>
//         <View style={styles.header}>
//           <TouchableOpacity
//             style={styles.backBtn}
//             onPress={() => router.back()}
//           >
//             <Ionicons name="arrow-back" size={22} color={COLORS.black} />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>Checkout</Text>
//           <View style={{ width: 40 }} />
//         </View>
//         <View style={styles.emptyWrap}>
//           <Ionicons name="cart-outline" size={48} color={COLORS.grayBorder} />
//           <Text style={styles.emptyText}>Your cart is empty.</Text>
//           <TouchableOpacity
//             style={styles.goCartBtn}
//             onPress={() => router.replace("/(tabs)/cart")}
//           >
//             <Text style={styles.goCartBtnText}>Go to Cart</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     );
//   }

//   if (!selectedAddressId) {
//     return (
//       <View style={[styles.root, { paddingTop: insets.top }]}>
//         <View style={styles.header}>
//           <TouchableOpacity
//             style={styles.backBtn}
//             onPress={() => router.back()}
//           >
//             <Ionicons name="arrow-back" size={22} color={COLORS.black} />
//           </TouchableOpacity>
//           <Text style={styles.headerTitle}>Checkout</Text>
//           <View style={{ width: 40 }} />
//         </View>
//         <View style={styles.emptyWrap}>
//           <Ionicons
//             name="location-outline"
//             size={48}
//             color={COLORS.grayBorder}
//           />
//           <Text style={styles.emptyText}>
//             Please select a delivery address.
//           </Text>
//           <TouchableOpacity
//             style={styles.goCartBtn}
//             onPress={() => router.push("/address")}
//           >
//             <Text style={styles.goCartBtnText}>Select Address</Text>
//           </TouchableOpacity>
//         </View>
//       </View>
//     );
//   }

//   const handleConfirmPay = async () => {
//     if (isSubmittingRef.current) return;
//     if (payAmount <= 0) {
//       Alert.alert("Checkout Failed", "Amount missing from backend");
//       return;
//     }
//     isSubmittingRef.current = true;
//     setSubmitting(true);

//     try {
//       const result = await checkout({
//         address_id: selectedAddressId,
//         payment_method: "online",
//       });

//       useOrderStore.getState().invalidateCache();

//       router.replace({
//         pathname: "/order-success" as any,
//         params: {
//           orderId: String(result.orderId),
//           amount: String(result.advanceAmount),
//           payment: "paid",
//         },
//       });
//     } catch (err) {
//       const msg =
//         err instanceof Error
//           ? err.message
//           : "Checkout failed. Please try again.";
//       Alert.alert("Checkout Failed", msg);
//     } finally {
//       setSubmitting(false);
//       isSubmittingRef.current = false;
//     }
//   };

//   return (
//     <View style={[styles.root, { paddingTop: insets.top }]}>
//       <View style={styles.header}>
//         <TouchableOpacity
//           style={styles.backBtn}
//           onPress={() => router.back()}
//           hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
//         >
//           <Ionicons name="arrow-back" size={22} color={COLORS.black} />
//         </TouchableOpacity>
//         <Text style={styles.headerTitle}>Checkout</Text>
//         <View style={{ width: 40 }} />
//       </View>

//       <ScrollView
//         showsVerticalScrollIndicator={false}
//         contentContainerStyle={styles.scroll}
//       >
//         <Animated.View
//           entering={FadeInDown.duration(400)}
//           style={styles.heroBanner}
//         >
//           <LinearGradient
//             colors={["#0c6c75", "#1aa3b0"]}
//             start={{ x: 0, y: 0 }}
//             end={{ x: 1, y: 1 }}
//             style={styles.heroGradient}
//           >
//             <Ionicons
//               name="receipt-outline"
//               size={36}
//               color="rgba(255,255,255,0.9)"
//             />
//             <Text style={styles.heroTitle}>Order Summary</Text>
//             <Text style={styles.heroSub}>
//               {itemCount} item{itemCount === 1 ? "" : "s"} in your cart
//             </Text>
//           </LinearGradient>
//         </Animated.View>

//         <Animated.View
//           entering={FadeInDown.delay(80).duration(400)}
//           style={styles.card}
//         >
//           <Text style={styles.cardTitle}>Services</Text>
//           {entries.map((entry) => (
//             <CartLineRow key={entry.id} entry={entry} />
//           ))}
//         </Animated.View>

//         <Animated.View
//           entering={FadeInDown.delay(140).duration(400)}
//           style={styles.card}
//         >
//           <Text style={styles.cardTitle}>Delivery Address</Text>
//           {selectedAddress ? (
//             <>
//               <ReviewRow
//                 icon="person-outline"
//                 label="Name"
//                 value={selectedAddress.full_name}
//               />
//               <ReviewRow
//                 icon="location-outline"
//                 label="Address"
//                 value={[
//                   selectedAddress.address_line_1,
//                   selectedAddress.address_line_2,
//                   selectedAddress.city,
//                   selectedAddress.state,
//                   selectedAddress.pincode,
//                 ]
//                   .filter(Boolean)
//                   .join(", ")}
//               />
//               <ReviewRow
//                 icon="call-outline"
//                 label="Mobile"
//                 value={selectedAddress.mobile}
//               />
//             </>
//           ) : (
//             <Text style={styles.missingText}>No address selected</Text>
//           )}
//         </Animated.View>

//         <Animated.View
//           entering={FadeInDown.delay(200).duration(400)}
//           style={styles.card}
//         >
//           <Text style={styles.cardTitle}>Price Details</Text>
//           <ReviewRow
//             icon="pricetag-outline"
//             label="Subtotal"
//             value={formatMoney(subtotal)}
//           />
//           {gst > 0 ? (
//             <ReviewRow
//               icon="calculator-outline"
//               label="GST"
//               value={formatMoney(gst)}
//             />
//           ) : null}
//           <ReviewRow
//             icon="wallet-outline"
//             label="Grand Total"
//             value={formatMoney(grandTotal)}
//             highlight
//           />
//         </Animated.View>

//         <TouchableOpacity
//           activeOpacity={0.85}
//           style={styles.payCard}
//           onPress={() => setShowPaymentInfo((prev) => !prev)}
//         >
//           <View style={styles.payRow}>
//             <Ionicons
//               name="card-outline"
//               size={20}
//               color={COLORS.primaryDark}
//             />

//             <Text style={styles.payTitle}>
//               Pay {formatMoney(payAmount)} To Start Service
//             </Text>

//             <Ionicons
//               name={showPaymentInfo ? "chevron-up" : "chevron-down"}
//               size={18}
//               color={COLORS.primaryDark}
//             />
//           </View>
//         </TouchableOpacity>

//         {showPaymentInfo && (
//           <Animated.View
//             entering={FadeInDown.duration(200)}
//             style={styles.payDetails}
//           >
//             <Text style={styles.payDesc}>
//               A {formatMoney(payAmount)} advance booking amount is required to
//               confirm and start your service request.
//             </Text>

//             <Text style={styles.payNote}>
//               This amount is non-refundable once the service process begins.
//             </Text>
//           </Animated.View>
//         )}
//         <Animated.View
//           entering={FadeInDown.delay(320).duration(400)}
//           style={styles.btnWrap}
//         >
//           <TouchableOpacity
//             style={[
//               styles.placeBtn,
//               (submitting || mutating || loading) && styles.placeBtnDisabled,
//             ]}
//             onPress={handleConfirmPay}
//             disabled={submitting || mutating || loading}
//             activeOpacity={0.85}
//           >
//             {submitting || mutating ? (
//               <>
//                 <ActivityIndicator color={COLORS.white} />
//                 <Text style={styles.placeBtnText}>Processing...</Text>
//               </>
//             ) : (
//               <>
//                 <Ionicons
//                   name="shield-checkmark-outline"
//                   size={22}
//                   color={COLORS.white}
//                 />
//                 <Text style={styles.placeBtnText}>
//                   Pay {formatMoney(payAmount)} & Confirm
//                 </Text>
//               </>
//             )}
//           </TouchableOpacity>
//         </Animated.View>

//         <View style={{ height: SPACING.xxl }} />
//       </ScrollView>
//     </View>
//   );
// }

// function CartLineRow({ entry }: { entry: CartServiceEntry }) {
//   return (
//     <View style={line.wrap}>
//       <View style={line.main}>
//         <Text style={line.name} numberOfLines={2}>
//           {entry.serviceName}
//         </Text>
//         {entry.measurement?.profileName ? (
//           <Text style={line.meta}>{entry.measurement.profileName}</Text>
//         ) : null}
//         <Text style={line.qty}>
//           Qty {entry.quantity} × {formatMoney(entry.unitPrice)}
//         </Text>
//       </View>
//       <Text style={line.total}>{formatMoney(entry.lineTotal)}</Text>
//     </View>
//   );
// }

// function ReviewRow({
//   icon,
//   label,
//   value,
//   highlight,
// }: {
//   icon: string;
//   label: string;
//   value: string;
//   highlight?: boolean;
// }) {
//   return (
//     <View style={row.wrap}>
//       <Ionicons
//         name={icon as any}
//         size={16}
//         color={highlight ? COLORS.primaryDark : COLORS.gray}
//       />
//       <View style={row.content}>
//         <Text style={row.label}>{label}</Text>
//         <Text style={[row.value, highlight && row.valueHighlight]}>
//           {value}
//         </Text>
//       </View>
//     </View>
//   );
// }

// const line = StyleSheet.create({
//   wrap: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     justifyContent: "space-between",
//     gap: SPACING.sm,
//     paddingVertical: SPACING.sm,
//     borderBottomWidth: 1,
//     borderBottomColor: COLORS.grayBorder,
//   },
//   main: { flex: 1 },
//   name: { fontSize: 14, fontWeight: "700", color: COLORS.black },
//   meta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
//   qty: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
//   total: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },
// });

// const row = StyleSheet.create({
//   wrap: {
//     flexDirection: "row",
//     alignItems: "flex-start",
//     gap: SPACING.sm,
//     paddingVertical: SPACING.sm,
//     borderBottomWidth: 1,
//     borderBottomColor: COLORS.grayBorder,
//   },
//   content: { flex: 1 },
//   label: { fontSize: 11, color: COLORS.gray, marginBottom: 2 },
//   value: { fontSize: 14, fontWeight: "500", color: COLORS.black },
//   valueHighlight: { color: COLORS.primaryDark, fontWeight: "700" },
// });

// const styles = StyleSheet.create({
//   root: { flex: 1, backgroundColor: COLORS.offWhite },
//   header: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "space-between",
//     paddingHorizontal: SPACING.lg,
//     paddingVertical: SPACING.md,
//     backgroundColor: COLORS.white,
//     borderBottomWidth: 1,
//     borderBottomColor: COLORS.grayBorder,
//   },
//   backBtn: {
//     width: 40,
//     height: 40,
//     borderRadius: 20,
//     backgroundColor: COLORS.grayLight,
//     alignItems: "center",
//     justifyContent: "center",
//   },
//   headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black },
//   scroll: { padding: SPACING.lg },
//   heroBanner: {
//     borderRadius: RADIUS.xl,
//     overflow: "hidden",
//     marginBottom: SPACING.lg,
//     ...SHADOW.card,
//   },
//   heroGradient: {
//     padding: SPACING.lg,
//     alignItems: "center",
//     gap: SPACING.sm,
//   },
//   heroTitle: { fontSize: 18, fontWeight: "800", color: COLORS.white },
//   heroSub: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
//   card: {
//     backgroundColor: COLORS.white,
//     borderRadius: RADIUS.lg,
//     padding: SPACING.md,
//     marginBottom: SPACING.md,
//     ...SHADOW.card,
//   },
//   cardTitle: {
//     fontSize: 15,
//     fontWeight: "700",
//     color: COLORS.black,
//     marginBottom: SPACING.sm,
//   },
//   payCard: {
//     backgroundColor: COLORS.primaryLight,
//     borderRadius: RADIUS.lg,
//     padding: SPACING.md,
//     borderWidth: 1,
//     borderColor: "rgba(12,108,117,0.15)",
//   },

//   payRow: {
//     flexDirection: "row",
//     alignItems: "center",
//     gap: SPACING.sm,
//   },

//   payDetails: {
//     backgroundColor: COLORS.white,
//     marginTop: SPACING.sm,
//     padding: SPACING.md,
//     borderRadius: RADIUS.lg,
//     borderWidth: 1,
//     borderColor: COLORS.grayBorder,
//   },
//   payTitle: {
//     flex: 1,
//     fontSize: 16,
//     fontWeight: "800",
//     color: COLORS.primaryDark,
//   },
//   payDesc: {
//     fontSize: 13,
//     color: COLORS.black,
//     lineHeight: 20,
//     marginBottom: SPACING.sm,
//   },
//   payNote: {
//     fontSize: 12,
//     color: COLORS.gray,
//     lineHeight: 18,
//     fontStyle: "italic",
//   },
//   missingText: { fontSize: 14, color: COLORS.error, fontStyle: "italic" },
//   btnWrap: { marginTop: SPACING.sm },
//   placeBtn: {
//     flexDirection: "row",
//     alignItems: "center",
//     justifyContent: "center",
//     gap: SPACING.sm,
//     backgroundColor: COLORS.primaryDark,
//     borderRadius: RADIUS.lg,
//     height: 56,
//     ...SHADOW.card,
//   },
//   placeBtnDisabled: { opacity: 0.6 },
//   placeBtnText: { fontSize: 17, fontWeight: "700", color: COLORS.white },
//   emptyWrap: {
//     flex: 1,
//     alignItems: "center",
//     justifyContent: "center",
//     gap: SPACING.md,
//     paddingHorizontal: SPACING.xl,
//   },
//   emptyText: { fontSize: 15, color: COLORS.gray, textAlign: "center" },
//   goCartBtn: {
//     backgroundColor: COLORS.primaryDark,
//     borderRadius: RADIUS.full,
//     paddingHorizontal: 28,
//     paddingVertical: 12,
//   },
//   goCartBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
// });

/**
 * Review / Checkout Screen
 *
 * Loads cart from GET /api/v1/cart, shows order summary, and places order via
 * POST /api/v1/cart/checkout with ₹99 advance booking payment. The remaining
 * balance is collected later (before delivery) via POST /api/v1/payments/balance.
 */
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useCallback, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Animated, { FadeInDown } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { COLORS, RADIUS, SHADOW, SPACING } from "../constants/theme";
import { useAddressStore } from "../src/store/useAddressStore";
import { useCartStore } from "../src/store/useCartStore";
import { useOrderStore } from "../src/store/useOrderStore";
import type { CartServiceEntry } from "../src/types/cart";
import { resolveCheckoutAddressId } from "../src/utils/checkoutNavigation";

function formatMoney(amount: number): string {
  return `₹${amount.toLocaleString("en-IN")}`;
}

export default function ReviewScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

  const entries = useCartStore((s) => s.entries);
  const itemCount = useCartStore((s) => s.itemCount);
  const billing = useCartStore((s) => s.billing);

  const subtotal = billing.itemTotal;
  const gst = billing.cgstAmount + billing.sgstAmount;
  const grandTotal = billing.totalAmount;

  const advanceAmount = billing.advanceAmount;
  const platformFee = billing.platformFee;
  const remainingAmount = billing.remainingAmount;

  const selectedAddressId = useCartStore((s) => s.selectedAddressId);
  const setAddressId = useCartStore((s) => s.setAddressId);
  const loading = useCartStore((s) => s.loading);
  const mutating = useCartStore((s) => s.mutating);
  const refreshCart = useCartStore((s) => s.refreshCart);
  const checkout = useCartStore((s) => s.checkout);

  const { addresses, fetchAddresses } = useAddressStore();
  const [showPaymentInfo, setShowPaymentInfo] = useState(false);

  useFocusEffect(
    useCallback(() => {
      void refreshCart({ silent: true, allowCreate: false }).catch(() => {});
      void fetchAddresses().then(() => {
        if (!useCartStore.getState().selectedAddressId) {
          const resolved = resolveCheckoutAddressId();
          if (resolved) setAddressId(resolved);
        }
      });
    }, [fetchAddresses, refreshCart, setAddressId]),
  );

  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);

  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);
  const payAmount = advanceAmount;

  if (!loading && (itemCount === 0 || entries.length === 0)) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons name="cart-outline" size={48} color={COLORS.grayBorder} />
          <Text style={styles.emptyText}>Your cart is empty.</Text>
          <TouchableOpacity
            style={styles.goCartBtn}
            onPress={() => router.replace("/(tabs)/cart")}
          >
            <Text style={styles.goCartBtnText}>Go to Cart</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (!selectedAddressId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top }]}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={22} color={COLORS.black} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Checkout</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={styles.emptyWrap}>
          <Ionicons
            name="location-outline"
            size={48}
            color={COLORS.grayBorder}
          />
          <Text style={styles.emptyText}>
            Please select a delivery address.
          </Text>
          <TouchableOpacity
            style={styles.goCartBtn}
            onPress={() => router.push("/address")}
          >
            <Text style={styles.goCartBtnText}>Select Address</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const handleConfirmPay = async () => {
    if (isSubmittingRef.current) return;
    if (payAmount <= 0) {
      Alert.alert("Checkout Failed", "Amount missing from backend");
      return;
    }
    isSubmittingRef.current = true;
    setSubmitting(true);

    try {
      const result = await checkout({
        address_id: selectedAddressId,
        payment_method: "online",
      });

      useOrderStore.getState().invalidateCache();

      router.replace({
        pathname: "/order-success" as any,
        params: {
          orderId: String(result.orderId),
          amount: String(result.advanceAmount),
          remaining: String(result.remainingAmount ?? 0),
          payment: "advance_paid",
        },
      });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Checkout failed. Please try again.";
      Alert.alert("Checkout Failed", msg);
    } finally {
      setSubmitting(false);
      isSubmittingRef.current = false;
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.back()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Ionicons name="arrow-back" size={22} color={COLORS.black} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Checkout</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        <Animated.View
          entering={FadeInDown.duration(400)}
          style={styles.heroBanner}
        >
          <LinearGradient
            colors={["#0c6c75", "#1aa3b0"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <Ionicons
              name="receipt-outline"
              size={36}
              color="rgba(255,255,255,0.9)"
            />
            <Text style={styles.heroTitle}>Order Summary</Text>
            <Text style={styles.heroSub}>
              {itemCount} item{itemCount === 1 ? "" : "s"} in your cart
            </Text>
          </LinearGradient>
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(80).duration(400)}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>Services</Text>
          {entries.map((entry) => (
            <CartLineRow key={entry.id} entry={entry} />
          ))}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(140).duration(400)}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>Delivery Address</Text>
          {selectedAddress ? (
            <>
              <ReviewRow
                icon="person-outline"
                label="Name"
                value={selectedAddress.full_name}
              />
              <ReviewRow
                icon="location-outline"
                label="Address"
                value={[
                  selectedAddress.address_line_1,
                  selectedAddress.address_line_2,
                  selectedAddress.city,
                  selectedAddress.state,
                  selectedAddress.pincode,
                ]
                  .filter(Boolean)
                  .join(", ")}
              />
              <ReviewRow
                icon="call-outline"
                label="Mobile"
                value={selectedAddress.mobile}
              />
            </>
          ) : (
            <Text style={styles.missingText}>No address selected</Text>
          )}
        </Animated.View>

        <Animated.View
          entering={FadeInDown.delay(200).duration(400)}
          style={styles.card}
        >
          <Text style={styles.cardTitle}>Price Details</Text>
          <ReviewRow
            icon="pricetag-outline"
            label="Subtotal"
            value={formatMoney(subtotal)}
          />
          {gst > 0 ? (
            <ReviewRow
              icon="calculator-outline"
              label="GST"
              value={formatMoney(gst)}
            />
          ) : null}
          {platformFee > 0 ? (
            <ReviewRow
              icon="construct-outline"
              label="Booking Amount"
              value={formatMoney(platformFee)}
            />
          ) : null}
          <ReviewRow
            icon="wallet-outline"
            label="Grand Total"
            value={formatMoney(grandTotal)}
            highlight
          />
          <ReviewRow
            icon="card-outline"
            label="Pay Now (Advance)"
            value={formatMoney(advanceAmount)}
          />
          {remainingAmount > 0 ? (
            <ReviewRow
              icon="time-outline"
              label="Balance Due Later"
              value={formatMoney(remainingAmount)}
            />
          ) : null}
        </Animated.View>

        <TouchableOpacity
          activeOpacity={0.85}
          style={styles.payCard}
          onPress={() => setShowPaymentInfo((prev) => !prev)}
        >
          <View style={styles.payRow}>
            <Ionicons
              name="card-outline"
              size={20}
              color={COLORS.primaryDark}
            />

            <Text style={styles.payTitle}>
              Pay {formatMoney(payAmount)} To Start Service
            </Text>

            <Ionicons
              name={showPaymentInfo ? "chevron-up" : "chevron-down"}
              size={18}
              color={COLORS.primaryDark}
            />
          </View>
        </TouchableOpacity>

        {showPaymentInfo && (
          <Animated.View
            entering={FadeInDown.duration(200)}
            style={styles.payDetails}
          >
            <Text style={styles.payDesc}>
              A {formatMoney(payAmount)} advance booking amount is required to
              confirm and start your service request.
            </Text>

            {remainingAmount > 0 ? (
              <Text style={styles.payDesc}>
                The remaining balance of {formatMoney(remainingAmount)} will be
                collected later, before delivery.
              </Text>
            ) : null}

            <Text style={styles.payNote}>
              This advance is non-refundable once the service process begins.
            </Text>
          </Animated.View>
        )}
        <Animated.View
          entering={FadeInDown.delay(320).duration(400)}
          style={styles.btnWrap}
        >
          <TouchableOpacity
            style={[
              styles.placeBtn,
              (submitting || mutating || loading) && styles.placeBtnDisabled,
            ]}
            onPress={handleConfirmPay}
            disabled={submitting || mutating || loading}
            activeOpacity={0.85}
          >
            {submitting || mutating ? (
              <>
                <ActivityIndicator color={COLORS.white} />
                <Text style={styles.placeBtnText}>Processing...</Text>
              </>
            ) : (
              <>
                <Ionicons
                  name="shield-checkmark-outline"
                  size={22}
                  color={COLORS.white}
                />
                <Text style={styles.placeBtnText}>
                  Pay {formatMoney(payAmount)} & Confirm
                </Text>
              </>
            )}
          </TouchableOpacity>
        </Animated.View>

        <View style={{ height: SPACING.xxl }} />
      </ScrollView>
    </View>
  );
}

function CartLineRow({ entry }: { entry: CartServiceEntry }) {
  return (
    <View style={line.wrap}>
      <View style={line.main}>
        <Text style={line.name} numberOfLines={2}>
          {entry.serviceName}
        </Text>
        {entry.measurement?.profileName ? (
          <Text style={line.meta}>{entry.measurement.profileName}</Text>
        ) : null}
        <Text style={line.qty}>
          Qty {entry.quantity} × {formatMoney(entry.unitPrice)}
        </Text>
      </View>
      <Text style={line.total}>{formatMoney(entry.lineTotal)}</Text>
    </View>
  );
}

function ReviewRow({
  icon,
  label,
  value,
  highlight,
}: {
  icon: string;
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <View style={row.wrap}>
      <Ionicons
        name={icon as any}
        size={16}
        color={highlight ? COLORS.primaryDark : COLORS.gray}
      />
      <View style={row.content}>
        <Text style={row.label}>{label}</Text>
        <Text style={[row.value, highlight && row.valueHighlight]}>
          {value}
        </Text>
      </View>
    </View>
  );
}

const line = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  main: { flex: 1 },
  name: { fontSize: 14, fontWeight: "700", color: COLORS.black },
  meta: { fontSize: 12, color: COLORS.gray, marginTop: 2 },
  qty: { fontSize: 12, color: COLORS.gray, marginTop: 4 },
  total: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },
});

const row = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  content: { flex: 1 },
  label: { fontSize: 11, color: COLORS.gray, marginBottom: 2 },
  value: { fontSize: 14, fontWeight: "500", color: COLORS.black },
  valueHighlight: { color: COLORS.primaryDark, fontWeight: "700" },
});

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
    backgroundColor: COLORS.grayLight,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 17, fontWeight: "700", color: COLORS.black },
  scroll: { padding: SPACING.lg },
  heroBanner: {
    borderRadius: RADIUS.xl,
    overflow: "hidden",
    marginBottom: SPACING.lg,
    ...SHADOW.card,
  },
  heroGradient: {
    padding: SPACING.lg,
    alignItems: "center",
    gap: SPACING.sm,
  },
  heroTitle: { fontSize: 18, fontWeight: "800", color: COLORS.white },
  heroSub: { fontSize: 13, color: "rgba(255,255,255,0.8)" },
  card: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    ...SHADOW.card,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.black,
    marginBottom: SPACING.sm,
  },
  payCard: {
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "rgba(12,108,117,0.15)",
  },

  payRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
  },

  payDetails: {
    backgroundColor: COLORS.white,
    marginTop: SPACING.sm,
    padding: SPACING.md,
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
  },
  payTitle: {
    flex: 1,
    fontSize: 16,
    fontWeight: "800",
    color: COLORS.primaryDark,
  },
  payDesc: {
    fontSize: 13,
    color: COLORS.black,
    lineHeight: 20,
    marginBottom: SPACING.sm,
  },
  payNote: {
    fontSize: 12,
    color: COLORS.gray,
    lineHeight: 18,
    fontStyle: "italic",
  },
  missingText: { fontSize: 14, color: COLORS.error, fontStyle: "italic" },
  btnWrap: { marginTop: SPACING.sm },
  placeBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.sm,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.lg,
    height: 56,
    ...SHADOW.card,
  },
  placeBtnDisabled: { opacity: 0.6 },
  placeBtnText: { fontSize: 17, fontWeight: "700", color: COLORS.white },
  emptyWrap: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: SPACING.md,
    paddingHorizontal: SPACING.xl,
  },
  emptyText: { fontSize: 15, color: COLORS.gray, textAlign: "center" },
  goCartBtn: {
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingHorizontal: 28,
    paddingVertical: 12,
  },
  goCartBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.white },
});
