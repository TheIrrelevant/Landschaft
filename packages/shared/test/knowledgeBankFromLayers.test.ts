/*
 * ---metadata---
 * type: package-test
 * description: Tests for knowledge-base export from national-map planning layers.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: cover soil grouping and spreadsheet row generation from map layers
 * ---end-metadata---
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  abbreviateCode,
  buildKnowledgeBankFromLayers,
  describeColor,
  polygonAreaSquareMeters
} from "../src/knowledgeBankFromLayers.js";
import { getSoilMapUnitColor } from "../src/mapFeatureColors.js";
import type { PlanningLayer } from "../src/index.js";

const soilLayer: PlanningLayer = {
  id: "safe-data-soil",
  name: "USDA soils",
  kind: "foundational-map",
  visible: true,
  opacity: 0.7,
  reviewStatus: "draft",
  category: "soil",
  geometryType: "polygon",
  source: {
    sourceName: "USDA NRCS Soil Data Access / Boulder AOI",
    sourceType: "external-api",
    coordinateReferenceSystem: "EPSG:3857",
    accuracyStatus: "public-dataset",
    confidence: 0.9
  },
  style: {
    stroke: "#8a6f3f",
    fill: "#c0392b"
  },
  legend: [{ label: "Red Soil", color: "#c0392b" }],
  features: [
    {
      id: "soil-1",
      label: "Red Soil",
      geometryType: "polygon",
      coordinates: [
        [0, 0],
        [50, 0],
        [50, 70],
        [0, 70]
      ],
      attributes: {
        musym: "RS",
        mukey: "12345",
        source: "USDA NRCS Soil Data Access"
      },
      planningImpact: "Soil review"
    },
    {
      id: "soil-2",
      label: "Red Soil",
      geometryType: "polygon",
      coordinates: [
        [50, 0],
        [100, 0],
        [100, 70],
        [50, 70]
      ],
      attributes: {
        musym: "RS",
        mukey: "12345",
        source: "USDA NRCS Soil Data Access"
      },
      planningImpact: "Soil review"
    }
  ]
};

describe("buildKnowledgeBankFromLayers", () => {
  it("groups soil polygons into one spreadsheet row with summed area and semantic headers", () => {
    const result = buildKnowledgeBankFromLayers([soilLayer]);

    assert.equal(result.recordCount, 1);
    assert.equal(result.columnHeaders[0], "Color");
    assert.equal(result.columnHeaders[2], "Code");
    const soilColor = getSoilMapUnitColor(soilLayer.features![0]!);
    assert.equal(result.rows[0]?.[0], describeColor(soilColor));
    assert.equal(result.rows[0]?.[1], "Red Soil");
    assert.equal(result.rows[0]?.[2], "RS");
    assert.equal(result.rows[0]?.[3], "7000");
    assert.equal(result.materialColors[0], getSoilMapUnitColor(soilLayer.features![0]!));
    assert.match(result.textSummary, /Red Soil/);
    assert.match(result.textSummary, /-----/);
  });

  it("uses full muname for soil rows while keeping musym as code", () => {
    const enrichedSoilLayer: PlanningLayer = {
      ...soilLayer,
      features: [
        {
          ...soilLayer.features![0]!,
          label: "Nederland very cobbly sandy loam, 1 to 12 percent slopes",
          attributes: {
            ...soilLayer.features![0]!.attributes,
            musym: "NdD",
            muname: "Nederland very cobbly sandy loam, 1 to 12 percent slopes"
          }
        }
      ]
    };

    const result = buildKnowledgeBankFromLayers([enrichedSoilLayer]);
    assert.equal(result.rows[0]?.[1], "Nederland very cobbly sandy loam, 1 to 12 percent slopes");
    assert.equal(result.rows[0]?.[2], "NdD");
  });

  it("assigns different material colors to different soil map unit codes", () => {
    const multiSoilLayer: PlanningLayer = {
      ...soilLayer,
      features: [
        {
          ...soilLayer.features![0]!,
          id: "soil-a",
          attributes: { ...soilLayer.features![0]!.attributes, musym: "NuB", muname: "Nunn clay loam" }
        },
        {
          ...soilLayer.features![0]!,
          id: "soil-b",
          coordinates: [
            [10, 0],
            [20, 0],
            [20, 10],
            [10, 10]
          ],
          attributes: { ...soilLayer.features![0]!.attributes, musym: "NdD", muname: "Nederland cobbly loam" }
        }
      ]
    };

    const result = buildKnowledgeBankFromLayers([multiSoilLayer]);
    assert.equal(result.recordCount, 2);
    assert.notEqual(result.materialColors[0], result.materialColors[1]);
  });

  it("exports NLCD land-cover classes for raster layers without vector features", () => {
    const landCoverLayer: PlanningLayer = {
      id: "safe-data-land-cover",
      name: "NLCD land cover",
      kind: "foundational-map",
      visible: true,
      opacity: 0.8,
      reviewStatus: "draft",
      category: "ecology-vegetation",
      geometryType: "raster",
      source: {
        sourceName: "MRLC NLCD",
        sourceType: "external-api",
        coordinateReferenceSystem: "EPSG:3857",
        accuracyStatus: "public-dataset",
        confidence: 0.9
      },
      style: { stroke: "#4f8f5c", fill: "#68ab5f" }
    };

    const result = buildKnowledgeBankFromLayers([landCoverLayer]);
    assert.equal(result.recordCount, 16);
    assert.equal(result.rows[0]?.[1], "Open Water");
    assert.equal(result.rows[0]?.[2], "11");
    assert.equal(result.materialColors[0], "#466b9f");
  });

  it("groups hydrography lines by fcode with readable names", () => {
    const hydroLayer: PlanningLayer = {
      id: "safe-data-hydrography",
      name: "NHD hydrography",
      kind: "foundational-map",
      visible: true,
      opacity: 0.9,
      reviewStatus: "draft",
      category: "hydrology",
      geometryType: "line",
      source: {
        sourceName: "USGS NHD",
        sourceType: "external-api",
        coordinateReferenceSystem: "EPSG:3857",
        accuracyStatus: "public-dataset",
        confidence: 0.9
      },
      style: { stroke: "#2f7fb8", fill: "#2f7fb8" },
      features: [
        {
          id: "hydro-1",
          label: "Stream 1",
          geometryType: "line",
          coordinates: [
            [0, 0],
            [100, 0]
          ],
          attributes: { fcode: "33400", source: "USGS NHD" },
          planningImpact: "Hydrology review"
        },
        {
          id: "hydro-2",
          label: "Stream 2",
          geometryType: "line",
          coordinates: [
            [0, 10],
            [50, 10]
          ],
          attributes: { fcode: "33400", source: "USGS NHD" },
          planningImpact: "Hydrology review"
        }
      ]
    };

    const result = buildKnowledgeBankFromLayers([hydroLayer]);
    assert.equal(result.recordCount, 1);
    assert.equal(result.rows[0]?.[1], "Stream/River");
    assert.equal(result.rows[0]?.[2], "33400");
    assert.equal(result.rows[0]?.[3], "");
    const lengthIndex = result.columnHeaders.findIndex((header) => header === "Length M");
    assert.ok(lengthIndex >= 0);
    assert.equal(result.rows[0]?.[lengthIndex], "150");
  });

  it("labels boundary features with kind and place name", () => {
    const boundaryLayer: PlanningLayer = {
      id: "safe-data-boundaries",
      name: "Administrative boundaries",
      kind: "foundational-map",
      visible: true,
      opacity: 0.7,
      reviewStatus: "draft",
      category: "boundary",
      geometryType: "polygon",
      source: {
        sourceName: "USGS TNM",
        sourceType: "external-api",
        coordinateReferenceSystem: "EPSG:3857",
        accuracyStatus: "public-dataset",
        confidence: 0.9
      },
      style: { stroke: "#7667b0", fill: "#7667b0" },
      features: [
        {
          id: "boundary-1",
          label: "County boundary 1",
          geometryType: "polygon",
          coordinates: [
            [0, 0],
            [40, 0],
            [40, 30],
            [0, 30]
          ],
          attributes: {
            layerKind: "county",
            county_name: "Boulder County",
            source: "USGS TNM"
          },
          planningImpact: "Boundary review"
        }
      ]
    };

    const result = buildKnowledgeBankFromLayers([boundaryLayer]);
    assert.equal(result.rows[0]?.[1], "County boundary: Boulder County");
    assert.equal(result.rows[0]?.[2], "county");
    assert.equal(result.materialColors[0], "#7667b0");
  });

  it("groups transportation features by road kind and highway tag", () => {
    const transportLayer: PlanningLayer = {
      id: "safe-data-transportation",
      name: "Transportation",
      kind: "foundational-map",
      visible: true,
      opacity: 0.9,
      reviewStatus: "draft",
      category: "transportation",
      geometryType: "line",
      source: {
        sourceName: "USGS TNM",
        sourceType: "external-api",
        coordinateReferenceSystem: "EPSG:3857",
        accuracyStatus: "public-dataset",
        confidence: 0.9
      },
      style: { stroke: "#4a4f56", fill: "#4a4f56" },
      features: [
        {
          id: "road-1",
          label: "Primary highway 1",
          geometryType: "line",
          coordinates: [
            [0, 0],
            [80, 0]
          ],
          attributes: { layerKind: "highway", highway: "primary", source: "USGS TNM" },
          planningImpact: "Transport review"
        },
        {
          id: "road-2",
          label: "Primary highway 2",
          geometryType: "line",
          coordinates: [
            [0, 5],
            [20, 5]
          ],
          attributes: { layerKind: "highway", highway: "primary", source: "USGS TNM" },
          planningImpact: "Transport review"
        }
      ]
    };

    const result = buildKnowledgeBankFromLayers([transportLayer]);
    assert.equal(result.recordCount, 1);
    assert.equal(result.rows[0]?.[1], "Primary highway");
    assert.equal(result.rows[0]?.[2], "primary");
  });

  it("names contour rows from elevation attributes", () => {
    const contourLayer: PlanningLayer = {
      id: "safe-data-usgs-contours",
      name: "USGS contours",
      kind: "foundational-map",
      visible: true,
      opacity: 0.8,
      reviewStatus: "draft",
      category: "topography",
      geometryType: "line",
      source: {
        sourceName: "USGS 3DEP",
        sourceType: "external-api",
        coordinateReferenceSystem: "EPSG:3857",
        accuracyStatus: "public-dataset",
        confidence: 0.9
      },
      style: { stroke: "#5f6f8a", fill: "#5f6f8a" },
      features: [
        {
          id: "contour-1",
          label: "Contour 2100",
          geometryType: "line",
          coordinates: [
            [0, 0],
            [60, 0]
          ],
          attributes: { elevation: "2100", contourinterval: "10", source: "USGS 3DEP" },
          planningImpact: "Topography review"
        }
      ]
    };

    const result = buildKnowledgeBankFromLayers([contourLayer]);
    assert.equal(result.rows[0]?.[1], "Contour 2100 m");
    assert.equal(result.rows[0]?.[2], "EL2100");
  });
});

describe("polygonAreaSquareMeters", () => {
  it("computes projected polygon area in square metres", () => {
    const area = polygonAreaSquareMeters([
      [0, 0],
      [100, 0],
      [100, 50],
      [0, 50]
    ]);

    assert.equal(area, 5000);
  });
});

describe("abbreviateCode", () => {
  it("creates short codes from multi-word labels", () => {
    assert.equal(abbreviateCode("Red Soil"), "RS");
  });
});
