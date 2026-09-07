import { request } from "../../services/api";

const BASE = "/users/measurements";

export type MeasurementGender = "male" | "female" | "kids" | "other";

export interface MeasurementField {
  key: string;
  label: string;
  unit: string;
}

export interface MeasurementFormDefaults {
  genders: MeasurementGender[];
  fit_preferences: string[];
  fields_by_gender: Record<string, MeasurementField[]>;
  suggested_profile_name: string | null;
}

export interface ApiMeasurement {
  id: number;
  user_id: number;
  profile_name: string;
  gender: MeasurementGender | null;
  chest: number | null;
  waist: number | null;
  hips: number | null;
  shoulder: number | null;
  neck: number | null;
  sleeve_length: number | null;
  inseam: number | null;
  height: number | null;
  fit_preference: string | null;
  notes: string | null;
  is_default: boolean;
  created_at: string;
  updated_at: string | null;
}

export interface MeasurementPayload {
  profile_name?: string | null;
  gender?: MeasurementGender | null;
  chest?: number | null;
  waist?: number | null;
  hips?: number | null;
  shoulder?: number | null;
  neck?: number | null;
  sleeve_length?: number | null;
  inseam?: number | null;
  height?: number | null;
  fit_preference?: string | null;
  notes?: string | null;
  is_default?: boolean;
}

export async function getMeasurements(): Promise<{
  measurements: ApiMeasurement[];
  default_measurement_id: number | null;
  suggested_profile_name: string | null;
}> {
  return request<{
    measurements: ApiMeasurement[];
    total: number;
    default_measurement_id: number | null;
    suggested_profile_name: string | null;
  }>(BASE);
}

export async function getMeasurementFormDefaults(): Promise<MeasurementFormDefaults> {
  return request<MeasurementFormDefaults>(`${BASE}/form-defaults`);
}

// No createMeasurement/deleteMeasurement here by design - a profile is
// created exclusively by Bridge/employee at pickup; the customer app only
// ever edits an existing one (see useMeasurementStore.ts).
export async function updateMeasurement(
  id: number,
  payload: Partial<MeasurementPayload>,
): Promise<ApiMeasurement> {
  return request<ApiMeasurement>(`${BASE}/${id}`, {
    method: "PATCH",
    body: payload as unknown as Record<string, unknown>,
  });
}
