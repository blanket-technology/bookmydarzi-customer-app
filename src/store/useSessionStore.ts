import { create } from "zustand";

interface SessionState {
  expired: boolean;
  markExpired: () => void;
  clear: () => void;
}

// Set only from the registerLogoutCallback path in store/useAuthStore.ts -
// i.e. only on a genuine refresh-token failure (services/api.ts's
// forceLogout), never on a user-initiated "Log out" tap.
export const useSessionStore = create<SessionState>((set) => ({
  expired: false,
  markExpired: () => set({ expired: true }),
  clear: () => set({ expired: false }),
}));
