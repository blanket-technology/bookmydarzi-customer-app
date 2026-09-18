import type { CatalogStitchingType } from "../types/catalogApi";

// Classifies a Custom Alterations line's tiers into Repair/Resize/Restyle -
// no backend/catalog change, the catalog has no explicit "type" field for a
// tier, so this reads keywords already present in every real tier name
// today (see the live catalog: "Sleeve Repair", "Button Replacement",
// "Waist Adjustment", "Length Shortening", ...). Mirrors the website's
// lib/services/alterationGroups.ts exactly - same classification, same
// real-extra-click design (line -> group screen -> tier), per explicit
// direction to keep both platforms consistent.
export type AlterationGroupKey = "repair" | "resize" | "restyle" | "other";

const GROUP_LABELS: Record<AlterationGroupKey, string> = {
  repair: "Repair",
  resize: "Resize",
  restyle: "Restyle",
  other: "Other",
};

export const GROUP_DESCRIPTIONS: Record<AlterationGroupKey, string> = {
  repair: "Fix a tear, broken zip, worn seam, or missing button - restore the garment to working order.",
  resize: "Adjust the fit - length, waist, shoulder, or sleeve - to match your exact measurements.",
  restyle: "Update the look - a design change, redesign, or styling refresh on an existing garment.",
  other: "Additional alteration work for this garment.",
};

const GROUP_ORDER: AlterationGroupKey[] = ["repair", "resize", "restyle", "other"];

function classify(name: string): AlterationGroupKey {
  const n = name.toLowerCase();
  if (n.includes("repair") || n.includes("replacement")) return "repair";
  if (n.includes("length") || n.includes("waist") || n.includes("shoulder") || n.includes("adjustment")) {
    return "resize";
  }
  if (n.includes("restyle") || n.includes("redesign") || n.includes("style")) return "restyle";
  return "other";
}

export interface AlterationGroup {
  key: AlterationGroupKey;
  label: string;
  tiers: CatalogStitchingType[];
}

/** Groups tiers by type, dropping any empty group - an "Other" bucket only
 * ever appears if a tier's name genuinely doesn't match a known keyword, so
 * nothing is hidden, just organized. */
export function groupAlterationTiers(tiers: CatalogStitchingType[]): AlterationGroup[] {
  const byKey = new Map<AlterationGroupKey, CatalogStitchingType[]>();
  for (const tier of tiers) {
    const key = classify(tier.name);
    const list = byKey.get(key) ?? [];
    list.push(tier);
    byKey.set(key, list);
  }
  return GROUP_ORDER
    .filter((key) => byKey.has(key))
    .map((key) => ({ key, label: GROUP_LABELS[key], tiers: byKey.get(key)! }));
}
