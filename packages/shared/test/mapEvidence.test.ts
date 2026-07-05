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

  it("groups categorical features into LCA evidence summaries", () => {
    const evidence = buildMapEvidence(
      {
        project,
        layers: [
          {
            id: "soil",
            name: "Soil",
            kind: "foundational-map",
            visible: true,
            opacity: 1,
            reviewStatus: "draft",
            category: "soil",
            geometryType: "polygon",
            features: [
              {
                id: "red-soil-a",
                label: "Red soil A",
                geometryType: "polygon",
                coordinates: [
                  [0, 0],
                  [20, 0],
                  [20, 20],
                  [0, 20]
                ],
                attributes: { soil: "red soil", drainage: "moderate" },
                planningImpact: "Red soil evidence."
              },
              {
                id: "red-soil-b",
                label: "Red soil B",
                geometryType: "polygon",
                coordinates: [
                  [30, 0],
                  [50, 0],
                  [50, 20],
                  [30, 20]
                ],
                attributes: { soil: "red soil", drainage: "moderate" },
                planningImpact: "Red soil evidence."
              }
            ]
          }
        ]
      },
      {
        projectId: project.id,
        selectedLayerIds: ["soil"],
        geometryDetail: "summary"
      }
    );

    const redSoilGroup = evidence.featureGroups.find(
      (group) => group.sourceValue === "red soil"
    );

    assert.ok(redSoilGroup);
    assert.equal(redSoilGroup?.featureCount, 2);
    assert.equal(redSoilGroup?.totalAreaSquareMeters, 800);
    assert.deepEqual(redSoilGroup?.representativeFeatureIds, ["red-soil-a", "red-soil-b"]);
  });
});
