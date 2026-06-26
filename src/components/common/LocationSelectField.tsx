import { Ionicons } from "@expo/vector-icons";
import React, { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { COLORS, RADIUS, SPACING } from "../../../constants/theme";

type Props = {
  label: string;
  required?: boolean;
  value: string;
  options: string[];
  placeholder: string;
  onSelect: (value: string) => void;
  error?: string;
};

export function LocationSelectField({
  label,
  required,
  value,
  options,
  placeholder,
  onSelect,
  error,
}: Props) {
  const [open, setOpen] = useState(false);

  const sortedOptions = useMemo(
    () => [...options].sort((a, b) => a.localeCompare(b)),
    [options],
  );

  return (
    <View>
      <Text style={styles.fieldLabel}>
        {label}
        {required ? <Text style={styles.required}> *</Text> : null}
      </Text>
      <TouchableOpacity
        style={[styles.selectTrigger, error ? styles.inputError : null]}
        onPress={() => setOpen(true)}
        activeOpacity={0.8}
      >
        <Text
          style={value ? styles.selectValue : styles.selectPlaceholder}
          numberOfLines={1}
        >
          {value || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color={COLORS.gray} />
      </TouchableOpacity>
      {error ? <Text style={styles.errorText}>{error}</Text> : null}

      <Modal
        visible={open}
        transparent
        animationType="slide"
        onRequestClose={() => setOpen(false)}
      >
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{label}</Text>
              <TouchableOpacity onPress={() => setOpen(false)} hitSlop={12}>
                <Ionicons name="close" size={22} color={COLORS.black} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={sortedOptions}
              keyExtractor={(item) => item}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => {
                const selected =
                  item.toLowerCase() === value.trim().toLowerCase();
                return (
                  <TouchableOpacity
                    style={[styles.optionRow, selected && styles.optionRowSelected]}
                    onPress={() => {
                      onSelect(item);
                      setOpen(false);
                    }}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        selected && styles.optionTextSelected,
                      ]}
                    >
                      {item}
                    </Text>
                    {selected ? (
                      <Ionicons
                        name="checkmark"
                        size={18}
                        color={COLORS.primaryDark}
                      />
                    ) : null}
                  </TouchableOpacity>
                );
              }}
              ListEmptyComponent={
                <Text style={styles.emptyOptions}>No options available</Text>
              }
            />
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fieldLabel: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.black,
    marginBottom: 6,
    marginTop: SPACING.sm,
  },
  required: { color: COLORS.error },
  selectTrigger: {
    backgroundColor: COLORS.grayLight,
    borderRadius: RADIUS.md,
    paddingHorizontal: SPACING.md,
    height: 46,
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: SPACING.sm,
  },
  selectValue: {
    flex: 1,
    fontSize: 14,
    color: COLORS.black,
  },
  selectPlaceholder: {
    flex: 1,
    fontSize: 14,
    color: COLORS.gray,
  },
  inputError: { borderColor: COLORS.error },
  errorText: { fontSize: 12, color: COLORS.error, marginTop: 4 },
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: RADIUS.xl,
    borderTopRightRadius: RADIUS.xl,
    maxHeight: "70%",
    paddingBottom: SPACING.lg,
  },
  sheetHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.grayBorder,
  },
  sheetTitle: { fontSize: 16, fontWeight: "700", color: COLORS.black },
  optionRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: COLORS.grayBorder,
  },
  optionRowSelected: { backgroundColor: COLORS.primaryLight },
  optionText: { fontSize: 15, color: COLORS.black },
  optionTextSelected: { fontWeight: "600", color: COLORS.primaryDark },
  emptyOptions: {
    textAlign: "center",
    padding: SPACING.lg,
    color: COLORS.gray,
    fontSize: 14,
  },
});
