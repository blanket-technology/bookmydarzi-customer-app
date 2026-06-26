import { request } from "../../services/api";
import type { MeasurementTemplate } from "../types/measurementTemplate";

function mapField(raw: Record<string, unknown>) {
  return {
    field_key: String(raw.field_key ?? raw.FieldKey ?? ""),
    label: String(raw.label ?? raw.Label ?? ""),
    unit: String(raw.unit ?? raw.Unit ?? "in"),
    display_order: Number(raw.display_order ?? raw.DisplayOrder ?? 0),
    is_required: Boolean(raw.is_required ?? raw.IsRequired ?? false),
    user_measurement_field:
      (raw.user_measurement_field ?? raw.UserMeasurementField ?? null) as
        | string
        | null,
  };
}

function mapSizeTemplate(raw: Record<string, unknown>) {
  const measurements =
    (raw.measurements ?? raw.Measurements ?? {}) as Record<string, number>;
  return {
    size_code: String(raw.size_code ?? raw.SizeCode ?? ""),
    measurements,
  };
}

function mapTemplate(raw: Record<string, unknown>): MeasurementTemplate {
  const fieldsRaw = raw.fields ?? raw.Fields ?? [];
  const sizesRaw = raw.size_templates ?? raw.SizeTemplates ?? [];
  const orderRaw = raw.size_display_order ?? raw.SizeDisplayOrder ?? [];

  return {
    service_id: Number(raw.service_id ?? raw.ServiceId ?? 0),
    service_name: (raw.service_name ?? raw.ServiceName) as string | undefined,
    category_name: (raw.category_name ?? raw.CategoryName) as string | undefined,
    service_line_name: (raw.service_line_name ?? raw.ServiceLineName) as
      | string
      | undefined,
    stitching_type: (raw.stitching_type ?? raw.StitchingType) as
      | string
      | undefined,
    fields: Array.isArray(fieldsRaw)
      ? fieldsRaw.map((f) => mapField(f as Record<string, unknown>))
      : [],
    size_templates: Array.isArray(sizesRaw)
      ? sizesRaw.map((s) => mapSizeTemplate(s as Record<string, unknown>))
      : [],
    size_display_order: Array.isArray(orderRaw)
      ? orderRaw.map(String)
      : [],
    custom_size_code: String(
      raw.custom_size_code ?? raw.CustomSizeCode ?? "CUSTOM",
    ),
    base_price: Number(raw.base_price ?? raw.BasePrice ?? 0) || undefined,
  };
}

/** GET /catalog/services/{bookableServiceId}/measurement-template */
export async function fetchMeasurementTemplate(
  bookableServiceId: number,
): Promise<MeasurementTemplate> {
  const res = await request<Record<string, unknown>>(
    `/catalog/services/${bookableServiceId}/measurement-template`,
    { skipAuth: true },
  );
  return mapTemplate(res?.data ? (res.data as Record<string, unknown>) : res);
}
