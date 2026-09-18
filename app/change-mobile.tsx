/**
 * Change mobile number - full backend flow already existed
 * (account_change.py / accountSecurityService.ts) but had no screen: the
 * profile's phone field was previously read-only with just a hint that
 * changes "require OTP verification" and no way to actually start that.
 *
 * Flow (3 steps, mirrors the backend exactly - see account_change_service.py):
 *  1. Send OTP to the CURRENT mobile (proves the caller controls it).
 *  2. Verify that OTP.
 *  3. Enter the new mobile number, send OTP to it, verify it - done.
 *
 * No password anywhere in this flow - receiving the OTP on the number
 * itself is the identity proof (see the backend's doc comment on
 * request_mobile_change_current for why a password gate here would lock
 * out most users).
 *
 * If the customer can no longer receive OTP on their current number at
 * all (lost/deactivated SIM), there is no self-serve bypass - that would
 * be a real account-takeover hole. Step 1 offers a "Chat with support"
 * escalation instead, routing to the existing /support-chat screen.
 */
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { COLORS, SPACING } from "../constants/theme";
import ScreenHeader from "../src/components/common/ScreenHeader";
import {
  requestChangeMobile,
  requestVerifyCurrentMobile,
  verifyChangeMobile,
  verifyCurrentMobile,
} from "../src/services/accountSecurityService";
import { useAuthStore } from "../store/useAuthStore";
import { useToastStore } from "../src/store/useToastStore";
import { getUserMobile } from "../src/utils/userPhone";

type Step = "start" | "verify-current" | "enter-new" | "verify-new";

export default function ChangeMobileScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user, fetchProfile, savedPhoneOverride } = useAuthStore();
  const toast = useToastStore((s) => s.show);

  const currentMobile = getUserMobile(user ?? undefined, savedPhoneOverride);

  const [step, setStep] = useState<Step>("start");
  const [loading, setLoading] = useState(false);
  const [currentOtp, setCurrentOtp] = useState("");
  const [newMobile, setNewMobile] = useState("");
  const [newOtp, setNewOtp] = useState("");
  const [error, setError] = useState("");

  const handleSendCurrentOtp = async () => {
    setError("");
    setLoading(true);
    try {
      await requestVerifyCurrentMobile();
      toast(`OTP sent to ${currentMobile}`);
      setStep("verify-current");
    } catch (err) {
      setError((err as any)?.message ?? "Could not send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCurrentOtp = async () => {
    if (currentOtp.trim().length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await verifyCurrentMobile(currentOtp.trim());
      setStep("enter-new");
    } catch (err) {
      setError((err as any)?.message ?? "Incorrect or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSendNewOtp = async () => {
    const cleaned = newMobile.replace(/\D/g, "");
    if (cleaned.length !== 10) {
      setError("Enter a valid 10-digit mobile number");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await requestChangeMobile(cleaned);
      setNewMobile(cleaned);
      toast(`OTP sent to ${cleaned}`);
      setStep("verify-new");
    } catch (err) {
      setError((err as any)?.message ?? "Could not send OTP. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyNewOtp = async () => {
    if (newOtp.trim().length !== 6) {
      setError("Enter the 6-digit code");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await verifyChangeMobile(newMobile, newOtp.trim());
      await fetchProfile();
      toast("Mobile number updated successfully");
      router.back();
    } catch (err) {
      setError((err as any)?.message ?? "Incorrect or expired code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.root, { paddingTop: insets.top }]}>
      <ScreenHeader title="Change Mobile Number" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {step === "start" ? (
            <>
              <View style={styles.iconCircle}>
                <Ionicons name="call-outline" size={26} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.stepTitle}>Verify your current number</Text>
              <Text style={styles.stepSub}>
                We&apos;ll send a 6-digit code to your registered number{" "}
                <Text style={{ fontWeight: "700", color: COLORS.black }}>{currentMobile || "on file"}</Text>{" "}
                to confirm it&apos;s you before changing it.
              </Text>

              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleSendCurrentOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send OTP</Text>
                )}
              </TouchableOpacity>

              <View style={styles.divider} />

              <Text style={styles.supportPrompt}>Can&apos;t access this number anymore?</Text>
              <TouchableOpacity
                style={styles.supportBtn}
                onPress={() => router.push("/support-chat" as never)}
              >
                <Ionicons name="chatbubble-ellipses-outline" size={16} color={COLORS.primaryDark} />
                <Text style={styles.supportBtnText}>Chat with support</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {step === "verify-current" ? (
            <>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={26} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.stepTitle}>Enter the code</Text>
              <Text style={styles.stepSub}>
                Sent to {currentMobile || "your registered number"}. Valid for 2 minutes.
              </Text>

              <TextInput
                style={styles.otpInput}
                value={currentOtp}
                onChangeText={(t) => setCurrentOtp(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                placeholderTextColor={COLORS.gray}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleVerifyCurrentOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Verify</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendCurrentOtp} disabled={loading} style={styles.resendBtn}>
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            </>
          ) : null}

          {step === "enter-new" ? (
            <>
              <View style={styles.iconCircle}>
                <Ionicons name="phone-portrait-outline" size={26} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.stepTitle}>Enter your new number</Text>
              <Text style={styles.stepSub}>We&apos;ll send a verification code to this number.</Text>

              <TextInput
                style={styles.input}
                value={newMobile}
                onChangeText={(t) => setNewMobile(t.replace(/\D/g, "").slice(0, 10))}
                placeholder="Enter new mobile number"
                placeholderTextColor={COLORS.gray}
                keyboardType="number-pad"
                maxLength={10}
                autoFocus
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleSendNewOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : null}

          {step === "verify-new" ? (
            <>
              <View style={styles.iconCircle}>
                <Ionicons name="shield-checkmark-outline" size={26} color={COLORS.primaryDark} />
              </View>
              <Text style={styles.stepTitle}>Enter the code</Text>
              <Text style={styles.stepSub}>Sent to {newMobile}. Valid for 2 minutes.</Text>

              <TextInput
                style={styles.otpInput}
                value={newOtp}
                onChangeText={(t) => setNewOtp(t.replace(/\D/g, "").slice(0, 6))}
                placeholder="••••••"
                placeholderTextColor={COLORS.gray}
                keyboardType="number-pad"
                maxLength={6}
                autoFocus
              />
              {error ? <Text style={styles.errorText}>{error}</Text> : null}

              <TouchableOpacity
                style={[styles.primaryBtn, loading && styles.primaryBtnDisabled]}
                onPress={handleVerifyNewOtp}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <Text style={styles.primaryBtnText}>Confirm New Number</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={handleSendNewOtp} disabled={loading} style={styles.resendBtn}>
                <Text style={styles.resendText}>Resend code</Text>
              </TouchableOpacity>
            </>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.offWhite ?? "#F6F8F8" },
  content: { padding: SPACING.md, paddingTop: SPACING.lg, paddingBottom: 40, alignItems: "stretch" },
  iconCircle: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#E6F5F6",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginBottom: 16,
  },
  stepTitle: { fontSize: 18, fontWeight: "700", color: COLORS.black, textAlign: "center", marginBottom: 6 },
  stepSub: { fontSize: 13, color: COLORS.gray, textAlign: "center", lineHeight: 19, marginBottom: 22 },
  input: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 15,
    fontWeight: "600",
    color: COLORS.black,
    borderWidth: 1,
    borderColor: "#E5E9E9",
    marginBottom: 12,
  },
  otpInput: {
    backgroundColor: COLORS.white,
    borderRadius: 12,
    paddingVertical: 14,
    fontSize: 20,
    fontWeight: "700",
    color: COLORS.black,
    textAlign: "center",
    letterSpacing: 6,
    borderWidth: 1,
    borderColor: "#E5E9E9",
    marginBottom: 12,
  },
  errorText: { color: COLORS.error, fontSize: 12, marginBottom: 12, textAlign: "center" },
  primaryBtn: {
    backgroundColor: COLORS.primary,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: "center",
  },
  primaryBtnDisabled: { opacity: 0.6 },
  primaryBtnText: { fontSize: 15, fontWeight: "700", color: "#fff" },
  resendBtn: { marginTop: 16, alignItems: "center" },
  resendText: { fontSize: 13, fontWeight: "700", color: COLORS.primaryDark },
  divider: { height: 1, backgroundColor: "#E5E9E9", marginVertical: 24 },
  supportPrompt: { fontSize: 13, color: COLORS.gray, textAlign: "center", marginBottom: 10 },
  supportBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: COLORS.primary,
  },
  supportBtnText: { fontSize: 14, fontWeight: "700", color: COLORS.primaryDark },
});
