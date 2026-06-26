import { useCallback, useMemo, useState } from "react";
import type { ApiMeasurement } from "../types/api";
import type { MeasurementTemplate } from "../types/measurementTemplate";
import {
  buildTemplateValuesForSize,
  CUSTOM_SIZE,
  formsDifferFromTemplate,
  mapMeasurementToTemplateForm,
  resolveEffectiveSizeCode,
  resolveMatchingSizeCode,
  sanitizeTemplateFieldInput,
} from "../utils/measurementSize";

export function useMeasurementSizeSelection(
  template: MeasurementTemplate | null,
) {
  const customSizeCode = template?.custom_size_code ?? CUSTOM_SIZE;
  const sizeDisplayOrder = useMemo(
    () => template?.size_display_order ?? [customSizeCode],
    [template?.size_display_order, customSizeCode],
  );

  const [selectedSize, setSelectedSize] = useState(customSizeCode);
  const [formByFieldKey, setFormByFieldKey] = useState<Record<string, string>>(
    {},
  );
  const [activeTemplateValues, setActiveTemplateValues] = useState<Record<
    string,
    string
  > | null>(null);

  const resetFormFields = useCallback(() => {
    setFormByFieldKey({});
    setActiveTemplateValues(null);
    setSelectedSize(customSizeCode);
  }, [customSizeCode]);

  const loadFromMeasurement = useCallback(
    (measurement: ApiMeasurement) => {
      if (!template) return;

      const mapped = mapMeasurementToTemplateForm(template, measurement);
      const matchedSize = resolveMatchingSizeCode(template, mapped);

      setFormByFieldKey(mapped);
      setSelectedSize(matchedSize);

      if (matchedSize !== customSizeCode) {
        setActiveTemplateValues(buildTemplateValuesForSize(template, matchedSize));
      } else {
        setActiveTemplateValues(null);
      }
    },
    [template, customSizeCode],
  );

  const selectSize = useCallback(
    (sizeCode: string) => {
      if (!template) return;

      const effective = resolveEffectiveSizeCode(template, sizeCode);
      setSelectedSize(effective);

      if (effective === customSizeCode) {
        setActiveTemplateValues(null);
        return;
      }

      const filled = buildTemplateValuesForSize(template, effective);
      setFormByFieldKey((prev) => ({ ...prev, ...filled }));
      setActiveTemplateValues(filled);
    },
    [template, customSizeCode],
  );

  const updateField = useCallback(
    (fieldKey: string, value: string) => {
      const sanitized = sanitizeTemplateFieldInput(value);

      setFormByFieldKey((prev) => {
        const next = { ...prev, [fieldKey]: sanitized };

        if (
          template &&
          selectedSize !== customSizeCode &&
          activeTemplateValues &&
          formsDifferFromTemplate(template, next, activeTemplateValues)
        ) {
          setSelectedSize(customSizeCode);
          setActiveTemplateValues(null);
        }

        return next;
      });
    },
    [template, selectedSize, customSizeCode, activeTemplateValues],
  );

  return {
    selectedSize,
    formByFieldKey,
    sizeDisplayOrder,
    customSizeCode,
    selectSize,
    updateField,
    setFormByFieldKey,
    resetFormFields,
    loadFromMeasurement,
  };
}
