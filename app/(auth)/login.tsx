/**
 * Login Screen
 *
 * Three modes on the same screen:
 *   "email"  — email + password sign-in
 *   "phone"  — enter mobile number → Send OTP
 *   "otp"    — enter 6-digit OTP → Verify & Login
 *
 * No separate OTP screen is needed — the full flow lives here.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  View,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/useAuthStore";
import { FormBannerError } from "../../src/components/common/FormMessage";
import { PasswordInput } from "../../src/components/common/PasswordInput";
import { useHardwareBackHandler } from "../../src/hooks/useHardwareBackHandler";
import { navigateAfterAuthWithCart } from "../../src/utils/authCartRedirect";
import { safeRouterReplace } from "../../src/utils/safeNavigation";

const RESEND_COOLDOWN = 30; // seconds

const PHONE_PATTERN = /^\d{10}$/;

function isValidLoginEmail(value: string): boolean {
  const trimmed = value.trim();
  return trimmed.length > 0 && trimmed.includes("@");
}

export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, loginWithOtp, verifyOtp, loading } = useAuthStore();

  // ── Form state ────────────────────────────────────────────────────────────
  const [loginMode, setLoginMode] = useState<"email" | "phone" | "otp">("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);

  // ── Countdown timer for OTP resend ────────────────────────────────────────
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSubmittingRef = useRef(false);

  const isPhoneValid = useMemo(
    () => PHONE_PATTERN.test(phone.trim()),
    [phone],
  );

  const isEmailSignInReady = useMemo(() => {
    return isValidLoginEmail(email) && password.trim().length > 0;
  }, [email, password]);

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

  const handleBack = useCallback(() => {
    if (loginMode === "otp") {
      setLoginMode("phone");
      setOtp("");
      setError(null);
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setCountdown(0);
      return true;
    }
    if (router.canGoBack()) {
      router.back();
    } else {
      safeRouterReplace(router, "/(tabs)");
    }
    return true;
  }, [loginMode, router]);

  useHardwareBackHandler(handleBack);

  // ── Navigation after successful auth ─────────────────────────────────────
  const navigateAfterAuth = () => {
    navigateAfterAuthWithCart(router);
  };

  // ── Switch tab (email ↔ phone) ────────────────────────────────────────────
  const switchMode = (mode: "email" | "phone") => {
    setLoginMode(mode);
    setError(null);
    setOtp("");
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setCountdown(0);
  };

  // ── Email sign-in ─────────────────────────────────────────────────────────
  const handleEmailSignIn = async () => {
    if (isSubmittingRef.current) return;
    setError(null);
    if (!email.trim()) return setError("Email is required.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (!password.trim()) return setError("Password is required.");
    isSubmittingRef.current = true;
    try {
      await login({ email: email.trim(), password });
      navigateAfterAuth();
    } catch (err: any) {
      setError(err?.message ?? "Login failed. Please try again.");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ── Send OTP ──────────────────────────────────────────────────────────────
  const handleSendOtp = async () => {
    if (isSubmittingRef.current) return;
    setError(null);
    if (!phone.trim()) return setError("Phone number is required.");
    if (!/^\d{10}$/.test(phone.trim())) return setError("Enter a valid 10-digit mobile number.");
    isSubmittingRef.current = true;
    try {
      await loginWithOtp(phone.trim());
      setLoginMode("otp");
      setOtp("");
      startCountdown();
    } catch (err: any) {
      setError(err?.message ?? "Failed to send OTP. Please try again.");
    } finally {
      isSubmittingRef.current = false;
    }
  };

  // ── Verify OTP ────────────────────────────────────────────────────────────
  const handleVerifyOtp = async () => {
    if (isSubmittingRef.current) return;
    setError(null);
    if (!otp.trim()) return setError("Please enter the OTP.");
    if (otp.trim().length < 6) return setError("OTP must be 6 digits.");
    isSubmittingRef.current = true;
    try {
      await verifyOtp(phone.trim(), otp.trim());
      safeRouterReplace(router, "/(auth)/otp-verify-success" as any);
    } catch (err: any) {
      const msg: string = err?.message ?? "OTP verification failed.";
      if (
        msg.toLowerCase().includes("invalid") ||
        msg.toLowerCase().includes("incorrect")
      ) {
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
      await loginWithOtp(phone.trim());
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
        <TouchableOpacity
          style={[styles.backBtn, { top: insets.top + 8 }]}
          onPress={() => handleBack()}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          accessibilityRole="button"
          accessibilityLabel="Go back"
        >
          <Ionicons name="arrow-back" size={22} color="#ffffff" />
        </TouchableOpacity>
        <ScrollView
        contentContainerStyle={[styles.container, { paddingTop: insets.top + 56 }]}
          keyboardShouldPersistTaps="handled"
        >
            {/* Logo */}
        <View style={styles.logoContainer}>
              <Image
                source={require("../../assets/logo.png")}
            style={styles.logoImage}
                resizeMode="contain"
              />
          <Text style={styles.appName}>BookMyDarzi</Text>
              <Text style={styles.tagline}>
                Your personal tailor, simplified.
              </Text>
            </View>

        {/* Error banner */}
        <FormBannerError message={error} style={styles.errorBanner} />

            {/* ── OTP step — shown inline, no tab toggle ── */}
            {loginMode === "otp" ? (
              <View style={styles.form}>
                {/* OTP header */}
                <View style={styles.otpHeader}>
                  <View style={styles.otpIconWrap}>
                    <Ionicons
                      name="phone-portrait-outline"
                      size={28}
                      color="#0c6c75"
                    />
                  </View>
                  <Text style={styles.otpTitle}>Enter OTP</Text>
                  <Text style={styles.otpSubtitle}>
                    Sent to <Text style={styles.otpPhone}>+91 {phone}</Text>
                  </Text>
                </View>

                {/* 6-digit OTP input */}
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
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={handleVerifyOtp}
                />

                {/* Verify button */}
                <TouchableOpacity
                  style={[
                    styles.signInButton,
                    (loading || otp.length < 6) && styles.buttonDisabled,
                  ]}
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                  activeOpacity={0.85}
                >
                  {loading ? (
                    <ActivityIndicator color="#ffffff" />
                  ) : (
                    <Text style={styles.signInButtonText}>Verify & Login</Text>
                  )}
                </TouchableOpacity>

                {/* Resend row */}
                <View style={styles.resendRow}>
                  <Text style={styles.resendPrompt}>Didn't receive it? </Text>
                  {countdown > 0 ? (
                    <Text style={styles.resendCountdown}>
                      Resend in {countdown}s
                    </Text>
                  ) : (
                    <TouchableOpacity onPress={handleResend} disabled={loading}>
                      <Text style={styles.resendLink}>Resend OTP</Text>
                    </TouchableOpacity>
                  )}
                </View>

                {/* Change number */}
                <TouchableOpacity
                  style={styles.changeNumberBtn}
              onPress={() => { setLoginMode("phone"); setOtp(""); setError(null); }}
                >
                  <Ionicons name="arrow-back" size={13} color="#d1faf8" />
                  <Text style={styles.changeNumberText}>
                    Change mobile number
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <>
            {/* ── Email / Phone toggle ── */}
            <View style={styles.toggle}>
              <TouchableOpacity
                style={[styles.toggleBtn, loginMode === "phone" && styles.toggleBtnActive]}
                onPress={() => switchMode("phone")}
              >
                <Text style={[styles.toggleText, loginMode === "phone" && styles.toggleTextActive]}>
                  Phone
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.toggleBtn, loginMode === "email" && styles.toggleBtnActive]}
                onPress={() => switchMode("email")}
              >
                <Text style={[styles.toggleText, loginMode === "email" && styles.toggleTextActive]}>
                  Email
                </Text>
              </TouchableOpacity>
            </View>

                {/* ── Form fields ── */}
                <View style={styles.form}>
              {loginMode === "email" ? (
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

                      <Text style={styles.label}>Password</Text>
                      <PasswordInput
                        style={styles.input}
                        placeholder="••••••••"
                        placeholderTextColor="#9ca3af"
                        value={password}
                        onChangeText={setPassword}
                        editable={!loading}
                      />

                      <Link href="/(auth)/forgot-password" asChild>
                        <TouchableOpacity style={styles.forgotContainer}>
                          <Text style={styles.forgotText}>
                            Forgot password?
                          </Text>
                        </TouchableOpacity>
                      </Link>

                      <TouchableOpacity
                        style={[
                          styles.signInButton,
                          (loading || !isEmailSignInReady) && styles.buttonDisabled,
                        ]}
                        onPress={handleEmailSignIn}
                        disabled={loading || !isEmailSignInReady}
                        activeOpacity={0.85}
                      >
                        {loading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.signInButtonText}>Sign In</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  ) : (
                    <>
                      <Text style={styles.label}>Mobile Number</Text>
                      <View style={styles.phoneRow}>
                        <View style={styles.countryCode}>
                          <Text style={styles.countryCodeText}>+91</Text>
                        </View>
                        <TextInput
                          style={[styles.input, styles.phoneInput]}
                          placeholder="10-digit mobile number"
                          placeholderTextColor="#9ca3af"
                          value={phone}
                          onChangeText={(t) =>
                            setPhone(t.replace(/\D/g, "").slice(0, 10))
                          }
                          keyboardType="number-pad"
                          maxLength={10}
                          editable={!loading}
                          returnKeyType="done"
                          onSubmitEditing={handleSendOtp}
                        />
                      </View>
                      <Text style={styles.otpHint}>
                        We'll send a one-time password to this number.
                      </Text>

                      <TouchableOpacity
                        style={[
                          styles.signInButton,
                          (loading || !isPhoneValid) && styles.buttonDisabled,
                        ]}
                        onPress={handleSendOtp}
                        disabled={loading || !isPhoneValid}
                        activeOpacity={0.85}
                      >
                        {loading ? (
                          <ActivityIndicator color="#ffffff" />
                        ) : (
                          <Text style={styles.signInButtonText}>Send OTP</Text>
                        )}
                      </TouchableOpacity>
                    </>
                  )}
                </View>
              </>
            )}

            {/* Sign up link — hidden during OTP step */}
            {loginMode !== "otp" && (
          <View style={styles.signUpRow}>
                <Text style={styles.signUpPrompt}>Don't have an account? </Text>
                <Link href="/(auth)/signup" asChild>
                  <TouchableOpacity>
                    <Text style={styles.signUpLink}>Sign up</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            )}

        {/* Footer with legal links — required for App Store / Play Store */}
        <View style={styles.legalSection}>
          <Text style={styles.footer}>Powered by Blanket Technologies Pvt Ltd</Text>
          <View style={styles.legalRow}>
            <Link href="https://bookmydarzi.com/privacy-policy" asChild>
              <TouchableOpacity>
                <Text style={styles.legalLink}>Privacy Policy</Text>
              </TouchableOpacity>
            </Link>
            <Text style={styles.legalDot}>·</Text>
            <Link href="https://bookmydarzi.com/terms" asChild>
              <TouchableOpacity>
                <Text style={styles.legalLink}>Terms of Service</Text>
              </TouchableOpacity>
            </Link>
          </View>
        </View>
        </ScrollView>
      </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, backgroundColor: "#1aa3b0" },
  backBtn: {
    position: "absolute",
    left: 16,
    zIndex: 10,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 40,
    alignItems: "center",
  },

  // Logo
  logoContainer: { alignItems: "center", marginBottom: 40 },
  logoImage: { width: 120, height: 120, marginBottom: 12 },
  appName: {
    fontSize: 26,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  tagline: { fontSize: 14, color: "#d1faf8" },

  // Error
  errorBanner: {
    width: "100%",
    backgroundColor: "#fee2e2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: { color: "#b91c1c", fontSize: 13, textAlign: "center" },

  // Toggle
  toggle: {
    flexDirection: "row",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    padding: 4,
    width: "100%",
    marginBottom: 8,
  },
  toggleBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: "center" },
  toggleBtnActive: { backgroundColor: "#ffffff" },
  toggleText: { fontSize: 14, fontWeight: "600", color: "rgba(255,255,255,0.75)" },
  toggleTextActive: { color: "#0c6c75" },

  // Form
  form: { width: "100%", marginBottom: 24 },
  label: { fontSize: 14, fontWeight: "600", color: "#ffffff", marginBottom: 6, marginTop: 16 },
  input: {
    width: "100%",
    height: 50,
    borderRadius: 12,
    paddingHorizontal: 16,
    fontSize: 15,
    color: "#111827",
    backgroundColor: "#e0f7f8",
  },

  // Phone row with country code
  phoneRow: { flexDirection: "row", gap: 8 },
  countryCode: {
    height: 50,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center",
    justifyContent: "center",
  },
  countryCodeText: { color: "#ffffff", fontSize: 15, fontWeight: "600" },
  phoneInput: { flex: 1 },

  otpHint: { fontSize: 12, color: "#d1faf8", marginTop: 8, marginBottom: 4 },
  forgotContainer: { alignSelf: "flex-end", marginTop: 8, marginBottom: 24 },
  forgotText: { fontSize: 13, color: "#ffffff", fontWeight: "500" },

  // Primary button
  signInButton: {
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
  signInButtonText: { color: "#ffffff", fontSize: 16, fontWeight: "700" },

  // OTP step
  otpHeader: {
    alignItems: "center",
    marginTop: 8,
    marginBottom: 8,
    paddingVertical: 16,
    paddingHorizontal: 20,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 16,
  },
  otpIconWrap: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#e0f7f8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  otpTitle: {
    fontSize: 20,
    fontWeight: "700",
    color: "#ffffff",
    marginBottom: 4,
  },
  otpSubtitle: { fontSize: 13, color: "#d1faf8", textAlign: "center" },
  otpPhone: { color: "#ffffff", fontWeight: "700" },
  otpInput: {
    fontSize: 28,
    fontWeight: "700",
    letterSpacing: 12,
    textAlign: "center",
    height: 64,
  },

  // Resend
  resendRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 16,
  },
  resendPrompt: { color: "#d1faf8", fontSize: 13 },
  resendCountdown: {
    color: "rgba(255,255,255,0.6)",
    fontSize: 13,
    fontWeight: "600",
  },
  resendLink: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "700",
    textDecorationLine: "underline",
  },

  // Change number
  changeNumberBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    marginTop: 12,
    paddingVertical: 8,
  },
  changeNumberText: { color: "#d1faf8", fontSize: 13 },

  // Sign up
  signUpRow: { flexDirection: "row", alignItems: "center", marginBottom: 32 },
  signUpPrompt: { fontSize: 14, color: "#d1faf8" },
  signUpLink: { fontSize: 14, color: "#ffffff", fontWeight: "700" },

  // Footer + legal
  legalSection: { alignItems: "center", gap: 6, marginTop: 8 },
  footer: { fontSize: 11, color: "rgba(255,255,255,0.55)", textAlign: "center" },
  legalRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  legalDot: { color: "rgba(255,255,255,0.4)", fontSize: 12 },
  legalLink: { fontSize: 12, color: "rgba(255,255,255,0.7)", textDecorationLine: "underline" },
});
