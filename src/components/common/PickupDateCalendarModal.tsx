/**
 * Full month-grid calendar for choosing a scheduled pickup date - replaces
 * the old 7-day horizontal chip row, which capped how far ahead a customer
 * could schedule (no backend limit actually requires that cap).
 *
 * Shared between the cart checkout flow (app/(tabs)/cart.tsx) and the
 * "Book Now" direct-checkout flow (app/buy-now-review.tsx) so both present
 * scheduling identically.
 */
import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS, RADIUS, SPACING } from "../../../constants/theme";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfDay(d: Date): Date {
  const copy = new Date(d);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

/** Builds the calendar grid for a given month - leading/trailing nulls pad
 * the first and last week out to a full 7-column row. */
function buildMonthGrid(year: number, month: number): (Date | null)[] {
  const firstDay = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const leadingBlanks = firstDay.getDay();

  const cells: (Date | null)[] = Array.from({ length: leadingBlanks }, () => null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(year, month, day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export interface PickupDateCalendarModalProps {
  visible: boolean;
  /** Currently selected ISO date ("YYYY-MM-DD"), or null if none chosen yet. */
  selectedDate: string | null;
  onSelect: (isoDate: string) => void;
  onClose: () => void;
  /** Earliest selectable date - defaults to tomorrow (pickup can't be scheduled for today). */
  minDate?: Date;
  /** How many months ahead the customer can navigate to - defaults to 6. */
  maxMonthsAhead?: number;
}

export default function PickupDateCalendarModal({
  visible,
  selectedDate,
  onSelect,
  onClose,
  minDate,
  maxMonthsAhead = 6,
}: PickupDateCalendarModalProps) {
  const effectiveMinDate = useMemo(() => {
    if (minDate) return startOfDay(minDate);
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return startOfDay(d);
  }, [minDate]);

  const [viewYear, setViewYear] = useState(effectiveMinDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(effectiveMinDate.getMonth());

  const grid = useMemo(() => buildMonthGrid(viewYear, viewMonth), [viewYear, viewMonth]);

  const today = useMemo(() => startOfDay(new Date()), []);
  const maxDate = useMemo(() => {
    const d = new Date(effectiveMinDate);
    d.setMonth(d.getMonth() + maxMonthsAhead);
    return d;
  }, [effectiveMinDate, maxMonthsAhead]);

  const canGoPrev =
    viewYear > effectiveMinDate.getFullYear() ||
    (viewYear === effectiveMinDate.getFullYear() && viewMonth > effectiveMinDate.getMonth());
  const canGoNext =
    viewYear < maxDate.getFullYear() ||
    (viewYear === maxDate.getFullYear() && viewMonth < maxDate.getMonth());

  const goPrevMonth = () => {
    if (!canGoPrev) return;
    if (viewMonth === 0) {
      setViewYear((y) => y - 1);
      setViewMonth(11);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (!canGoNext) return;
    if (viewMonth === 11) {
      setViewYear((y) => y + 1);
      setViewMonth(0);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const monthLabel = new Date(viewYear, viewMonth, 1).toLocaleDateString("en-IN", {
    month: "long",
    year: "numeric",
  });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
          <View style={styles.handle} />
          <Text style={styles.title}>Select Pickup Date</Text>

          <View style={styles.monthNav}>
            <TouchableOpacity
              onPress={goPrevMonth}
              disabled={!canGoPrev}
              style={[styles.navBtn, !canGoPrev && styles.navBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Previous month"
            >
              <Ionicons name="chevron-back" size={18} color={canGoPrev ? COLORS.primaryDark : COLORS.grayBorder} />
            </TouchableOpacity>
            <Text style={styles.monthLabel}>{monthLabel}</Text>
            <TouchableOpacity
              onPress={goNextMonth}
              disabled={!canGoNext}
              style={[styles.navBtn, !canGoNext && styles.navBtnDisabled]}
              accessibilityRole="button"
              accessibilityLabel="Next month"
            >
              <Ionicons name="chevron-forward" size={18} color={canGoNext ? COLORS.primaryDark : COLORS.grayBorder} />
            </TouchableOpacity>
          </View>

          <View style={styles.weekdayRow}>
            {WEEKDAY_LABELS.map((label, i) => (
              <Text key={`${label}-${i}`} style={styles.weekdayLabel}>
                {label}
              </Text>
            ))}
          </View>

          <View style={styles.grid}>
            {grid.map((date, i) => {
              if (!date) {
                return <View key={`blank-${i}`} style={styles.cell} />;
              }
              const iso = toIsoDate(date);
              const isPast = date < effectiveMinDate;
              const isToday = date.getTime() === today.getTime();
              const isSelected = selectedDate === iso;
              return (
                <TouchableOpacity
                  key={iso}
                  style={styles.cell}
                  disabled={isPast}
                  onPress={() => {
                    onSelect(iso);
                    onClose();
                  }}
                  activeOpacity={0.7}
                >
                  <View style={[styles.dayCircle, isSelected && styles.dayCircleSelected]}>
                    <Text
                      style={[
                        styles.dayText,
                        isPast && styles.dayTextDisabled,
                        isToday && !isSelected && styles.dayTextToday,
                        isSelected && styles.dayTextSelected,
                      ]}
                    >
                      {date.getDate()}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    paddingHorizontal: SPACING.md,
    paddingBottom: SPACING.xl,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: COLORS.grayBorder,
    alignSelf: "center",
    marginTop: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  title: { fontSize: 16, fontWeight: "700", color: COLORS.black, marginBottom: SPACING.sm },
  monthNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: SPACING.sm,
  },
  navBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: COLORS.grayLight,
  },
  navBtnDisabled: { opacity: 0.4 },
  monthLabel: { fontSize: 15, fontWeight: "700", color: COLORS.black },
  weekdayRow: { flexDirection: "row" },
  weekdayLabel: {
    flex: 1,
    textAlign: "center",
    fontSize: 12,
    fontWeight: "600",
    color: COLORS.gray,
    paddingVertical: 6,
  },
  grid: { flexDirection: "row", flexWrap: "wrap" },
  cell: { width: `${100 / 7}%`, alignItems: "center", paddingVertical: 4 },
  dayCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  dayCircleSelected: { backgroundColor: COLORS.primaryDark },
  dayText: { fontSize: 14, color: COLORS.black, fontWeight: "600" },
  dayTextDisabled: { color: COLORS.grayBorder },
  dayTextToday: { color: COLORS.primaryDark, fontWeight: "800" },
  dayTextSelected: { color: COLORS.white },
});
