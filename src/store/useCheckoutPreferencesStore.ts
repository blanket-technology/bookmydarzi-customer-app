import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import type { PaymentMethodOption } from "../types/payment";

interface CheckoutPreferencesStore {
  /** Last payment method the customer picked at checkout - defaults to "online". */
  lastPaymentMethod: PaymentMethodOption;
  setLastPaymentMethod: (method: PaymentMethodOption) => void;
}

/** Remembers the customer's last-chosen checkout payment method across app
 * sessions, so the selector defaults to it on the next checkout instead of
 * always resetting to Online. */
export const useCheckoutPreferencesStore = create<CheckoutPreferencesStore>()(
  persist(
    (set) => ({
      lastPaymentMethod: "online",
      setLastPaymentMethod: (method) => set({ lastPaymentMethod: method }),
    }),
    {
      name: "bmd-checkout-preferences",
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
