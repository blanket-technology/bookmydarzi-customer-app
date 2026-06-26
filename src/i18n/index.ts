import en from "./locales/en.json";
import hi from "./locales/hi.json";

const catalogs = { en, hi } as const;
export type AppLanguage = keyof typeof catalogs;

let currentLanguage: AppLanguage = "en";

function resolveString(obj: Record<string, unknown>, path: string): string | undefined {
  const value = path.split(".").reduce<unknown>((acc, key) => {
    if (acc && typeof acc === "object" && key in (acc as Record<string, unknown>)) {
      return (acc as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
  return typeof value === "string" ? value : undefined;
}

export function setLanguage(language: AppLanguage) {
  currentLanguage = language;
}

export function getLanguage(): AppLanguage {
  return currentLanguage;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const raw =
    resolveString(catalogs[currentLanguage] as Record<string, unknown>, key) ??
    resolveString(en as Record<string, unknown>, key) ??
    key;

  if (!params) return raw;

  return raw.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
    params[token] != null ? String(params[token]) : "",
  );
}

const i18n = { t, setLanguage, getLanguage };
export default i18n;
