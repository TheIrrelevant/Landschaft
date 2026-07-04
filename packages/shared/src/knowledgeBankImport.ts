/*
 * ---metadata---
 * type: package-source
 * description: Parse spreadsheet rows into Landschaft knowledge-bank entries for translator workflows.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add Excel/CSV row parser for knowledge bank import
 * ---end-metadata---
 */
import {
  createPendingKnowledgeBankEntry,
  LCA_CODE_THEMES,
  LCA_KNOWLEDGE_BANK_VERSION,
  normalizeKnowledgeValue,
  type KnowledgeBankEntry,
  type KnowledgeBankEntryStatus,
  type LcaCodeTheme
} from "./lcaKnowledgeBank.js";

export interface KnowledgeBankImportResult {
  entries: KnowledgeBankEntry[];
  warnings: string[];
  rejectedRowCount: number;
}

const THEME_ALIASES: Record<string, LcaCodeTheme> = {
  topography: "topography",
  elevation: "topography",
  slope: "slope",
  geology: "geology",
  geomorphology: "geology",
  soil: "soil",
  soils: "soil",
  vegetation: "vegetation",
  "land cover": "vegetation",
  landcover: "vegetation",
  woodland: "vegetation",
  "land-use": "land-use",
  landuse: "land-use",
  "land use": "land-use",
  settlement: "land-use"
};

const COLUMN_ALIASES: Record<string, keyof KnowledgeBankImportRow> = {
  theme: "theme",
  category: "theme",
  "theme category": "theme",
  "code theme": "theme",
  sourcevalue: "sourceValue",
  "source value": "sourceValue",
  source_value: "sourceValue",
  value: "sourceValue",
  "gis value": "sourceValue",
  codesegment: "codeSegment",
  "code segment": "codeSegment",
  code: "codeSegment",
  segment: "codeSegment",
  "short code": "codeSegment",
  meaning: "meaning",
  description: "meaning",
  label: "meaning",
  "human readable": "meaning",
  classificationrule: "classificationRule",
  "classification rule": "classificationRule",
  rule: "classificationRule",
  "mapping rule": "classificationRule",
  status: "status",
  sourcefile: "importSource",
  "import source": "importSource"
};

interface KnowledgeBankImportRow {
  theme: string;
  sourceValue: string;
  codeSegment: string;
  meaning: string;
  classificationRule: string;
  status?: string;
  importSource?: string;
}

export function parseKnowledgeBankRows(
  rows: Array<Record<string, unknown>>,
  options?: { importSource?: string }
): KnowledgeBankImportResult {
  const entries: KnowledgeBankEntry[] = [];
  const warnings: string[] = [];
  let rejectedRowCount = 0;

  rows.forEach((rawRow, index) => {
    const row = normalizeImportRow(rawRow);
    if (isEmptyImportRow(row)) {
      return;
    }

    const theme = resolveImportTheme(row.theme);
    if (!theme) {
      rejectedRowCount += 1;
      warnings.push(
        `Row ${index + 2}: unsupported theme "${row.theme}". Use one of: ${LCA_CODE_THEMES.join(", ")}.`
      );
      return;
    }

    if (!row.sourceValue.trim()) {
      rejectedRowCount += 1;
      warnings.push(`Row ${index + 2}: source value is required.`);
      return;
    }

    const normalizedSourceValue = normalizeKnowledgeValue(row.sourceValue);
    const status = parseImportStatus(row.status);
    const codeSegment = row.codeSegment.trim() || deriveCodeSegmentFromMeaning(row.meaning);
    const meaning =
      row.meaning.trim() ||
      createPendingKnowledgeBankEntry(theme, row.sourceValue).meaning;
    const classificationRule =
      row.classificationRule.trim() ||
      `Imported knowledge-bank mapping for ${theme} value "${row.sourceValue}".`;

    entries.push({
      id: `kb-import-${theme}-${normalizedSourceValue.replace(/[^a-z0-9]+/g, "-")}-${index}`,
      theme,
      sourceValue: normalizedSourceValue,
      codeSegment: codeSegment.toUpperCase(),
      meaning,
      classificationRule,
      status,
      version: LCA_KNOWLEDGE_BANK_VERSION,
      usageCount: 0,
      importSource: row.importSource?.trim() || options?.importSource,
      importedAt: new Date().toISOString()
    });
  });

  return {
    entries: dedupeKnowledgeBankEntries(entries),
    warnings,
    rejectedRowCount
  };
}

export function mergeKnowledgeBankEntries(
  existing: KnowledgeBankEntry[],
  imported: KnowledgeBankEntry[]
): KnowledgeBankEntry[] {
  const merged = new Map<string, KnowledgeBankEntry>();

  for (const entry of existing) {
    merged.set(getKnowledgeBankEntryKey(entry), entry);
  }

  for (const entry of imported) {
    merged.set(getKnowledgeBankEntryKey(entry), entry);
  }

  return Array.from(merged.values()).sort((left, right) =>
    `${left.theme}:${left.sourceValue}`.localeCompare(`${right.theme}:${right.sourceValue}`)
  );
}

export function getKnowledgeBankEntryKey(entry: Pick<KnowledgeBankEntry, "theme" | "sourceValue">) {
  return `${entry.theme}::${normalizeKnowledgeValue(entry.sourceValue)}`;
}

function normalizeImportRow(rawRow: Record<string, unknown>): KnowledgeBankImportRow {
  const normalized: KnowledgeBankImportRow = {
    theme: "",
    sourceValue: "",
    codeSegment: "",
    meaning: "",
    classificationRule: ""
  };

  for (const [column, value] of Object.entries(rawRow)) {
    const field = COLUMN_ALIASES[normalizeColumnName(column)];
    if (!field || value == null) {
      continue;
    }

    normalized[field] = String(value).trim();
  }

  return normalized;
}

function normalizeColumnName(column: string) {
  return column.trim().toLowerCase().replace(/\s+/g, " ");
}

function isEmptyImportRow(row: KnowledgeBankImportRow) {
  return (
    !row.theme &&
    !row.sourceValue &&
    !row.codeSegment &&
    !row.meaning &&
    !row.classificationRule
  );
}

function resolveImportTheme(value: string): LcaCodeTheme | null {
  const normalized = normalizeColumnName(value).replace(/\s+/g, "-");
  if ((LCA_CODE_THEMES as readonly string[]).includes(normalized)) {
    return normalized as LcaCodeTheme;
  }

  return THEME_ALIASES[normalizeColumnName(value)] ?? null;
}

function parseImportStatus(value?: string): KnowledgeBankEntryStatus {
  const normalized = (value ?? "reviewed").trim().toLowerCase();
  if (normalized === "pending" || normalized === "draft" || normalized === "reviewed") {
    return normalized;
  }

  return "reviewed";
}

function deriveCodeSegmentFromMeaning(meaning: string) {
  const words = meaning.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .slice(0, 2)
      .map((word) => word.slice(0, 1).toUpperCase())
      .join("");
  }

  return meaning.slice(0, 2).toUpperCase() || "KB";
}

function dedupeKnowledgeBankEntries(entries: KnowledgeBankEntry[]) {
  const unique = new Map<string, KnowledgeBankEntry>();
  for (const entry of entries) {
    unique.set(getKnowledgeBankEntryKey(entry), entry);
  }

  return Array.from(unique.values());
}
