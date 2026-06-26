import React, { useMemo, useState } from "react";
import {
  View,
  TextInput,
  StyleSheet,
  Pressable,
  type TextInputProps,
  type StyleProp,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { COLORS, RADIUS } from "../../../constants/theme";

type Props = Omit<TextInputProps, "secureTextEntry"> & {
  style?: StyleProp<ViewStyle>;
};

export function PasswordInput({ style, ...props }: Props) {
  const [visible, setVisible] = useState(false);

  const entry = useMemo(() => !visible, [visible]);

  return (
    <View style={[styles.wrap, style]}>
      <TextInput
        {...props}
        style={styles.input}
        secureTextEntry={entry}
        autoCapitalize={props.autoCapitalize ?? "none"}
        autoCorrect={props.autoCorrect ?? false}
        textContentType={props.textContentType ?? "password"}
      />
      <Pressable
        onPress={() => setVisible((v) => !v)}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={visible ? "Hide password" : "Show password"}
        style={({ pressed }) => [styles.eyeBtn, pressed && styles.eyePressed]}
      >
        <Ionicons
          name={visible ? "eye-off-outline" : "eye-outline"}
          size={18}
          color={COLORS.gray}
        />
      </Pressable>
    </View>
  );
}

export default PasswordInput;

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: COLORS.grayBorder,
    borderRadius: RADIUS.md,
    backgroundColor: COLORS.white,
    paddingRight: 10,
  },
  input: {
    flex: 1,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 14,
    color: "#0F172A",
  },
  eyeBtn: {
    width: 34,
    height: 34,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(15,23,42,0.04)",
  },
  eyePressed: { opacity: 0.7 },
});

