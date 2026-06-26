import { useCallback } from "react";
import { getLanguage, t, type AppLanguage } from "./index";

export function useAppLanguage() {
  const translate = useCallback(
    (key: string, params?: Record<string, string | number>) => t(key, params),
    [],
  );

  return {
    t: translate,
    language: getLanguage() as AppLanguage,
  };
}
