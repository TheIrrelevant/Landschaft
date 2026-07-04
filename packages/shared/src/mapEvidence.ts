/*
 * ---metadata---
 * type: package-source
 * description: Serialize Landschaft project layers into coordinate-based LLM map evidence.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: infer overlap, adjacency, containment, and proximity relationships
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
  const features = layers.flatMap((layer) =>
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
