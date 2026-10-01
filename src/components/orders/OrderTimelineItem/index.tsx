import React, { memo } from "react";
import { Image, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS, SPACING, TYPOGRAPHY } from "../../../../constants/theme";
import { orderDisplayValue } from "../../../types/api";
import type { OrderTimelineStage } from "../../../types/api";

export interface OrderTimelineItemProps {
  stage: OrderTimelineStage;
  /** Hide the connector line below the last item. */
  isLast?: boolean;
}

function formatTimestamp(ts: string | null): string | null {
  if (!ts) return null;
  const d = new Date(ts);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString("en-IN", {
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

const OrderTimelineItem = memo(({ stage, isLast = false }: OrderTimelineItemProps) => {
  const timeLabel = formatTimestamp(stage.timestamp);
  // Bug fix: the backend marks the customer's actual latest-reached status
  // as current=true, completed=false (e.g. "Tailor Assigned" right after
  // a tailor accepts - the next step, pickup, hasn't started). That
  // "current, not completed" pairing used to render as a hollow ring with
  // no checkmark, identical to a stage that hasn't happened at all - a
  // customer looking at their own order's current stage saw it looking
  // exactly like a future, not-yet-reached step. A stage the order has
  // actually reached (current OR completed) should always look reached;
  // the hollow ring has no remaining use case now that this treats
  // "current" as reached too, but is left in the stylesheet in case a
  // future genuinely-in-progress-with-no-milestone-yet state needs it.
  const reached = stage.completed || stage.current;

  return (
    <View style={styles.row}>
      <View style={styles.dotCol}>
        <View style={[styles.dot, reached && styles.dotCompleted]}>
          {reached && (
            <Ionicons name="checkmark" size={11} color={COLORS.white} />
          )}
        </View>
        {!isLast && (
          <View style={[styles.line, reached && styles.lineCompleted]} />
        )}
      </View>

      <View style={styles.content}>
        <Text
          style={[styles.title, stage.current && styles.titleCurrent]}
          numberOfLines={2}
        >
          {orderDisplayValue(stage.title)}
        </Text>
        {stage.description ? (
          <Text style={styles.description} numberOfLines={3}>
            {stage.description}
          </Text>
        ) : null}
        {timeLabel ? <Text style={styles.time}>{timeLabel}</Text> : null}
        {stage.note ? (
          <Text style={styles.note} numberOfLines={4}>
            {stage.note}
          </Text>
        ) : null}
        {/* Who was assigned - only present on "Pickup/Delivery Partner
            Assigned" pseudo-stages. Previously this entry carried only a
            bare title/timestamp with no identity, reading as an
            unexplained duplicate of the next real stage (e.g. "Pickup
            Completed") right after it. */}
        {stage.partner ? (
          <View style={styles.partnerRow}>
            {stage.partner.photo_url ? (
              <Image source={{ uri: stage.partner.photo_url }} style={styles.partnerAvatar} />
            ) : (
              <View style={styles.partnerAvatarFallback}>
                <Text style={styles.partnerAvatarInitial}>
                  {stage.partner.name.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
            <View style={styles.partnerInfo}>
              <Text style={styles.partnerName} numberOfLines={1}>
                {stage.partner.name}
              </Text>
              {stage.partner.mobile ? (
                <Text style={styles.partnerMobile}>{stage.partner.mobile}</Text>
              ) : null}
            </View>
          </View>
        ) : null}
      </View>
    </View>
  );
});

OrderTimelineItem.displayName = "OrderTimelineItem";
export default OrderTimelineItem;

const DOT_SIZE = 22;

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
  },
  dotCol: {
    width: DOT_SIZE,
    alignItems: "center",
  },
  dot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
    backgroundColor: COLORS.grayLight,
    borderWidth: 2,
    borderColor: COLORS.grayBorder,
    alignItems: "center",
    justifyContent: "center",
  },
  dotCompleted: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  dotCurrent: {
    backgroundColor: COLORS.white,
    borderColor: COLORS.primary,
    borderWidth: 3,
  },
  line: {
    width: 2,
    flex: 1,
    minHeight: 28,
    backgroundColor: COLORS.grayBorder,
    marginVertical: 2,
  },
  lineCompleted: {
    backgroundColor: COLORS.primary,
  },
  content: {
    flex: 1,
    paddingLeft: SPACING.md,
    paddingBottom: SPACING.lg,
  },
  title: {
    ...TYPOGRAPHY.body.lg,
    fontWeight: "700",
    color: COLORS.gray,
  },
  titleCurrent: {
    color: COLORS.black,
  },
  description: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.gray,
    marginTop: 2,
  },
  time: {
    ...TYPOGRAPHY.label.sm,
    color: COLORS.gray,
    marginTop: 4,
    textTransform: "none",
    letterSpacing: 0,
  },
  note: {
    ...TYPOGRAPHY.body.sm,
    color: COLORS.error,
    marginTop: 4,
  },
  partnerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: SPACING.sm,
    marginTop: SPACING.sm,
    backgroundColor: COLORS.offWhite,
    borderRadius: RADIUS.md,
    padding: SPACING.sm,
  },
  partnerAvatar: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },
  partnerAvatarFallback: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.primaryLight,
    alignItems: "center",
    justifyContent: "center",
  },
  partnerAvatarInitial: {
    ...TYPOGRAPHY.label.md,
    color: COLORS.primaryDark,
  },
  partnerInfo: {
    flex: 1,
  },
  partnerName: {
    ...TYPOGRAPHY.body.sm,
    fontWeight: "700",
    color: COLORS.black,
  },
  partnerMobile: {
    ...TYPOGRAPHY.label.sm,
    color: COLORS.gray,
    textTransform: "none",
    letterSpacing: 0,
  },
});
