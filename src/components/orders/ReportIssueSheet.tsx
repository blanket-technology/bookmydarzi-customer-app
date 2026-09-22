import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../constants/theme";
import { reportOrderIssue } from "../../services/apiOrderService";
import { trackIssueReported } from "../../services/mixpanelService";

export interface ReportIssueSheetProps {
  visible: boolean;
  orderId: number;
  onClose: () => void;
  /** Called after a successful report - parent should refresh the
   * order/tracking data so the new IN_REPAIR status shows immediately. */
  onReported: () => void;
}

/** Post-delivery inspection-window "Report an issue" form - only ever
 * rendered while OrderTrackingPayload.can_report_issue is true. Routes the
 * order back to the same tailor already assigned (no fresh broadcast), see
 * POST /orders/{id}/report-issue on the backend. */
export default function ReportIssueSheet({ visible, orderId, onClose, onReported }: ReportIssueSheetProps) {
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleClose = () => {
    if (submitting) return;
    setDescription("");
    setError(null);
    onClose();
  };

  const handleSubmit = async () => {
    if (description.trim().length < 5) {
      setError("Please describe the issue in a bit more detail.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await reportOrderIssue(orderId, description.trim());
      trackIssueReported({ order_id: orderId });
      setDescription("");
      onReported();
      onClose();
    } catch (e) {
      setError(
        e instanceof Error && e.message
          ? e.message
          : "Couldn't submit your report. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={handleClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.header}>
            <View style={styles.iconBox}>
              <Ionicons name="alert-circle-outline" size={22} color={COLORS.error} />
            </View>
            <View style={styles.headerText}>
              <Text style={styles.title}>Report an issue</Text>
              <Text style={styles.subtitle}>
                Your tailor will be notified directly and will fix it - no need to place a new order.
              </Text>
            </View>
            <TouchableOpacity onPress={handleClose} hitSlop={10} disabled={submitting}>
              <Ionicons name="close" size={22} color={COLORS.gray} />
            </TouchableOpacity>
          </View>

          <TextInput
            style={styles.input}
            value={description}
            onChangeText={setDescription}
            placeholder="What's wrong? e.g. 'The sleeve length is off' or 'A seam came loose'"
            placeholderTextColor={COLORS.gray}
            multiline
            numberOfLines={4}
            maxLength={1000}
            textAlignVertical="top"
            editable={!submitting}
          />

          {error ? <Text style={styles.errorText}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
            onPress={handleSubmit}
            disabled={submitting}
          >
            {submitting ? (
              <ActivityIndicator size="small" color={COLORS.white} />
            ) : (
              <Text style={styles.submitBtnText}>Submit Report</Text>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    padding: SPACING.lg,
    paddingBottom: SPACING.xl,
    gap: SPACING.md,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: SPACING.sm,
  },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FEF2F2",
    alignItems: "center",
    justifyContent: "center",
  },
  headerText: { flex: 1 },
  title: {
    ...TYPOGRAPHY.heading.h3,
    color: COLORS.black,
  },
  subtitle: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.gray,
    marginTop: 2,
  },
  input: {
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
    minHeight: 100,
    ...TYPOGRAPHY.body.md,
    color: COLORS.black,
  },
  errorText: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.error,
  },
  submitBtn: {
    backgroundColor: COLORS.error,
    borderRadius: RADIUS.full,
    paddingVertical: SPACING.sm + 2,
    alignItems: "center",
    justifyContent: "center",
  },
  submitBtnDisabled: {
    opacity: 0.6,
  },
  submitBtnText: {
    ...TYPOGRAPHY.label.md,
    color: COLORS.white,
    textTransform: "none",
    letterSpacing: 0,
  },
});
