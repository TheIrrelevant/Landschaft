/*
 * ---metadata---
 * type: package-test
 * description: Tests for Landschaft map evidence spatial relationship inference.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: cover overlap and adjacency relationship inference
 * ---end-metadata---
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildMapEvidence } from "../src/mapEvidence.js";
import type { PlanningLayer } from "../src/index.js";

const project = {
  id: "project-demo",
  name: "Demo",
  coordinateReferenceSystem: "EPSG:4326",
  corners: [
    { label: "NW", latitude: 0, longitude: 0 },
    { label: "NE", latitude: 0, longitude: 1 },
    { label: "SE", latitude: -1, longitude: 1 },
    { label: "SW", latitude: -1, longitude: 0 }
  ],
  realWorldExtentMeters: {
    width: 100,
    depth: 80
  }
};

const layers: PlanningLayer[] = [
  {
    id: "soil",
    name: "Soil",
    kind: "foundational-map",
    visible: true,
    opacity: 1,
    category: "soil",
    geometryType: "polygon",
    features: [
      {
        id: "soil-a",
        label: "Loam",
        geometryType: "polygon",
        coordinates: [
          [0, 0],
          [60, 0],
          [60, 60],
          [0, 60]
        ],
        attributes: { soil: "loam" }
      }
    ]
  },
  {
    id: "woodland",
    name: "Woodland",
    kind: "foundational-map",
    visible: true,
    opacity: 1,
    category: "vegetation",
    geometryType: "polygon",
    features: [
      {
        id: "wood-a",
        label: "Forest",
        geometryType: "polygon",
        coordinates: [
          [40, 0],
          [100, 0],
          [100, 60],
          [40, 60]
        ],
        attributes: { vegetation: "forest" }
      }
    ]
  }
];

describe("buildMapEvidence", () => {
  it("infers overlap relationships between intersecting polygon features", () => {
    const evidence = buildMapEvidence(
      { project, layers },
      {
        projectId: project.id,
        selectedLayerIds: ["soil", "woodland"],
        geometryDetail: "full"
      }
    );

    const overlap = evidence.spatialRelationships.find(
      (relationship) => relationship.type === "overlap"
    );

    assert.ok(overlap);
    assert.deepEqual(overlap?.layerIds.sort(), ["soil", "woodland"]);
  });
});
