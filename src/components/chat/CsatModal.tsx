import React, { useState } from "react";
import { Modal, View, Text, TouchableOpacity, StyleSheet } from "react-native";

interface Props {
  visible: boolean;
  onSubmit: (score: number) => void;
  onDismiss: () => void;
}

export function CsatModal({ visible, onSubmit, onDismiss }: Props) {
  const [selected, setSelected] = useState(0);
  const stars = [1, 2, 3, 4, 5];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>How was your experience?</Text>
          <Text style={styles.sub}>Rate your support session</Text>
          <View style={styles.stars}>
            {stars.map((s) => (
              <TouchableOpacity key={s} onPress={() => setSelected(s)} style={styles.star}>
                <Text style={[styles.starIcon, s <= selected && styles.starSelected]}>★</Text>
              </TouchableOpacity>
            ))}
          </View>
          <TouchableOpacity
            style={[styles.submitBtn, !selected && styles.submitDisabled]}
            onPress={() => selected && onSubmit(selected)}
            disabled={!selected}
          >
            <Text style={styles.submitText}>Submit</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={styles.skipBtn}>
            <Text style={styles.skipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.4)", justifyContent: "flex-end" },
  sheet: { backgroundColor: "#fff", borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 28, alignItems: "center" },
  title: { fontSize: 18, fontWeight: "700", color: "#1a1a1a", marginBottom: 4 },
  sub: { fontSize: 13, color: "#888", marginBottom: 20 },
  stars: { flexDirection: "row", gap: 10, marginBottom: 24 },
  star: { padding: 4 },
  starIcon: { fontSize: 36, color: "#ddd" },
  starSelected: { color: "#f59e0b" },
  submitBtn: { backgroundColor: "#0a8c8c", borderRadius: 12, paddingHorizontal: 32, paddingVertical: 12, width: "100%", alignItems: "center", marginBottom: 10 },
  submitDisabled: { backgroundColor: "#b2d8d8" },
  submitText: { color: "#fff", fontWeight: "700", fontSize: 15 },
  skipBtn: { padding: 10 },
  skipText: { color: "#aaa", fontSize: 13 },
});
