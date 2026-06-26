const SYNTHETIC_PHONE_EMAIL = /^phone\.(\d{10})@bookmydarzi\.app$/i;
const PHONE_ONLY_EMAIL = /^(\d{10})@bookmydarzi\.app$/i;

/** Backend/client-generated placeholder emails tied to a phone number. */
export function isSyntheticOrPhoneDerivedEmail(
  email: string | null | undefined
): boolean {
  const trimmed = email == null ? "" : String(email).trim();
  if (!trimmed) return false;
  if (SYNTHETIC_PHONE_EMAIL.test(trimmed)) return true;
  if (PHONE_ONLY_EMAIL.test(trimmed)) return true;
  if (/^phone\./i.test(trimmed) && /@bookmydarzi\.app$/i.test(trimmed)) return true;
  return false;
}

/** Real email for auth store/API mapping, or empty. Never synthesize from mobile. */
export function sanitizeUserEmailForStore(
  email: string | null | undefined
): string {
  const trimmed = email == null ? "" : String(email).trim();
  if (!trimmed || isSyntheticOrPhoneDerivedEmail(trimmed)) return "";
  return trimmed;
}

/** Real email for profile display and edit prefill, or empty. */
export function getProfileDisplayEmail(
  email: string | null | undefined
): string {
  return sanitizeUserEmailForStore(email);
}
