/** Measurement body field keys (numeric inputs only). */
export const MEASUREMENT_VALUE_KEYS = [
  "chest",
  "waist",
  "hips",
  "shoulder",
  "neck",
  "sleeve_length",
  "inseam",
  "height",
] as const;

export type MeasurementValueKey = (typeof MEASUREMENT_VALUE_KEYS)[number];

export type MeasurementFieldRule = {
  label: string;
  unit: string;
  maxDigits: number;
  min: number;
  max: number;
  placeholder: string;
};

/** Practical tailoring ranges (inches except height in cm). */
export const MEASUREMENT_FIELD_RULES: Record<MeasurementValueKey, MeasurementFieldRule> = {
  chest: {
    label: "Chest",
    unit: "in",
    maxDigits: 2,
    min: 28,
    max: 56,
    placeholder: "e.g. 38",
  },
  waist: {
    label: "Waist",
    unit: "in",
    maxDigits: 2,
    min: 22,
    max: 48,
    placeholder: "e.g. 32",
  },
  hips: {
    label: "Hips",
    unit: "in",
    maxDigits: 2,
    min: 28,
    max: 56,
    placeholder: "e.g. 40",
  },
  shoulder: {
    label: "Shoulder",
    unit: "in",
    maxDigits: 2,
    min: 12,
    max: 24,
    placeholder: "e.g. 17",
  },
  neck: {
    label: "Neck",
    unit: "in",
    maxDigits: 2,
    min: 12,
    max: 22,
    placeholder: "e.g. 15",
  },
  sleeve_length: {
    label: "Sleeve Length",
    unit: "in",
    maxDigits: 2,
    min: 20,
    max: 36,
    placeholder: "e.g. 24",
  },
  inseam: {
    label: "Inseam",
    unit: "in",
    maxDigits: 2,
    min: 24,
    max: 40,
    placeholder: "e.g. 30",
  },
  height: {
    label: "Height",
    unit: "cm",
    maxDigits: 3,
    min: 100,
    max: 250,
    placeholder: "e.g. 170",
  },
};

/** Strip non-digits and cap length per field (height allows 3 digits). */
export function sanitizeMeasurementInput(
  fieldKey: string,
  value: string,
): string {
  const rule = MEASUREMENT_FIELD_RULES[fieldKey as MeasurementValueKey];
  const maxDigits = rule?.maxDigits ?? 2;
  return value.replace(/\D/g, "").slice(0, maxDigits);
}

/** Format stored number for edit form. */
export function measurementNumberToFieldString(
  fieldKey: string,
  value: number,
): string {
  if (!value || value <= 0) return "";
  const rule = MEASUREMENT_FIELD_RULES[fieldKey as MeasurementValueKey];
  if (!rule) return String(Math.floor(value));
  const n = Math.min(rule.max, Math.max(rule.min, Math.floor(value)));
  return String(n);
}

/** Validate filled measurement fields before save/update. */
export function validateMeasurementFieldValues(
  values: Record<string, string>,
): Record<string, string> {
  const errs: Record<string, string> = {};

  for (const key of MEASUREMENT_VALUE_KEYS) {
    const raw = values[key]?.trim();
    if (!raw) continue;

    const rule = MEASUREMENT_FIELD_RULES[key];
    const digitPattern =
      rule.maxDigits === 3 ? /^\d{1,3}$/ : /^\d{1,2}$/;

    if (!digitPattern.test(raw)) {
      errs[key] =
        rule.maxDigits === 3
          ? "Enter up to 3 digits only"
          : "Enter up to 2 digits only";
      continue;
    }

    const n = parseInt(raw, 10);
    if (Number.isNaN(n) || n < rule.min || n > rule.max) {
      errs[key] = `Enter ${rule.min}–${rule.max} ${rule.unit}`;
    }
  }

  return errs;
}

/** At least one body measurement must be provided. */
export function hasAtLeastOneMeasurementValue(
  values: Record<string, string>,
): boolean {
  return MEASUREMENT_VALUE_KEYS.some((key) => {
    const raw = values[key]?.trim();
    if (!raw) return false;
    const n = parseInt(raw, 10);
    return !Number.isNaN(n) && n > 0;
  });
}
