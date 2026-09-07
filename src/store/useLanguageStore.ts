import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { setLanguage, type AppLanguage } from "../i18n";

interface LanguageStore {
  language: AppLanguage;
  setLanguage: (lang: AppLanguage) => void;
}

export const useLanguageStore = create<LanguageStore>()(
  persist(
    (set) => ({
      language: "en" as AppLanguage,
      setLanguage: (lang) => {
        setLanguage(lang);   // update the module-level variable too
        set({ language: lang });
      },
    }),
    {
      name: "bmd-language",
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => {
        if (state?.language) setLanguage(state.language);
      },
    },
  ),
);
