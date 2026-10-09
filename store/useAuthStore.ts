import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  registerRequest,
  loginRequest,
  requestOtpRequest,
  verifyOtpRequest,
  verifyEmailOtpRequest,
  resendEmailOtpRequest,
  logoutRequest,
  fetchProfileRequest,
  RegisterPayload,
  AuthResponse,
  User,
} from "../services/authService";
import {
  API_HOST,
  saveTokens,
  clearTokens,
  getAccessToken,
  getRefreshToken,
  registerLogoutCallback,
  registerTokenUpdateCallback,
  setLoggingOut,
  getIsLoggingOut,
  maskToken,
} from "../services/api";
import { getUserMobile, mergeUserMobile } from "../src/utils/userPhone";
import { useSessionStore } from "../src/store/useSessionStore";
import { useChatStore } from "../src/store/useChatStore";
import { useSupportChatStore } from "../src/store/useSupportChatStore";
import { useSupportStore } from "../src/store/useSupportStore";
import { useNotificationStore } from "../src/store/useNotificationStore";
import { useAddressStore } from "../src/store/useAddressStore";
import { useMeasurementStore } from "../src/store/useMeasurementStore";
import { useOrderStore } from "../src/store/useOrderStore";
import { useCustomerOrdersStore } from "../src/store/useCustomerOrdersStore";
import { useCartStore } from "../src/store/useCartStore";
import { unregisterCurrentPushToken } from "../src/services/pushService";

/**
 * Bug fix: every one of these stores is a plain in-memory (or, for cart,
 * AsyncStorage-persisted) Zustand singleton scoped to the app process, not
 * to the logged-in user. logout() used to only clear auth state (tokens,
 * user) - it never called any of these stores' own reset()/clearCartState()
 * methods, even though 8 of them already had a reset() built specifically
 * for this. If a second account logs in on the same device/session without
 * a full app restart in between (shared phones, QA/demo devices, testers
 * switching accounts), the new user would see the previous user's chat
 * messages, addresses, orders, measurements and notifications still sitting
 * in memory until each screen's own fetch happened to overwrite it -
 * reported live as "chat shows my previous chat to other users."
 */
function clearPerUserStores(): void {
  useChatStore.getState().reset();
  useSupportChatStore.getState().reset();
  useSupportStore.getState().reset();
  useNotificationStore.getState().reset();
  useAddressStore.getState().reset();
  useMeasurementStore.getState().reset();
  useOrderStore.getState().reset();
  useCustomerOrdersStore.getState().reset();
  useCartStore.getState().clearCartState();
  // Book Now's pendingService/pendingRoute/etc. are now persisted
  // (useCartStore.ts) precisely so they survive a reload mid-login - but
  // that same persistence means they'd otherwise also survive a genuine
  // logout, letting the next account on this device pick up wherever a
  // previous customer's in-progress booking left off. clearCartState()
  // only resets the cart-server-state fields, not these.
  useCartStore.getState().resetBookingFlow();
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  /** API origin these tokens were issued for - cleared on host mismatch. */
  apiHost: string | null;
  isAuthenticated: boolean;
  /** Keeps UI phone in sync when PATCH succeeds but GET still returns old Mobile. */
  savedPhoneOverride: string | null;

  loading: boolean;
  error: string | null;
  _hasHydrated: boolean;

  register: (data: RegisterPayload) => Promise<void>;
  verifyEmailOtp: (email: string, otp: string) => Promise<void>;
  resendEmailOtp: (email: string) => Promise<void>;
  login: (data: { email: string; password: string }) => Promise<void>;
  loginWithOtp: (phone: string) => Promise<void>;
  verifyOtp: (phone: string, code: string) => Promise<void>;
  logout: () => Promise<void>;
  fetchProfile: () => Promise<void>;
  clearError: () => void;
  setHasHydrated: (value: boolean) => void;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function resolvePersistedRefreshToken(
  response: AuthResponse,
): string {
  const refresh = response.refresh_token?.trim();
  if (refresh) return refresh;
  if (__DEV__) {
    console.warn(
      "[AuthStore] login response missing refresh_token - using access_token fallback",
    );
  }
  return response.access_token;
}

async function applyAuthResponse(
  response: AuthResponse,
  set: (partial: Partial<AuthState>) => void
): Promise<void> {
  if (!response.access_token) {
    throw new Error("Authentication succeeded but no token was returned.");
  }

  const refreshToken = resolvePersistedRefreshToken(response);

  await saveTokens(response.access_token, refreshToken);

  if (__DEV__) {
    console.log(
      `[AuthStore] session saved for ${API_HOST}: access=${maskToken(response.access_token)} refresh=${maskToken(refreshToken)}`,
    );
  }

  set({
    user: response.user,
    accessToken: response.access_token,
    refreshToken,
    apiHost: API_HOST,
    isAuthenticated: true,
    loading: false,
    error: null,
  });

  try {
    const profile = await fetchProfileRequest();
    if (profile) set({ user: profile });
  } catch (profileErr) {
    console.warn("[AuthStore] Profile fetch after auth failed (non-fatal):", profileErr);
  }
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      apiHost: null,
      savedPhoneOverride: null,
      loading: false,
      error: null,
      isAuthenticated: false,
      _hasHydrated: false,

      register: async (data: RegisterPayload) => {
        set({ loading: true, error: null });
        try {
          await registerRequest(data);
          set({ loading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Registration failed. Please try again.";
          set({ loading: false, error: message });
          throw new Error(message);
        }
      },

      verifyEmailOtp: async (email: string, otp: string) => {
        set({ loading: true, error: null });
        try {
          const response = await verifyEmailOtpRequest(email, otp);
          await applyAuthResponse(response, set);
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "OTP verification failed. Please try again.";
          set({ loading: false, error: message });
          throw new Error(message);
        }
      },

      resendEmailOtp: async (email: string) => {
        set({ loading: true, error: null });
        try {
          await resendEmailOtpRequest(email);
          set({ loading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to resend OTP. Please try again.";
          set({ loading: false, error: message });
          throw new Error(message);
        }
      },

      login: async ({ email, password }) => {
        set({ loading: true, error: null });
        try {
          const response = await loginRequest({ email, password });
          await applyAuthResponse(response, set);
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Login failed. Please try again.";
          set({ loading: false, error: message });
          throw new Error(message);
        }
      },

      loginWithOtp: async (phone: string) => {
        set({ loading: true, error: null });
        try {
          await requestOtpRequest(phone);
          set({ loading: false });
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "Failed to send OTP. Please try again.";
          set({ loading: false, error: message });
          throw new Error(message);
        }
      },

      verifyOtp: async (phone: string, code: string) => {
        set({ loading: true, error: null });
        try {
          const response = await verifyOtpRequest(phone, code);
          await applyAuthResponse(response, set);
        } catch (err: unknown) {
          const message =
            err instanceof Error
              ? err.message
              : "OTP verification failed. Please try again.";
          set({ loading: false, error: message });
          throw new Error(message);
        }
      },

      logout: async () => {
        setLoggingOut(true);
        set({ loading: true });
        try {
          // Must run while the access token still exists (see pushService).
          await unregisterCurrentPushToken().catch(() => {});
          try {
            await logoutRequest();
          } catch {
            // ignore - local logout always proceeds
          }
          await clearTokens();
          clearPerUserStores();
          set({
            user: null,
            accessToken: null,
            refreshToken: null,
            apiHost: null,
            savedPhoneOverride: null,
            isAuthenticated: false,
            loading: false,
            error: null,
          });
          if (__DEV__) {
            console.log("[AuthStore] logout complete - tokens and per-user stores cleared");
          }
        } finally {
          setLoggingOut(false);
        }
      },

      fetchProfile: async () => {
        const { isAuthenticated, savedPhoneOverride } = get();
        if (!isAuthenticated) return;
        try {
          const profile = await fetchProfileRequest();
          if (!profile) return;

          const serverPhone = getUserMobile(profile);
          if (
            savedPhoneOverride &&
            serverPhone === savedPhoneOverride
          ) {
            set({ user: profile, savedPhoneOverride: null });
            return;
          }

          if (savedPhoneOverride) {
            set({ user: mergeUserMobile(profile, savedPhoneOverride) });
            return;
          }

          set({ user: profile });
        } catch (err) {
          console.warn(
            "[AuthStore] fetchProfile failed:",
            err instanceof Error ? err.message : err
          );
        }
      },

      clearError: () => set({ error: null }),

      setHasHydrated: (value: boolean) => set({ _hasHydrated: value }),
    }),

    {
      name: "auth-storage",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        apiHost: state.apiHost,
        savedPhoneOverride: state.savedPhoneOverride,
        isAuthenticated: state.isAuthenticated,
        // Tokens are NOT persisted here - SecureStore is the single source of truth.
      }),
      onRehydrateStorage: () => {
        return async (state, error) => {
          if (error) {
            console.warn("[AuthStore] Rehydration error:", error);
          }

          if (state?.isAuthenticated) {
            // Tokens live only in SecureStore - read them directly, not from AsyncStorage
            const secureAccess = await getAccessToken();
            const secureRefresh = await getRefreshToken();

            if (!secureAccess) {
              // AsyncStorage says logged in but SecureStore has no token - stale state
              if (__DEV__) {
                console.warn("[AuthStore] No token in SecureStore on restart - clearing session");
              }
              useAuthStore.setState({
                user: null,
                accessToken: null,
                refreshToken: null,
                apiHost: null,
                savedPhoneOverride: null,
                isAuthenticated: false,
              });
            } else if (state.apiHost && state.apiHost !== API_HOST) {
              // API host changed between sessions - clear stale session
              console.warn(
                `[AuthStore] API host changed (${state.apiHost} → ${API_HOST}) - clearing stale session`,
              );
              await clearTokens();
              useAuthStore.setState({
                user: null,
                accessToken: null,
                refreshToken: null,
                apiHost: null,
                savedPhoneOverride: null,
                isAuthenticated: false,
              });
            } else {
              // Valid session - load tokens from SecureStore into memory
              useAuthStore.setState({
                accessToken: secureAccess,
                refreshToken: secureRefresh,
                apiHost: API_HOST,
              });

              if (__DEV__) {
                console.log(
                  `[AuthStore] session restored from SecureStore (${API_HOST}): access=${maskToken(secureAccess)}`,
                );
              }

              try {
                const profile = await fetchProfileRequest();
                if (profile) {
                  const override = useAuthStore.getState().savedPhoneOverride;
                  const serverPhone = getUserMobile(profile);
                  if (override && serverPhone === override) {
                    useAuthStore.setState({ user: profile, savedPhoneOverride: null, apiHost: API_HOST });
                  } else if (override) {
                    useAuthStore.setState({ user: mergeUserMobile(profile, override), apiHost: API_HOST });
                  } else {
                    useAuthStore.setState({ user: profile, apiHost: API_HOST });
                  }
                }
              } catch (profileErr) {
                console.warn("[AuthStore] Profile fetch on restart failed (non-fatal):", profileErr);
              }
            }
          }

          useAuthStore.getState().setHasHydrated(true);
        };
      },
    }
  )
);

registerTokenUpdateCallback((accessToken, refreshToken) => {
  const { isAuthenticated } = useAuthStore.getState();
  if (!isAuthenticated) return;
  useAuthStore.setState({ accessToken, refreshToken, apiHost: API_HOST });
  if (__DEV__) {
    console.log(
      `[AuthStore] tokens synced after refresh: access=${maskToken(accessToken)} refresh=${maskToken(refreshToken)}`,
    );
  }
});

registerLogoutCallback(async () => {
  if (getIsLoggingOut()) return;
  setLoggingOut(true);
  try {
    await clearTokens();
    clearPerUserStores();
    useAuthStore.setState({
      user: null,
      accessToken: null,
      refreshToken: null,
      apiHost: null,
      savedPhoneOverride: null,
      isAuthenticated: false,
      loading: false,
      error: null,
    });
    useSessionStore.getState().markExpired();
    if (__DEV__) {
      console.log("[AuthStore] forced logout - session and per-user stores cleared");
    }
  } finally {
    setLoggingOut(false);
  }
});

// Safety fallback only - unlocks the splash screen if the rehydrate profile
// fetch (onRehydrateStorage above) never settles at all, so the app doesn't
// stay stuck on the splash forever. Must stay comfortably above the
// backend's real response time (observed 700-1100ms) - a shorter timeout
// routinely fires BEFORE the real profile lands, unlocking index.tsx's
// role-based redirect with whatever stale role was persisted from a
// previous session on this device (e.g. an old admin login), sending the
// user into a route group they no longer have access to and firing
// forbidden API calls before AuthGuard's defence-in-depth effect corrects
// the route a moment later.
setTimeout(() => {
  if (!useAuthStore.getState()._hasHydrated) {
    useAuthStore.getState().setHasHydrated(true);
  }
}, 4000);

export const isLoggedIn = (state: AuthState) => state.isAuthenticated;

export function useAuth() {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const loading = useAuthStore((s) => s.loading);
  const error = useAuthStore((s) => s.error);
  const login = useAuthStore((s) => s.login);
  const register = useAuthStore((s) => s.register);
  const verifyEmailOtp = useAuthStore((s) => s.verifyEmailOtp);
  const resendEmailOtp = useAuthStore((s) => s.resendEmailOtp);
  const loginWithOtp = useAuthStore((s) => s.loginWithOtp);
  const verifyOtp = useAuthStore((s) => s.verifyOtp);
  const logout = useAuthStore((s) => s.logout);
  const fetchProfile = useAuthStore((s) => s.fetchProfile);
  const clearError = useAuthStore((s) => s.clearError);

  return {
    user,
    isAuthenticated,
    loading,
    error,
    login,
    register,
    verifyEmailOtp,
    resendEmailOtp,
    loginWithOtp,
    verifyOtp,
    logout,
    fetchProfile,
    clearError,
  };
}
