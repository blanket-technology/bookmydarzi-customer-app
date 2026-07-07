import { request, authRequest, maskToken } from "./api";
import { sanitizeUserEmailForStore } from "../src/utils/email";
import {
  normalizeTenDigitMobile,
  parseMobileFromProfileApi,
} from "../src/utils/userPhone";
import { normalizeProfileImageUrl } from "../src/utils/profileImage";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface RegisterPayload {
  first_name: string;
  last_name: string;
  email: string;
  mobile: string;
  password: string;
}

export interface LoginPayload {
  email: string;
  password: string;
}

export type UserRole = "user" | "employee" | "tailor" | "admin" | "superadmin";

export interface User {
  id: string;
  first_name: string;
  last_name: string;
  name: string;
  email: string;
  phone?: string;
  mobile?: string;
  phone_number?: string;
  address?: string;
  profile_image?: string | null;
  date_joined?: string;
  is_active?: boolean;
  role?: UserRole;
}

export interface AuthResponse {
  user: User;
  access_token: string;
  refresh_token: string;
}

export interface MessageResponse {
  message: string;
}

export interface OtpResponse {
  message: string;
  session?: string;
}

export interface ForgotPasswordVerifyResponse {
  reset_token: string;
  message?: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function extractToken(res: any, field: "access" | "refresh"): string {
  if (field === "access") {
    return (
      res?.access_token ??
      res?.token ??
      res?.accessToken ??
      res?.tokens?.access_token ??
      res?.tokens?.access ??
      res?.data?.access_token ??
      res?.data?.token ??
      res?.data?.accessToken ??
      res?.data?.tokens?.access_token ??
      ""
    );
  }
  return (
    res?.refresh_token ??
    res?.refreshToken ??
    res?.tokens?.refresh_token ??
    res?.tokens?.refresh ??
    res?.data?.refresh_token ??
    res?.data?.refreshToken ??
    res?.data?.tokens?.refresh_token ??
    ""
  );
}

function logTokensFromResponse(context: string, res: any): void {
  if (!__DEV__) return;
  const access = extractToken(res, "access");
  const refresh = extractToken(res, "refresh");
  console.log(
    `[AuthService] ${context}: access=${maskToken(access)} refresh=${maskToken(refresh || access)}`
  );
}

function extractUser(res: any, fallback: Partial<User>): User {
  const raw = res?.user ?? res?.data?.user ?? res?.data ?? res;

  const mobileDigits =
    parseMobileFromProfileApi(raw) ||
    normalizeTenDigitMobile(fallback.phone ?? fallback.mobile);

  const user: User = {
    id: String(raw?.id ?? raw?.user_id ?? fallback.id ?? ""),
    first_name: raw?.first_name ?? fallback.first_name ?? "",
    last_name: raw?.last_name ?? fallback.last_name ?? "",
    name: raw?.name ?? raw?.full_name ?? "",
    email: raw?.Email ?? raw?.email ?? fallback.email ?? "",
    phone: mobileDigits || undefined,
    mobile: mobileDigits || undefined,
    phone_number: mobileDigits || undefined,
    address: raw?.address ?? undefined,
    profile_image: normalizeProfileImageUrl(
      raw?.ProfileImageUrl ??
        raw?.profile_image_url ??
        raw?.profile_image ??
        raw?.ProfileImage ??
        raw?.avatar ??
        null,
    ),
    role: ((raw?.Role ?? raw?.role ?? "user") as string).toLowerCase() as UserRole,
  };

  if (!user.name) {
    user.name = `${user.first_name} ${user.last_name}`.trim();
  }

  user.email = sanitizeUserEmailForStore(user.email);

  return user;
}

function toAuthResponse(res: any, fallback: Partial<User> = {}): AuthResponse {
  return {
    user: extractUser(res, fallback),
    access_token: extractToken(res, "access"),
    refresh_token: extractToken(res, "refresh"),
  };
}

// ---------------------------------------------------------------------------
// Email auth
// ---------------------------------------------------------------------------

/** POST /auth/email/signup - sends email OTP, no JWT */
export async function registerRequest(
  payload: RegisterPayload
): Promise<MessageResponse> {
  return authRequest<MessageResponse>("/auth/email/signup", {
    method: "POST",
    body: {
      first_name: payload.first_name,
      last_name: payload.last_name,
      email: payload.email,
      mobile: payload.mobile,
      password: payload.password,
    },
    skipAuth: true,
  });
}

/** POST /auth/email/verify-otp - verify signup OTP and return JWT */
export async function verifyEmailOtpRequest(
  email: string,
  otp: string
): Promise<AuthResponse> {
  const res = await authRequest<any>("/auth/email/verify-otp", {
    method: "POST",
    body: { email, otp },
    skipAuth: true,
  });

  logTokensFromResponse("verifyEmailOtp", res);
  const auth = toAuthResponse(res, { email });
  if (!auth.access_token) {
    throw new Error("OTP verified but no access token was returned. Please try again.");
  }
  return auth;
}

/** POST /auth/email/resend-otp - resend signup OTP */
export async function resendEmailOtpRequest(email: string): Promise<MessageResponse> {
  return authRequest<MessageResponse>("/auth/email/resend-otp", {
    method: "POST",
    body: { email },
    skipAuth: true,
  });
}

/** POST /auth/email/login */
export async function loginRequest(payload: LoginPayload): Promise<AuthResponse> {
  const res = await authRequest<any>("/auth/email/login", {
    method: "POST",
    body: {
      email: payload.email,
      password: payload.password,
    },
    skipAuth: true,
  });

  logTokensFromResponse("login", res);
  const auth = toAuthResponse(res, { email: payload.email });
  if (!auth.access_token) {
    throw new Error("Login succeeded but no access token was returned.");
  }
  if (!auth.refresh_token?.trim() && __DEV__) {
    console.warn(
      "[AuthService] login: refresh_token missing from response - refresh may fail after access token expires",
    );
  }
  return auth;
}

// ---------------------------------------------------------------------------
// Mobile auth
// ---------------------------------------------------------------------------

/** POST /auth/mobile/request-otp */
export async function requestOtpRequest(mobile: string): Promise<OtpResponse> {
  return authRequest<OtpResponse>("/auth/mobile/request-otp", {
    method: "POST",
    body: { mobile },
    skipAuth: true,
  });
}

/** POST /auth/mobile/verify-otp */
export async function verifyOtpRequest(
  mobile: string,
  otp: string
): Promise<AuthResponse> {
  const res = await authRequest<any>("/auth/mobile/verify-otp", {
    method: "POST",
    // Support backends that expect `otp` or legacy `code`
    body: { mobile, otp, code: otp },
    skipAuth: true,
  });

  logTokensFromResponse("verifyOtp", res);

  const auth = toAuthResponse(res, { mobile });
  if (!auth.access_token) {
    throw new Error("OTP verified but no access token was returned. Please try again.");
  }
  return auth;
}

// ---------------------------------------------------------------------------
// Session
// ---------------------------------------------------------------------------

/** POST /auth/logout - revoke refresh session */
export async function logoutRequest(): Promise<void> {
  let refreshToken: string | null = null;
  try {
    const { getRefreshToken } = await import("./api");
    refreshToken = await getRefreshToken();
  } catch {
    // proceed without body
  }

  const body = refreshToken ? { refresh_token: refreshToken } : undefined;

  await authRequest("/auth/logout", {
    method: "POST",
    body: body as Record<string, unknown> | undefined,
    skipAuth: true,
  }).catch((e) => {
    if (__DEV__) {
      console.warn("[AuthService] logout request failed (ignored):", e?.message);
    }
  });
}

// ---------------------------------------------------------------------------
// Forgot password
// ---------------------------------------------------------------------------

/** POST /auth/forgot-password/request */
export async function forgotPasswordRequest(email: string): Promise<MessageResponse> {
  return authRequest<MessageResponse>("/auth/forgot-password/request", {
    method: "POST",
    body: { email },
    skipAuth: true,
  });
}

/** POST /auth/forgot-password/verify */
export async function forgotPasswordVerifyRequest(
  email: string,
  otp: string
): Promise<ForgotPasswordVerifyResponse> {
  const res = await authRequest<any>("/auth/forgot-password/verify", {
    method: "POST",
    body: { email, otp },
    skipAuth: true,
  });

  const reset_token =
    res?.reset_token ?? res?.resetToken ?? res?.data?.reset_token ?? "";

  if (!reset_token) {
    throw new Error("OTP verified but no reset token was returned. Please try again.");
  }

  return {
    reset_token,
    message: res?.message ?? res?.data?.message,
  };
}

/** POST /auth/forgot-password/reset */
export async function forgotPasswordResetRequest(
  resetToken: string,
  password: string
): Promise<MessageResponse> {
  return authRequest<MessageResponse>("/auth/forgot-password/reset", {
    method: "POST",
    body: { reset_token: resetToken, password },
    skipAuth: true,
  });
}

// ---------------------------------------------------------------------------
// Profile
// ---------------------------------------------------------------------------

/** GET /users/profile */
export async function fetchProfileRequest(): Promise<User | null> {
  let res: any;
  try {
    res = await request<any>("/users/profile");
  } catch (e: any) {
    if (__DEV__) {
      console.warn(
        "[AuthService] /users/profile fetch failed (non-fatal):",
        e?.message ?? e
      );
    }
    return null;
  }

  if (__DEV__) {
    console.log("[AuthService] fetchProfile raw response:", JSON.stringify(res));
  }

  const raw = res?.data ?? res;
  const hasId = raw?.Id ?? raw?.id ?? raw?.user_id ?? raw?.UserId;
  const hasEmail = raw?.Email ?? raw?.email;
  if (!raw || (!hasId && !hasEmail)) {
    if (__DEV__) {
      console.warn(
        "[AuthService] fetchProfile: response has no recognisable user data:",
        JSON.stringify(raw)
      );
    }
    return null;
  }

  const mobileDigits = parseMobileFromProfileApi(raw);

  const user: User = {
    id: String(raw?.Id ?? raw?.id ?? raw?.user_id ?? raw?.UserId ?? ""),
    first_name: raw?.FirstName ?? raw?.first_name ?? "",
    last_name: raw?.LastName ?? raw?.last_name ?? "",
    name: raw?.Name ?? raw?.name ?? raw?.FullName ?? raw?.full_name ?? "",
    email: raw?.Email ?? raw?.email ?? "",
    phone: mobileDigits || undefined,
    mobile: mobileDigits || undefined,
    phone_number: mobileDigits || undefined,
    address: raw?.Address ?? raw?.address ?? undefined,
    profile_image: normalizeProfileImageUrl(
      raw?.ProfileImageUrl ??
        raw?.ProfileImage ??
        raw?.profile_image_url ??
        raw?.profile_image ??
        raw?.Avatar ??
        raw?.avatar ??
        null,
    ),
    date_joined:
      raw?.DateJoined ??
      raw?.date_joined ??
      raw?.CreatedAt ??
      raw?.created_at ??
      undefined,
    is_active: raw?.IsActive ?? raw?.is_active ?? true,
    role: ((raw?.Role ?? raw?.role ?? "user") as string).toLowerCase() as UserRole,
  };

  if (!user.name) {
    user.name = `${user.first_name} ${user.last_name}`.trim();
  }

  user.email = sanitizeUserEmailForStore(user.email);

  if (__DEV__) {
    console.log("[AuthService] fetchProfile mapped user:", JSON.stringify(user));
  }

  return user;
}
