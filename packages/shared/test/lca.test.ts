/*
 * ---metadata---
 * type: package-test
 * description: Tests for Landschaft LCA prompt and DeepSeek response parsing.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: cover LCA code anatomy and citation metadata
 * ---end-metadata---
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  buildDeepSeekLcaPrompt,
  createLcaLayerFromDraft,
  LCA_DEEPSEEK_MODEL,
  LCA_DEEPSEEK_PROMPT_VERSION,
  parseDeepSeekLcaDraftResponse,
  type LcaDraftAnalysisRequest
} from "../src/index.js";

const request: LcaDraftAnalysisRequest = {
  purpose: "Baseline landscape character assessment for site planning.",
  evidence: {
    projectId: "project-demo",
    coordinateReferenceSystem: "EPSG:4326",
    coordinateSpace: "project-metres",
    projectExtent: {
      width: 100,
      depth: 80
    },
    selectedLayerIds: ["soil", "woodland"],
    geometryDetail: "simplified",
    layerSummaries: [
      {
        layerId: "soil",
        name: "Soil",
        kind: "foundational-map",
        category: "soil",
        geometryType: "polygon",
        featureCount: 1,
        accuracyStatus: "provider-derived",
        planningNotes: ["Use soil boundaries as baseline evidence."]
      }
    ],
    features: [
      {
        id: "soil-a",
        layerId: "soil",
        layerName: "Soil",
        label: "Well drained loam",
        geometryType: "polygon",
        coordinates: [
          [0, 0],
          [100, 0],
          [100, 80],
          [0, 80]
        ],
        attributes: {
          soil: "loam",
          drainage: "well drained"
        }
      }
    ],
    spatialRelationships: [
      {
        type: "extent",
        description: "Project extent spans 100 m by 80 m.",
        layerIds: ["soil"]
      }
    ]
  }
};

describe("buildDeepSeekLcaPrompt", () => {
  it("creates a versioned JSON-object prompt from map evidence", () => {
    const prompt = buildDeepSeekLcaPrompt(request);
    const user = JSON.parse(prompt.user) as Record<string, unknown>;

    assert.equal(prompt.model, LCA_DEEPSEEK_MODEL);
    assert.equal(prompt.promptVersion, LCA_DEEPSEEK_PROMPT_VERSION);
    assert.equal(prompt.responseFormat, "json_object");
    assert.equal(user.purpose, request.purpose);
    assert.deepEqual(user.selectedLayerIds, request.evidence.selectedLayerIds);
  });
});

describe("createLcaLayerFromDraft", () => {
  it("stores parseable code anatomy and evidence citations on generated features", () => {
    const layer = createLcaLayerFromDraft(
      {
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
      },
      [
        {
          id: "area-a",
          label: "Loam terrace",
          ring: [
            [0, 0],
            [100, 0],
            [100, 80],
            [0, 80],
            [0, 0]
          ],
          layer: "lca",
          code: "LO-WD",
          meaning: "Evidence: soil loam and woodland edge.",
          confidence: 0.82
        }
      ],
      {
        model: "deepseek-reasoner",
        promptVersion: "lca-deepseek-v1",
        inputLayerIds: ["soil", "woodland"]
      }
    );
    const attributes = layer.features?.[0]?.attributes;

    assert.equal(attributes?.knowledgeBankVersion, "lca-kb-mvp-v1");
    const codeAnatomy = JSON.parse(attributes?.codeAnatomy ?? "[]") as {
      segment: string;
      sourceLayerId: string;
    }[];
    const evidenceCitations = JSON.parse(
      attributes?.evidenceCitations ?? "[]"
    ) as { sourceLayerId: string; excerpt: string }[];

    assert.deepEqual(
      codeAnatomy.map((segment) => segment.segment),
      ["LO", "WD"]
    );
    assert.deepEqual(
      evidenceCitations.map((citation) => citation.sourceLayerId),
      ["soil", "woodland"]
    );
    assert.match(evidenceCitations[0]?.excerpt ?? "", /soil loam/);
  });
});

describe("parseDeepSeekLcaDraftResponse", () => {
  it("parses fenced JSON and closes area rings", () => {
    const result = parseDeepSeekLcaDraftResponse(
      "```json\n{\"areas\":[{\"id\":\"area-a\",\"label\":\"Loam terrace\",\"ring\":[[0,0],[100,0],[100,80],[0,80]],\"layer\":\"lca\",\"code\":\"LO-WD\",\"meaning\":\"Evidence: soil loam and woodland edge.\",\"confidence\":0.82}]}\n```",
      request
    );

    assert.equal(result.model, LCA_DEEPSEEK_MODEL);
    assert.equal(result.promptVersion, LCA_DEEPSEEK_PROMPT_VERSION);
    assert.deepEqual(result.inputLayerIds, ["soil", "woodland"]);
    assert.deepEqual(result.areas[0]?.ring.at(-1), [0, 0]);
  });

  it("parses chat completion content and preserves response metadata", () => {
    const result = parseDeepSeekLcaDraftResponse(
      {
        choices: [
          {
            message: {
              content: JSON.stringify({
                model: "deepseek-chat",
                promptVersion: "custom-v2",
                areas: [
                  {
                    id: "area-b",
                    label: "Wooded edge",
                    ring: [
                      [0, 0],
                      [50, 0],
                      [50, 50],
                      [0, 50],
                      [0, 0]
                    ],
                    layer: "lca",
                    code: "WD",
                    meaning: "Evidence: woodland layer forms a distinct edge.",
                    confidence: 1.4
                  }
                ]
              })
            }
          }
        ]
      },
      request
    );

    assert.equal(result.model, "deepseek-chat");
    assert.equal(result.promptVersion, "custom-v2");
    assert.equal(result.areas[0]?.confidence, 1);
  });
});
