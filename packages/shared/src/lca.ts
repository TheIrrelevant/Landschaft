/*
 * ---metadata---
 * type: package-source
 * description: Landscape Character Assessment draft generation and layer mapping for Landschaft.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: add DeepSeek LCA prompt contract and response parser
 * ---end-metadata---
 */
import type {
  CodedArea,
  Coordinate,
  MapWriteDraftRequest,
  PlanningLayer,
  ProjectMetadata,
  ReviewStatus,
  VectorFeature
} from "./index.js";
import type { MapEvidenceFeature, MapReadResult } from "./mapEvidence.js";

export interface LcaDraftAnalysisRequest {
  purpose: string;
  evidence: MapReadResult;
}

export interface LcaDraftAnalysisResult {
  areas: CodedArea[];
  model: string;
  promptVersion: string;
  inputLayerIds: string[];
}

export interface DeepSeekLcaPrompt {
  model: string;
  promptVersion: string;
  system: string;
  user: string;
  responseFormat: "json_object";
  temperature: number;
}

export interface MapWriteDraftResult {
  status: "draft-written";
  projectId: string;
  targetLayerId: string;
  layer: PlanningLayer;
  featureCount: number;
  reviewStatus: ReviewStatus;
  reason: string;
}

const LCA_LAYER_ID = "landscape-character-assessment";
const LCA_PROMPT_VERSION = "lca-mvp-v1";
export const LCA_DEEPSEEK_MODEL = "deepseek-reasoner";
export const LCA_DEEPSEEK_PROMPT_VERSION = "lca-deepseek-v1";

export function generateLcaCodedId() {
  const alphabet = "abcdefghijklmnopqrstuvwxyz0123456789";
  return Array.from({ length: 10 }, () => {
    const index = Math.floor(Math.random() * alphabet.length);
    return alphabet[index];
  }).join("");
}

export function generateMockLcaDraft(
  request: LcaDraftAnalysisRequest
): LcaDraftAnalysisResult {
  const polygonFeatures = request.evidence.features.filter(
    (feature) => feature.geometryType === "polygon" && feature.coordinates.length >= 3
  );

  const areas =
    polygonFeatures.length > 0
      ? polygonFeatures.slice(0, 4).map((feature, index) =>
          codedAreaFromEvidenceFeature(feature, request.purpose, index)
        )
      : defaultExtentCharacterAreas(request.evidence, request.purpose);

  return {
    areas,
    model: "landschaft-mock-lca",
    promptVersion: LCA_PROMPT_VERSION,
    inputLayerIds: request.evidence.selectedLayerIds
  };
}

export function buildDeepSeekLcaPrompt(
  request: LcaDraftAnalysisRequest
): DeepSeekLcaPrompt {
  return {
    model: LCA_DEEPSEEK_MODEL,
    promptVersion: LCA_DEEPSEEK_PROMPT_VERSION,
    responseFormat: "json_object",
    temperature: 0.2,
    system: [
      "You are a landscape character assessment assistant for Landschaft.",
      "Use Carys Swanwick Landscape Character Assessment principles.",
      "Do not invent evidence outside the supplied map evidence.",
      "Separate factual baseline interpretation from design judgement.",
      "Return only valid JSON matching the requested schema."
    ].join(" "),
    user: JSON.stringify(
      {
        task: "Draft candidate Landscape Character Assessment areas.",
        purpose: request.purpose,
        coordinateSpace: request.evidence.coordinateSpace,
        coordinateReferenceSystem: request.evidence.coordinateReferenceSystem,
        projectExtent: request.evidence.projectExtent,
        selectedLayerIds: request.evidence.selectedLayerIds,
        layerSummaries: request.evidence.layerSummaries,
        spatialRelationships: request.evidence.spatialRelationships,
        features: request.evidence.features,
        outputSchema: {
          areas: [
            {
              id: "stable short lowercase id",
              label: "human-readable character area name",
              ring: [
                [0, 0],
                [100, 0],
                [100, 100],
                [0, 100],
                [0, 0]
              ],
              layer: "lca",
              code: "controlled landscape character code",
              meaning:
                "baseline character meaning with source evidence references and no unsupported claims",
              confidence: 0.75
            }
          ]
        },
        constraints: [
          "Coordinates must use project metres.",
          "Each ring must contain at least four coordinates and be closed.",
          "Each area must cite evidence inside meaning.",
          "Confidence must be a number from 0 to 1.",
          "Use fallback project-extent zones only when source geometry is insufficient."
        ]
      },
      null,
      2
    )
  };
}

export function parseDeepSeekLcaDraftResponse(
  response: unknown,
  request: LcaDraftAnalysisRequest
): LcaDraftAnalysisResult {
  const payload = parseJsonPayload(extractDeepSeekContent(response));
  const areasValue = getRecordValue(payload, "areas");

  if (!Array.isArray(areasValue)) {
    throw new Error("DeepSeek LCA response must include an areas array.");
  }

  const areas = areasValue.map((area, index) =>
    validateCodedArea(coerceCodedArea(area, index))
  );

  if (areas.length === 0) {
    throw new Error("DeepSeek LCA response must include at least one area.");
  }

  return {
    areas,
    model: getStringValue(payload, "model") ?? LCA_DEEPSEEK_MODEL,
    promptVersion:
      getStringValue(payload, "promptVersion") ?? LCA_DEEPSEEK_PROMPT_VERSION,
    inputLayerIds: request.evidence.selectedLayerIds
  };
}

export function createLcaLayerFromDraft(
  project: ProjectMetadata,
  areas: CodedArea[],
  analysis: Pick<LcaDraftAnalysisResult, "model" | "promptVersion" | "inputLayerIds">
): PlanningLayer {
  const features = areas.map((area) => codedAreaToVectorFeature(area, analysis));

  return {
    id: LCA_LAYER_ID,
    name: "Landscape Character Assessment",
    kind: "lca",
    visible: true,
    opacity: 0.82,
    reviewStatus: "needs-review",
    category: "designer-created",
    geometryType: "polygon",
    source: {
      sourceName: "LCA draft analysis",
      sourceType: "derived",
      sourceDate: new Date().toISOString().slice(0, 10),
      coordinateReferenceSystem: project.coordinateReferenceSystem,
      accuracyStatus: "provider-derived",
      confidence: averageConfidence(areas)
    },
    style: {
      stroke: "#5f4b8b",
      fill: "#9d8ec7",
      strokeWidth: 2
    },
    legend: areas.map((area) => ({
      label: area.label,
      color: "#9d8ec7"
    })),
    features,
    planningImpactNotes: [
      "Draft landscape character areas require human review before planning use.",
      `Generated by ${analysis.model} using prompt ${analysis.promptVersion}.`
    ],
    locked: false
  };
}

export function applyMapWriteDraft(
  project: ProjectMetadata,
  request: MapWriteDraftRequest,
  existingLayers: PlanningLayer[],
  analysisMeta?: Pick<LcaDraftAnalysisResult, "model" | "promptVersion" | "inputLayerIds">
): MapWriteDraftResult {
  const validatedAreas = request.features.map(validateCodedArea);
  const existingLayer = existingLayers.find(
    (layer) => layer.id === (request.targetLayerId ?? LCA_LAYER_ID)
  );
  const layer = createLcaLayerFromDraft(project, validatedAreas, {
    model: analysisMeta?.model ?? "external-llm",
    promptVersion: analysisMeta?.promptVersion ?? LCA_PROMPT_VERSION,
    inputLayerIds:
      analysisMeta?.inputLayerIds ??
      existingLayer?.features?.map((feature) => feature.id) ??
      []
  });

  if (request.createLayerName) {
    layer.name = request.createLayerName;
  }

  return {
    status: "draft-written",
    projectId: request.projectId,
    targetLayerId: layer.id,
    layer,
    featureCount: layer.features?.length ?? 0,
    reviewStatus: layer.reviewStatus,
    reason: request.reason
  };
}

function codedAreaFromEvidenceFeature(
  feature: MapEvidenceFeature,
  purpose: string,
  index: number
): CodedArea {
  return {
    id: generateLcaCodedId(),
    label: feature.label || `Character Area ${index + 1}`,
    ring: closeRing(feature.coordinates),
    layer: "lca",
    code: deriveCharacterCode(feature.attributes),
    meaning: buildCharacterMeaning(feature, purpose),
    confidence: clampConfidence(0.66 + index * 0.05)
  };
}

function defaultExtentCharacterAreas(
  evidence: MapReadResult,
  purpose: string
): CodedArea[] {
  const { width, depth } = evidence.projectExtent;
  const northMeaning = `Northern project character derived from selected layers for ${purpose}.`;
  const southMeaning = `Southern project character derived from selected layers for ${purpose}.`;

  return [
    {
      id: generateLcaCodedId(),
      label: "North character area",
      ring: closeRing([
        [0, 0],
        [width * 0.52, 0],
        [width * 0.48, depth * 0.56],
        [0, depth * 0.5],
        [0, 0]
      ]),
      layer: "lca",
      code: "N-CH",
      meaning: northMeaning,
      confidence: 0.62
    },
    {
      id: generateLcaCodedId(),
      label: "South character area",
      ring: closeRing([
        [width * 0.48, depth * 0.44],
        [width, depth * 0.5],
        [width, depth],
        [0, depth],
        [width * 0.48, depth * 0.44]
      ]),
      layer: "lca",
      code: "S-CH",
      meaning: southMeaning,
      confidence: 0.6
    }
  ];
}

function codedAreaToVectorFeature(
  area: CodedArea,
  analysis: Pick<LcaDraftAnalysisResult, "model" | "promptVersion" | "inputLayerIds">
): VectorFeature {
  return {
    id: area.id,
    label: area.label,
    geometryType: "polygon",
    coordinates: openRing(area.ring),
    attributes: {
      lcaCodedId: area.id,
      characterCode: area.code,
      reviewStatus: "needs-review",
      confidence: String(area.confidence),
      model: analysis.model,
      promptVersion: analysis.promptVersion,
      inputLayerIds: analysis.inputLayerIds.join(","),
      meaning: area.meaning
    },
    planningImpact:
      "Review this landscape character area against source layers before using it in planning."
  };
}

function validateCodedArea(area: CodedArea): CodedArea {
  if (area.ring.length < 4) {
    throw new Error(`Coded area ${area.id} must contain at least four coordinates.`);
  }

  return {
    ...area,
    ring: closeRing(area.ring),
    confidence: clampConfidence(area.confidence)
  };
}

function deriveCharacterCode(attributes: Record<string, string>) {
  const soil = attributes.soil ?? attributes.Soil;
  const drainage = attributes.drainage ?? attributes.Drainage;
  const landUse = attributes.landUse ?? attributes.suitability ?? attributes.LandUse;

  return [soil, drainage, landUse]
    .filter(Boolean)
    .map((value) => value.slice(0, 2).toUpperCase())
    .join("")
    .slice(0, 6) || "LCA";
}

function buildCharacterMeaning(feature: MapEvidenceFeature, purpose: string) {
  const attributeSummary = Object.entries(feature.attributes)
    .slice(0, 4)
    .map(([key, value]) => `${key}: ${value}`)
    .join("; ");

  return attributeSummary
    ? `${feature.label} contributes to ${purpose}. Evidence: ${attributeSummary}.`
    : `${feature.label} contributes to ${purpose} based on mapped project evidence.`;
}

function closeRing(coordinates: Coordinate[]): Coordinate[] {
  if (coordinates.length === 0) {
    return coordinates;
  }

  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return coordinates;
  }

  return [...coordinates, first];
}

function openRing(ring: Coordinate[]): Coordinate[] {
  if (ring.length < 2) {
    return ring;
  }

  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first[0] === last[0] && first[1] === last[1]) {
    return ring.slice(0, -1);
  }

  return ring;
}

function averageConfidence(areas: CodedArea[]) {
  if (areas.length === 0) {
    return 0.5;
  }

  return areas.reduce((total, area) => total + area.confidence, 0) / areas.length;
}

function clampConfidence(value: number) {
  return Math.min(Math.max(value, 0), 1);
}

function extractDeepSeekContent(response: unknown): unknown {
  if (typeof response === "string") {
    return response;
  }

  if (!isRecord(response)) {
    return response;
  }

  const choices = response.choices;
  if (!Array.isArray(choices) || choices.length === 0 || !isRecord(choices[0])) {
    return response;
  }

  const message = choices[0].message;
  if (!isRecord(message)) {
    return response;
  }

  return typeof message.content === "string" ? message.content : response;
}

function parseJsonPayload(value: unknown): Record<string, unknown> {
  if (isRecord(value)) {
    return value;
  }

  if (typeof value !== "string") {
    throw new Error("DeepSeek LCA response must be a JSON object or JSON string.");
  }

  const trimmed = value.trim();
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
  const parsed = JSON.parse(withoutFence) as unknown;

  if (!isRecord(parsed)) {
    throw new Error("DeepSeek LCA response JSON must be an object.");
  }

  return parsed;
}

function coerceCodedArea(value: unknown, index: number): CodedArea {
  if (!isRecord(value)) {
    throw new Error(`DeepSeek LCA area ${index + 1} must be an object.`);
  }

  const ringValue = value.ring;
  if (!Array.isArray(ringValue)) {
    throw new Error(`DeepSeek LCA area ${index + 1} must include a ring.`);
  }

  return {
    id: getStringValue(value, "id") ?? generateLcaCodedId(),
    label: getStringValue(value, "label") ?? `Character Area ${index + 1}`,
    ring: ringValue.map((coordinate, coordinateIndex) =>
      coerceCoordinate(coordinate, index, coordinateIndex)
    ),
    layer: getStringValue(value, "layer") ?? "lca",
    code: getStringValue(value, "code") ?? "LCA",
    meaning:
      getStringValue(value, "meaning") ??
      "Draft landscape character area generated from supplied map evidence.",
    confidence: getNumberValue(value, "confidence") ?? 0.5
  };
}

function coerceCoordinate(
  value: unknown,
  areaIndex: number,
  coordinateIndex: number
): Coordinate {
  if (
    !Array.isArray(value) ||
    value.length < 2 ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number"
  ) {
    throw new Error(
      `DeepSeek LCA area ${areaIndex + 1} coordinate ${coordinateIndex + 1} must be [x, y].`
    );
  }

  return [value[0], value[1]];
}

function getRecordValue(record: Record<string, unknown>, key: string) {
  return record[key];
}

function getStringValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function getNumberValue(record: Record<string, unknown>, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
