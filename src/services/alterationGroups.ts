import type { CatalogStitchingType } from "../types/catalogApi";

// Classifies a Custom Alterations line's tiers into Repair/Resize/Restyle.
// The catalog now has a real, admin-set field for this
// (CatalogStitchingType.alteration_group) - a tier's own explicit
// assignment always wins. Keyword classification on the tier name is only
// a fallback for a tier that hasn't been assigned one yet. Mirrors the
// website's lib/services/alterationGroups.ts exactly - same resolution
// order, same real-extra-tap design (line -> group screen -> tier), per
// explicit direction to keep both platforms consistent.
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

/** Strips a leading "Normal "/"Designer " quality prefix for display - the
 * distinction still matters for booking (they're separate priced tiers) but
 * reads as noise in a list that's already scoped to one alteration group,
 * e.g. "Normal Sleeve Repair" -> "Sleeve Repair". */
export function stripQualityPrefix(name: string): string {
  const t = name.trim();
  const l = t.toLowerCase();
  if (l.startsWith("normal ")) return t.slice("normal ".length).trim();
  if (l.startsWith("designer ")) return t.slice("designer ".length).trim();
  return t;
}

function classifyByKeyword(name: string): AlterationGroupKey {
  const n = name.toLowerCase();
  if (n.includes("repair") || n.includes("replacement")) return "repair";
  if (n.includes("length") || n.includes("waist") || n.includes("shoulder") || n.includes("adjustment")) {
    return "resize";
  }
  if (n.includes("restyle") || n.includes("redesign") || n.includes("style")) return "restyle";
  return "other";
}

function resolveGroup(tier: CatalogStitchingType): AlterationGroupKey {
  if (tier.alteration_group === "repair" || tier.alteration_group === "resize" || tier.alteration_group === "restyle") {
    return tier.alteration_group;
  }
  return classifyByKeyword(tier.name);
}

export interface AlterationGroup {
  key: AlterationGroupKey;
  label: string;
  tiers: CatalogStitchingType[];
}

/** Groups tiers by type, dropping any empty group - an "Other" bucket only
 * ever appears if a tier has neither an explicit alteration_group nor a
 * name matching a known keyword, so nothing is hidden, just organized. */
export function groupAlterationTiers(tiers: CatalogStitchingType[]): AlterationGroup[] {
  const byKey = new Map<AlterationGroupKey, CatalogStitchingType[]>();
  for (const tier of tiers) {
    const key = resolveGroup(tier);
    const list = byKey.get(key) ?? [];
    list.push(tier);
    byKey.set(key, list);
  }
  return GROUP_ORDER
    .filter((key) => byKey.has(key))
    .map((key) => ({ key, label: GROUP_LABELS[key], tiers: byKey.get(key)! }));
}
