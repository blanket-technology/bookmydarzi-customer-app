import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  forgotPasswordRequest,
  forgotPasswordVerifyRequest,
  forgotPasswordResetRequest,
} from "../../services/authService";
import { POWERED_BY_LABEL } from "../../constants/branding";
import { FormBannerError } from "../../src/components/common/FormMessage";
import { PasswordInput } from "../../src/components/common/PasswordInput";

const RESEND_COOLDOWN = 30;

type Step = "request" | "verify" | "reset" | "done";

export default function ForgotPasswordScreen() {
  const router = useRouter();

  const [step, setStep] = useState<Step>("request");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
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

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const handleRequestOtp = async () => {
    setError(null);
    if (!email.trim()) return setError("Email is required.");
    if (!email.includes("@")) return setError("Enter a valid email address.");

    setLoading(true);
    try {
      await forgotPasswordRequest(email.trim());
      setStep("verify");
      setOtp("");
      startCountdown();
    } catch (err: any) {
      setError(err?.message ?? "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (!otp.trim()) return setError("Please enter the OTP.");
    if (otp.trim().length < 6) return setError("OTP must be 6 digits.");

    setLoading(true);
    try {
      const res = await forgotPasswordVerifyRequest(email.trim(), otp.trim());
      setResetToken(res.reset_token);
      setStep("reset");
      setPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      setError(err?.message ?? "OTP verification failed. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0 || loading) return;
    setError(null);
    setOtp("");
    setLoading(true);
    try {
      await forgotPasswordRequest(email.trim());
      startCountdown();
    } catch (err: any) {
      setError(err?.message ?? "Failed to resend OTP.");
    } finally {
      setLoading(false);
    }
  };

  const handleResetPassword = async () => {
    setError(null);
    if (password.length < 6) return setError("Password must be at least 6 characters.");
    if (password !== confirmPassword) return setError("Passwords do not match.");

    setLoading(true);
    try {
      await forgotPasswordResetRequest(resetToken, password);
      setStep("done");
    } catch (err: any) {
      setError(err?.message ?? "Failed to reset password. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const subtitle =
    step === "request"
      ? "Enter your email and we'll send you a reset OTP."
      : step === "verify"
        ? `Enter the OTP sent to ${email}`
        : step === "reset"
          ? "Choose a new password for your account."
          : "Your password has been updated.";

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Text style={styles.title}>Forgot Password?</Text>
          <Text style={styles.subtitle}>{subtitle}</Text>
        </View>

        {step === "done" ? (
          <View style={styles.successBanner}>
            <Text style={styles.successText}>✓ Password reset successfully!</Text>
            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.replace("/(auth)/login")}
            >
              <Text style={styles.backButtonText}>Back to Login</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <FormBannerError message={error} />
            <View style={styles.form}>
            {step === "request" && (
              <>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor="#9ca3af"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoCorrect={false}
                  editable={!loading}
                />

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleRequestOtp}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Send OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {step === "verify" && (
              <>
                <Text style={styles.label}>OTP</Text>
                <TextInput
                  style={[styles.input, styles.otpInput]}
                  placeholder="• • • • • •"
                  placeholderTextColor="#9ca3af"
                  value={otp}
                  onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                  keyboardType="number-pad"
                  maxLength={6}
                  editable={!loading}
                />

                <TouchableOpacity
                  style={[styles.button, (loading || otp.length < 6) && styles.buttonDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Verify OTP</Text>
                  )}
                </TouchableOpacity>

                <View style={styles.resendRow}>
                  <Text style={styles.resendPrompt}>Didn't receive it? </Text>
                  {countdown > 0 ? (
                    <Text style={styles.resendCountdown}>Resend in {countdown}s</Text>
                  ) : (
                    <TouchableOpacity onPress={handleResendOtp} disabled={loading}>
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>

                <TouchableOpacity
                  style={styles.cancelButton}
                  onPress={() => {
                    setStep("request");
                    setOtp("");
                    setError(null);
                  }}
                >
                  <Text style={styles.cancelText}>← Change email</Text>
                </TouchableOpacity>
              </>
            )}

            {step === "reset" && (
              <>
                <Text style={styles.label}>New Password</Text>
                <PasswordInput
                  style={styles.input}
                  placeholder="Min. 6 characters"
                  placeholderTextColor="#9ca3af"
                  value={password}
                  onChangeText={setPassword}
                  editable={!loading}
                />

                <Text style={styles.label}>Confirm Password</Text>
                <PasswordInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor="#9ca3af"
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  editable={!loading}
                />

                <TouchableOpacity
                  style={[styles.button, loading && styles.buttonDisabled]}
                  onPress={handleResetPassword}
                  disabled={loading}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.buttonText}>Reset Password</Text>
                  )}
                </TouchableOpacity>
              </>
            )}

            {step === "request" && (
              <TouchableOpacity
                style={styles.cancelButton}
                onPress={() => router.back()}
              >
                <Text style={styles.cancelText}>← Back to Login</Text>
              </TouchableOpacity>
            )}
          </View>
          </>
        )}

        <Text style={styles.footer}>{POWERED_BY_LABEL}</Text>
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
  header: { alignItems: "center", marginBottom: 40 },
  title: { fontSize: 26, fontWeight: "700", color: "#ffffff", marginBottom: 8 },
  subtitle: { fontSize: 14, color: "#d1faf8", textAlign: "center", lineHeight: 20 },
  successBanner: {
    width: "100%",
    backgroundColor: "#d1fae5",
    borderRadius: 14,
    padding: 20,
    alignItems: "center",
    marginBottom: 32,
  },
  successText: { color: "#065f46", fontSize: 15, fontWeight: "600", marginBottom: 16 },
  backButton: {
    backgroundColor: "#0c6c75",
    paddingVertical: 12,
    paddingHorizontal: 28,
    borderRadius: 12,
  },
  backButtonText: { color: "#ffffff", fontWeight: "700", fontSize: 14 },
  form: { width: "100%", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", color: "#ffffff", marginBottom: 6, marginTop: 8 },
  input: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#e0f7f8",
  },
  otpInput: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 10,
    textAlign: "center",
  },
  button: {
    width: "100%",
    height: 52,
    backgroundColor: "#0c6c75",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 24,
    elevation: 4,
  },
  buttonDisabled: { opacity: 0.6 },
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
  cancelButton: { alignItems: "center", marginTop: 16 },
  cancelText: { color: "#ffffff", fontSize: 14 },
  footer: { fontSize: 12, color: "#d1faf8", textAlign: "center", marginTop: 40 },
});
