import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import React, { useRef, useState } from "react";
import { ActivityIndicator, Alert, StyleSheet, Text, TextInput, TouchableOpacity, View } from "react-native";
import { AttachmentPreview, type AttachmentUploadStatus } from "./AttachmentPreview";
import { toLocalFileUri } from "../../utils/localFileUri";

const MAX_LENGTH = 1000;

interface Props {
  onSend: (text: string) => void;
  /** Resolves to the uploaded attachment's URL (used as attachment_id - see
   * chatV2Service.uploadChatAttachment) or throws on failure. */
  onSendImage?: (uri: string) => Promise<void>;
  onTypingStart: () => void;
  onTypingStop: () => void;
  disabled?: boolean;
  sending?: boolean;
  sessionStatus?: string;
  wsConnected?: boolean;
}

export function MessageInput({
  onSend,
  onSendImage,
  onTypingStart,
  onTypingStop,
  disabled,
  sending,
  sessionStatus,
  wsConnected = true,
}: Props) {
  const [text, setText] = useState("");
  const [pendingImage, setPendingImage] = useState<{ uri: string; status: AttachmentUploadStatus } | null>(null);
  const typingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isTypingRef = useRef(false);

  const handleChangeText = (val: string) => {
    if (val.length > MAX_LENGTH) return;
    setText(val);
    if (!isTypingRef.current && val.length > 0) {
      isTypingRef.current = true;
      onTypingStart();
    }
    if (typingTimer.current) clearTimeout(typingTimer.current);
    typingTimer.current = setTimeout(() => {
      if (isTypingRef.current) {
        isTypingRef.current = false;
        onTypingStop();
      }
    }, 2000);
  };

  const handleSend = () => {
    const trimmed = text.trim();
    if (!trimmed || sending || !wsConnected) return;
    if (isTypingRef.current) {
      isTypingRef.current = false;
      onTypingStop();
    }
    onSend(trimmed);
    setText("");
  };

  const uploadImage = async (uri: string) => {
    if (!onSendImage) return;
    setPendingImage({ uri, status: "uploading" });
    try {
      // Gallery picks can be a content:// URI on Android, which RN's
      // FormData can't attach (see localFileUri.ts) - normalize to a real
      // file:// path before handing off to onSendImage's upload call.
      const localUri = await toLocalFileUri(uri);
      await onSendImage(localUri);
      setPendingImage(null);
    } catch {
      setPendingImage({ uri, status: "failed" });
    }
  };

  const pickFromLibrary = async () => {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsEditing: false,
    });
    if (result.canceled || !result.assets?.[0]) return;
    void uploadImage(result.assets[0].uri);
  };

  const takePhoto = async () => {
    const permission = await ImagePicker.requestCameraPermissionsAsync();
    if (!permission.granted) {
      Alert.alert("Permission needed", "Allow BookMyDarzi to use your camera to take a photo.");
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: false });
    if (result.canceled || !result.assets?.[0]) return;
    void uploadImage(result.assets[0].uri);
  };

  // Previously only the photo library was reachable here - a customer
  // wanting to show a live problem (e.g. a stitching defect, a wrong item)
  // had no way to capture a fresh photo on the spot, only pick an existing
  // one. A simple choice sheet on the one attach button, matching how the
  // rest of the app already offers both (see order-detail.tsx's pickPhoto/
  // takePhoto), rather than adding a second toolbar icon to this compact bar.
  const handlePickImage = () => {
    if (!onSendImage || disabled || !wsConnected) return;
    Alert.alert("Add a photo", undefined, [
      { text: "Take Photo", onPress: () => void takePhoto() },
      { text: "Choose from Library", onPress: () => void pickFromLibrary() },
      { text: "Cancel", style: "cancel" },
    ]);
  };

  const isResolved = sessionStatus === "resolved" || sessionStatus === "closed";

  if (isResolved) {
    return (
      <View style={styles.resolvedBar}>
        <Text style={styles.resolvedText}>This conversation has been resolved.</Text>
      </View>
    );
  }

  const sendDisabled = !text.trim() || sending || !wsConnected;

  return (
    <View>
      {pendingImage && (
        <View style={styles.previewRow}>
          <AttachmentPreview
            uri={pendingImage.uri}
            status={pendingImage.status}
            onRetry={pendingImage.status === "failed" ? () => uploadImage(pendingImage.uri) : undefined}
            onCancel={() => setPendingImage(null)}
          />
        </View>
      )}
      <View style={styles.container}>
        {onSendImage && (
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={handlePickImage}
            disabled={disabled || !wsConnected}
            hitSlop={8}
          >
            <Ionicons name="image-outline" size={22} color={disabled || !wsConnected ? "#c4c4c4" : "#0a8c8c"} />
          </TouchableOpacity>
        )}
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={handleChangeText}
          placeholder={disabled ? "Chat unavailable" : "Type a message..."}
          placeholderTextColor="#aaa"
          multiline
          maxLength={MAX_LENGTH}
          editable={!disabled}
          returnKeyType="default"
        />
        <TouchableOpacity
          style={[styles.sendBtn, sendDisabled && styles.sendBtnDisabled]}
          onPress={handleSend}
          disabled={sendDisabled}
          activeOpacity={0.75}
        >
          {sending ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : !wsConnected ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.sendIcon}>↑</Text>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: "row", alignItems: "flex-end", paddingHorizontal: 12, paddingVertical: 8, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f0f0f0", gap: 8 },
  attachBtn: { width: 38, height: 38, alignItems: "center", justifyContent: "center" },
  input: { flex: 1, backgroundColor: "#f5f5f5", borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, fontSize: 14, color: "#1a1a1a", maxHeight: 100 },
  sendBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: "#0a8c8c", alignItems: "center", justifyContent: "center" },
  sendBtnDisabled: { backgroundColor: "#b2d8d8" },
  sendIcon: { color: "#fff", fontSize: 18, fontWeight: "700" },
  resolvedBar: { padding: 14, backgroundColor: "#f0faf0", alignItems: "center" },
  resolvedText: { fontSize: 13, color: "#4caf50", fontWeight: "600" },
  previewRow: { paddingHorizontal: 12, paddingTop: 8, backgroundColor: "#fff", borderTopWidth: 1, borderTopColor: "#f0f0f0" },
});
