/*
 * ---metadata---
 * type: app-source
 * description: Project-space geometry clipping, export, snapping, and raster world-file parsing.
 * last-updated: 2026-06-28
 * last-model: composer
 * last-change: add extent clipping, GeoJSON export, snap, and world-file helpers
 * ---end-metadata---
 */
import bboxClip from "@turf/bbox-clip";
import {
  getProjectExtentBbox,
  type ProjectExtentSource,
  type RasterGeoreference
} from "@landschaft/shared";
import type {
  Coordinate,
  PlanningLayer,
  ProjectMetadata,
  VectorFeature
} from "@landschaft/shared";
import type {
  Feature,
  GeoJsonProperties,
  LineString,
  MultiLineString,
  Polygon,
  Position
} from "geojson";

export interface WorldFileParams {
  pixelSizeX: number;
  rotationRow: number;
  rotationCol: number;
  pixelSizeY: number;
  originX: number;
  originY: number;
}

export function parseWorldFile(text: string): WorldFileParams {
  const lines = text
    .trim()
    .split(/\r?\n/)
    .map((line) => Number(line.trim()));

  if (lines.length < 6 || lines.some((value) => !Number.isFinite(value))) {
    throw new Error("World file must contain six numeric lines.");
  }

  return {
    pixelSizeX: lines[0],
    rotationRow: lines[1],
    rotationCol: lines[2],
    pixelSizeY: lines[3],
    originX: lines[4],
    originY: lines[5]
  };
}

export function mapCoordinateToProject(
  mapCoordinate: [number, number],
  project: ProjectMetadata
): Coordinate {
  const longitude = mapCoordinate[0];
  const latitude = mapCoordinate[1];
  const longitudes = project.corners.map((corner) => corner.longitude);
  const latitudes = project.corners.map((corner) => corner.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const u = safeRatio(longitude - minLongitude, maxLongitude - minLongitude);
  const v = 1 - safeRatio(latitude - minLatitude, maxLatitude - minLatitude);

  return [
    u * project.realWorldExtentMeters.width,
    v * project.realWorldExtentMeters.depth
  ];
}

export function projectCoordinateToMap(
  coordinate: Coordinate,
  project: ProjectMetadata
): [number, number] {
  const longitudes = project.corners.map((corner) => corner.longitude);
  const latitudes = project.corners.map((corner) => corner.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const u = safeRatio(coordinate[0], project.realWorldExtentMeters.width);
  const v = 1 - safeRatio(coordinate[1], project.realWorldExtentMeters.depth);

  return [
    minLongitude + u * (maxLongitude - minLongitude),
    minLatitude + v * (maxLatitude - minLatitude)
  ];
}

export function createRasterGeoreferenceFromWorldFile(
  worldFile: WorldFileParams,
  imageWidthPixels: number,
  imageHeightPixels: number,
  project: ProjectMetadata,
  worldFileSource: string
): RasterGeoreference {
  const topLeft: [number, number] = [worldFile.originX, worldFile.originY];
  const bottomRight: [number, number] = [
    worldFile.originX + imageWidthPixels * worldFile.pixelSizeX,
    worldFile.originY + imageHeightPixels * worldFile.pixelSizeY
  ];
  const projectMin = mapCoordinateToProject(
    [Math.min(topLeft[0], bottomRight[0]), Math.min(topLeft[1], bottomRight[1])],
    project
  );
  const projectMax = mapCoordinateToProject(
    [Math.max(topLeft[0], bottomRight[0]), Math.max(topLeft[1], bottomRight[1])],
    project
  );

  return {
    projectMin: [
      Math.max(0, Math.min(projectMin[0], projectMax[0])),
      Math.max(0, Math.min(projectMin[1], projectMax[1]))
    ],
    projectMax: [
      Math.min(project.realWorldExtentMeters.width, Math.max(projectMin[0], projectMax[0])),
      Math.min(project.realWorldExtentMeters.depth, Math.max(projectMin[1], projectMax[1]))
    ],
    imageWidthPixels,
    imageHeightPixels,
    parsedFrom: "world-file",
    worldFileSource
  };
}

export function clipVectorFeaturesToExtent(
  features: VectorFeature[],
  project: ProjectExtentSource
): VectorFeature[] {
  const extent = getProjectExtentBbox(project);
  return features.flatMap((feature, index) =>
    clipVectorFeatureToExtent(feature, extent, index)
  );
}

export function clipVectorFeatureToExtent(
  feature: VectorFeature,
  extent: [number, number, number, number],
  index = 0
): VectorFeature[] {
  if (feature.geometryType === "point") {
    const coordinate = feature.coordinates[0];
    if (!coordinate || !isCoordinateInsideBbox(coordinate, extent)) {
      return [];
    }

    return [withClippedAttributes(feature)];
  }

  const turfFeature = vectorFeatureToTurf(feature) as Feature<
    LineString | Polygon
  >;
  if (!turfFeature) {
    return [];
  }

  const clipped = bboxClip(
    turfFeature,
    extent
  ) as Feature<LineString | MultiLineString | Polygon>;
  if (!clipped.geometry) {
    return [];
  }

  return turfGeometryToVectorFeatures(clipped, feature, index).map(withClippedAttributes);
}

export function exportLayerAsGeoJson(
  layer: PlanningLayer,
  project: ProjectMetadata
) {
  const features = (layer.features ?? []).map((feature) =>
    vectorFeatureToExportGeoJson(feature, project)
  );

  return {
    type: "FeatureCollection" as const,
    metadata: {
      layerId: layer.id,
      layerName: layer.name,
      coordinateReferenceSystem: project.coordinateReferenceSystem,
      coordinateSpace: "project-metres",
      clippedToProjectExtent: true,
      exportedAt: new Date().toISOString()
    },
    features
  };
}

export function collectSnapTargets(
  layers: PlanningLayer[],
  exclude?: { layerId: string; featureId: string }
) {
  const targets: Coordinate[] = [];

  for (const layer of layers) {
    if (!layer.visible || layer.locked || !layer.features?.length) {
      continue;
    }

    for (const feature of layer.features) {
      if (
        exclude &&
        exclude.layerId === layer.id &&
        exclude.featureId === feature.id
      ) {
        continue;
      }

      targets.push(...feature.coordinates);
    }
  }

  return targets;
}

export function snapCoordinate(
  coordinate: Coordinate,
  project: ProjectMetadata,
  layers: PlanningLayer[],
  exclude: { layerId: string; featureId: string } | null,
  snapRadius: number
): Coordinate {
  const gridStep = Math.max(
    1,
    Math.round(
      Math.min(
        project.realWorldExtentMeters.width,
        project.realWorldExtentMeters.depth
      ) * 0.01
    )
  );
  const snappedGrid: Coordinate = [
    Math.round(coordinate[0] / gridStep) * gridStep,
    Math.round(coordinate[1] / gridStep) * gridStep
  ];

  let best: Coordinate = snappedGrid;
  let bestDistance = Number.POSITIVE_INFINITY;

  for (const target of collectSnapTargets(layers, exclude ?? undefined)) {
    const distance = coordinateDistance(coordinate, target);
    if (distance <= snapRadius && distance < bestDistance) {
      best = target;
      bestDistance = distance;
    }
  }

  return [
    clamp(best[0], 0, project.realWorldExtentMeters.width),
    clamp(best[1], 0, project.realWorldExtentMeters.depth)
  ];
}

function withClippedAttributes(feature: VectorFeature): VectorFeature {
  return {
    ...feature,
    attributes: {
      ...feature.attributes,
      clippedToExtent: "true",
      coordinateSpace: "project-metres"
    }
  };
}

function vectorFeatureToTurf(feature: VectorFeature): Feature | null {
  const coordinates = feature.coordinates.map(
    (coordinate) => [coordinate[0], coordinate[1]] as Position
  );

  if (feature.geometryType === "line") {
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "LineString",
        coordinates
      }
    };
  }

  if (feature.geometryType === "polygon") {
    const ring = closeRing(coordinates);
    return {
      type: "Feature",
      properties: {},
      geometry: {
        type: "Polygon",
        coordinates: [ring]
      }
    };
  }

  return null;
}

function turfGeometryToVectorFeatures(
  feature: Feature<LineString | MultiLineString | Polygon>,
  source: VectorFeature,
  index: number
): VectorFeature[] {
  const geometry = feature.geometry;

  if (geometry.type === "LineString") {
    return [
      {
        ...source,
        id: `${source.id}-clip-${index + 1}`,
        geometryType: "line",
        coordinates: geometry.coordinates.map((coordinate) => [
          coordinate[0],
          coordinate[1]
        ])
      }
    ];
  }

  if (geometry.type === "MultiLineString") {
    return geometry.coordinates.map((line, lineIndex) => ({
      ...source,
      id: `${source.id}-clip-${index + 1}-${lineIndex + 1}`,
      label: `${source.label} ${lineIndex + 1}`,
      geometryType: "line" as const,
      coordinates: line.map((coordinate) => [coordinate[0], coordinate[1]])
    }));
  }

  if (geometry.type === "Polygon") {
    return [
      {
        ...source,
        id: `${source.id}-clip-${index + 1}`,
        geometryType: "polygon",
        coordinates: geometry.coordinates[0].map((coordinate) => [
          coordinate[0],
          coordinate[1]
        ])
      }
    ];
  }

  return [];
}

function vectorFeatureToExportGeoJson(feature: VectorFeature, project: ProjectMetadata) {
  const properties: GeoJsonProperties = {
    ...feature.attributes,
    featureId: feature.id,
    label: feature.label,
    planningImpact: feature.planningImpact,
    coordinateSpace: "project-metres",
    clippedToExtent: feature.attributes.clippedToExtent ?? "true"
  };

  if (feature.geometryType === "point") {
    const [mapX, mapY] = projectCoordinateToMap(feature.coordinates[0], project);
    return {
      type: "Feature" as const,
      properties,
      geometry: {
        type: "Point" as const,
        coordinates: [mapX, mapY]
      }
    };
  }

  if (feature.geometryType === "line") {
    return {
      type: "Feature" as const,
      properties,
      geometry: {
        type: "LineString" as const,
        coordinates: feature.coordinates.map((coordinate) =>
          projectCoordinateToMap(coordinate, project)
        )
      }
    };
  }

  return {
    type: "Feature" as const,
    properties,
    geometry: {
      type: "Polygon" as const,
      coordinates: [
        closeRing(
          feature.coordinates.map((coordinate) =>
            projectCoordinateToMap(coordinate, project)
          )
        )
      ]
    }
  };
}

function isCoordinateInsideBbox(
  coordinate: Coordinate,
  extent: [number, number, number, number]
) {
  const [minX, minY, maxX, maxY] = extent;
  return (
    coordinate[0] >= minX &&
    coordinate[0] <= maxX &&
    coordinate[1] >= minY &&
    coordinate[1] <= maxY
  );
}

function closeRing(coordinates: Position[]) {
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

function coordinateDistance(a: Coordinate, b: Coordinate) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  return Math.hypot(dx, dy);
}

function safeRatio(value: number, range: number) {
  if (Math.abs(range) < 0.0000001) {
    return 0;
  }

  return Math.min(Math.max(value / range, 0), 1);
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}
