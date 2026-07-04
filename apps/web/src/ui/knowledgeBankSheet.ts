/*
 * ---metadata---
 * type: app-source
 * description: Grid helpers for the Landschaft knowledge-base spreadsheet overlay.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add empty sheet creation and column-letter helpers for Excel-like grid
 * ---end-metadata---
 */

export const DEFAULT_SHEET_ROW_COUNT = 40;
export const DEFAULT_SHEET_COL_COUNT = 8;
export const DEFAULT_COLUMN_WIDTH = 128;
export const DEFAULT_ROW_HEIGHT = 28;
export const MIN_COLUMN_WIDTH = 48;
export const MIN_ROW_HEIGHT = 22;
export const MATERIAL_COLUMN_WIDTH = 52;

export interface KnowledgeBankSheetSnapshot {
  rows: string[][];
  columnWidths: number[];
  rowHeights: number[];
  columnHeaders?: string[];
  materialColors?: string[];
  textSummary?: string;
}

export function createEmptyKnowledgeBankSheet(
  rowCount = DEFAULT_SHEET_ROW_COUNT,
  colCount = DEFAULT_SHEET_COL_COUNT
): KnowledgeBankSheetSnapshot {
  return {
    rows: Array.from({ length: rowCount }, () => Array.from({ length: colCount }, () => "")),
    columnWidths: Array.from({ length: colCount }, () => DEFAULT_COLUMN_WIDTH),
    rowHeights: Array.from({ length: rowCount }, () => DEFAULT_ROW_HEIGHT)
  };
}

export function sheetFromKnowledgeBankLayers(
  result: {
    columnHeaders: string[];
    rows: string[][];
    materialColors: string[];
    textSummary: string;
  },
  minimumRowCount = DEFAULT_SHEET_ROW_COUNT
): KnowledgeBankSheetSnapshot {
  const rowCount = Math.max(minimumRowCount, result.rows.length);
  const colCount = Math.max(DEFAULT_SHEET_COL_COUNT, result.columnHeaders.length);
  const rows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = result.rows[rowIndex] ?? [];
    return Array.from({ length: colCount }, (_, colIndex) => sourceRow[colIndex] ?? "");
  });

  return {
    rows,
    columnWidths: Array.from({ length: colCount }, () => DEFAULT_COLUMN_WIDTH),
    rowHeights: Array.from({ length: rowCount }, () => DEFAULT_ROW_HEIGHT),
    columnHeaders: result.columnHeaders,
    materialColors: Array.from({ length: rowCount }, (_, index) => result.materialColors[index] ?? "#8a8a8a"),
    textSummary: result.textSummary
  };
}

export function normalizeKnowledgeBankSheet(
  rows: string[][],
  columnWidths: number[],
  rowHeights: number[],
  options?: Pick<KnowledgeBankSheetSnapshot, "columnHeaders" | "materialColors" | "textSummary">
): KnowledgeBankSheetSnapshot {
  const colCount = Math.max(
    DEFAULT_SHEET_COL_COUNT,
    rows.reduce((max, row) => Math.max(max, row.length), 0),
    columnWidths.length
  );
  const rowCount = Math.max(DEFAULT_SHEET_ROW_COUNT, rows.length, rowHeights.length);

  const normalizedRows = Array.from({ length: rowCount }, (_, rowIndex) => {
    const sourceRow = rows[rowIndex] ?? [];
    return Array.from({ length: colCount }, (_, colIndex) => String(sourceRow[colIndex] ?? ""));
  });

  const normalizedColumnWidths = Array.from({ length: colCount }, (_, index) =>
    Math.max(MIN_COLUMN_WIDTH, columnWidths[index] ?? DEFAULT_COLUMN_WIDTH)
  );

  const normalizedRowHeights = Array.from({ length: rowCount }, (_, index) =>
    Math.max(MIN_ROW_HEIGHT, rowHeights[index] ?? DEFAULT_ROW_HEIGHT)
  );

  return {
    rows: normalizedRows,
    columnWidths: normalizedColumnWidths,
    rowHeights: normalizedRowHeights,
    columnHeaders: options?.columnHeaders,
    materialColors: options?.materialColors,
    textSummary: options?.textSummary
  };
}

export function columnIndexToLabel(index: number) {
  let label = "";
  let value = index + 1;

  while (value > 0) {
    const remainder = (value - 1) % 26;
    label = String.fromCharCode(65 + remainder) + label;
    value = Math.floor((value - 1) / 26);
  }

  return label;
}

export function updateSheetCell(
  sheet: KnowledgeBankSheetSnapshot,
  rowIndex: number,
  colIndex: number,
  value: string
): KnowledgeBankSheetSnapshot {
  const nextRows = sheet.rows.map((row, currentRow) =>
    currentRow === rowIndex
      ? row.map((cell, currentCol) => (currentCol === colIndex ? value : cell))
      : [...row]
  );

  const normalized = normalizeKnowledgeBankSheet(nextRows, sheet.columnWidths, sheet.rowHeights, {
    columnHeaders: sheet.columnHeaders,
    materialColors: sheet.materialColors,
    textSummary: sheet.textSummary
  });

  return normalized;
}
