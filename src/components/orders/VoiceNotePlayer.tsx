import { Ionicons } from "@expo/vector-icons";
import { useAudioPlayer, useAudioPlayerStatus } from "expo-audio";
import React from "react";
import { StyleSheet, Text, TouchableOpacity } from "react-native";
import { COLORS, RADIUS } from "../../../constants/theme";

export interface VoiceNotePlayerProps {
  url: string;
  label?: string;
}

/**
 * Read-only playback for a voice note already recorded and uploaded
 * elsewhere (VoiceNoteRecorder.tsx handles record+upload; this is just the
 * play/pause chip shown afterward on order-details). Matches bmdadmin's
 * VoiceNoteChip (OrderMeasurementCard.tsx) so the same voice note looks and
 * behaves the same to the customer, Bridge, and the tailor.
 */
export default function VoiceNotePlayer({ url, label = "Play voice note" }: VoiceNotePlayerProps) {
  const player = useAudioPlayer({ uri: url });
  const status = useAudioPlayerStatus(player);

  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (status.didJustFinish || status.currentTime >= status.duration) {
      player.seekTo(0);
    }
    player.play();
  };

  return (
    <TouchableOpacity style={styles.chip} onPress={toggle} activeOpacity={0.8}>
      <Ionicons
        name={status.playing ? "pause" : "play"}
        size={14}
        color={COLORS.primaryDark}
      />
      <Text style={styles.label}>{status.playing ? "Playing…" : label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    backgroundColor: COLORS.primaryLight,
    borderRadius: RADIUS.full,
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  label: {
    fontSize: 13,
    fontWeight: "600",
    color: COLORS.primaryDark,
  },
});
