/**
 * Tailor order detail + stitching action buttons + progress photo upload.
 *
 * Stitching flow (matches backend OrderStatus.TAILOR_ALLOWED_TARGETS):
 *   cloth_received_by_tailor → "Start Stitching"      → stitching_started
 *   stitching_started        → "Mark In Progress"     → in_progress
 *   in_progress              → "Send for Final Check" → final_check
 *   final_check              → "Ready for Dispatch"   → ready_for_dispatch
 *   ready_for_dispatch / out_for_delivery / delivered / completed → read-only waiting state
 *
 * Photo upload is only allowed during stitching_started | in_progress |
 * final_check (backend's _PHOTO_UPLOAD_STAGES) - the upload card is hidden
 * outside that window rather than shown-but-erroring.
 *
 * Shows only: order code, service, measurements. No customer contact or payment info.
 */
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, FONTS, RADIUS, SHADOW, SPACING } from "../../constants/theme";
import ProgressGallery from "../../src/components/orders/ProgressGallery";
import {
    getOrderStatusMeta,
    normalizeOrderStatus,
    PHOTO_UPLOAD_STAGES,
} from "../../src/constants/orderStatus";
import {
    PHOTO_UPLOAD_STAGE_OPTIONS,
    uploadOrderPhoto,
} from "../../src/services/orderPhotoService";
import {
    getTailorOrder,
    updateStitchingStatus,
    type TailorStitchingStatus,
} from "../../src/services/tailorService";

const TEAL = "#0D9488";
const AMBER = "#D97706";
const GREEN = "#16A34A";
const PURPLE = "#7C3AED";

function SectionHeader({ icon, title }: { icon: string; title: string }) {
  return (
    <View style={styles.sectionHeader}>
      <Ionicons name={icon as any} size={15} color={TEAL} />
      <Text style={styles.sectionTitle}>{title}</Text>
    </View>
  );
}

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

function MeasGrid({ measurement }: { measurement: any }) {
  const fields = [
    { label: "Chest", value: measurement.chest },
    { label: "Waist", value: measurement.waist },
    { label: "Hips",  value: measurement.hips },
    { label: "Shoulder", value: measurement.shoulder },
    { label: "Neck",  value: measurement.neck },
    { label: "Sleeve", value: measurement.sleeve_length },
    { label: "Inseam", value: measurement.inseam },
    { label: "Height", value: measurement.height },
  ].filter((f) => f.value != null);

  if (fields.length === 0) return null;
  return (
    <View style={styles.measGrid}>
      {fields.map((f) => (
        <View key={f.label} style={styles.measCell}>
          <Text style={styles.measLabel}>{f.label}</Text>
          <Text style={styles.measValue}>{f.value}&quot;</Text>
        </View>
      ))}
    </View>
  );
}

/** The forward chain of stitching-stage transitions this screen can trigger. */
const NEXT_STITCHING_STATUS: Partial<Record<string, { target: TailorStitchingStatus; label: string; confirmMsg: string }>> = {
  cloth_received_by_tailor: {
    target: "stitching_started",
    label: "Start Stitching",
    confirmMsg: "Ready to begin stitching this order?",
  },
  stitching_started: {
    target: "in_progress",
    label: "Mark In Progress",
    confirmMsg: "Confirm stitching is now in progress?",
  },
  in_progress: {
    target: "final_check",
    label: "Send for Final Check",
    confirmMsg: "Confirm the garment is ready for final quality check?",
  },
  final_check: {
    target: "ready_for_dispatch",
    label: "Ready for Dispatch",
    confirmMsg: "Confirm the garment has passed final check and is ready for dispatch?",
  },
};

function UploadPhotoCard({
  orderId,
  onUploaded,
}: {
  orderId: number;
  onUploaded: () => void;
}) {
  const [stage, setStage] = useState<(typeof PHOTO_UPLOAD_STAGE_OPTIONS)[number]["value"]>(
    PHOTO_UPLOAD_STAGE_OPTIONS[0].value,
  );
  const [caption, setCaption] = useState("");
  const [visibleToCustomer, setVisibleToCustomer] = useState(true);
  const [pickedUri, setPickedUri] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const pickPhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow BookMyDarzi to access your photos to upload a progress photo.",
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPickedUri(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        "Permission needed",
        "Allow BookMyDarzi to use your camera to take a progress photo.",
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets[0]?.uri) {
      setPickedUri(result.assets[0].uri);
    }
  };

  const handleUpload = async () => {
    if (!pickedUri || uploading) return;
    setUploading(true);
    try {
      await uploadOrderPhoto(orderId, pickedUri, {
        stage,
        caption: caption.trim() || undefined,
        visibleToCustomer,
      });
      setPickedUri(null);
      setCaption("");
      onUploaded();
      Alert.alert("Uploaded", "Progress photo shared successfully.");
    } catch (e) {
      Alert.alert("Upload failed", e instanceof Error ? e.message : "Please try again.");
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.section}>
      <SectionHeader icon="camera-outline" title="Share Progress Photo" />

      <View style={styles.stageRow}>
        {PHOTO_UPLOAD_STAGE_OPTIONS.map((opt) => (
          <TouchableOpacity
            key={opt.value}
            style={[styles.stageChip, stage === opt.value && styles.stageChipActive]}
            onPress={() => setStage(opt.value)}
          >
            <Text style={[styles.stageChipText, stage === opt.value && styles.stageChipTextActive]}>
              {opt.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {pickedUri ? (
        <View style={styles.previewWrap}>
          <Ionicons name="image" size={18} color={TEAL} />
          <Text style={styles.previewText} numberOfLines={1}>
            Photo selected - ready to upload
          </Text>
          <TouchableOpacity onPress={() => setPickedUri(null)} hitSlop={8}>
            <Ionicons name="close-circle" size={20} color={COLORS.gray} />
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.pickRow}>
          <TouchableOpacity style={styles.pickBtn} onPress={takePhoto}>
            <Ionicons name="camera-outline" size={18} color={TEAL} />
            <Text style={styles.pickBtnText}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.pickBtn} onPress={pickPhoto}>
            <Ionicons name="images-outline" size={18} color={TEAL} />
            <Text style={styles.pickBtnText}>Gallery</Text>
          </TouchableOpacity>
        </View>
      )}

      <TextInput
        style={styles.captionInput}
        placeholder="Add a caption (optional)"
        placeholderTextColor="#9CA3AF"
        value={caption}
        onChangeText={setCaption}
        maxLength={200}
      />

      <TouchableOpacity
        style={styles.visibilityRow}
        onPress={() => setVisibleToCustomer((v) => !v)}
      >
        <Ionicons
          name={visibleToCustomer ? "checkbox" : "square-outline"}
          size={20}
          color={visibleToCustomer ? TEAL : COLORS.gray}
        />
        <Text style={styles.visibilityText}>Visible to customer</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.uploadBtn, (!pickedUri || uploading) && styles.disabledBtn]}
        onPress={handleUpload}
        disabled={!pickedUri || uploading}
      >
        {uploading ? (
          <ActivityIndicator size="small" color="#fff" />
        ) : (
          <>
            <Ionicons name="cloud-upload-outline" size={18} color="#fff" />
            <Text style={styles.uploadBtnText}>Upload Photo</Text>
          </>
        )}
      </TouchableOpacity>
    </View>
  );
}

export default function TailorOrderDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [acting, setActing] = useState(false);
  const [photoRefreshKey, setPhotoRefreshKey] = useState(0);

  const orderId = Number(id);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getTailorOrder(orderId);
      setOrder(data);
    } catch (e: any) {
      setError(e?.message ?? "Failed to load order");
    } finally {
      setLoading(false);
    }
  }, [orderId]);

  useEffect(() => { load(); }, [load]);

  const rawStatus = order?.Status ?? order?.status ?? "";
  const status = normalizeOrderStatus(rawStatus);
  const meta = getOrderStatusMeta(status);
  const measurement = order?.measurement ?? order?.Measurement;
  const canUploadPhoto = PHOTO_UPLOAD_STAGES.has(status);
  const nextAction = NEXT_STITCHING_STATUS[status];
  const isTerminal = ["ready_for_dispatch", "out_for_delivery", "delivered", "completed"].includes(status);

  const runAction = () => {
    if (!nextAction) return;
    Alert.alert("Confirm", nextAction.confirmMsg, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm",
        style: "default",
        onPress: async () => {
          setActing(true);
          try {
            await updateStitchingStatus(orderId, nextAction.target);
            load();
          } catch (e: any) {
            Alert.alert("Error", e?.message ?? "Action failed");
          } finally {
            setActing(false);
          }
        },
      },
    ]);
  };

  const terminalMsg =
    status === "ready_for_dispatch"
      ? "Ready for dispatch - employee will collect and deliver"
      : status === "out_for_delivery"
      ? "Order is on its way to the customer"
      : status === "completed"
      ? "Order completed"
      : "Order delivered successfully";

  return (
    <View style={styles.root}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="arrow-back" size={20} color={COLORS.white} style={{ marginRight: 1.5 }} />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerCode} numberOfLines={1}>
            {order?.OrderCode ?? order?.order_code ?? `Order #${orderId}`}
          </Text>
          <Text style={styles.headerSub}>Order Details</Text>
        </View>
        <TouchableOpacity onPress={load} style={styles.backBtn} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
          <Ionicons name="refresh-outline" size={20} color={COLORS.white} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={TEAL} />
          <Text style={styles.loadingText}>Loading order…</Text>
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Ionicons name="alert-circle-outline" size={48} color={COLORS.error} />
          <Text style={styles.errorText}>{error}</Text>
          <TouchableOpacity style={styles.retryBtn} onPress={load}>
            <Ionicons name="refresh" size={15} color="#fff" />
            <Text style={styles.retryText}>Try Again</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <>
          <ScrollView
            contentContainerStyle={styles.scroll}
            showsVerticalScrollIndicator={false}
          >
            {/* Status banner */}
            <View style={styles.statusBanner}>
              <View style={[styles.statusIconWrap, { backgroundColor: TEAL + "22" }]}>
                <Ionicons name={meta.icon} size={20} color={TEAL} />
              </View>
              <View style={styles.statusTextBlock}>
                <Text style={[styles.statusLabel, { color: TEAL }]}>{meta.tailorLabel}</Text>
                <Text style={styles.statusHint}>{meta.description}</Text>
              </View>
            </View>

            {/* Order info */}
            <View style={styles.section}>
              <SectionHeader icon="receipt-outline" title="Order Info" />
              <InfoRow label="Order Code" value={order?.OrderCode ?? order?.order_code} />
              <InfoRow
                label="Ordered On"
                value={
                  order?.CreatedAt
                    ? new Date(order.CreatedAt).toLocaleString("en-IN", {
                        day: "numeric", month: "short", year: "numeric",
                        hour: "2-digit", minute: "2-digit",
                      })
                    : null
                }
              />
            </View>

            {/* Service */}
            {(order?.service?.name ?? order?.ServiceName) ? (
              <View style={styles.section}>
                <SectionHeader icon="shirt-outline" title="Service" />
                <InfoRow label="Service" value={order?.service?.name ?? order?.ServiceName} />
                <InfoRow label="Category" value={order?.service?.category ?? order?.category?.name} />
                {(order?.ClothDetails ?? order?.cloth_details) && (
                  <InfoRow label="Cloth" value={order?.ClothDetails ?? order?.cloth_details} />
                )}
                {(order?.CustomizationNotes ?? order?.customization_notes) && (
                  <InfoRow label="Customization" value={order?.CustomizationNotes ?? order?.customization_notes} />
                )}
                {(order?.FabricNotes ?? order?.fabric_notes) && (
                  <InfoRow label="Fabric Notes" value={order?.FabricNotes ?? order?.fabric_notes} />
                )}
              </View>
            ) : null}

            {/* Measurements */}
            <View style={styles.section}>
              <SectionHeader icon="body-outline" title="Measurements" />
              {measurement ? (
                <>
                  <View style={styles.measTopRow}>
                    {measurement.profile_name ? (
                      <View style={styles.measTag}>
                        <Ionicons name="person-outline" size={12} color={TEAL} />
                        <Text style={styles.measTagText}>{measurement.profile_name}</Text>
                      </View>
                    ) : null}
                    {measurement.gender ? (
                      <View style={[styles.measTag, { backgroundColor: "#EDE9FE" }]}>
                        <Text style={[styles.measTagText, { color: PURPLE }]}>{measurement.gender}</Text>
                      </View>
                    ) : null}
                    {(measurement.fit_preference ?? measurement.fit) ? (
                      <View style={[styles.measTag, { backgroundColor: "#FEF3C7" }]}>
                        <Text style={[styles.measTagText, { color: AMBER }]}>
                          {measurement.fit_preference ?? measurement.fit} fit
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  <MeasGrid measurement={measurement} />
                  {measurement.notes ? (
                    <View style={styles.measNotes}>
                      <Ionicons name="document-text-outline" size={13} color={COLORS.gray} />
                      <Text style={styles.measNotesText}>{measurement.notes}</Text>
                    </View>
                  ) : null}
                </>
              ) : (
                <View style={styles.noMeasBox}>
                  <Ionicons name="alert-circle-outline" size={22} color={AMBER} />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.noMeasTitle}>No measurements yet</Text>
                    <Text style={styles.noMeasSub}>Employee will update before cloth delivery</Text>
                  </View>
                </View>
              )}
            </View>

            {/* Progress photo upload - only during the tailor's active stitching window */}
            {canUploadPhoto && (
              <UploadPhotoCard
                orderId={orderId}
                onUploaded={() => setPhotoRefreshKey((k) => k + 1)}
              />
            )}

            {/* Progress photo gallery - always visible once any photo exists */}
            <View style={styles.section}>
              <SectionHeader icon="images-outline" title="Progress Photos" />
              <ProgressGallery key={photoRefreshKey} orderId={orderId} />
            </View>

            {/* Terminal state message */}
            {isTerminal && (
              <View style={styles.terminalCard}>
                <Ionicons
                  name={status === "completed" || status === "delivered" ? "checkmark-done-circle-outline" : "hourglass-outline"}
                  size={20}
                  color={status === "completed" || status === "delivered" ? GREEN : COLORS.gray}
                />
                <Text style={[styles.terminalText, (status === "completed" || status === "delivered") && { color: GREEN }]}>
                  {terminalMsg}
                </Text>
              </View>
            )}

            <View style={{ height: 100 }} />
          </ScrollView>

          {/* Bottom action bar */}
          {nextAction ? (
            <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: TEAL }, acting && styles.disabledBtn]}
                onPress={runAction}
                disabled={acting}
                activeOpacity={0.85}
              >
                {acting ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <>
                    <Ionicons name="checkmark-circle-outline" size={20} color="#fff" />
                    <Text style={styles.actionBtnText}>{nextAction.label}</Text>
                  </>
                )}
              </TouchableOpacity>
            </View>
          ) : isTerminal ? (
            <View style={[styles.actionBar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
              <View style={[styles.waitingBar, { backgroundColor: TEAL + "18" }]}>
                <Ionicons name={meta.icon} size={18} color={TEAL} />
                <Text style={[styles.waitingBarText, { color: TEAL }]}>{meta.tailorLabel}</Text>
              </View>
            </View>
          ) : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: "#F8FAFC" },

  // Header
  header: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: TEAL,
    paddingHorizontal: SPACING.md,
    paddingBottom: 12,
    gap: 10,
  },
  backBtn: {
    width: 38,
    height: 38,
    borderRadius: RADIUS.md,
    backgroundColor: "rgba(255,255,255,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  headerCenter: { flex: 1, alignItems: "center" },
  headerCode: { fontSize: 16, ...FONTS.bold, color: "#fff" },
  headerSub: { fontSize: 11, color: "rgba(255,255,255,0.7)", marginTop: 1 },

  // Loading / Error
  center: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12, padding: SPACING.lg },
  loadingText: { fontSize: 13, color: COLORS.gray },
  errorText: { fontSize: 14, color: COLORS.error, textAlign: "center", paddingHorizontal: 24 },
  retryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: TEAL,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: RADIUS.md,
    marginTop: 4,
  },
  retryText: { color: "#fff", ...FONTS.semiBold, fontSize: 13 },

  // Scroll
  scroll: { padding: SPACING.md, gap: 12 },

  // Status banner
  statusBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    backgroundColor: "#CCFBF1",
  },
  statusIconWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTextBlock: { flex: 1 },
  statusLabel: { fontSize: 15, ...FONTS.bold },
  statusHint: { fontSize: 12, color: COLORS.gray, marginTop: 2 },

  // Section
  section: {
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.xl,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
    ...SHADOW.card,
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    marginBottom: 12,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#E5E7EB",
  },
  sectionTitle: { fontSize: 12, ...FONTS.bold, color: "#374151", textTransform: "uppercase", letterSpacing: 0.6 },

  // Info rows
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#F3F4F6",
  },
  rowLabel: { fontSize: 13, color: COLORS.gray, flex: 1.2 },
  rowValue: { fontSize: 13, color: "#111827", ...FONTS.medium, flex: 2, textAlign: "right" },

  // Measurement grid
  measTopRow: { flexDirection: "row", flexWrap: "wrap", gap: 6, marginBottom: 12 },
  measTag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: TEAL + "12",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: RADIUS.full,
  },
  measTagText: { fontSize: 12, color: TEAL, ...FONTS.semiBold },
  measGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 8,
  },
  measCell: {
    width: "22%",
    backgroundColor: "#F8FAFC",
    borderRadius: RADIUS.md,
    padding: 10,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  measLabel: { fontSize: 10, color: COLORS.gray, ...FONTS.semiBold, textTransform: "uppercase", letterSpacing: 0.4 },
  measValue: { fontSize: 15, ...FONTS.bold, color: "#111827", marginTop: 3 },
  measNotes: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 7,
    marginTop: 6,
    backgroundColor: "#F9FAFB",
    padding: SPACING.sm,
    borderRadius: RADIUS.md,
  },
  measNotesText: { fontSize: 13, color: COLORS.gray, flex: 1, lineHeight: 18 },

  // No measurements
  noMeasBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    backgroundColor: "#FFFBEB",
    borderRadius: RADIUS.md,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#FDE68A",
  },
  noMeasTitle: { fontSize: 13, ...FONTS.semiBold, color: "#92400E" },
  noMeasSub: { fontSize: 12, color: "#B45309", marginTop: 2 },

  // Photo upload card
  stageRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  stageChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: RADIUS.full,
    backgroundColor: "#F3F4F6",
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  stageChipActive: {
    backgroundColor: TEAL + "18",
    borderColor: TEAL,
  },
  stageChipText: { fontSize: 12, ...FONTS.semiBold, color: COLORS.gray },
  stageChipTextActive: { color: TEAL },
  pickRow: { flexDirection: "row", gap: 10, marginBottom: 12 },
  pickBtn: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 12,
    borderRadius: RADIUS.md,
    backgroundColor: TEAL + "10",
    borderWidth: 1,
    borderColor: TEAL + "30",
  },
  pickBtnText: { fontSize: 13, ...FONTS.semiBold, color: TEAL },
  previewWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F0FDFA",
    borderRadius: RADIUS.md,
    padding: 10,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#99F6E4",
  },
  previewText: { flex: 1, fontSize: 13, color: TEAL, ...FONTS.medium },
  captionInput: {
    borderWidth: 1,
    borderColor: "#E5E7EB",
    borderRadius: RADIUS.md,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 13,
    color: "#111827",
    marginBottom: 10,
  },
  visibilityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 14,
  },
  visibilityText: { fontSize: 13, color: "#374151", ...FONTS.medium },
  uploadBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: TEAL,
    borderRadius: RADIUS.md,
    paddingVertical: 12,
  },
  uploadBtnText: { color: "#fff", fontSize: 14, ...FONTS.bold },

  // Terminal card
  terminalCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: COLORS.white,
    borderRadius: RADIUS.lg,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: "#E5E7EB",
  },
  terminalText: { fontSize: 14, color: COLORS.gray, flex: 1, ...FONTS.medium },

  // Action bar
  actionBar: {
    paddingHorizontal: SPACING.md,
    paddingTop: 12,
    backgroundColor: COLORS.white,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "#E5E7EB",
    ...SHADOW.strong,
  },
  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderRadius: RADIUS.lg,
    paddingVertical: 15,
    gap: 9,
  },
  disabledBtn: { opacity: 0.55 },
  actionBtnText: { color: "#fff", fontSize: 16, ...FONTS.bold },
  waitingBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: RADIUS.lg,
    paddingVertical: 14,
  },
  waitingBarText: { fontSize: 14, ...FONTS.semiBold },
});
