// ============================================================================
// GET /catalog/services/{bookableServiceId}/measurement-template
// ============================================================================

export interface MeasurementTemplateField {
  field_key: string;
  label: string;
  unit: string;
  display_order: number;
  is_required: boolean;
  user_measurement_field: string | null;
}

export interface MeasurementSizeTemplate {
  size_code: string;
  measurements: Record<string, number>;
}

export interface MeasurementTemplate {
  service_id: number;
  service_name?: string;
  category_name?: string;
  service_line_name?: string;
  stitching_type?: string;
  fields: MeasurementTemplateField[];
  size_templates: MeasurementSizeTemplate[];
  size_display_order: string[];
  custom_size_code: string;
  base_price?: number;
}
