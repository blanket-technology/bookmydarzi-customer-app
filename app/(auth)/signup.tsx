 import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { useAuthStore } from "../../store/useAuthStore";
import { POWERED_BY_LABEL } from "../../constants/branding";
import { FormBannerError } from "../../src/components/common/FormMessage";
import { PasswordInput } from "../../src/components/common/PasswordInput";
import { navigateAfterAuthWithCart } from "../../src/utils/authCartRedirect";
import { safeRouterReplace } from "../../src/utils/safeNavigation";

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN = 30;

function validateForm(
  firstName: string,
  lastName: string,
  email: string,
  mobile: string,
  password: string,
  confirmPassword: string,
): string | null {
  if (!firstName.trim()) return "First name is required.";
  if (!lastName.trim()) return "Last name is required.";
  if (!email.trim()) return "Email is required.";
  if (!EMAIL_REGEX.test(email.trim())) return "Enter a valid email address.";
  if (!mobile.trim()) return "Mobile number is required.";
  if (!/^[0-9]{10}$/.test(mobile.trim()))
    return "Enter a valid 10-digit mobile number.";
  if (password.length < 6) return "Password must be at least 6 characters.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { register, verifyEmailOtp, resendEmailOtp, loading } = useAuthStore();

  const [step, setStep] = useState<"form" | "otp">("form");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [mobile, setMobile] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
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

  const navigateAfterAuth = () => {
    navigateAfterAuthWithCart(router);
  };

  const handleRegister = async () => {
    setError(null);

    const validationError = validateForm(
      firstName,
      lastName,
      email,
      mobile,
      password,
      confirmPassword,
    );
    if (validationError) return setError(validationError);

    try {
      await register({
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        mobile: mobile.trim(),
        password,
      });
      setStep("otp");
      setOtp("");
      startCountdown();
    } catch (err: any) {
      setError(err?.message ?? "Registration failed. Please try again.");
    }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (!otp.trim()) return setError("Please enter the OTP.");
    if (otp.trim().length < 6) return setError("OTP must be 6 digits.");

    try {
      await verifyEmailOtp(email.trim(), otp.trim());
      navigateAfterAuth();
    } catch (err: any) {
      setError(err?.message ?? "OTP verification failed. Please try again.");
    }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setError(null);
    setOtp("");
    try {
      await resendEmailOtp(email.trim());
      startCountdown();
    } catch (err: any) {
      setError(err?.message ?? "Failed to resend OTP.");
    }
  };

  const handleOtpLogin = () => {
    router.push("/(auth)/otp-login");
  };

  const handleSkip = () => {
    setError(null);
    safeRouterReplace(router, "/(tabs)");
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      keyboardVerticalOffset={Platform.OS === "ios" ? 0 : 28}
    >
      <View pointerEvents="box-none" style={[styles.skipWrap, { top: insets.top + 6 }]}>
        <TouchableOpacity
          style={styles.skipBtn}
          onPress={handleSkip}
          activeOpacity={0.85}
          accessibilityRole="button"
          accessibilityLabel="Skip signup"
        >
          <Text style={styles.skipText}>Skip</Text>
        </TouchableOpacity>
      </View>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>
            {step === "form" ? "Create Account" : "Verify Email"}
          </Text>
          <Text style={styles.subtitle}>
            {step === "form"
              ? "Join DarziApp today"
              : `Enter the OTP sent to ${email}`}
          </Text>
        </View>

        <FormBannerError message={error} />

        {/* ── Form ── */}
        <View style={styles.form}>
          {step === "otp" ? (
            <>
              <Text style={styles.label}>
                Email OTP <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={[styles.input, styles.otpInput]}
                placeholder="• • • • • •"
                placeholderTextColor="#9ca3af"
                value={otp}
                onChangeText={(t) => setOtp(t.replace(/\D/g, "").slice(0, 6))}
                keyboardType="number-pad"
                maxLength={6}
                editable={!loading}
                returnKeyType="done"
                onSubmitEditing={handleVerifyOtp}
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
                  <Text style={styles.buttonText}>Verify & Continue</Text>
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
                style={styles.backToFormBtn}
                onPress={() => {
                  setStep("form");
                  setOtp("");
                  setError(null);
                }}
              >
                <Text style={styles.backToFormText}>← Edit signup details</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
          <Text style={styles.sectionTitle}>Personal details</Text>
          <Text style={styles.sectionSubtitle}>
            Create an account to manage bookings, tailor preferences, and
            orders.
          </Text>

          <View style={styles.rowGroup}>
            <View style={[styles.inputHalf, styles.inputHalfSpacing]}>
              <Text style={styles.label}>
                First Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="First name"
                placeholderTextColor="#9ca3af"
                value={firstName}
                onChangeText={setFirstName}
                autoCapitalize="words"
                editable={!loading}
                returnKeyType="next"
              />
            </View>
            <View style={styles.inputHalf}>
              <Text style={styles.label}>
                Last Name <Text style={styles.required}>*</Text>
              </Text>
              <TextInput
                style={styles.input}
                placeholder="Last name"
                placeholderTextColor="#9ca3af"
                value={lastName}
                onChangeText={setLastName}
                autoCapitalize="words"
                editable={!loading}
                returnKeyType="next"
              />
            </View>
          </View>

          <Text style={styles.label}>
            Email <Text style={styles.required}>*</Text>
          </Text>
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
            returnKeyType="next"
          />

          <Text style={styles.label}>
            Mobile <Text style={styles.required}>*</Text>
          </Text>
          <TextInput
            style={styles.input}
            placeholder="10-digit mobile number"
            placeholderTextColor="#9ca3af"
            value={mobile}
            onChangeText={(t) => setMobile(t.replace(/\D/g, "").slice(0, 10))}
            keyboardType="number-pad"
            maxLength={10}
            editable={!loading}
            returnKeyType="next"
          />
          <Text style={styles.fieldNote}>
            Only used for booking updates and delivery status.
          </Text>

          <Text style={styles.label}>
            Password <Text style={styles.required}>*</Text>
          </Text>
          <PasswordInput
            style={styles.input}
            placeholder="Min. 6 characters"
            placeholderTextColor="#9ca3af"
            value={password}
            onChangeText={setPassword}
            editable={!loading}
            returnKeyType="next"
          />

          <Text style={styles.label}>
            Confirm password <Text style={styles.required}>*</Text>
          </Text>
          <PasswordInput
            style={styles.input}
            placeholder="Re-enter password"
            placeholderTextColor="#9ca3af"
            value={confirmPassword}
            onChangeText={setConfirmPassword}
            editable={!loading}
            returnKeyType="done"
          />

          {/* Primary CTA */}
          <TouchableOpacity
            style={[styles.button, loading && styles.buttonDisabled]}
            onPress={handleRegister}
            disabled={loading}
            activeOpacity={0.85}
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text style={styles.buttonText}>Create Account</Text>
            )}
          </TouchableOpacity>

          {/* Secondary CTA - Login with OTP */}
          <TouchableOpacity
            style={[styles.otpButton, loading && styles.buttonDisabled]}
            onPress={handleOtpLogin}
            disabled={loading}
            activeOpacity={0.85}
          >
            <Text style={styles.otpButtonText}>Login with OTP</Text>
          </TouchableOpacity>
            </>
          )}
        </View>

        {/* Login link */}
        <View style={styles.row}>
          <Text style={styles.prompt}>Already have an account? </Text>
          <Link href="/(auth)/login" asChild>
            <TouchableOpacity>
              <Text style={styles.link}>Sign in</Text>
            </TouchableOpacity>
          </Link>
        </View>

        <Text style={styles.footer}>
          {POWERED_BY_LABEL}
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------
const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: "#1aa3b0",
  },
  skipWrap: {
    position: "absolute",
    right: 16,
    zIndex: 50,
  },
  skipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(255,255,255,0.35)",
  },
  skipText: { fontSize: 13, fontWeight: "700", color: "#ffffff" },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: Platform.OS === "android" ? 80 : 72,
    paddingBottom: 48,
    alignItems: "stretch",
  },

  // Header
  header: { alignItems: "center", marginBottom: 28 },
  title: { fontSize: 30, fontWeight: "700", color: "#ffffff", marginBottom: 6 },
  subtitle: {
    fontSize: 15,
    color: "#d1faf8",
    lineHeight: 20,
    textAlign: "center",
  },

  // Form
  form: {
    width: "100%",
    marginBottom: 24,
    backgroundColor:
      Platform.OS === "android"
        ? "rgba(255,255,255,0.2)"
        : "rgba(255,255,255,0.16)",
    borderRadius: 8,
    padding: 30,
    borderWidth: Platform.OS === "android" ? 0 : 0,
    borderColor: Platform.OS === "android" ? "transparent" : "transparent",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 14 },
    shadowOpacity: 0.12,
    shadowRadius: 28,
    elevation: Platform.OS === "android" ? 0 : 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: "700",
    color: "#f8ffff",
    marginBottom: 6,
  },
  sectionSubtitle: {
    fontSize: 13,
    color: "#d7f9f8",
    lineHeight: 20,
    marginBottom: 18,
  },
  rowGroup: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  inputHalf: {
    flex: 1,
    minWidth: 0,
  },
  inputHalfSpacing: { marginRight: 12 },
  label: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
    marginBottom: 6,
    marginTop: 14,
  },
  fieldNote: {
    fontSize: 12,
    color: "#d1faf8",
    marginTop: 6,
    marginBottom: 2,
  },
  required: { color: "#fca5a5" },
  optional: { color: "#a5f3f0", fontWeight: "400", fontSize: 12 },

  // Inputs
  input: {
    width: "100%",
    height: 52,
    borderRadius: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#0f172a",
    backgroundColor: "#e7f9fb",
    borderWidth: 1,
    borderColor: "rgba(15, 23, 42, 0.08)",
  },
  // Primary button
  button: {
    width: "100%",
    height: 52,
    backgroundColor: "#0c6c75",
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 28,
    elevation: 4,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },

  // Secondary OTP button
  otpButton: {
    width: "100%",
    height: 52,
    backgroundColor: "transparent",
    borderRadius: 14,
    borderWidth: 2,
    borderColor: "rgba(255,255,255,0.9)",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
  },
  otpButtonText: {
    color: "#ffffff",
    fontSize: 15,
    fontWeight: "600",
  },

  // Bottom row
  row: { flexDirection: "row", alignItems: "center", marginBottom: 24 },
  prompt: { fontSize: 14, color: "#d1faf8" },
  link: { fontSize: 14, color: "#ffffff", fontWeight: "700" },

  footer: { fontSize: 12, color: "#d1faf8", textAlign: "center", marginTop: 8 },

  otpInput: {
    fontSize: 24,
    fontWeight: "700",
    letterSpacing: 10,
    textAlign: "center",
  },
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  resendPrompt: { fontSize: 13, color: "#d1faf8" },
  resendCountdown: { fontSize: 13, color: "rgba(255,255,255,0.6)", fontWeight: "600" },
  resendLink: { fontSize: 13, color: "#ffffff", fontWeight: "700", textDecorationLine: "underline" },
  backToFormBtn: { alignItems: "center", marginTop: 12, paddingVertical: 8 },
  backToFormText: { fontSize: 13, color: "#d1faf8" },
});
