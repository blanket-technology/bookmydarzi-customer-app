import { Ionicons } from "@expo/vector-icons";
import {
  AudioModule,
  RecordingPresets,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from "expo-audio";
import React, { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, LayoutAnimation, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { COLORS, RADIUS } from "../../../constants/theme";
import { uploadOrderVoiceNote } from "../../services/apiOrderService";

// Bug fix: setLayoutAnimationEnabledExperimental is a documented no-op on
// React Native's New Architecture (this app has newArchEnabled: true) -
// see StyleReferencePicker.tsx's identical comment for the full reasoning.

// A short voice note (~60s cap) is generously covered by LOW_QUALITY (.m4a,
// 64kbps) - keeps the recorded file small while staying well within the
// backend's 5MB cap (_MAX_VOICE_NOTE_BYTES).
const MAX_DURATION_SECONDS = 60;

export interface VoiceNoteRecorderProps {
  url: string | null;
  onUploaded: (url: string) => void;
  onRemove: () => void;
}

function formatSeconds(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = Math.floor(totalSeconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/**
 * Optional voice-note recording, collapsed by default - matches
 * StyleReferencePicker's "optional add-on" pattern. For a customer who
 * finds speaking easier than typing notes, or wants to make sure a tailor
 * who reads slowly understands the requirement (see the tailor-literacy
 * discussion this shipped alongside).
 */
export default function VoiceNoteRecorder({ url, onUploaded, onRemove }: VoiceNoteRecorderProps) {
  const [expanded, setExpanded] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recorder = useAudioRecorder(RecordingPresets.LOW_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 200);

  const player = useAudioPlayer(url ? { uri: url } : null);
  const playerStatus = useAudioPlayerStatus(player);

  useEffect(() => {
    if (recorderState.isRecording && recorderState.durationMillis / 1000 >= MAX_DURATION_SECONDS) {
      void stopAndUpload();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recorderState.isRecording, recorderState.durationMillis]);

  const toggle = () => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((v) => !v);
  };

  const startRecording = useCallback(async () => {
    setError(null);
    const perm = await AudioModule.requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Microphone access needed",
        "Allow microphone access to record a voice note for your tailor.",
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
  }, [recorder]);

  const stopAndUpload = useCallback(async () => {
    if (!recorder.isRecording) return;
    await recorder.stop();
    const uri = recorder.uri;
    if (!uri) {
      setError("Recording failed. Please try again.");
      return;
    }
    setUploading(true);
    setError(null);
    try {
      const result = await uploadOrderVoiceNote(uri);
      onUploaded(result.url);
    } catch (e: any) {
      setError(e?.message || "Couldn't upload voice note. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [recorder, onUploaded]);

  const togglePlayback = useCallback(() => {
    if (playerStatus.playing) {
      player.pause();
    } else {
      if (playerStatus.didJustFinish || playerStatus.currentTime >= playerStatus.duration) {
        player.seekTo(0);
      }
      player.play();
    }
  }, [player, playerStatus]);

  if (url) {
    return (
      <View style={styles.addedRow}>
        <TouchableOpacity onPress={togglePlayback} style={styles.playBtn} hitSlop={8}>
          <Ionicons name={playerStatus.playing ? "pause" : "play"} size={16} color="#fff" />
        </TouchableOpacity>
        <View style={styles.addedTextWrap}>
          <View style={styles.addedTitleRow}>
            <Ionicons name="checkmark-circle" size={13} color="#16a34a" />
            <Text style={styles.addedTitle}>Voice note added</Text>
          </View>
          <Text style={styles.addedSubtitle}>
            {formatSeconds(playerStatus.duration || 0)} recording
          </Text>
        </View>
        <TouchableOpacity onPress={onRemove} hitSlop={8}>
          <Text style={styles.removeLink}>Remove</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View>
      <TouchableOpacity
        style={styles.promptRow}
        onPress={toggle}
        activeOpacity={0.75}
        accessibilityRole="button"
        accessibilityState={{ expanded }}
      >
        <Ionicons name="mic-outline" size={14} color="#0c6c75" />
        <Text style={styles.promptText}>Prefer to speak instead of typing?</Text>
        <View style={styles.promptCta}>
          <Text style={styles.promptCtaText}>{expanded ? "Close" : "Record"}</Text>
          <Ionicons name={expanded ? "chevron-up" : "chevron-forward"} size={13} color="#0c6c75" />
        </View>
      </TouchableOpacity>

      {expanded ? (
        <View style={styles.recordBox}>
          {uploading ? (
            <>
              <ActivityIndicator size="small" color="#0c6c75" />
              <Text style={styles.recordBoxText}>Uploading voice note…</Text>
            </>
          ) : recorderState.isRecording ? (
            <>
              <TouchableOpacity onPress={stopAndUpload} style={styles.stopBtn} hitSlop={8}>
                <Ionicons name="stop" size={16} color="#fff" />
              </TouchableOpacity>
              <Text style={styles.recordingText}>
                Recording… {formatSeconds(recorderState.durationMillis / 1000)} / {formatSeconds(MAX_DURATION_SECONDS)}
              </Text>
            </>
          ) : (
            <TouchableOpacity style={styles.recordBoxInner} onPress={startRecording} activeOpacity={0.8}>
              <Ionicons name="mic" size={18} color="#0c6c75" />
              <Text style={styles.recordBoxText}>Tap to record a voice note (up to 60s)</Text>
            </TouchableOpacity>
          )}
        </View>
      ) : null}
      {error ? <Text style={styles.errorText}>{error}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  promptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    paddingVertical: 8,
  },
  promptText: {
    flex: 1,
    fontSize: 12.5,
    fontWeight: "600",
    color: COLORS.gray,
  },
  promptCta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2,
  },
  promptCtaText: {
    fontSize: 12,
    fontWeight: "700",
    color: "#0c6c75",
  },
  recordBox: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderWidth: 1.5,
    borderColor: "#0c6c75",
    borderStyle: "dashed",
    borderRadius: RADIUS.sm,
    paddingVertical: 12,
    paddingHorizontal: 12,
    backgroundColor: "#F0FDFB",
    marginBottom: 4,
  },
  recordBoxInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    flex: 1,
  },
  recordBoxText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "600",
    color: "#0c6c75",
  },
  recordingText: {
    flex: 1,
    fontSize: 12,
    fontWeight: "700",
    color: COLORS.error,
  },
  stopBtn: {
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: COLORS.error,
    alignItems: "center",
    justifyContent: "center",
  },
  errorText: {
    fontSize: 11.5,
    color: COLORS.error,
    marginTop: -2,
    marginBottom: 4,
  },

  addedRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 6,
  },
  playBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#0c6c75",
    alignItems: "center",
    justifyContent: "center",
  },
  addedTextWrap: { flex: 1, gap: 3 },
  addedTitleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  addedTitle: { fontSize: 12.5, fontWeight: "700", color: COLORS.black },
  addedSubtitle: { fontSize: 11.5, color: COLORS.gray },
  removeLink: { fontSize: 11.5, fontWeight: "600", color: COLORS.error },
});
