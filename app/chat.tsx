/**
 * Order-scoped chat - now powered by AI (chat v2 system).
 * The AI has access to live order status via function calling.
 * Users can escalate to a human agent at any time.
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SupportChatScreen } from "../src/components/chat/SupportChatScreen";
import { parsePositiveId } from "../src/services/paymentService";

export default function OrderChatScreen() {
  const router = useRouter();
  const rawId = useLocalSearchParams<{ orderId?: string }>().orderId;
  const orderId = parsePositiveId(rawId) ?? undefined;

  return (
    <View style={styles.root}>
      <SupportChatScreen
        orderId={orderId}
        onClose={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
});
