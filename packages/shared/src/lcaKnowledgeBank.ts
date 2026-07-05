/*
 * ---metadata---
 * type: package-source
 * description: Reusable reviewed knowledge-bank entries for Landschaft LCA code segments.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add reviewed LCA knowledge-bank lookup and pending entry creation
 * ---end-metadata---
 */
export const LCA_CODE_THEMES = [
  "topography",
  "slope",
  "geology",
  "soil",
  "vegetation",
  "land-use"
] as const;

export type LcaCodeTheme = (typeof LCA_CODE_THEMES)[number];

export type KnowledgeBankEntryStatus = "reviewed" | "pending" | "draft";

export interface KnowledgeBankEntry {
  id: string;
  theme: LcaCodeTheme;
  sourceValue: string;
  codeSegment: string;
  meaning: string;
  classificationRule: string;
  status: KnowledgeBankEntryStatus;
  version: string;
  usageCount: number;
  importSource?: string;
  importedAt?: string;
}

export const LCA_KNOWLEDGE_BANK_VERSION = "lca-kb-v2";

const REVIEWED_KNOWLEDGE_BANK: KnowledgeBankEntry[] = [
  {
    id: "kb-soil-loam",
    theme: "soil",
    sourceValue: "loam",
    codeSegment: "LO",
    meaning: "Loam soil group with balanced sand, silt, and clay.",
    classificationRule: "USDA soil texture class mapped to loam.",
    status: "reviewed",
    version: LCA_KNOWLEDGE_BANK_VERSION,
    usageCount: 0
  },
  {
    id: "kb-soil-clay",
    theme: "soil",
    sourceValue: "clay",
    codeSegment: "CL",
    meaning: "Clay-dominated soil with low permeability.",
    classificationRule: "USDA soil texture class mapped to clay.",
    status: "reviewed",
    version: LCA_KNOWLEDGE_BANK_VERSION,
    usageCount: 0
  },
  {
    id: "kb-drainage-well",
    theme: "soil",
    sourceValue: "well drained",
    codeSegment: "WD",
    meaning: "Well drained soil profile.",
    classificationRule: "Soil drainage class mapped to well drained.",
    status: "reviewed",
    version: LCA_KNOWLEDGE_BANK_VERSION,
    usageCount: 0
  },
  {
    id: "kb-veg-forest",
    theme: "vegetation",
    sourceValue: "forest",
    codeSegment: "FO",
    meaning: "Forest or woodland land cover.",
    classificationRule: "NLCD or woodland mask mapped to forest cover.",
    status: "reviewed",
    version: LCA_KNOWLEDGE_BANK_VERSION,
    usageCount: 0
  },
  {
    id: "kb-veg-shrub",
    theme: "vegetation",
    sourceValue: "shrub",
    codeSegment: "SH",
    meaning: "Shrub or scrub land cover.",
    classificationRule: "NLCD shrub/scrub class mapped to shrub cover.",
    status: "reviewed",
    version: LCA_KNOWLEDGE_BANK_VERSION,
    usageCount: 0
  },
  {
    id: "kb-use-rural",
    theme: "land-use",
    sourceValue: "rural",
    codeSegment: "RU",
    meaning: "Rural settlement or land-use pattern.",
    classificationRule: "Settlement pattern mapped to rural character.",
    status: "reviewed",
    version: LCA_KNOWLEDGE_BANK_VERSION,
    usageCount: 0
  },
  {
    id: "kb-use-urban",
    theme: "land-use",
    sourceValue: "urban",
    codeSegment: "UR",
    meaning: "Urban or built-up land use.",
    classificationRule: "Settlement pattern mapped to urban character.",
    status: "reviewed",
    version: LCA_KNOWLEDGE_BANK_VERSION,
    usageCount: 0
  }
];

export function createKnowledgeBankStore(
  seedEntries: KnowledgeBankEntry[] = REVIEWED_KNOWLEDGE_BANK
) {
  const entries = seedEntries.map((entry) => ({ ...entry }));

  return {
    list(): KnowledgeBankEntry[] {
      return entries.map((entry) => ({ ...entry }));
    },

    resolve(theme: LcaCodeTheme, sourceValue: string): KnowledgeBankEntry {
      const normalized = normalizeKnowledgeValue(sourceValue);
      const reviewed = entries.find(
        (entry) =>
          entry.theme === theme &&
          entry.sourceValue === normalized &&
          entry.status === "reviewed"
      );

      if (reviewed) {
        reviewed.usageCount += 1;
        return { ...reviewed };
      }

      const pending = entries.find(
        (entry) =>
          entry.theme === theme &&
          entry.sourceValue === normalized &&
          entry.status !== "reviewed"
      );

      if (pending) {
        pending.usageCount += 1;
        return { ...pending };
      }

      const draft = createPendingKnowledgeBankEntry(theme, sourceValue);
      entries.push(draft);
      return { ...draft };
    }
  };
}

export function getReviewedKnowledgeBankEntries(): KnowledgeBankEntry[] {
  return REVIEWED_KNOWLEDGE_BANK.map((entry) => ({ ...entry }));
}

export function createPendingKnowledgeBankEntry(
  theme: LcaCodeTheme,
  sourceValue: string
): KnowledgeBankEntry {
  const normalized = normalizeKnowledgeValue(sourceValue);
  const codeSegment = deriveDraftCodeSegment(normalized);

  return {
    id: `kb-pending-${theme}-${normalized.replace(/\s+/g, "-")}`,
    theme,
    sourceValue: normalized,
    codeSegment,
    meaning: `Pending ${formatTheme(theme)} classification for "${sourceValue}".`,
    classificationRule:
      "Draft code segment created from dominant intersecting evidence pending human review.",
    status: "pending",
    version: LCA_KNOWLEDGE_BANK_VERSION,
    usageCount: 1
  };
}

export function normalizeKnowledgeValue(value: string) {
  return value.trim().toLowerCase();
}

function deriveDraftCodeSegment(value: string) {
  const words = value.split(/[\s/_-]+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word.slice(0, 1).toUpperCase())
      .join("");
  }

  const compact = value.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return compact.slice(0, 2) || "DR";
}

function formatTheme(theme: LcaCodeTheme) {
  return theme.replace("-", " ");
}
