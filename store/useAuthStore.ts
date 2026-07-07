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
          try {
            await logoutRequest();
          } catch {
            // ignore - local logout always proceeds
          }
          await clearTokens();
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
            console.log("[AuthStore] logout complete - tokens cleared");
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
    if (__DEV__) {
      console.log("[AuthStore] forced logout - session cleared");
    }
  } finally {
    setLoggingOut(false);
  }
});

setTimeout(() => {
  if (!useAuthStore.getState()._hasHydrated) {
    useAuthStore.getState().setHasHydrated(true);
  }
}, 500);

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
