import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useRef } from "react";
import { View, Animated, StyleSheet, Text } from "react-native";

interface Props {
  /** True when a human agent is typing (not the AI). Changes avatar/color
   * so a real agent's typing bubble never looks identical to the bot's. */
  isAgent?: boolean;
  agentName?: string | null;
}

export function TypingIndicator({ isAgent = false, agentName }: Props) {
  const dots = [useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current, useRef(new Animated.Value(0)).current];

  useEffect(() => {
    const animations = dots.map((dot, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 150),
          Animated.timing(dot, { toValue: 1, duration: 300, useNativeDriver: true }),
          Animated.timing(dot, { toValue: 0, duration: 300, useNativeDriver: true }),
          Animated.delay(600),
        ]),
      ),
    );
    animations.forEach((a) => a.start());
    return () => animations.forEach((a) => a.stop());
  // `dots` wraps 3 stable useRef(...).current Animated.Values in a fresh
  // array literal each render - the refs themselves never change, so this
  // is intentionally mount-only.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <View style={styles.wrap}>
      <View style={styles.container}>
        <View style={[styles.avatar, isAgent && styles.avatarAgent]}>
          {isAgent ? (
            <Ionicons name="person" size={14} color="#fff" />
          ) : (
            <View style={styles.avatarDot} />
          )}
        </View>
        <View style={[styles.bubble, isAgent && styles.bubbleAgent]}>
          {dots.map((dot, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                isAgent && styles.dotAgent,
                { transform: [{ translateY: dot.interpolate({ inputRange: [0, 1], outputRange: [0, -5] }) }] },
              ]}
            />
          ))}
        </View>
      </View>
      {isAgent ? (
        <Text style={styles.label}>{agentName ?? "Agent"} is typing…</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingHorizontal: 12, marginVertical: 4 },
  container: { flexDirection: "row", alignItems: "flex-end" },
  avatar: { width: 28, height: 28, borderRadius: 14, backgroundColor: "#7c3aed", alignItems: "center", justifyContent: "center", marginRight: 6 },
  avatarAgent: { backgroundColor: "#0c6c75" },
  avatarDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#fff" },
  bubble: { flexDirection: "row", backgroundColor: "#f3f0ff", borderRadius: 16, borderBottomLeftRadius: 4, paddingHorizontal: 14, paddingVertical: 12, gap: 4, alignItems: "center" },
  bubbleAgent: { backgroundColor: "#e6f7f7" },
  dot: { width: 7, height: 7, borderRadius: 3.5, backgroundColor: "#7c3aed" },
  dotAgent: { backgroundColor: "#0c6c75" },
  label: { fontSize: 11, color: "#6b7280", marginLeft: 34, marginTop: 2 },
});
