import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";

/**
 * Bump this whenever the onboarding slides change meaningfully - a
 * mismatch between this and the persisted `completedVersion` re-shows
 * onboarding even for a user who already dismissed an older version.
 */
export const ONBOARDING_VERSION = 1;

interface OnboardingStore {
  /** Version the user last completed/dismissed - null if never seen. */
  completedVersion: number | null;
  complete: () => void;
  /** True once AsyncStorage rehydration has resolved - callers must wait
   * for this before trusting `completedVersion` (same pattern as
   * useAuthStore._hasHydrated), otherwise a fresh install briefly reads
   * the in-memory default and could flash past onboarding before storage
   * finishes loading. */
  _hasHydrated: boolean;
  _setHasHydrated: (value: boolean) => void;
}

export const useOnboardingStore = create<OnboardingStore>()(
  persist(
    (set) => ({
      completedVersion: null,
      complete: () => set({ completedVersion: ONBOARDING_VERSION }),
      _hasHydrated: false,
      _setHasHydrated: (value) => set({ _hasHydrated: value }),
    }),
    {
      name: "bmd-onboarding",
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ completedVersion: state.completedVersion }),
      onRehydrateStorage: () => (_state, error) => {
        if (error) {
          console.warn("[OnboardingStore] Rehydration error:", error);
        }
        useOnboardingStore.getState()._setHasHydrated(true);
      },
    },
  ),
);

// Safety net - if rehydration somehow never fires (e.g. AsyncStorage
// unavailable), don't leave the app stuck treating every user as
// not-yet-onboarded forever. Mirrors useAuthStore's same fallback.
setTimeout(() => {
  if (!useOnboardingStore.getState()._hasHydrated) {
    useOnboardingStore.getState()._setHasHydrated(true);
  }
}, 500);
