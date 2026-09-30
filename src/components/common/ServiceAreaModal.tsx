import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS, SPACING } from "../../../constants/theme";

type Props = {
  visible: boolean;
  title: string;
  message: string;
  onNotifyMe?: () => void;
  onDismiss: () => void;
  onExploreServices?: () => void;
  notifyState?: "idle" | "submitting" | "done";
  /** Label for the secondary/dismiss button. Defaults to "OK" (a plain
   * acknowledgement fits the mid-flow callers - address save, checkout -
   * where the customer is dismissing an error to go back to what they were
   * doing). The launch-time ServiceAreaCheck popup passes something more
   * specific ("Maybe later") since there's no prior action to return to. */
  dismissLabel?: string;
};

/**
 * Themed replacement for Alert.alert("Could not save/place order", msg, [...])
 * on the "outside our current service area" rejection - the native OS alert
 * (grey system dialog, no branding) was jarring against the rest of the app
 * and, worse, was showing the raw "latitude: <message>" backend field-prefix
 * verbatim. Matches SessionExpiredModal.tsx's card/icon/title/message/button
 * shape so every full-screen app alert looks like one family.
 */
export default function ServiceAreaModal({
  visible,
  title,
  message,
  onNotifyMe,
  onDismiss,
  onExploreServices,
  notifyState = "idle",
  dismissLabel = "OK",
}: Props) {
  const isDone = notifyState === "done";
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <View style={[styles.iconBox, isDone && styles.iconBoxDone]}>
            <Ionicons
              name={isDone ? "checkmark-circle" : "location-outline"}
              size={30}
              color={isDone ? COLORS.success : COLORS.primaryDark}
            />
          </View>
          <Text style={styles.title}>{isDone ? "Thanks — you're on the list!" : title}</Text>
          <Text style={styles.message}>
            {isDone
              ? "We'll notify you the moment BookMyDarzi launches in your area. Meanwhile, take a look at what we offer."
              : message}
          </Text>

          {isDone ? (
            onExploreServices ? (
              <TouchableOpacity style={styles.btn} onPress={onExploreServices}>
                <Ionicons name="storefront-outline" size={17} color={COLORS.white} />
                <Text style={styles.btnText}>Explore our services</Text>
              </TouchableOpacity>
            ) : null
          ) : onNotifyMe ? (
            <TouchableOpacity
              style={[styles.btn, notifyState === "submitting" && styles.btnDisabled]}
              onPress={onNotifyMe}
              disabled={notifyState === "submitting"}
            >
              <Text style={styles.btnText}>
                {notifyState === "submitting" ? "Submitting…" : "I'm interested — notify me"}
              </Text>
            </TouchableOpacity>
          ) : null}

          <TouchableOpacity style={styles.secondaryBtn} onPress={onDismiss}>
            <Text style={styles.secondaryBtnText}>{isDone ? "Close" : dismissLabel}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    // Deliberately darker than the shared COLORS.overlay token (0.45) -
    // this dialog needs to read as fully blocking the home screen behind
    // it until the customer makes a choice, not as a light dim.
    backgroundColor: "rgba(0,0,0,0.72)",
    paddingHorizontal: SPACING.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    backgroundColor: COLORS.white,
    borderRadius: 28,
    padding: SPACING.xl,
    alignItems: "center",
  },
  iconBox: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: SPACING.md,
  },
  iconBoxDone: {
    backgroundColor: COLORS.successLight,
  },
  title: {
    fontSize: 18,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
  },
  message: {
    fontSize: 14,
    color: COLORS.gray,
    textAlign: "center",
    lineHeight: 20,
    marginTop: SPACING.sm,
  },
  btn: {
    marginTop: SPACING.lg,
    width: "100%",
    flexDirection: "row",
    gap: 8,
    backgroundColor: COLORS.primaryDark,
    borderRadius: RADIUS.full,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  btnDisabled: {
    opacity: 0.6,
  },
  btnText: {
    fontSize: 15,
    fontWeight: "700",
    color: COLORS.white,
  },
  secondaryBtn: {
    marginTop: SPACING.sm,
    paddingVertical: 10,
    alignItems: "center",
    width: "100%",
  },
  secondaryBtnText: {
    fontSize: 14,
    fontWeight: "600",
    color: COLORS.gray,
  },
});
