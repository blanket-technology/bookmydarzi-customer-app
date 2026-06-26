import type { ApiMeasurement, MeasurementPayload } from "../types/api";
import type {
  MeasurementTemplate,
  MeasurementTemplateField,
} from "../types/measurementTemplate";
import {
  MEASUREMENT_FIELD_RULES,
  MEASUREMENT_VALUE_KEYS,
  type MeasurementValueKey,
} from "./measurementInput";

export const CUSTOM_SIZE = "CUSTOM";

export const STANDARD_SIZES = ["S", "M", "L", "XL", "XXL"] as const;

const PAYLOAD_MEASUREMENT_KEYS = new Set<string>(MEASUREMENT_VALUE_KEYS);

/** Fields sorted for stable UI rendering. */
export function getOrderedTemplateFields(
  template: MeasurementTemplate,
): MeasurementTemplateField[] {
  return [...template.fields].sort(
    (a, b) => (a.display_order ?? 0) - (b.display_order ?? 0),
  );
}

export function resolveEffectiveSizeCode(
  template: MeasurementTemplate | null,
  selectedSize: string,
): string {
  if (!template) return CUSTOM_SIZE;
  const custom = template.custom_size_code || CUSTOM_SIZE;
  if (selectedSize === custom) return custom;
  if (template.size_display_order.includes(selectedSize)) return selectedSize;
  return custom;
}

export function templateNumberToString(value: number | undefined): string {
  if (value == null || value <= 0) return "";
  return Number.isInteger(value) ? String(value) : String(value);
}

export function sanitizeTemplateFieldInput(value: string): string {
  let cleaned = value.replace(/[^\d.]/g, "");
  const dotIndex = cleaned.indexOf(".");
  if (dotIndex !== -1) {
    cleaned =
      cleaned.slice(0, dotIndex + 1) +
      cleaned.slice(dotIndex + 1).replace(/\./g, "");
  }
  return cleaned.slice(0, 6);
}

export function getSaveKeyForField(field: MeasurementTemplateField): string {
  return field.user_measurement_field || field.field_key;
}

export function isPersistedMeasurementKey(saveKey: string): boolean {
  return PAYLOAD_MEASUREMENT_KEYS.has(saveKey);
}

/** Backward-compatible template when no bookable service context is available. */
export function buildLegacyMeasurementTemplate(): MeasurementTemplate {
  return {
    service_id: 0,
    fields: MEASUREMENT_VALUE_KEYS.map((key, index) => ({
      field_key: key,
      label: MEASUREMENT_FIELD_RULES[key].label,
      unit: MEASUREMENT_FIELD_RULES[key].unit,
      display_order: index + 1,
      is_required: false,
      user_measurement_field: key,
    })),
    size_templates: [{ size_code: CUSTOM_SIZE, measurements: {} }],
    size_display_order: [CUSTOM_SIZE],
    custom_size_code: CUSTOM_SIZE,
  };
}

export function mapMeasurementToTemplateForm(
  template: MeasurementTemplate,
  measurement: ApiMeasurement,
): Record<string, string> {
  const form: Record<string, string> = {};
  for (const field of getOrderedTemplateFields(template)) {
    const saveKey = getSaveKeyForField(field);
    if (!isPersistedMeasurementKey(saveKey)) {
      form[field.field_key] = "";
      continue;
    }
    const raw = measurement[saveKey as keyof MeasurementPayload];
    const num = typeof raw === "number" ? raw : 0;
    form[field.field_key] = templateNumberToString(num);
  }
  return form;
}

function numericFormValuesEqual(a: string, b: string): boolean {
  const aTrim = a.trim();
  const bTrim = b.trim();
  if (aTrim === bTrim) return true;
  if (!aTrim && !bTrim) return true;
  if (!aTrim || !bTrim) return false;

  const aNum = parseFloat(aTrim);
  const bNum = parseFloat(bTrim);
  if (!Number.isNaN(aNum) && !Number.isNaN(bNum)) {
    return Math.abs(aNum - bNum) < 0.001;
  }
  return false;
}

export function formMatchesSizeTemplate(
  template: MeasurementTemplate,
  formByFieldKey: Record<string, string>,
  sizeCode: string,
): boolean {
  const customCode = template.custom_size_code || CUSTOM_SIZE;
  if (!sizeCode || sizeCode === customCode) return false;

  const entry = template.size_templates.find((s) => s.size_code === sizeCode);
  if (!entry) return false;

  return getOrderedTemplateFields(template).every((field) => {
    const expected = templateNumberToString(entry.measurements[field.field_key]);
    const actual = formByFieldKey[field.field_key] ?? "";
    return numericFormValuesEqual(actual, expected);
  });
}

/** Pick S/M/L/XL/XXL when form exactly matches a template size; otherwise CUSTOM. */
export function resolveMatchingSizeCode(
  template: MeasurementTemplate,
  formByFieldKey: Record<string, string>,
): string {
  const customCode = template.custom_size_code || CUSTOM_SIZE;

  for (const sizeCode of template.size_display_order) {
    if (sizeCode === customCode) continue;
    if (formMatchesSizeTemplate(template, formByFieldKey, sizeCode)) {
      return sizeCode;
    }
  }

  for (const entry of template.size_templates) {
    if (entry.size_code === customCode) continue;
    if (formMatchesSizeTemplate(template, formByFieldKey, entry.size_code)) {
      return entry.size_code;
    }
  }

  return customCode;
}

export function buildTemplateValuesForSize(
  template: MeasurementTemplate,
  sizeCode: string,
): Record<string, string> {
  const entry = template.size_templates.find((s) => s.size_code === sizeCode);
  if (!entry) return {};

  const values: Record<string, string> = {};
  for (const field of getOrderedTemplateFields(template)) {
    values[field.field_key] = templateNumberToString(
      entry.measurements[field.field_key],
    );
  }
  return values;
}

export function formsDifferFromTemplate(
  template: MeasurementTemplate,
  formByFieldKey: Record<string, string>,
  templateValues: Record<string, string>,
): boolean {
  return getOrderedTemplateFields(template).some((field) => {
    return (
      (formByFieldKey[field.field_key] ?? "") !==
      (templateValues[field.field_key] ?? "")
    );
  });
}

export function hasAtLeastOneTemplateMeasurement(
  template: MeasurementTemplate,
  formByFieldKey: Record<string, string>,
): boolean {
  return getOrderedTemplateFields(template).some((field) => {
    const raw = formByFieldKey[field.field_key]?.trim();
    if (!raw) return false;
    const n = parseFloat(raw);
    return !Number.isNaN(n) && n > 0;
  });
}

export function validateTemplateFieldValues(
  template: MeasurementTemplate,
  formByFieldKey: Record<string, string>,
): Record<string, string> {
  const errs: Record<string, string> = {};

  for (const field of getOrderedTemplateFields(template)) {
    const raw = formByFieldKey[field.field_key]?.trim();
    if (!raw) {
      if (field.is_required) {
        errs[field.field_key] = `${field.label} is required`;
      }
      continue;
    }

    const legacyRule =
      MEASUREMENT_FIELD_RULES[field.field_key as MeasurementValueKey];
    if (legacyRule) {
      const digitPattern =
        legacyRule.maxDigits === 3 ? /^\d{1,3}$/ : /^\d{1,2}(\.\d)?$/;
      if (!digitPattern.test(raw)) {
        errs[field.field_key] = "Enter a valid measurement";
        continue;
      }
      const n = parseFloat(raw);
      if (Number.isNaN(n) || n < legacyRule.min || n > legacyRule.max) {
        errs[field.field_key] = `Enter ${legacyRule.min}–${legacyRule.max} ${legacyRule.unit}`;
      }
      continue;
    }

    const n = parseFloat(raw);
    if (Number.isNaN(n) || n <= 0) {
      errs[field.field_key] = "Enter a valid measurement";
    }
  }

  return errs;
}

export interface MeasurementSaveMeta {
  profile_name: string;
  gender: string;
  fit_preference: string;
  notes: string;
  is_default: boolean;
}

export function buildSavePayload(
  template: MeasurementTemplate,
  formByFieldKey: Record<string, string>,
  meta: MeasurementSaveMeta,
): MeasurementPayload {
  const payload: MeasurementPayload = {
    profile_name: meta.profile_name,
    gender: meta.gender,
    fit_preference: meta.fit_preference,
    notes: meta.notes,
    is_default: meta.is_default,
    chest: 0,
    waist: 0,
    hips: 0,
    shoulder: 0,
    neck: 0,
    sleeve_length: 0,
    inseam: 0,
    height: 0,
  };

  for (const field of getOrderedTemplateFields(template)) {
    const saveKey = getSaveKeyForField(field);
    if (!isPersistedMeasurementKey(saveKey)) continue;

    const raw = formByFieldKey[field.field_key]?.trim();
    const n = raw ? parseFloat(raw) : 0;
    payload[saveKey as keyof MeasurementPayload] = (
      Number.isNaN(n) ? 0 : n
    ) as never;
  }

  return payload;
}
