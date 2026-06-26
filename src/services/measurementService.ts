import { request } from "../../services/api";
import type {
  ApiMeasurement,
  MeasurementFormDefaults,
  MeasurementPayload,
} from "../types/api";

const BASE = "/users/measurements";

function extractList(res: any): any[] {
  if (Array.isArray(res)) return res;
  if (Array.isArray(res?.measurements)) return res.measurements;
  if (Array.isArray(res?.data)) return res.data;
  return [];
}

function mapMeasurement(raw: any): ApiMeasurement {
  return {
    id: raw?.Id ?? raw?.id ?? 0,
    user_id: raw?.UserId ?? raw?.user_id ?? 0,
    profile_name: raw?.ProfileName ?? raw?.profile_name ?? "",
    gender: raw?.Gender ?? raw?.gender ?? "",
    chest: Number(raw?.Chest ?? raw?.chest ?? 0),
    waist: Number(raw?.Waist ?? raw?.waist ?? 0),
    hips: Number(raw?.Hips ?? raw?.hips ?? 0),
    shoulder: Number(raw?.Shoulder ?? raw?.shoulder ?? 0),
    neck: Number(raw?.Neck ?? raw?.neck ?? 0),
    sleeve_length: Number(raw?.SleeveLength ?? raw?.sleeve_length ?? 0),
    inseam: Number(raw?.Inseam ?? raw?.inseam ?? 0),
    height: Number(raw?.Height ?? raw?.height ?? 0),
    fit_preference: raw?.FitPreference ?? raw?.fit_preference ?? "",
    notes: raw?.Notes ?? raw?.notes ?? "",
    is_default: raw?.IsDefault ?? raw?.is_default ?? false,
    created_at: raw?.CreatedAt ?? raw?.created_at ?? "",
    updated_at: raw?.UpdatedAt ?? raw?.updated_at ?? "",
  };
}

export async function getMeasurements(): Promise<ApiMeasurement[]> {
  const res = await request<any>(BASE);
  return extractList(res).map(mapMeasurement);
}

function mapFormDefaults(raw: Record<string, unknown>): MeasurementFormDefaults {
  const suggested =
    raw.suggested_profile_name ??
    raw.SuggestedProfileName ??
    raw.suggestedProfileName;

  return {
    profile_name: String(
      raw.profile_name ??
        raw.ProfileName ??
        suggested ??
        "",
    ).trim() || undefined,
    gender: String(raw.gender ?? raw.Gender ?? "").trim() || undefined,
    fit_preference:
      String(raw.fit_preference ?? raw.FitPreference ?? "").trim() || undefined,
    is_default:
      raw.is_default !== undefined
        ? Boolean(raw.is_default)
        : raw.IsDefault !== undefined
          ? Boolean(raw.IsDefault)
          : undefined,
  };
}

/** GET /users/measurements/form-defaults */
export async function getMeasurementFormDefaults(): Promise<MeasurementFormDefaults> {
  const res = await request<Record<string, unknown>>(`${BASE}/form-defaults`);
  const data = (res as { data?: Record<string, unknown> })?.data ?? res;
  return mapFormDefaults(data as Record<string, unknown>);
}

export async function getMeasurementById(id: number): Promise<ApiMeasurement> {
  const res = await request<any>(`${BASE}/${id}`);
  return mapMeasurement(res?.data ?? res);
}

export async function createMeasurement(
  payload: MeasurementPayload,
): Promise<ApiMeasurement> {
  const res = await request<any>(BASE, {
    method: "POST",
    body: payload as unknown as Record<string, unknown>,
  });
  return mapMeasurement(res?.data ?? res);
}

export async function updateMeasurement(
  id: number,
  payload: Partial<MeasurementPayload>,
): Promise<ApiMeasurement> {
  const res = await request<any>(`${BASE}/${id}`, {
    method: "PATCH",
    body: payload as unknown as Record<string, unknown>,
  });
  return mapMeasurement(res?.data ?? res);
}

export async function deleteMeasurement(id: number): Promise<void> {
  await request(`${BASE}/${id}`, { method: "DELETE" });
}
