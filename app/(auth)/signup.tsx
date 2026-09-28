/**
 * Signup - BookMyDarzi brand redesign (full-screen, centered-logo layout).
 * Visual layer only. All auth logic unchanged from the previous version.
 *
 * Matches login.tsx/welcome.tsx: white canvas, logo centered at top, teal
 * accent (not gold), PasswordInput given its own field box directly (no
 * nested double-border wrapper).
 */
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  useWindowDimensions,
} from "react-native";
import Animated, {
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { POWERED_BY_LABEL } from "../../constants/branding";
import { COLORS } from "../../constants/theme";
import { FormBannerError } from "../../src/components/common/FormMessage";
import { PasswordInput } from "../../src/components/common/PasswordInput";
import { navigateAfterAuthWithCart } from "../../src/utils/authCartRedirect";
import { safeRouterReplace } from "../../src/utils/safeNavigation";
import { useAuthStore } from "../../store/useAuthStore";

const EMAIL_REGEX    = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESEND_COOLDOWN = 30;

const TEAL       = COLORS.primaryDark;
const TEAL_MID   = COLORS.primary;
const INK        = "#0F1D1E";
const MUTED      = "#6B7B7C";
const BORDER     = "#E7ECEC";
const INPUT_BG   = "#F6F8F8";
const WHITE      = "#FFFFFF";
const ERROR_BG   = "#FEF2F2";

// Password rules - MUST mirror the backend policy exactly
// (app/schemas/auth.py validate_password: >=6 chars, >=1 uppercase, >=1 number),
// so the message the user sees matches the rule the server actually enforces
// (Bug Report cycle 1, item 16.1). Each rule also drives the criteria hint (17.1).
const PASSWORD_RULES: { test: (p: string) => boolean; label: string; error: string }[] = [
  { test: (p) => p.length >= 6, label: "At least 6 characters", error: "Password must be at least 6 characters." },
  { test: (p) => /[A-Z]/.test(p), label: "One uppercase letter", error: "Password must contain at least one uppercase letter." },
  { test: (p) => /[0-9]/.test(p), label: "One number", error: "Password must contain at least one number." },
];

function firstPasswordError(password: string): string | null {
  for (const rule of PASSWORD_RULES) {
    if (!rule.test(password)) return rule.error;
  }
  return null;
}

function validateForm(
  firstName: string, lastName: string, email: string,
  mobile: string, password: string, confirmPassword: string,
): string | null {
  if (!firstName.trim())   return "First name is required.";
  if (!lastName.trim())    return "Last name is required.";
  if (!email.trim())       return "Email is required.";
  if (!EMAIL_REGEX.test(email.trim())) return "Enter a valid email address.";
  if (!mobile.trim())      return "Mobile number is required.";
  // Mirrors backend's _validate_mobile_10_digit (app/schemas/auth.py) - must
  // also start with 6/7/8/9, not just be 10 digits. Was previously looser,
  // so e.g. a mistyped/landline-style number passed here and 422'd server-side.
  if (!/^[6-9][0-9]{9}$/.test(mobile.trim())) return "Enter a valid 10-digit mobile number starting with 6-9.";
  const pwErr = firstPasswordError(password);
  if (pwErr) return pwErr;
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
}

function StepDots({ step }: { step: "form" | "otp" }) {
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 16, justifyContent: "center" }}>
      <View style={{ height: 3, borderRadius: 1.5, width: step === "form" ? 22 : 10, backgroundColor: step === "form" ? TEAL_MID : BORDER }} />
      <View style={{ height: 3, borderRadius: 1.5, width: step === "otp" ? 22 : 10, backgroundColor: step === "otp" ? TEAL_MID : BORDER }} />
      <Text style={{ fontSize: 10, fontWeight: "700", color: MUTED, letterSpacing: 0.4 }}>
        STEP {step === "form" ? "1" : "2"} OF 2
      </Text>
    </View>
  );
}

function PasswordStrength({ password }: { password: string }) {
  if (!password) return null;
  const strength =
    password.length < 6 ? 1 :
    password.length < 8 ? 2 :
    /[A-Z]/.test(password) && /\d/.test(password) ? 4 : 3;
  const colors = ["", "#E74C3C", "#E67E22", "#27AE60", TEAL_MID];
  const labels = ["", "Too short", "Fair", "Good", "Strong"];
  return (
    <View style={{ marginTop: -10, marginBottom: 14 }}>
      <View style={{ flexDirection: "row", gap: 4, marginBottom: 4 }}>
        {[1, 2, 3, 4].map((i) => (
          <View key={i} style={{ flex: 1, height: 2.5, borderRadius: 1.5, backgroundColor: i <= strength ? colors[strength] : BORDER }} />
        ))}
      </View>
      <Text style={{ fontSize: 10, fontWeight: "600", color: colors[strength] }}>{labels[strength]}</Text>
    </View>
  );
}

// Password criteria hint (Bug Report cycle 1, item 17.1) - shows the exact
// backend rules and ticks each one live as the user types, so the requirements
// are clear before submitting. Driven by the same PASSWORD_RULES the validator
// uses, so hint and enforcement can never drift apart.
function PasswordCriteria({ password }: { password: string }) {
  if (!password) return null;
  return (
    <View style={{ marginTop: -6, marginBottom: 14, gap: 4 }}>
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(password);
        return (
          <View key={rule.label} style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Ionicons
              name={met ? "checkmark-circle" : "ellipse-outline"}
              size={13}
              color={met ? "#27AE60" : BORDER}
            />
            <Text style={{ fontSize: 11, fontWeight: "500", color: met ? "#27AE60" : "#9AA5A5" }}>
              {rule.label}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function OtpBoxes({
  value, onChangeText, editable,
}: { value: string; onChangeText: (t: string) => void; editable: boolean }) {
  const ref   = useRef<TextInput>(null);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  return (
    <TouchableOpacity activeOpacity={1} onPress={() => ref.current?.focus()} style={{ flexDirection: "row", gap: 8, marginBottom: 24 }}>
      {digits.map((d, i) => {
        const active = value.length === i;
        const filled = !!d;
        return (
          <View
            key={i}
            style={{
              flex: 1, minWidth: 0, height: 54, borderRadius: 14,
              backgroundColor: filled ? "#E6F5F6" : INPUT_BG,
              borderWidth: 1.5, borderColor: filled || active ? TEAL_MID : BORDER,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 20, fontWeight: "700", color: filled ? INK : MUTED }}>{d}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
        value={value}
        onChangeText={(t) => onChangeText(t.replace(/\D/g, "").slice(0, 6))}
        keyboardType="number-pad" maxLength={6}
        editable={editable} autoFocus caretHidden
      />
    </TouchableOpacity>
  );
}

export default function SignupScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { register, verifyEmailOtp, resendEmailOtp, loading } = useAuthStore();

  const contentMaxWidth = Math.min(screenWidth, 440);

  // Bug fix: the logo was a fixed 204x204 regardless of screen size/height -
  // reused login.tsx's/welcome.tsx's own existing pattern instead of
  // inventing a new one. logoSize tracks content width proportionally
  // (same ~52%/clamp as login.tsx); sc() additionally shrinks it (and
  // other sizes, if this screen adopts sc() more broadly later) on a
  // short-height device so the hero doesn't dominate the first viewport
  // before any scrolling on a small phone with both a tall status bar
  // and a short screen.
  const logoSize = Math.max(150, Math.min(220, Math.round(contentMaxWidth * 0.52)));
  const availableHeight = screenHeight - insets.top - insets.bottom - 24;
  const BASELINE_HEIGHT = 760;
  const scale = Math.max(0.64, Math.min(1, availableHeight / BASELINE_HEIGHT));
  const sc = useCallback((v: number) => Math.round(v * scale), [scale]);

  const [step,            setStep]            = useState<"form" | "otp">("form");
  const [firstName,       setFirstName]       = useState("");
  const [lastName,        setLastName]        = useState("");
  const [email,           setEmail]           = useState("");
  const [mobile,          setMobile]          = useState("");
  const [password,        setPassword]        = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpVal,          setOtpVal]          = useState("");
  const [error,           setError]           = useState<string | null>(null);
  const [countdown,       setCountdown]       = useState(0);
  const [focused,         setFocused]         = useState<string | null>(null);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const btnSc = useSharedValue(1);
  const onBtnIn  = () => { btnSc.value = withTiming(0.97, { duration: 100 }); };
  const onBtnOut = () => { btnSc.value = withTiming(1.0,  { duration: 150 }); };
  const btnAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnSc.value }] }));

  const startCountdown = useCallback(() => {
    setCountdown(RESEND_COOLDOWN);
    if (timerRef.current) clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown((p) => {
        if (p <= 1) { clearInterval(timerRef.current!); timerRef.current = null; return 0; }
        return p - 1;
      });
    }, 1000);
  }, []);

  useEffect(() => () => { if (timerRef.current) clearInterval(timerRef.current); }, []);

  const afterAuth = () => navigateAfterAuthWithCart(router);

  const handleRegister = async () => {
    setError(null);
    const err = validateForm(firstName, lastName, email, mobile, password, confirmPassword);
    if (err) return setError(err);
    try {
      await register({ first_name: firstName.trim(), last_name: lastName.trim(), email: email.trim(), mobile: mobile.trim(), password });
      setStep("otp"); setOtpVal(""); startCountdown();
    } catch (e: any) { setError(e?.message ?? "Registration failed. Please try again."); }
  };

  const handleVerifyOtp = async () => {
    setError(null);
    if (otpVal.length < 6) return setError("Please enter the 6-digit OTP.");
    try { await verifyEmailOtp(email.trim(), otpVal.trim()); afterAuth(); }
    catch (e: any) { setError(e?.message ?? "OTP verification failed."); }
  };

  const handleResendOtp = async () => {
    if (countdown > 0) return;
    setError(null); setOtpVal("");
    try { await resendEmailOtp(email.trim()); startCountdown(); }
    catch (e: any) { setError(e?.message ?? "Failed to resend OTP."); }
  };

  const handleBack = () => {
    if (step === "otp") { setStep("form"); setOtpVal(""); setError(null); return; }
    if (router.canGoBack()) router.back();
    else safeRouterReplace(router, "/(auth)/welcome" as any);
  };

  const fo = (key: string) => ({ onFocus: () => setFocused(key), onBlur: () => setFocused(null) });

  return (
    <View style={{ flex: 1, backgroundColor: WHITE }}>
      <TouchableOpacity
        onPress={handleBack}
        hitSlop={12}
        style={{
          position: "absolute", left: 20, top: insets.top + 12, zIndex: 20,
          width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center",
          backgroundColor: INPUT_BG,
        }}
        accessibilityRole="button"
        accessibilityLabel="Go back"
      >
        <Ionicons name="arrow-back" size={20} color={INK} style={{ marginRight: 1.5 }} />
      </TouchableOpacity>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : "height"}>
        <ScrollView
          contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 24, paddingBottom: 32, justifyContent: "center" }}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}>

            {/* ── Logo, centered at top ── */}
            <View style={{ alignItems: "center", marginTop: insets.top + 14, marginBottom: -20 }}>
              <Image source={require("../../assets/logo.png")} style={{ width: sc(logoSize), height: sc(logoSize) }} resizeMode="contain" />
            </View>

            {/* ── Hero ── */}
            <Animated.View entering={FadeInDown.delay(80).duration(400)} style={{ alignItems: "center" }}>
              <StepDots step={step} />
              {step === "form" ? (
                <>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: INK, letterSpacing: -0.6, textAlign: "center" }}>Create Your Account</Text>
                  <Text style={{ fontSize: 13, color: MUTED, marginTop: 8, marginBottom: 22, textAlign: "center" }}>
                    Professional tailoring, delivered to your door.
                  </Text>
                </>
              ) : (
                <>
                  <Text style={{ fontSize: 26, fontWeight: "800", color: INK, letterSpacing: -0.6, textAlign: "center" }}>Verify Your Email</Text>
                  <Text style={{ fontSize: 13, color: MUTED, marginTop: 8, marginBottom: 22, textAlign: "center" }}>
                    OTP sent to <Text style={{ color: TEAL_MID, fontWeight: "700" }}>{email}</Text>
                  </Text>
                </>
              )}
            </Animated.View>

            {/* ── Form ── */}
            <Animated.View entering={FadeInDown.delay(140).duration(420)}>

              <FormBannerError message={error} style={{ borderRadius: 12, marginBottom: 16, backgroundColor: ERROR_BG, padding: 12 }} />

              {step === "otp" ? (
                <>
                  <Text style={fl}>EMAIL OTP</Text>
                  <OtpBoxes
                    value={otpVal}
                    onChangeText={(t) => { setOtpVal(t); if (error) setError(null); }}
                    editable={!loading}
                  />

                  <Animated.View style={btnAnimStyle}>
                    <TouchableOpacity
                      style={[btnBase, (loading || otpVal.length < 6) && btnOff]}
                      onPress={handleVerifyOtp}
                      onPressIn={onBtnIn} onPressOut={onBtnOut}
                      disabled={loading || otpVal.length < 6} activeOpacity={1}
                    >
                      {loading ? <ActivityIndicator color={WHITE} /> : <Text style={btnTxt}>Verify & Continue  →</Text>}
                    </TouchableOpacity>
                  </Animated.View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, marginBottom: 10, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 13, color: MUTED }}>Didn&apos;t receive it?  </Text>
                    {countdown > 0
                      ? <Text style={{ fontSize: 13, color: MUTED, fontWeight: "600" }}>Resend in {countdown}s</Text>
                      : <TouchableOpacity onPress={handleResendOtp} disabled={loading} hitSlop={8}>
                          <Text style={{ fontSize: 13, color: TEAL_MID, fontWeight: "700" }}>Resend OTP</Text>
                        </TouchableOpacity>}
                  </View>

                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 10 }}
                    onPress={() => { setStep("form"); setOtpVal(""); setError(null); }}
                  >
                    <Ionicons name="arrow-back" size={13} color={TEAL_MID} />
                    <Text style={{ fontSize: 13, color: TEAL_MID, fontWeight: "600" }}> Edit signup details</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* Name row */}
                  <View style={{ flexDirection: "row", gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={fl}>FIRST NAME</Text>
                      <View style={[inputWrap, focused === "fn" && inputFocus]}>
                        <TextInput
                          style={inputTxt} placeholder="First" placeholderTextColor="#9CA8A8"
                          value={firstName} onChangeText={setFirstName}
                          autoCapitalize="words" editable={!loading} returnKeyType="next"
                          {...fo("fn")}
                        />
                      </View>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={fl}>LAST NAME</Text>
                      <View style={[inputWrap, focused === "ln" && inputFocus]}>
                        <TextInput
                          style={inputTxt} placeholder="Last" placeholderTextColor="#9CA8A8"
                          value={lastName} onChangeText={setLastName}
                          autoCapitalize="words" editable={!loading} returnKeyType="next"
                          {...fo("ln")}
                        />
                      </View>
                    </View>
                  </View>

                  <Text style={fl}>EMAIL ADDRESS</Text>
                  <View style={[inputWrap, focused === "em" && inputFocus]}>
                    <TextInput
                      style={inputTxt} placeholder="Enter email address" placeholderTextColor="#9CA8A8"
                      value={email} onChangeText={(t) => { setEmail(t); if (error) setError(null); }}
                      keyboardType="email-address" autoCapitalize="none" autoCorrect={false}
                      editable={!loading} returnKeyType="next" {...fo("em")}
                    />
                  </View>

                  <Text style={fl}>MOBILE NUMBER</Text>
                  <View style={[phoneRow, focused === "mob" && inputFocus]}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 12, borderRightWidth: 1, borderRightColor: BORDER }}>
                      <Text style={{ fontSize: 18 }}>🇮🇳</Text>
                      <Text style={{ fontSize: 15, fontWeight: "700", color: INK }}>+91</Text>
                    </View>
                    <TextInput
                      style={[inputTxt, { flex: 1 }]} placeholder="Enter mobile number" placeholderTextColor="#9CA8A8"
                      value={mobile} onChangeText={(t) => { setMobile(t.replace(/\D/g, "").slice(0, 10)); if (error) setError(null); }}
                      keyboardType="number-pad" maxLength={10}
                      editable={!loading} returnKeyType="next" {...fo("mob")}
                    />
                  </View>
                  <Text style={{ fontSize: 12, color: MUTED, lineHeight: 17, marginTop: 6, marginBottom: 16 }}>
                    Only for booking updates & delivery status.
                  </Text>

                  <Text style={fl}>PASSWORD</Text>
                  <PasswordInput
                    style={[passwordWrap, focused === "pw" && inputFocus, { marginBottom: 16 }]}
                    placeholder="Min. 6 characters, 1 uppercase, 1 number" placeholderTextColor="#9CA8A8"
                    value={password} onChangeText={(t) => { setPassword(t); if (error) setError(null); }}
                    editable={!loading} returnKeyType="next"
                    onFocus={() => setFocused("pw")} onBlur={() => setFocused(null)}
                  />
                  <PasswordStrength password={password} />
                  <PasswordCriteria password={password} />

                  <Text style={fl}>CONFIRM PASSWORD</Text>
                  <PasswordInput
                    style={[
                      passwordWrap, focused === "cpw" && inputFocus,
                      confirmPassword.length > 0 && confirmPassword !== password && { borderColor: "#E74C3C" },
                      { marginBottom: 4 },
                    ]}
                    placeholder="Re-enter password" placeholderTextColor="#9CA8A8"
                    value={confirmPassword} onChangeText={(t) => { setConfirmPassword(t); if (error) setError(null); }}
                    editable={!loading} returnKeyType="done"
                    onFocus={() => setFocused("cpw")} onBlur={() => setFocused(null)}
                  />
                  {confirmPassword.length > 0 && confirmPassword !== password && (
                    <Text style={{ fontSize: 11, color: "#DC2626", marginTop: 4, marginBottom: 10, fontWeight: "500" }}>
                      Passwords don&apos;t match
                    </Text>
                  )}

                  <View style={{ height: 20 }} />

                  <Animated.View style={btnAnimStyle}>
                    <TouchableOpacity
                      style={[btnBase, loading && btnOff]}
                      onPress={handleRegister}
                      onPressIn={onBtnIn} onPressOut={onBtnOut}
                      disabled={loading} activeOpacity={1}
                      accessibilityRole="button"
                    >
                      {loading ? <ActivityIndicator color={WHITE} /> : <Text style={btnTxt}>Signup  →</Text>}
                    </TouchableOpacity>
                  </Animated.View>
                </>
              )}

              {/* Sign-in row */}
              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 22, flexWrap: "wrap" }}>
                <Text style={{ fontSize: 14, color: MUTED }}>Already have an account? </Text>
                <Link href="/(auth)/login" asChild>
                  <TouchableOpacity hitSlop={8}>
                    <Text style={{ fontSize: 14, fontWeight: "700", color: TEAL_MID }}>Sign In</Text>
                  </TouchableOpacity>
                </Link>
              </View>
            </Animated.View>

            <Text style={{ fontSize: 11, color: "#9CA8A8", textAlign: "center", lineHeight: 17, paddingTop: 22 }}>
              By signing up you agree to our Terms & Privacy Policy.{"\n"}{POWERED_BY_LABEL}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Shared inline style objects ────────────────────────────────────────────
const fl = { fontSize: 10, fontWeight: "700" as const, color: MUTED, letterSpacing: 1.2, marginBottom: 8, marginTop: 4 };
const inputWrap = { borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, backgroundColor: INPUT_BG, minHeight: 52, justifyContent: "center" as const, paddingHorizontal: 16, marginBottom: 16 };
const inputFocus = { borderColor: TEAL_MID, backgroundColor: WHITE };
const inputTxt = { fontSize: 15, color: INK, paddingVertical: 14, flex: 1 };
// PasswordInput owns its full field box (border/bg/radius) via this style
// prop directly - no nested wrapper, avoiding the earlier double-border bug.
const passwordWrap = { borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, backgroundColor: INPUT_BG, minHeight: 52, paddingHorizontal: 4 };
const phoneRow = { flexDirection: "row" as const, alignItems: "center" as const, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, backgroundColor: INPUT_BG, minHeight: 52, paddingHorizontal: 14, gap: 10 };
const btnBase = {
  height: 54, backgroundColor: TEAL, borderRadius: 16, alignItems: "center" as const, justifyContent: "center" as const,
  shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
};
const btnOff = { opacity: 0.45 };
const btnTxt = { fontSize: 16, fontWeight: "700" as const, color: WHITE, letterSpacing: 0.2 };
