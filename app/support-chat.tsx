import { useRouter, useLocalSearchParams } from "expo-router";
import { View, StyleSheet } from "react-native";
import { SupportChatScreen } from "../src/components/chat/SupportChatScreen";

export default function SupportChatPage() {
  const router = useRouter();
  const { orderId, issueCategory, sessionUuid } = useLocalSearchParams<{
    orderId?: string;
    issueCategory?: string;
    sessionUuid?: string;
  }>();

  return (
    <View style={styles.root}>
      <SupportChatScreen
        orderId={orderId ? Number(orderId) : undefined}
        issueCategory={issueCategory}
        sessionUuid={sessionUuid}
        onClose={() => router.back()}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#fff" },
});
