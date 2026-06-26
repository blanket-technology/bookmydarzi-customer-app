import type { ApiMeasurement } from "../types/api";
import {
  MEASUREMENT_FIELD_RULES,
  MEASUREMENT_VALUE_KEYS,
} from "./measurementInput";

export function formatMeasurementDetailLines(m: ApiMeasurement): string[] {
  const lines: string[] = [];
  for (const key of MEASUREMENT_VALUE_KEYS) {
    const rule = MEASUREMENT_FIELD_RULES[key];
    const val = Number(m[key as keyof ApiMeasurement]);
    if (val > 0) lines.push(`${rule.label}: ${val} ${rule.unit}`);
  }
  if (m.gender) lines.push(`Gender: ${m.gender}`);
  if (m.fit_preference) lines.push(`Fit: ${m.fit_preference}`);
  if (m.notes?.trim()) lines.push(`Notes: ${m.notes.trim()}`);
  return lines;
}

export function formatMeasurementSummary(m: ApiMeasurement): string {
  const parts = formatMeasurementDetailLines(m).slice(0, 4);
  return parts.length > 0
    ? parts.join(" · ")
    : `${m.gender} · ${m.fit_preference}`;
}
