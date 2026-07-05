/*
 * ---metadata---
 * type: package-test
 * description: Tests for Landschaft LCA prompt and DeepSeek response parsing.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: cover polygon intersection knowledge-bank code anatomy
 * ---end-metadata---
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  extractLlmResponseContent,
  buildDeepSeekLcaPrompt,
  createCodedLandscapeUnitLayerFromEvidence,
  createLcaLayerFromDraft,
  generateMockLcaDraft,
  LCA_DEFAULT_OLLAMA_MODEL,
  LCA_DEEPSEEK_MODEL,
  LCA_DEEPSEEK_PROMPT_VERSION,
  parseDeepSeekLcaDraftResponse,
  type LcaDraftAnalysisRequest
} from "../src/index.js";
import {
  LCA_KNOWLEDGE_BANK_VERSION,
  type KnowledgeBankEntry
} from "../src/lcaKnowledgeBank.js";

const request: LcaDraftAnalysisRequest = {
  constitution: [
    "# Landscape Character Assessment Constitution",
    "",
    "Follow Carys Swanwick four-step LCA process.",
    "Separate description from judgement."
  ].join("\n"),
  purpose: "Baseline landscape character assessment for site planning.",
  analysisMode: "desk-study",
  outputQuality: "professional",
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
    assert.equal(user.analysisMode, "desk-study");
    assert.equal(user.outputQuality, "professional");
    assert.deepEqual(user.selectedLayerIds, request.evidence.selectedLayerIds);
    assert.match(prompt.constitution, /Carys Swanwick four-step LCA process/);
    assert.match(prompt.system, /LCA Constitution/);
  });
});

describe("createLcaLayerFromDraft", () => {
  it("stores knowledge-bank code anatomy from polygon-intersecting evidence", () => {
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
        promptVersion: "lca-deepseek-v2",
        inputLayerIds: ["soil", "woodland"],
        evidenceFeatures: request.evidence.features
      }
    );
    const attributes = layer.features?.[0]?.attributes;

    assert.equal(attributes?.knowledgeBankVersion, LCA_KNOWLEDGE_BANK_VERSION);
    const codeAnatomy = JSON.parse(attributes?.codeAnatomy ?? "[]") as {
      segment: string;
      sourceLayerId: string;
      sourceFeatureId?: string;
      sourceValue: string;
      classificationRule: string;
    }[];
    const evidenceCitations = JSON.parse(
      attributes?.evidenceCitations ?? "[]"
    ) as { sourceLayerId: string; sourceFeatureId?: string; excerpt: string }[];

    assert.ok(codeAnatomy.length >= 1);
    assert.equal(codeAnatomy[0]?.sourceFeatureId, "soil-a");
    assert.equal(codeAnatomy[0]?.sourceValue, "loam");
    assert.match(codeAnatomy[0]?.classificationRule ?? "", /USDA|Draft|mapped/i);
    assert.deepEqual(
      evidenceCitations.map((citation) => citation.sourceLayerId),
      ["soil"]
    );
    assert.equal(evidenceCitations[0]?.sourceFeatureId, "soil-a");
    assert.match(evidenceCitations[0]?.excerpt ?? "", /soil: loam/);
    assert.match(evidenceCitations[0]?.excerpt ?? "", /polygon-intersects/);
  });

  it("uses imported knowledge-bank entries for draft code anatomy", () => {
    const importedEntries: KnowledgeBankEntry[] = [
      {
        id: "kb-import-soil-loam",
        theme: "soil",
        sourceValue: "loam",
        codeSegment: "LX",
        meaning: "Locally reviewed loam terrace class.",
        classificationRule: "Imported local soil code mapping.",
        status: "reviewed",
        version: LCA_KNOWLEDGE_BANK_VERSION,
        usageCount: 0,
        importSource: "knowledge-base-sheet"
      }
    ];
    const analysis = generateMockLcaDraft({
      ...request,
      knowledgeBankEntries: importedEntries
    });
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
      analysis.areas,
      analysis
    );
    const attributes = layer.features?.[0]?.attributes;
    const codeAnatomy = JSON.parse(attributes?.codeAnatomy ?? "[]") as {
      segment: string;
      sourceValue: string;
      classificationRule: string;
    }[];

    assert.match(attributes?.characterCode ?? "", /^LX/);
    assert.equal(codeAnatomy[0]?.segment, "LX");
    assert.equal(codeAnatomy[0]?.sourceValue, "loam");
    assert.equal(codeAnatomy[0]?.classificationRule, "Imported local soil code mapping.");
  });
});

describe("createCodedLandscapeUnitLayerFromEvidence", () => {
  it("uses explicit LDU source codes and source polygon geometry", () => {
    const layer = createCodedLandscapeUnitLayerFromEvidence(
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
      {
        ...request.evidence,
        features: [
          {
            id: "ldu-source-a",
            layerId: "ldu",
            layerName: "Landscape Description Units",
            label: "Source LDU",
            geometryType: "polygon",
            coordinates: [
              [10, 10],
              [90, 10],
              [90, 60],
              [10, 60]
            ],
            attributes: {
              LDU_CODE: "MW54",
              landscape_type: "Principal Timbered Farmlands"
            }
          }
        ]
      },
      {
        model: "deepseek-v4-pro@ollama",
        promptVersion: "lca-deepseek-v2",
        inputLayerIds: ["ldu"],
        areas: [
          {
            id: "llm-area",
            label: "LLM area",
            ring: [
              [0, 0],
              [100, 0],
              [100, 80],
              [0, 80],
              [0, 0]
            ],
            layer: "lca",
            code: "MW54",
            meaning: "LLM characterization for LDU MW54.",
            confidence: 0.84
          }
        ]
      }
    );

    const feature = layer?.features?.[0];
    assert.ok(layer);
    assert.equal(layer.name.startsWith("Landscape Character Units"), true);
    assert.equal(feature?.label, "LDU MW54");
    assert.equal(feature?.attributes.landscapeUnitType, "LDU");
    assert.equal(feature?.attributes.landscapeUnitCode, "MW54");
    assert.equal(feature?.attributes.boundarySource, "source-polygon");
    assert.equal(feature?.attributes.meaning, "LLM characterization for LDU MW54.");
    assert.deepEqual(feature?.coordinates, [
      [10, 10],
      [90, 10],
      [90, 60],
      [10, 60]
    ]);
  });

  it("uses imported knowledge-bank codes when explicit unit code attributes are absent", () => {
    const layer = createCodedLandscapeUnitLayerFromEvidence(
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
      request.evidence,
      {
        model: "landschaft-mock-lca",
        promptVersion: "lca-mvp-v1",
        inputLayerIds: ["soil"],
        areas: [],
        knowledgeBankEntries: [
          {
            id: "kb-import-soil-loam",
            theme: "soil",
            sourceValue: "loam",
            codeSegment: "23E3AK34ELE",
            meaning: "Imported local landscape unit code.",
            classificationRule: "Imported local code mapping.",
            status: "reviewed",
            version: LCA_KNOWLEDGE_BANK_VERSION,
            usageCount: 0,
            importSource: "knowledge-base-sheet"
          }
        ]
      }
    );

    const feature = layer?.features?.[0];
    assert.ok(layer);
    assert.equal(feature?.attributes.landscapeUnitType, "LCA");
    assert.equal(feature?.attributes.landscapeUnitCode, "23E3AK34ELE");
    assert.equal(feature?.attributes.codeSource, "knowledge-bank");
    assert.equal(feature?.attributes.sourceValue, "loam");
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


describe("extractLlmResponseContent", () => {
  it("reads Ollama chat message content", () => {
    const content = extractLlmResponseContent({
      message: { role: "assistant", content: "{\"areas\":[]}" }
    });
    assert.equal(content, "{\"areas\":[]}");
  });
});
