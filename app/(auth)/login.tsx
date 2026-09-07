/**
 * Login - BookMyDarzi brand redesign (full-screen, centered-logo layout).
 * Visual layer only. All auth logic unchanged from the previous version.
 *
 * Design: white canvas, logo centered at top (not a header row), headline
 * "Welcome to BookMyDarzi", teal accent throughout (matches app primary,
 * not gold). PasswordInput owns its full field box directly - no nested
 * wrapper border, which was the previous "double box" bug.
 */
import { Ionicons } from "@expo/vector-icons";
import { Link, useRouter } from "expo-router";
import { useCallback, useMemo, useRef, useState } from "react";
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
import { COLORS } from "../../constants/theme";
import { FormBannerError } from "../../src/components/common/FormMessage";
import { PasswordInput } from "../../src/components/common/PasswordInput";
import { useHardwareBackHandler } from "../../src/hooks/useHardwareBackHandler";
import { navigateAfterAuthWithCart } from "../../src/utils/authCartRedirect";
import { safeRouterReplace } from "../../src/utils/safeNavigation";
import { useAuthStore } from "../../store/useAuthStore";

const RESEND_COOLDOWN = 30;
const PHONE_PATTERN   = /^\d{10}$/;

// ── Tokens - teal brand family (matches constants/theme.ts primary) ──────────
const TEAL       = COLORS.primaryDark;
const TEAL_MID   = COLORS.primary;
const INK        = "#0F1D1E";
const MUTED      = "#6B7B7C";
const BORDER     = "#E7ECEC";
const INPUT_BG   = "#F6F8F8";
const WHITE      = "#FFFFFF";
const ERROR_BG   = "#FEF2F2";

function isValidEmail(v: string) { return v.trim().length > 0 && v.includes("@"); }

// ── OTP digit boxes ───────────────────────────────────────────────────────────
function OtpBoxes({
  value, onChangeText, editable, boxHeight = 56, rowMarginBottom = 24,
}: { value: string; onChangeText: (t: string) => void; editable: boolean; boxHeight?: number; rowMarginBottom?: number }) {
  const ref   = useRef<TextInput>(null);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  return (
    <TouchableOpacity activeOpacity={1} onPress={() => ref.current?.focus()} style={{ flexDirection: "row", gap: 8, marginBottom: rowMarginBottom }}>
      {digits.map((d, i) => {
        const active = value.length === i;
        const filled = !!d;
        return (
          <View
            key={i}
            style={{
              flex: 1, minWidth: 0, height: boxHeight, borderRadius: 14,
              backgroundColor: filled ? "#E6F5F6" : INPUT_BG,
              borderWidth: 1.5, borderColor: filled || active ? TEAL_MID : BORDER,
              alignItems: "center", justifyContent: "center",
            }}
          >
            <Text style={{ fontSize: 22, fontWeight: "700", color: filled ? INK : MUTED }}>{d}</Text>
          </View>
        );
      })}
      <TextInput
        ref={ref}
        style={{ position: "absolute", opacity: 0, width: 0, height: 0 }}
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

// ── LoginScreen ───────────────────────────────────────────────────────────────
export default function LoginScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { width: screenWidth, height: screenHeight } = useWindowDimensions();
  const { login, loginWithOtp, verifyOtp, loading } = useAuthStore();

  const contentMaxWidth = Math.min(screenWidth, 440);

  // Logo tracks content width (~52%) so it's proportional on every device,
  // clamped so it's neither tiny on small phones nor huge on tablets.
  const logoSize = Math.max(150, Math.min(220, Math.round(contentMaxWidth * 0.52)));

  // Content is designed at a 760px baseline (insets excluded). `scale`
  // shrinks every size/gap continuously so the whole screen always fits
  // with no scrolling, instead of jumping between fixed breakpoints.
  const availableHeight = screenHeight - insets.top - insets.bottom - 24;
  const BASELINE_HEIGHT = 760;
  const scale = Math.max(0.64, Math.min(1, availableHeight / BASELINE_HEIGHT));
  const sc = useCallback((v: number) => Math.round(v * scale), [scale]);

  const [mode, setMode]         = useState<"phone" | "email" | "otp">("phone");
  const [email, setEmail]       = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone]       = useState("");
  const [otpVal, setOtpVal]     = useState("");
  const [error, setError]       = useState<string | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [focused, setFocused]   = useState<string | null>(null);

  const timerRef       = useRef<ReturnType<typeof setInterval> | null>(null);
  const submittingRef  = useRef(false);

  const btnSc = useSharedValue(1);
  const onBtnIn  = () => { btnSc.value = withTiming(0.97, { duration: 100 }); };
  const onBtnOut = () => { btnSc.value = withTiming(1.0,  { duration: 150 }); };
  const btnAnimStyle = useAnimatedStyle(() => ({ transform: [{ scale: btnSc.value }] }));

  const isPhoneReady = useMemo(() => PHONE_PATTERN.test(phone.trim()), [phone]);
  const isEmailReady = useMemo(() => isValidEmail(email) && password.trim().length > 0, [email, password]);

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

  const handleBack = useCallback(() => {
    if (mode === "otp") {
      setMode("phone"); setOtpVal(""); setError(null);
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      setCountdown(0);
      return true;
    }
    // Back always lands on the guest home. Pop if there's history (returns to
    // wherever the user opened login from), otherwise reset to the home tab.
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)");
    return true;
  }, [mode, router]);

  useHardwareBackHandler(handleBack);

  const afterAuth = () => navigateAfterAuthWithCart(router);

  const switchMode = (m: "phone" | "email") => {
    setMode(m); setError(null); setOtpVal("");
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    setCountdown(0);
  };

  const handleEmailSignIn = async () => {
    if (submittingRef.current) return;
    setError(null);
    if (!email.trim()) return setError("Email is required.");
    if (!email.includes("@")) return setError("Enter a valid email address.");
    if (!password.trim()) return setError("Password is required.");
    submittingRef.current = true;
    try { await login({ email: email.trim(), password }); afterAuth(); }
    catch (e: any) { setError(e?.message ?? "Login failed. Please try again."); }
    finally { submittingRef.current = false; }
  };

  const handleSendOtp = async () => {
    if (submittingRef.current) return;
    setError(null);
    if (!/^\d{10}$/.test(phone.trim())) return setError("Enter a valid 10-digit number.");
    submittingRef.current = true;
    try { await loginWithOtp(phone.trim()); setMode("otp"); setOtpVal(""); startCountdown(); }
    catch (e: any) { setError(e?.message ?? "Failed to send OTP. Please try again."); }
    finally { submittingRef.current = false; }
  };

  const handleVerifyOtp = async () => {
    if (submittingRef.current) return;
    setError(null);
    if (otpVal.length < 6) return setError("Please enter the 6-digit OTP.");
    submittingRef.current = true;
    try {
      await verifyOtp(phone.trim(), otpVal.trim());
      safeRouterReplace(router, "/(auth)/otp-verify-success" as any);
    } catch (e: any) {
      const msg = (e?.message ?? "") as string;
      if (msg.toLowerCase().includes("invalid") || msg.toLowerCase().includes("incorrect"))
        setError("Invalid OTP. Please check and try again.");
      else if (msg.toLowerCase().includes("expired"))
        setError("OTP has expired. Request a new one.");
      else setError(msg || "OTP verification failed.");
    } finally { submittingRef.current = false; }
  };

  const handleResend = async () => {
    if (countdown > 0 || submittingRef.current) return;
    setError(null); setOtpVal("");
    submittingRef.current = true;
    try { await loginWithOtp(phone.trim()); startCountdown(); }
    catch (e: any) { setError(e?.message ?? "Failed to resend OTP."); }
    finally { submittingRef.current = false; }
  };

  const primaryDisabled = loading || (
    mode === "phone" ? !isPhoneReady :
    mode === "email" ? !isEmailReady :
    otpVal.length < 6
  );

  // ── Render ────────────────────────────────────────────────────────────────
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
        {/* ScrollView so the form never clips on short screens or when the
            keyboard is up. contentContainerStyle centers the block when it
            fits and lets it scroll when it doesn't (flexGrow + center). */}
        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={{
            flexGrow: 1,
            justifyContent: "center",
            paddingHorizontal: 24,
            paddingTop: insets.top + sc(56),
            paddingBottom: insets.bottom + sc(24),
          }}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          showsVerticalScrollIndicator={false}
        >
          <View style={{ width: "100%", maxWidth: contentMaxWidth, alignSelf: "center" }}>

            {/* ── Logo, centered at top. Sized off the screen width (capped)
                so it stays proportional across phones and tablets, then
                scaled by sc() for short screens. ── */}
            <View style={{ alignItems: "center", marginBottom: sc(4) }}>
              <Image
                source={require("../../assets/logo.png")}
                style={{ width: sc(logoSize), height: sc(logoSize) }}
                resizeMode="contain"
              />
            </View>

            {/* ── Headline ── */}
            <Animated.View entering={FadeInDown.delay(60).duration(380)} style={{ alignItems: "center", marginBottom: sc(18) }}>
              {mode === "otp" ? (
                <>
                  <Text maxFontSizeMultiplier={1.3} style={{ fontSize: sc(26), fontWeight: "800", color: INK, letterSpacing: -0.6, textAlign: "center" }}>Verify Your Number</Text>
                  <Text maxFontSizeMultiplier={1.3} style={{ fontSize: sc(13), color: MUTED, marginTop: 6, textAlign: "center" }}>
                    OTP sent to <Text style={{ color: TEAL_MID, fontWeight: "700" }}>+91 {phone}</Text>
                  </Text>
                </>
              ) : (
                <>
                  <Text maxFontSizeMultiplier={1.3} style={{ fontSize: sc(26), fontWeight: "800", color: INK, letterSpacing: -0.6, textAlign: "center" }}>Welcome to BookMyDarzi</Text>
                  <Text maxFontSizeMultiplier={1.3} style={{ fontSize: sc(13), color: MUTED, marginTop: 6, textAlign: "center" }}>
                    {mode === "email" ? "Login with your email" : "Enter your mobile number to continue"}
                  </Text>
                </>
              )}
            </Animated.View>

            {/* ── Form ── */}
            <Animated.View entering={FadeInDown.delay(140).duration(420)}>

              <FormBannerError message={error} style={{ borderRadius: 12, marginBottom: 16, backgroundColor: ERROR_BG, padding: 12 }} />

              {/* ── OTP step ── */}
              {mode === "otp" ? (
                <>
                  <Text style={fl}>ONE-TIME PASSWORD</Text>
                  <OtpBoxes
                    value={otpVal}
                    onChangeText={(t) => { setOtpVal(t); if (error) setError(null); }}
                    editable={!loading}
                    boxHeight={sc(56)}
                    rowMarginBottom={sc(24)}
                  />

                  <Animated.View style={btnAnimStyle}>
                    <TouchableOpacity
                      style={[btnBase, { height: sc(54) }, primaryDisabled && btnOff]}
                      onPress={handleVerifyOtp}
                      onPressIn={onBtnIn} onPressOut={onBtnOut}
                      disabled={primaryDisabled} activeOpacity={1}
                    >
                      {loading ? <ActivityIndicator color={WHITE} /> : <Text style={btnTxt}>Verify & Continue  →</Text>}
                    </TouchableOpacity>
                  </Animated.View>

                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: 16, flexWrap: "wrap" }}>
                    <Text style={{ fontSize: 13, color: MUTED }}>Didn&apos;t receive it?  </Text>
                    {countdown > 0
                      ? <Text style={{ fontSize: 13, color: MUTED, fontWeight: "600" }}>Resend in {countdown}s</Text>
                      : <TouchableOpacity onPress={handleResend} disabled={loading} hitSlop={8}>
                          <Text style={{ fontSize: 13, color: TEAL_MID, fontWeight: "700" }}>Resend OTP</Text>
                        </TouchableOpacity>}
                  </View>

                  <TouchableOpacity
                    style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", paddingVertical: 12 }}
                    onPress={() => { setMode("phone"); setOtpVal(""); setError(null); }}
                  >
                    <Ionicons name="arrow-back" size={13} color={TEAL_MID} />
                    <Text style={{ fontSize: 13, color: TEAL_MID, fontWeight: "600" }}> Change mobile number</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <>
                  {/* ── Email + Password ── */}
                  {mode === "email" ? (
                    <>
                      <Text style={fl}>EMAIL ADDRESS</Text>
                      <View style={[inputWrap, { minHeight: sc(52) }, focused === "email" && inputFocus]}>
                        <TextInput
                          style={inputTxt}
                          placeholder="Enter email address"
                          placeholderTextColor="#9CA8A8"
                          value={email}
                          onChangeText={(t) => { setEmail(t); if (error) setError(null); }}
                          onFocus={() => setFocused("email")} onBlur={() => setFocused(null)}
                          keyboardType="email-address"
                          autoCapitalize="none" autoCorrect={false}
                          editable={!loading}
                        />
                      </View>

                      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 14, marginBottom: 8 }}>
                        <Text style={[fl, { marginBottom: 0, marginTop: 0 }]}>PASSWORD</Text>
                        <Link href="/(auth)/forgot-password" asChild>
                          <TouchableOpacity hitSlop={8}>
                            <Text style={{ fontSize: 12, fontWeight: "600", color: TEAL_MID }}>Forgot?</Text>
                          </TouchableOpacity>
                        </Link>
                      </View>
                      <PasswordInput
                        style={[passwordWrap, { minHeight: sc(52) }, focused === "pwd" && inputFocus]}
                        placeholder="Enter password"
                        placeholderTextColor="#9CA8A8"
                        value={password}
                        onChangeText={(t) => { setPassword(t); if (error) setError(null); }}
                        onFocus={() => setFocused("pwd")} onBlur={() => setFocused(null)}
                        editable={!loading}
                      />
                    </>
                  ) : (
                    /* ── Phone + OTP ── */
                    <>
                      <Text style={fl}>MOBILE NUMBER</Text>
                      <View style={[phoneRow, { minHeight: sc(52) }, focused === "phone" && inputFocus]}>
                        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingRight: 12, borderRightWidth: 1, borderRightColor: BORDER }}>
                          <Text style={{ fontSize: 18 }}>🇮🇳</Text>
                          <Text style={{ fontSize: 15, fontWeight: "700", color: INK }}>+91</Text>
                        </View>
                        <TextInput
                          style={[inputTxt, { flex: 1 }]}
                          placeholder="Enter mobile number"
                          placeholderTextColor="#9CA8A8"
                          value={phone}
                          onChangeText={(t) => { setPhone(t.replace(/\D/g, "").slice(0, 10)); if (error) setError(null); }}
                          onFocus={() => setFocused("phone")} onBlur={() => setFocused(null)}
                          keyboardType="number-pad" maxLength={10}
                          editable={!loading} returnKeyType="done"
                          onSubmitEditing={handleSendOtp}
                        />
                      </View>
                      <Text style={{ fontSize: 12, color: MUTED, lineHeight: 17, marginTop: 6 }}>We&apos;ll send a one-time password to verify.</Text>
                    </>
                  )}

                  <View style={{ height: sc(22) }} />

                  {/* Primary CTA */}
                  <Animated.View style={btnAnimStyle}>
                    <TouchableOpacity
                      style={[btnBase, { height: sc(54) }, primaryDisabled && btnOff]}
                      onPress={mode === "phone" ? handleSendOtp : handleEmailSignIn}
                      onPressIn={onBtnIn} onPressOut={onBtnOut}
                      disabled={primaryDisabled} activeOpacity={1}
                      accessibilityRole="button"
                    >
                      {loading
                        ? <ActivityIndicator color={WHITE} />
                        : <Text style={btnTxt}>{mode === "phone" ? "Send OTP" : "Login"}  →</Text>}
                    </TouchableOpacity>
                  </Animated.View>

                  {/* Switch phone/email - small, secondary; no separate signup
                      flow needed since OTP verification IS account creation
                      for new phone numbers (Blinkit/Zepto-style). */}
                  <TouchableOpacity
                    style={{ alignItems: "center", justifyContent: "center", marginTop: sc(18), paddingVertical: 8 }}
                    onPress={() => switchMode(mode === "phone" ? "email" : "phone")}
                    hitSlop={8}
                  >
                    <Text style={{ fontSize: 13, fontWeight: "600", color: TEAL_MID }}>
                      {mode === "phone" ? "Login with email instead" : "Login with mobile number instead"}
                    </Text>
                  </TouchableOpacity>

                  {/* Signup link is only offered on the email flow. On the
                      mobile-number flow, OTP verification IS account creation
                      for a new phone (Blinkit/Zepto-style), so a separate
                      signup step would be redundant there. */}
                  {mode === "email" && (
                    <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "center", marginTop: sc(4) }}>
                      <Text style={{ fontSize: 13, color: MUTED }}>New here? </Text>
                      <Link href="/(auth)/signup" asChild>
                        <TouchableOpacity hitSlop={8}>
                          <Text style={{ fontSize: 13, fontWeight: "700", color: TEAL_MID }}>Create an account</Text>
                        </TouchableOpacity>
                      </Link>
                    </View>
                  )}
                </>
              )}
            </Animated.View>

            {/* Terms - the doc names are tappable, opening the in-app
                Terms / Privacy screens (standard consent pattern). */}
            <Text style={{ fontSize: 11, color: "#9CA8A8", textAlign: "center", lineHeight: 17, paddingTop: sc(24) }}>
              By continuing you agree to our{" "}
              <Text
                onPress={() => router.push("/terms" as any)}
                style={{ color: TEAL_MID, fontWeight: "600", textDecorationLine: "underline" }}
              >
                Terms
              </Text>
              {" & "}
              <Text
                onPress={() => router.push("/privacy" as any)}
                style={{ color: TEAL_MID, fontWeight: "600", textDecorationLine: "underline" }}
              >
                Privacy Policy
              </Text>
              .
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

// ── Shared inline style objects ────────────────────────────────────────────
const fl = { fontSize: 10, fontWeight: "700" as const, color: MUTED, letterSpacing: 1.2, marginBottom: 8, marginTop: 4 };
const inputWrap = { borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, backgroundColor: INPUT_BG, justifyContent: "center" as const, paddingHorizontal: 16 };
const inputFocus = { borderColor: TEAL_MID, backgroundColor: WHITE };
const inputTxt = { fontSize: 15, color: INK, paddingVertical: 14, flex: 1 };
// PasswordInput renders its own box (border/background/radius) around the
// input + eye-icon internally - this is passed as its outer `style`, not
// nested inside another bordered wrapper, which was the earlier "double
// box" bug (an inputWrap box containing PasswordInput's own box).
const passwordWrap = { borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, backgroundColor: INPUT_BG, paddingHorizontal: 4 };
const phoneRow = { flexDirection: "row" as const, alignItems: "center" as const, borderWidth: 1.5, borderColor: BORDER, borderRadius: 14, backgroundColor: INPUT_BG, paddingHorizontal: 14, gap: 10 };
const btnBase = {
  backgroundColor: TEAL, borderRadius: 16, alignItems: "center" as const, justifyContent: "center" as const,
  shadowColor: TEAL, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.2, shadowRadius: 12, elevation: 4,
};
const btnOff = { opacity: 0.45 };
const btnTxt = { fontSize: 16, fontWeight: "700" as const, color: WHITE, letterSpacing: 0.2 };
