/** Normalize to 10-digit Indian mobile for API payloads. */
export function normalizeTenDigitMobile(
  value: string | null | undefined,
): string {
  const digits = String(value ?? "").replace(/\D/g, "");
  if (digits.length === 10) return digits;
  if (digits.length > 10) return digits.slice(-10);
  return "";
}

/** Read stored mobile from API profile payloads (`Mobile` is canonical on UserResponse). */
export function parseMobileFromProfileApi(raw: unknown): string {
  if (!raw || typeof raw !== "object") return "";
  const r = raw as Record<string, unknown>;

  const nestedUser =
    r.user && typeof r.user === "object"
      ? (r.user as Record<string, unknown>)
      : null;
  const editProfile =
    r.EditProfile && typeof r.EditProfile === "object"
      ? (r.EditProfile as Record<string, unknown>)
      : r.edit_profile && typeof r.edit_profile === "object"
        ? (r.edit_profile as Record<string, unknown>)
        : null;

  const pick = (obj: Record<string, unknown> | null) =>
    obj
      ? normalizeTenDigitMobile(
          obj.Mobile ??
            obj.mobile ??
            obj.phone_number ??
            obj.PhoneNumber ??
            obj.phone ??
            obj.Phone,
        )
      : "";

  return (
    pick(r) ||
    pick(nestedUser) ||
    pick(editProfile) ||
    ""
  );
}

export function getUserMobile(
  user:
    | {
        Mobile?: string;
        mobile?: string;
        phone?: string;
        phone_number?: string;
      }
    | null
    | undefined,
  phoneOverride?: string | null,
): string {
  const fromOverride = normalizeTenDigitMobile(phoneOverride);
  if (fromOverride) return fromOverride;
  return normalizeTenDigitMobile(
    user?.Mobile ?? user?.mobile ?? user?.phone ?? user?.phone_number,
  );
}

export function mergeUserMobile<
  T extends {
    Mobile?: string;
    mobile?: string;
    phone?: string;
    phone_number?: string;
  },
>(user: T, mobile: string): T {
  const normalized = normalizeTenDigitMobile(mobile);
  if (!normalized) return user;
  return {
    ...user,
    Mobile: normalized,
    phone: normalized,
    mobile: normalized,
    phone_number: normalized,
  };
}
