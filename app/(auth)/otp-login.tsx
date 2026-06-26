/**
 * OTP Login Screen
 *
 * Step 1 — Phone entry: user enters 10-digit mobile number → POST /auth/login/otp/request
 * Step 2 — OTP entry:   user enters 6-digit OTP → POST /auth/login/otp/verify
 *
 * On success: tokens are saved, user is authenticated, navigated to app.
 */
import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuthStore } from "../../store/useAuthStore";
import { navigateAfterAuthWithCart } from "../../src/utils/authCartRedirect";
import { safeRouterReplace } from "../../src/utils/safeNavigation";

const RESEND_COOLDOWN_SECONDS = 30;

export default function OtpLoginScreen() {
  const router = useRouter();
  const { verifyOtp, loginWithOtp, loading } = useAuthStore();

  const [mobile, setMobile] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<"phone" | "otp">("phone");

  // Countdown timer for resend cooldown
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Prevent double-submit
  const isSubmittingRef = useRef(false);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN_SECONDS);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          timerRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const navigateAfterAuth = () => {
    navigateAfterAuthWithCart(router);
  };

  // ── Step 1: Send OTP ──────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (isSubmittingRef.current) return;
    setError(null);

    if (!mobile.trim()) return setError("Phone number is required.");
    if (!/^\d{10}$/.test(mobile.trim())) return setError("Enter a valid 10-digit mobile number.");

    isSubmittingRef.current = true;
    try {
      await loginWithOtp(mobile.trim());
      setStep("otp");
      startCountdown();
    } catch (err: any) {
      setError(err?.message ?? "Failed to send OTP. Please try again.");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ── Step 2: Verify OTP ────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (isSubmittingRef.current) return;
    setError(null);

    if (!otp.trim()) return setError("Please enter the OTP.");
    if (otp.trim().length < 6) return setError("OTP must be 6 digits.");

    isSubmittingRef.current = true;
    try {
      await verifyOtp(mobile.trim(), otp.trim());
      safeRouterReplace(router, "/(auth)/otp-verify-success" as any);
    } catch (err: any) {
      const msg: string = err?.message ?? "OTP verification failed.";
      // User-friendly messages for common errors
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("incorrect")) {
        setError("Invalid OTP. Please check and try again.");
      } else if (msg.toLowerCase().includes("expired")) {
        setError("OTP has expired. Please request a new one.");
      } else {
        setError(msg);
      }
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ── Resend OTP ────────────────────────────────────────────────────────────
  const handleResend = async () => {
    if (countdown > 0 || isSubmittingRef.current) return;
    setError(null);
    setOtp("");
    isSubmittingRef.current = true;
    try {
      await loginWithOtp(mobile.trim());
      startCountdown();
    } catch (err: any) {
      setError(err?.message ?? "Failed to resend OTP.");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === "phone" ? "Login with OTP" : "Enter OTP"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "phone"
              ? "We'll send a one-time password to your mobile number"
              : `OTP sent to +91 ${mobile}`}
          </Text>
        </View>

        {/* Error banner */}
        {error ? (
          <View style={styles.errorBanner}>
            <Ionicons name="alert-circle-outline" size={16} color="#b91c1c" style={{ marginRight: 6 }} />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.form}>
          {step === "phone" ? (
            /* ── Phone step ── */
            <>
              <Text style={styles.label}>Mobile Number</Text>
              <View style={styles.inputRow}>
                <View style={styles.countryCode}>
                  <Text style={styles.countryCodeText}>+91</Text>
                </View>
                <TextInput
                  style={[styles.input, styles.inputFlex]}
                  placeholder="10-digit mobile number"
                  placeholderTextColor="#9ca3af"
                  value={mobile}
                  onChangeText={(t) => setMobile(t.replace(/\D/g, "").slice(0, 10))}
                  keyboardType="number-pad"
                  maxLength={10}
                  editable={!loading}
                  returnKeyType="done"
                  onSubmitEditing={handleSendOtp}
                />
              </View>

              <TouchableOpacity
                style={[styles.button, loading && styles.buttonDisabled]}
                onPress={handleSendOtp}
                disabled={loading}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Send OTP</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            /* ── OTP step ── */
            <>
              <Text style={styles.label}>One-Time Password</Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="• • • • • •"
                placeholderTextColor="#9ca3af"
                value={otp}
                onChangeText={(t) => {
                  setOtp(t.replace(/\D/g, "").slice(0, 6));
                  if (error) setError(null);
                }}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
                autoFocus
              />

              <TouchableOpacity
                style={[styles.button, (loading || otp.length < 6) && styles.buttonDisabled]}
                onPress={handleVerifyOtp}
                disabled={loading || otp.length < 6}
                activeOpacity={0.85}
              >
                {loading ? (
                  <ActivityIndicator color="#ffffff" />
                ) : (
                  <Text style={styles.buttonText}>Verify & Login</Text>
                )}
              </TouchableOpacity>

              {/* Resend row */}
              <View style={styles.resendRow}>
                <Text style={styles.resendPrompt}>Didn't receive the OTP? </Text>
                {countdown > 0 ? (
                  <Text style={styles.resendCountdown}>Resend in {countdown}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleResend} disabled={loading}>
                    <Text style={styles.resendLink}>Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>

              {/* Change number */}
              <TouchableOpacity
                style={styles.changeNumberBtn}
                onPress={() => { setStep("phone"); setOtp(""); setError(null); }}
              >
                <Ionicons name="arrow-back" size={14} color="#d1faf8" />
                <Text style={styles.changeNumberText}>Change mobile number</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        {/* Back to login */}
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={14} color="#d1faf8" />
          <Text style={styles.backText}>Back to Login</Text>
        </TouchableOpacity>

        <Text style={styles.footer}>Powered By Blanket Technologies Pvt Ltd</Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#1aa3b0" },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 100,
    paddingBottom: 40,
    alignItems: "center",
  },
  header: { alignItems: "center", marginBottom: 36 },
  title: { fontSize: 26, fontWeight: "700", color: "#ffffff", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#d1faf8", textAlign: "center", lineHeight: 20 },

  errorBanner: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
  },
  errorText: { color: "#b91c1c", fontSize: 13, flex: 1 },

  form: { width: "100%", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", color: "#ffffff", marginBottom: 8 },

  inputRow: { flexDirection: "row", gap: 8 },
  countryCode: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  countryCodeText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },

  input: {
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#e0f7f8",
  },
  inputFlex: { flex: 1 },
  otpInput: {
    width: "100%",
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 12,
    textAlign: "center",
    height: 64,
  },

  button: {
    width: "100%",
    height: 52,
    backgroundColor: "#0c6c75",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 20,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  buttonDisabled: { opacity: 0.5 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },

  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  resendPrompt: { color: "#d1faf8", fontSize: 13 },
  resendCountdown: { color: "rgba(255,255,255,0.6)", fontSize: 13, fontWeight: "600" },
  resendLink: { color: "#ffffff", fontSize: 13, fontWeight: "700", textDecorationLine: "underline" },

  changeNumberBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  changeNumberText: { color: "#d1faf8", fontSize: 13 },

  backBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    marginBottom: 24,
    paddingVertical: 8,
  },
  backText: { color: "#d1faf8", fontSize: 14 },
  footer: { fontSize: 12, color: "#d1faf8", textAlign: "center" },
});
