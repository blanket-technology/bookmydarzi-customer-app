import React, { memo } from "react";
import { StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, SPACING, TYPOGRAPHY } from "../../../../constants/theme";
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

  return (
    <View style={styles.row}>
      <View style={styles.dotCol}>
        <View
          style={[
            styles.dot,
            stage.completed && styles.dotCompleted,
            stage.current && styles.dotCurrent,
          ]}
        >
          {stage.completed && !stage.current && (
            <Ionicons name="checkmark" size={11} color={COLORS.white} />
          )}
        </View>
        {!isLast && (
          <View style={[styles.line, stage.completed && styles.lineCompleted]} />
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
});
