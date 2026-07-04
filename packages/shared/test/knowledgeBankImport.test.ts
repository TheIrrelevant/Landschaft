/*
 * ---metadata---
 * type: package-test
 * description: Tests for spreadsheet import into the Landschaft knowledge bank.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: cover row parsing and merge behavior for knowledge bank import
 * ---end-metadata---
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  mergeKnowledgeBankEntries,
  parseKnowledgeBankRows
} from "../src/knowledgeBankImport.js";
import type { KnowledgeBankEntry } from "../src/lcaKnowledgeBank.js";

describe("parseKnowledgeBankRows", () => {
  it("maps spreadsheet columns into reviewed knowledge-bank entries", () => {
    const result = parseKnowledgeBankRows(
      [
        {
          Theme: "soil",
          "Source Value": "Sandy Loam",
          "Code Segment": "SL",
          Meaning: "Sandy loam soil texture class.",
          "Classification Rule": "Map USDA texture sandy loam to SL segment.",
          Status: "reviewed"
        }
      ],
      { importSource: "soil-codes.xlsx" }
    );

    assert.equal(result.rejectedRowCount, 0);
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0]?.theme, "soil");
    assert.equal(result.entries[0]?.sourceValue, "sandy loam");
    assert.equal(result.entries[0]?.codeSegment, "SL");
    assert.equal(result.entries[0]?.importSource, "soil-codes.xlsx");
  });

  it("rejects rows with unsupported themes", () => {
    const result = parseKnowledgeBankRows([
      {
        theme: "mythology",
        sourceValue: "valhalla",
        meaning: "Not a valid theme"
      }
    ]);

    assert.equal(result.entries.length, 0);
    assert.equal(result.rejectedRowCount, 1);
    assert.match(result.warnings[0] ?? "", /unsupported theme/i);
  });
});

describe("mergeKnowledgeBankEntries", () => {
  it("deduplicates by theme and normalized source value", () => {
    const existing: KnowledgeBankEntry[] = [
      {
        id: "kb-soil-loam",
        theme: "soil",
        sourceValue: "loam",
        codeSegment: "LO",
        meaning: "Existing loam entry.",
        classificationRule: "Existing rule.",
        status: "reviewed",
        version: "lca-kb-v2",
        usageCount: 2
      }
    ];

    const imported = parseKnowledgeBankRows([
      {
        theme: "soil",
        sourceValue: "Loam",
        codeSegment: "LM",
        meaning: "Updated loam entry.",
        classificationRule: "Updated rule."
      }
    ]).entries;

    const merged = mergeKnowledgeBankEntries(existing, imported);
    assert.equal(merged.length, 1);
    assert.equal(merged[0]?.codeSegment, "LM");
    assert.equal(merged[0]?.meaning, "Updated loam entry.");
  });
});
