/*
 * ---metadata---
 * type: package-test
 * description: Tests for LCA polygon intersection and dominant-value scoring.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: cover polygon intersection and dominant theme scoring
 * ---end-metadata---
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  findIntersectingEvidence,
  scoreDominantThemeValues
} from "../src/lcaEvidenceMatching.js";
import type { MapEvidenceFeature } from "../src/mapEvidence.js";

const soilFeature: MapEvidenceFeature = {
  id: "soil-a",
  layerId: "soil",
  layerName: "Soil",
  label: "Loam",
  geometryType: "polygon",
  coordinates: [
    [0, 0],
    [60, 0],
    [60, 60],
    [0, 60]
  ],
  attributes: {
    soil: "loam"
  }
};

const woodlandFeature: MapEvidenceFeature = {
  id: "wood-a",
  layerId: "woodland",
  layerName: "Woodland",
  label: "Forest edge",
  geometryType: "polygon",
  coordinates: [
    [40, 0],
    [100, 0],
    [100, 60],
    [40, 60]
  ],
  attributes: {
    vegetation: "forest"
  }
};

describe("findIntersectingEvidence", () => {
  it("returns only polygon-intersecting features sorted by overlap area", () => {
    const matches = findIntersectingEvidence(
      [
        [20, 10],
        [80, 10],
        [80, 50],
        [20, 50],
        [20, 10]
      ],
      [soilFeature, woodlandFeature]
    );

    assert.equal(matches.length, 2);
    assert.deepEqual(
      matches.map((match) => match.feature.id).sort(),
      ["soil-a", "wood-a"]
    );
    assert.ok(matches[0]?.intersectionArea >= matches[1]?.intersectionArea);
  });
});

describe("scoreDominantThemeValues", () => {
  it("maps dominant intersecting values through the reviewed knowledge bank", () => {
    const dominants = scoreDominantThemeValues(
      [
        [20, 10],
        [80, 10],
        [80, 50],
        [20, 50],
        [20, 10]
      ],
      [soilFeature, woodlandFeature]
    );

    const soilDominant = dominants.find((value) => value.theme === "soil");
    const vegetationDominant = dominants.find((value) => value.theme === "vegetation");

    assert.equal(soilDominant?.knowledgeBankEntry.codeSegment, "LO");
    assert.equal(vegetationDominant?.knowledgeBankEntry.codeSegment, "FO");
    assert.equal(soilDominant?.knowledgeBankEntry.status, "reviewed");
  });
});
