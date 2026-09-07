import { useCallback } from "react";
import { useLanguageStore } from "../store/useLanguageStore";
import { t, type AppLanguage } from "./index";

export function useAppLanguage() {
  // Subscribing to the store makes components re-render when language changes
  const language = useLanguageStore((s) => s.language);

  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(key, params),
    // Re-create the callback when language changes so stale closures refresh
    [language],
  );

  return {
    t: translate,
    language: language as AppLanguage,
  };
}
