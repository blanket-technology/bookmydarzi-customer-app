/**
 * Login Screen — professional redesign.
 * Three modes: "phone" → "otp" (inline) and "email".
 * Logic unchanged; only the visual layer is new.
 */
import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  Animated,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAuthStore } from "../../store/useAuthStore";
import { FormBannerError } from "../../src/components/common/FormMessage";
import { PasswordInput } from "../../src/components/common/PasswordInput";
import { useHardwareBackHandler } from "../../src/hooks/useHardwareBackHandler";
import { navigateAfterAuthWithCart } from "../../src/utils/authCartRedirect";
import { safeRouterReplace } from "../../src/utils/safeNavigation";

const RESEND_COOLDOWN = 30;
const PHONE_PATTERN = /^\d{10}$/;

function isValidLoginEmail(v: string) {
  const t = v.trim();
  return t.length > 0 && t.includes("@");
}

// ─── OTP digit boxes ─────────────────────────────────────────────────────────
function OtpBoxInput({
  value,
  onChangeText,
  editable,
}: {
  value: string;
  onChangeText: (t: string) => void;
  editable: boolean;
}) {
  const inputRef = useRef<TextInput>(null);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");

  return (
    <TouchableOpacity
      activeOpacity={1}
      onPress={() => inputRef.current?.focus()}
      style={otp.row}
      accessibilityLabel="OTP input"
    >
      {digits.map((d, i) => {
        const isActive = value.length === i;
        const filled = !!d;
        return (
          <View
            key={i}
            style={[
              otp.box,
              filled && otp.boxFilled,
              isActive && otp.boxActive,
            ]}
          >
            <Text style={[otp.digit, filled && otp.digitFilled]}>{d || ""}</Text>
            {isActive && <View style={otp.cursor} />}
          </View>
        );
      })}
      <TextInput
        ref={inputRef}
        style={otp.hidden}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad"
        maxLength={6}
        editable={editable}
        autoFocus
        caretHidden
      />
    </TouchableOpacity>
  );
}

const otp = StyleSheet.create({
  row: {
    flexDirection: "row",
    gap: 8,
    marginBottom: 24,
  },
  box: {
    flex: 1,          // fill available width equally — no fixed px needed
    minWidth: 0,      // allow shrinking on very small screens
    height: 54,
    borderRadius: 12,
    backgroundColor: "#F8FAFC",
    borderWidth: 1.5,
    borderColor: "#E2E8F0",
    alignItems: "center",
    justifyContent: "center",
  },
  boxActive: { borderColor: "#0c6c75", backgroundColor: "#F0FDFC" },
  boxFilled: { borderColor: "#0c6c75", backgroundColor: "#F0FDFC" },
  digit: { fontSize: 20, fontWeight: "700", color: "#6B7280" },
  digitFilled: { color: "#0c6c75" },
  cursor: {
    position: "absolute",
    bottom: 8,
    width: 2,
    height: 18,
    backgroundColor: "#0c6c75",
    borderRadius: 1,
  },
  hidden: {
    position: "absolute",
    opacity: 0,
    width: 0,
    height: 0,
  },
});

// ─── Main component ───────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { login, loginWithOtp, verifyOtp, loading } = useAuthStore();

  const [loginMode, setLoginMode] = useState<"email" | "phone" | "otp">("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isSubmittingRef = useRef(false);

  // Slide-up animation for card
  const cardY = useRef(new Animated.Value(40)).current;
  const cardOpacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.parallel([
      Animated.spring(cardY, { toValue: 0, useNativeDriver: true, damping: 22, stiffness: 260 }),
      Animated.timing(cardOpacity, { toValue: 1, duration: 320, useNativeDriver: true }),
    ]).start();
  }, []);

  const isPhoneValid = useMemo(() => PHONE_PATTERN.test(phone.trim()), [phone]);
  const isEmailSignInReady = useMemo(
    () => isValidLoginEmail(email) && password.trim().length > 0,
    [email, password],
  );

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return prev - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const handleBack = useCallback(() => {
    if (loginMode === "otp") {
      setLoginMode("phone"); setOtp(""); setError(null);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setCountdown(0);
      return true;
    }
    if (router.canGoBack()) router.back();
    else safeRouterReplace(router, "/(tabs)");
    return true;
  }, [loginMode, router]);

  useHardwareBackHandler(handleBack);

  const navigateAfterAuth = () => navigateAfterAuthWithCart(router);

  const switchMode = (mode: "email" | "phone") => {
    setLoginMode(mode); setError(null); setOtp("");
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCountdown(0);
  };

  const handleEmailSignIn = async () => {
    if (isSubmittingRef.current) return;
    setError(null);
    if (!email.trim()) return setError("Email is required.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (!password.trim()) return setError("Password is required.");
    isSubmittingRef.current = true;
    try { await login({ email: email.trim(), password }); navigateAfterAuth(); }
    catch (err: any) { setError(err?.message ?? "Login failed. Please try again."); }
    finally { isSubmittingRef.current = false; }
  };

  const handleSendOtp = async () => {
    if (isSubmittingRef.current) return;
    setError(null);
    if (!phone.trim()) return setError("Phone number is required.");
    if (!/^\d{10}$/.test(phone.trim())) return setError("Enter a valid 10-digit number.");
    isSubmittingRef.current = true;
    try { await loginWithOtp(phone.trim()); setLoginMode("otp"); setOtp(""); startCountdown(); }
    catch (err: any) { setError(err?.message ?? "Failed to send OTP. Please try again."); }
    finally { isSubmittingRef.current = false; }
  };

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
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("incorrect"))
        setError("Invalid OTP. Please check and try again.");
      else if (msg.toLowerCase().includes("expired"))
        setError("OTP has expired. Please request a new one.");
      else setError(msg);
    } finally { isSubmittingRef.current = false; }
  };

  const handleResend = async () => {
    if (countdown > 0 || isSubmittingRef.current) return;
    setError(null); setOtp("");
    isSubmittingRef.current = true;
    try { await loginWithOtp(phone.trim()); startCountdown(); }
    catch (err: any) { setError(err?.message ?? "Failed to resend OTP."); }
    finally { isSubmittingRef.current = false; }
  };

  return (
    <View style={s.root}>
      {/* Background gradient */}
      <LinearGradient colors={["#0a5c63", "#149694", "#1dbfc5"]} style={StyleSheet.absoluteFillObject} />

      {/* Decorative circles */}
      <View style={s.decTop} />
      <View style={s.decBr} />

      {/* Back button */}
      <TouchableOpacity
        style={[s.backBtn, { top: insets.top + 8 }]}
        onPress={handleBack}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={20} color="#fff" />
      </TouchableOpacity>

      <KeyboardAvoidingView
        style={s.kav}
        behavior={Platform.OS === "ios" ? "padding" : "height"}
      >
        <ScrollView
          contentContainerStyle={[s.scroll, { paddingTop: insets.top + 48 }]}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* ── Brand section ── */}
          <View style={s.brand}>
            <View style={s.logoRing}>
              <Image
                source={require("../../assets/logo.png")}
                style={s.logo}
                resizeMode="contain"
              />
            </View>
            <Text style={s.appName}>BookMyDarzi</Text>
            <Text style={s.tagline}>Your personal tailor, simplified.</Text>
          </View>

          {/* ── Form card ── */}
          <Animated.View style={[s.card, { opacity: cardOpacity, transform: [{ translateY: cardY }] }]}>
            <FormBannerError message={error} style={s.errorBanner} />

            {loginMode === "otp" ? (
              /* ── OTP step ── */
              <>
                <View style={s.otpHeader}>
                  <View style={s.otpIconRing}>
                    <Ionicons name="shield-checkmark-outline" size={26} color="#0c6c75" />
                  </View>
                  <Text style={s.otpTitle}>Verify your number</Text>
                  <Text style={s.otpSub}>
                    OTP sent to <Text style={s.otpPhone}>+91 {phone}</Text>
                  </Text>
                </View>

                <Text style={s.fieldLabel}>One-Time Password</Text>
                <OtpBoxInput value={otp} onChangeText={(t) => { setOtp(t); if (error) setError(null); }} editable={!loading} />

                <TouchableOpacity
                  style={[s.btn, (loading || otp.length < 6) && s.btnDisabled]}
                  onPress={handleVerifyOtp}
                  disabled={loading || otp.length < 6}
                  activeOpacity={0.88}
                >
                  {loading
                    ? <ActivityIndicator color="#fff" />
                    : <><Ionicons name="checkmark-circle-outline" size={18} color="#fff" /><Text style={s.btnText}>Verify & Login</Text></>}
                </TouchableOpacity>

                <View style={s.resendRow}>
                  <Text style={s.resendPrompt}>Didn't receive it? </Text>
                  {countdown > 0
                    ? <Text style={s.resendCountdown}>Resend in {countdown}s</Text>
                    : <TouchableOpacity onPress={handleResend} disabled={loading}>
                        <Text style={s.resendLink}>Resend OTP</Text>
                      </TouchableOpacity>
                  }
                </View>

                <TouchableOpacity
                  style={s.changeNum}
                  onPress={() => { setLoginMode("phone"); setOtp(""); setError(null); }}
                >
                  <Ionicons name="arrow-back" size={13} color="#0c6c75" />
                  <Text style={s.changeNumText}>Change mobile number</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                {/* ── Toggle ── */}
                <View style={s.toggle}>
                  {(["phone", "email"] as const).map((m) => (
                    <TouchableOpacity
                      key={m}
                      style={[s.toggleBtn, loginMode === m && s.toggleBtnActive]}
                      onPress={() => switchMode(m)}
                      activeOpacity={0.85}
                    >
                      <Ionicons
                        name={m === "phone" ? "phone-portrait-outline" : "mail-outline"}
                        size={14}
                        color={loginMode === m ? "#0c6c75" : "#6B7280"}
                      />
                      <Text style={[s.toggleText, loginMode === m && s.toggleTextActive]}>
                        {m === "phone" ? "Phone" : "Email"}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>

                {loginMode === "email" ? (
                  <>
                    <Text style={s.fieldLabel}>Email address</Text>
                    <View style={s.inputRow}>
                      <Ionicons name="mail-outline" size={18} color="#9CA3AF" style={s.inputIcon} />
                      <TextInput
                        style={s.input}
                        placeholder="you@example.com"
                        placeholderTextColor="#C4C9D0"
                        value={email}
                        onChangeText={setEmail}
                        keyboardType="email-address"
                        autoCapitalize="none"
                        autoCorrect={false}
                        editable={!loading}
                      />
                    </View>

                    <Text style={s.fieldLabel}>Password</Text>
                    <View style={[s.inputRow, { paddingRight: 4 }]}>
                      <Ionicons name="lock-closed-outline" size={18} color="#9CA3AF" style={s.inputIcon} />
                      <PasswordInput
                        style={s.input}
                        placeholder="••••••••"
                        placeholderTextColor="#C4C9D0"
                        value={password}
                        onChangeText={setPassword}
                        editable={!loading}
                      />
                    </View>

                    <Link href="/(auth)/forgot-password" asChild>
                      <TouchableOpacity style={s.forgotWrap}>
                        <Text style={s.forgotText}>Forgot password?</Text>
                      </TouchableOpacity>
                    </Link>

                    <TouchableOpacity
                      style={[s.btn, (loading || !isEmailSignInReady) && s.btnDisabled]}
                      onPress={handleEmailSignIn}
                      disabled={loading || !isEmailSignInReady}
                      activeOpacity={0.88}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <><Ionicons name="log-in-outline" size={18} color="#fff" /><Text style={s.btnText}>Sign In</Text></>}
                    </TouchableOpacity>
                  </>
                ) : (
                  <>
                    <Text style={s.fieldLabel}>Mobile number</Text>
                    <View style={s.phoneRow}>
                      <View style={s.countryPill}>
                        <Text style={s.flag}>🇮🇳</Text>
                        <Text style={s.countryCode}>+91</Text>
                      </View>
                      <TextInput
                        style={[s.input, s.phoneInput]}
                        placeholder="10-digit number"
                        placeholderTextColor="#C4C9D0"
                        value={phone}
                        onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
                        keyboardType="number-pad"
                        maxLength={10}
                        editable={!loading}
                        returnKeyType="done"
                        onSubmitEditing={handleSendOtp}
                      />
                    </View>
                    <Text style={s.hint}>
                      <Ionicons name="information-circle-outline" size={12} color="#9CA3AF" />{"  "}
                      We'll send a one-time password to this number.
                    </Text>

                    <TouchableOpacity
                      style={[s.btn, (loading || !isPhoneValid) && s.btnDisabled]}
                      onPress={handleSendOtp}
                      disabled={loading || !isPhoneValid}
                      activeOpacity={0.88}
                    >
                      {loading
                        ? <ActivityIndicator color="#fff" />
                        : <><Ionicons name="send-outline" size={16} color="#fff" /><Text style={s.btnText}>Send OTP</Text></>}
                    </TouchableOpacity>
                  </>
                )}
              </>
            )}

            {/* Sign up row */}
            {loginMode !== "otp" && (
              <View style={s.signUpRow}>
                <Text style={s.signUpPrompt}>Don't have an account? </Text>
                <Link href="/(auth)/signup" asChild>
                  <TouchableOpacity>
                    <Text style={s.signUpLink}>Sign up</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            )}
          </Animated.View>

          <Text style={s.footer}>Powered by Blanket Technologies Pvt Ltd</Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const TEAL = "#0c6c75";
const TEAL_LIGHT = "#E0F7F8";

const s = StyleSheet.create({
  root: { flex: 1 },
  kav: { flex: 1 },

  // Decorative shapes
  decTop: {
    position: "absolute", top: -80, left: -80,
    width: 260, height: 260, borderRadius: 130,
    backgroundColor: "rgba(255,255,255,0.07)",
  },
  decBr: {
    position: "absolute", bottom: 80, right: -60,
    width: 200, height: 200, borderRadius: 100,
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  backBtn: {
    position: "absolute", left: 16, zIndex: 20,
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.2)",
    alignItems: "center", justifyContent: "center",
  },

  scroll: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingBottom: 40,
    alignItems: "center",
  },

  // ── Brand ──────────────────────────────────────────────────────────────────
  brand: { alignItems: "center", marginBottom: 28, marginTop: 8 },
  logoRing: {
    width: 96, height: 96, borderRadius: 48,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center", justifyContent: "center",
    marginBottom: 14,
    borderWidth: 2, borderColor: "rgba(255,255,255,0.3)",
  },
  logo: { width: 74, height: 74 },
  appName: { fontSize: 26, fontWeight: "800", color: "#fff", letterSpacing: -0.3, marginBottom: 4 },
  tagline: { fontSize: 13, color: "rgba(255,255,255,0.78)", fontWeight: "400" },

  // ── Card ───────────────────────────────────────────────────────────────────
  card: {
    width: "100%",
    backgroundColor: "#fff",
    borderRadius: 24,
    padding: 24,
    marginBottom: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.12,
    shadowRadius: 20,
    elevation: 12,
  },
  errorBanner: {
    backgroundColor: "#FEF2F2",
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },

  // ── OTP step ───────────────────────────────────────────────────────────────
  otpHeader: { alignItems: "center", marginBottom: 20 },
  otpIconRing: {
    width: 64, height: 64, borderRadius: 32,
    backgroundColor: TEAL_LIGHT,
    alignItems: "center", justifyContent: "center",
    marginBottom: 12,
  },
  otpTitle: { fontSize: 18, fontWeight: "800", color: "#1F2937", marginBottom: 4 },
  otpSub: { fontSize: 13, color: "#6B7280", textAlign: "center" },
  otpPhone: { color: TEAL, fontWeight: "700" },

  // ── Toggle ─────────────────────────────────────────────────────────────────
  toggle: {
    flexDirection: "row",
    backgroundColor: "#F3F4F6",
    borderRadius: 12, padding: 4,
    marginBottom: 20,
  },
  toggleBtn: {
    flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 6, paddingVertical: 10, borderRadius: 10,
  },
  toggleBtnActive: { backgroundColor: "#fff", shadowColor: "#000", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.08, shadowRadius: 3, elevation: 2 },
  toggleText: { fontSize: 14, fontWeight: "600", color: "#6B7280" },
  toggleTextActive: { color: TEAL, fontWeight: "700" },

  // ── Inputs ─────────────────────────────────────────────────────────────────
  fieldLabel: {
    fontSize: 13, fontWeight: "600", color: "#374151",
    marginBottom: 8, marginTop: 4,
  },
  inputRow: {
    flexDirection: "row", alignItems: "center",
    borderWidth: 1.5, borderColor: "#E5E7EB",
    borderRadius: 14, backgroundColor: "#F9FAFB",
    marginBottom: 16, minHeight: 52,
    paddingHorizontal: 14,
  },
  inputIcon: { marginRight: 10 },
  input: {
    flex: 1, fontSize: 15, color: "#1F2937",
    paddingVertical: 0,
  },
  phoneRow: {
    flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 8,
  },
  countryPill: {
    flexDirection: "row", alignItems: "center", gap: 6,
    backgroundColor: "#F3F4F6", borderRadius: 14,
    borderWidth: 1.5, borderColor: "#E5E7EB",
    paddingHorizontal: 14, height: 52,
  },
  flag: { fontSize: 18 },
  countryCode: { fontSize: 15, fontWeight: "700", color: "#374151" },
  phoneInput: { flex: 1, height: 52, borderWidth: 1.5, borderColor: "#E5E7EB", borderRadius: 14, backgroundColor: "#F9FAFB", paddingHorizontal: 14 },
  hint: { fontSize: 12, color: "#9CA3AF", marginBottom: 20, lineHeight: 17 },

  forgotWrap: { alignSelf: "flex-end", marginBottom: 20, marginTop: -8 },
  forgotText: { fontSize: 13, color: TEAL, fontWeight: "600" },

  // ── Primary button ─────────────────────────────────────────────────────────
  btn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center",
    gap: 8, height: 54, borderRadius: 16,
    backgroundColor: TEAL,
    shadowColor: TEAL, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.35, shadowRadius: 10,
    elevation: 6, marginBottom: 4,
  },
  btnDisabled: { opacity: 0.5 },
  btnText: { fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: 0.2 },

  // ── Resend row ─────────────────────────────────────────────────────────────
  resendRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 14 },
  resendPrompt: { fontSize: 13, color: "#6B7280" },
  resendCountdown: { fontSize: 13, color: "#9CA3AF", fontWeight: "600" },
  resendLink: { fontSize: 13, color: TEAL, fontWeight: "700", textDecorationLine: "underline" },

  changeNum: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 4, marginTop: 10, paddingVertical: 8 },
  changeNumText: { fontSize: 13, color: TEAL, fontWeight: "500" },

  // ── Sign up row ────────────────────────────────────────────────────────────
  signUpRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 20 },
  signUpPrompt: { fontSize: 14, color: "#6B7280" },
  signUpLink: { fontSize: 14, color: TEAL, fontWeight: "800" },

  footer: { fontSize: 11, color: "rgba(255,255,255,0.6)", textAlign: "center" },
});
