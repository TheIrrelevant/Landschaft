/*
 * ---metadata---
 * type: package-source
 * description: Serialize Landschaft project layers into coordinate-based LLM map evidence.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: cap spatial relationship inference to avoid large-project stalls
 * ---end-metadata---
 */
import type { Coordinate, MapReadRequest, PlanningLayer, ProjectMetadata } from "./index.js";
import { inferSpatialRelationshipType } from "./lcaEvidenceMatching.js";

export interface MapEvidenceFeature {
  id: string;
  layerId: string;
  layerName: string;
  label: string;
  geometryType: "point" | "line" | "polygon";
  coordinates: Coordinate[];
  attributes: Record<string, string>;
}

export interface MapLayerSummary {
  layerId: string;
  name: string;
  kind: PlanningLayer["kind"];
  category?: string;
  geometryType?: string;
  featureCount: number;
  accuracyStatus?: string;
  planningNotes: string[];
}

export interface MapSpatialRelationship {
  type: "overlap" | "adjacency" | "containment" | "proximity" | "extent";
  description: string;
  layerIds: string[];
}

export interface MapFeatureGroup {
  id: string;
  layerId: string;
  layerName: string;
  theme: string;
  sourceAttribute: string;
  sourceValue: string;
  featureCount: number;
  totalAreaSquareMeters: number | null;
  totalLengthMeters: number | null;
  representativeFeatureIds: string[];
  representativeCoordinates: Coordinate[][];
  sampleAttributes: Record<string, string>;
}

export interface MapReadResult {
  projectId: string;
  coordinateReferenceSystem: string;
  coordinateSpace: "project-metres";
  projectExtent: {
    width: number;
    depth: number;
  };
  selectedLayerIds: string[];
  geometryDetail: MapReadRequest["geometryDetail"];
  layerSummaries: MapLayerSummary[];
  features: MapEvidenceFeature[];
  featureGroups: MapFeatureGroup[];
  spatialRelationships: MapSpatialRelationship[];
}

type MapEvidenceSource = {
  project: ProjectMetadata;
  layers: PlanningLayer[];
};

export function buildMapEvidence(
  source: MapEvidenceSource,
  request: MapReadRequest
): MapReadResult {
  const selectedLayers = source.layers.filter((layer) =>
    request.selectedLayerIds.includes(layer.id)
  );
  const layerSummaries = selectedLayers.map((layer) => summarizeLayer(layer));
  const features = selectedLayers.flatMap((layer) =>
    (layer.features ?? []).map((feature) => ({
      id: feature.id,
      layerId: layer.id,
      layerName: layer.name,
      label: feature.label,
      geometryType: feature.geometryType,
      coordinates: simplifyCoordinates(feature.coordinates, request.geometryDetail),
      attributes: feature.attributes
    }))
  );

  return {
    projectId: request.projectId,
    coordinateReferenceSystem: source.project.coordinateReferenceSystem,
    coordinateSpace: "project-metres",
    projectExtent: source.project.realWorldExtentMeters,
    selectedLayerIds: request.selectedLayerIds,
    geometryDetail: request.geometryDetail,
    layerSummaries,
    features,
    featureGroups: buildFeatureGroups(layerSummaries, features, source.project),
    spatialRelationships: buildSpatialRelationships(selectedLayers, source.project)
  };
}

export function getDefaultLcaInputLayerIds(layers: PlanningLayer[]) {
  return layers
    .filter(
      (layer) =>
        layer.kind === "foundational-map" &&
        layer.id !== "project-boundary" &&
        layer.visible
    )
    .map((layer) => layer.id);
}

function summarizeLayer(layer: PlanningLayer): MapLayerSummary {
  return {
    layerId: layer.id,
    name: layer.name,
    kind: layer.kind,
    category: layer.category,
    geometryType: layer.geometryType,
    featureCount: layer.features?.length ?? 0,
    accuracyStatus: layer.source?.accuracyStatus,
    planningNotes: layer.planningImpactNotes ?? []
  };
}

function simplifyCoordinates(
  coordinates: Coordinate[],
  geometryDetail: MapReadRequest["geometryDetail"]
): Coordinate[] {
  if (geometryDetail === "full" || coordinates.length <= 6) {
    return coordinates;
  }

  if (geometryDetail === "summary") {
    if (coordinates.length <= 2) {
      return coordinates;
    }

    return [coordinates[0], coordinates[coordinates.length - 1]];
  }

  const step = Math.max(1, Math.ceil(coordinates.length / 12));
  const simplified = coordinates.filter((_, index) => index % step === 0);
  const last = coordinates[coordinates.length - 1];
  if (simplified[simplified.length - 1] !== last) {
    simplified.push(last);
  }

  return simplified;
}

function buildSpatialRelationships(
  layers: PlanningLayer[],
  project: ProjectMetadata
): MapSpatialRelationship[] {
  const allFeatures = layers.flatMap((layer) =>
    (layer.features ?? []).map((feature) => ({
      id: feature.id,
      layerId: layer.id,
      layerName: layer.name,
      label: feature.label,
      geometryType: feature.geometryType,
      coordinates: feature.coordinates,
      attributes: feature.attributes
    }))
  );
  const features = allFeatures.slice(0, 80);

  const relationships: MapSpatialRelationship[] = [
    {
      type: "extent",
      description: `Project extent spans ${Math.round(project.realWorldExtentMeters.width)} m by ${Math.round(project.realWorldExtentMeters.depth)} m.`,
      layerIds: layers.map((layer) => layer.id)
    }
  ];

  const seen = new Set<string>();

  for (let leftIndex = 0; leftIndex < features.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < features.length; rightIndex += 1) {
      const left = features[leftIndex];
      const right = features[rightIndex];
      const relationshipType = inferSpatialRelationshipType(left, right);
      if (!relationshipType) {
        continue;
      }

      const key = [relationshipType, left.id, right.id].sort().join(":");
      if (seen.has(key)) {
        continue;
      }
      seen.add(key);

      relationships.push({
        type: relationshipType,
        description: `${left.layerName}/${left.label} ${relationshipType}s ${right.layerName}/${right.label}.`,
        layerIds: [left.layerId, right.layerId]
      });
    }
  }

  return relationships;
}

export interface CapMapEvidenceOptions {
  maxFeaturesPerLayer?: number;
  maxTotalFeatures?: number;
  maxFeatureGroups?: number;
  maxSpatialRelationships?: number;
}

export function capMapEvidenceForLca(
  evidence: MapReadResult,
  options: CapMapEvidenceOptions = {}
): MapReadResult {
  const maxFeaturesPerLayer = options.maxFeaturesPerLayer ?? 15;
  const maxTotalFeatures = options.maxTotalFeatures ?? 80;
  const maxFeatureGroups = options.maxFeatureGroups ?? 24;
  const maxSpatialRelationships = options.maxSpatialRelationships ?? 40;
  const featuresByLayer = new Map<string, MapEvidenceFeature[]>();

  for (const feature of evidence.features) {
    const layerFeatures = featuresByLayer.get(feature.layerId) ?? [];
    if (layerFeatures.length < maxFeaturesPerLayer) {
      layerFeatures.push(feature);
      featuresByLayer.set(feature.layerId, layerFeatures);
    }
  }

  const features = Array.from(featuresByLayer.values())
    .flat()
    .slice(0, maxTotalFeatures);

  const layerSummaries = evidence.layerSummaries.map((summary) => ({
    ...summary,
    planningNotes:
      summary.featureCount > maxFeaturesPerLayer
        ? [
            ...summary.planningNotes,
            `LCA prompt capped to ${maxFeaturesPerLayer} features from this layer.`
          ]
        : summary.planningNotes
  }));

  return {
    ...evidence,
    geometryDetail: "summary",
    features,
    featureGroups: evidence.featureGroups.slice(0, maxFeatureGroups),
    layerSummaries,
    spatialRelationships: evidence.spatialRelationships.slice(0, maxSpatialRelationships)
  };
}

function buildFeatureGroups(
  layerSummaries: MapLayerSummary[],
  features: MapEvidenceFeature[],
  project: ProjectMetadata
): MapFeatureGroup[] {
  const layerCategoryById = new Map(
    layerSummaries.map((summary) => [summary.layerId, summary.category ?? "layer"])
  );
  const groups = new Map<string, MapFeatureGroup>();

  for (const feature of features) {
    const category = layerCategoryById.get(feature.layerId) ?? "layer";
    const sourceAttribute = pickGroupingAttribute(category, feature.attributes);
    const sourceValue = sourceAttribute
      ? feature.attributes[sourceAttribute]
      : feature.label || feature.geometryType;
    const theme = normalizeTheme(category, sourceAttribute);
    const key = [
      feature.layerId,
      theme,
      sourceAttribute || "label",
      sourceValue.toLowerCase()
    ].join("::");
    const existing = groups.get(key);
    const area = feature.geometryType === "polygon"
      ? polygonAreaSquareMeters(feature.coordinates)
      : 0;
    const length = feature.geometryType === "line"
      ? lineLengthMeters(feature.coordinates)
      : 0;

    if (!existing) {
      groups.set(key, {
        id: `group-${groups.size + 1}`,
        layerId: feature.layerId,
        layerName: feature.layerName,
        theme,
        sourceAttribute: sourceAttribute || "label",
        sourceValue,
        featureCount: 1,
        totalAreaSquareMeters: area > 0 ? area : null,
        totalLengthMeters: length > 0 ? length : null,
        representativeFeatureIds: [feature.id],
        representativeCoordinates: [simplifyCoordinates(feature.coordinates, "summary")],
        sampleAttributes: pickRelevantAttributes(category, feature.attributes)
      });
      continue;
    }

    existing.featureCount += 1;
    existing.totalAreaSquareMeters = addNullableMetric(existing.totalAreaSquareMeters, area);
    existing.totalLengthMeters = addNullableMetric(existing.totalLengthMeters, length);
    if (existing.representativeFeatureIds.length < 3) {
      existing.representativeFeatureIds.push(feature.id);
      existing.representativeCoordinates.push(
        simplifyCoordinates(feature.coordinates, "summary")
      );
    }
  }

  const projectArea = Math.max(project.realWorldExtentMeters.width * project.realWorldExtentMeters.depth, 1);
  return Array.from(groups.values()).sort((left, right) => {
    const leftArea = left.totalAreaSquareMeters ?? 0;
    const rightArea = right.totalAreaSquareMeters ?? 0;
    if (rightArea !== leftArea) {
      return rightArea - leftArea;
    }
    return right.featureCount - left.featureCount;
  }).map((group) => ({
    ...group,
    totalAreaSquareMeters: group.totalAreaSquareMeters === null
      ? null
      : Math.round(group.totalAreaSquareMeters),
    totalLengthMeters: group.totalLengthMeters === null
      ? null
      : Math.round(group.totalLengthMeters),
    sampleAttributes: {
      ...group.sampleAttributes,
      ...(group.totalAreaSquareMeters
        ? { coveragePercent: String(Math.round((group.totalAreaSquareMeters / projectArea) * 1000) / 10) }
        : {})
    }
  }));
}

function pickGroupingAttribute(category: string, attributes: Record<string, string>) {
  const candidatesByCategory: Record<string, string[]> = {
    soil: ["muname", "soil", "musym", "nationalmusym", "mukey", "drainage"],
    "ecology-vegetation": ["landCover", "landcover", "vegetation", "class", "woodland"],
    hydrology: ["fcode", "gnis_name", "name", "waterbody", "stream"],
    geomorphology: ["elevation", "contourelevation", "slope", "aspect"],
    geology: ["geology", "parentMaterial", "lithology", "bedrock"],
    "land-use-settlement": ["landUse", "landuse", "building", "name", "layerKind"],
    "infrastructure-utilities": ["highway", "fclass", "layerKind", "name"],
    "legal-planning": ["name", "layerKind", "unit_name", "county_name"]
  };
  const candidates = candidatesByCategory[category] ?? ["class", "type", "name", "label"];
  const entries = Object.entries(attributes);

  for (const candidate of candidates) {
    const match = entries.find(([key, value]) =>
      key.toLowerCase() === candidate.toLowerCase() && value.trim()
    );
    if (match) {
      return match[0];
    }
  }

  return undefined;
}

function normalizeTheme(category: string, sourceAttribute?: string) {
  if (category === "soil") {
    return "soil";
  }
  if (category === "ecology-vegetation") {
    return "vegetation";
  }
  if (category === "land-use-settlement" || sourceAttribute === "building") {
    return "land-use";
  }
  if (category === "geomorphology") {
    return sourceAttribute?.toLowerCase().includes("slope") ? "slope" : "topography";
  }
  return category;
}

function pickRelevantAttributes(category: string, attributes: Record<string, string>) {
  const allowed = new Set([
    pickGroupingAttribute(category, attributes),
    "soil",
    "muname",
    "musym",
    "drainage",
    "landCover",
    "vegetation",
    "class",
    "fcode",
    "gnis_name",
    "elevation",
    "contourelevation",
    "slope",
    "geology",
    "landUse",
    "building",
    "highway",
    "layerKind",
    "name"
  ].filter(Boolean));

  return Object.fromEntries(
    Object.entries(attributes).filter(([key]) => allowed.has(key))
  );
}

function addNullableMetric(current: number | null, next: number) {
  if (next <= 0) {
    return current;
  }
  return (current ?? 0) + next;
}

function polygonAreaSquareMeters(coordinates: Coordinate[]) {
  if (coordinates.length < 3) {
    return 0;
  }

  const ring = closeRing(coordinates);
  let total = 0;
  for (let index = 0; index < ring.length - 1; index += 1) {
    const [x1, y1] = ring[index];
    const [x2, y2] = ring[index + 1];
    total += x1 * y2 - x2 * y1;
  }

  return Math.abs(total) / 2;
}

function lineLengthMeters(coordinates: Coordinate[]) {
  let total = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [x1, y1] = coordinates[index - 1];
    const [x2, y2] = coordinates[index];
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

function closeRing(coordinates: Coordinate[]) {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (!first || !last || (first[0] === last[0] && first[1] === last[1])) {
    return coordinates;
  }
  return [...coordinates, first];
}
