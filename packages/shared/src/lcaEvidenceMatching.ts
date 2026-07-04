/*
 * ---metadata---
 * type: package-source
 * description: Polygon intersection and dominant-value scoring for LCA evidence matching.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: replace bbox matching with polygon intersection and dominant scoring
 * ---end-metadata---
 */
import area from "@turf/area";
import booleanContains from "@turf/boolean-contains";
import booleanIntersects from "@turf/boolean-intersects";
import booleanPointInPolygon from "@turf/boolean-point-in-polygon";
import distance from "@turf/distance";
import intersect from "@turf/intersect";
import { featureCollection, lineString, point, polygon } from "@turf/helpers";
import type { Coordinate } from "./index.js";
import type { MapEvidenceFeature } from "./mapEvidence.js";
import {
  createKnowledgeBankStore,
  LCA_CODE_THEMES,
  type KnowledgeBankEntry,
  type LcaCodeTheme
} from "./lcaKnowledgeBank.js";

export interface IntersectingEvidenceMatch {
  feature: MapEvidenceFeature;
  intersectionArea: number;
  coverageRatio: number;
}

export interface DominantThemeValue {
  theme: LcaCodeTheme;
  sourceLayerId: string;
  sourceFeatureId?: string;
  sourceAttribute: string;
  sourceValue: string;
  score: number;
  coverageRatio: number;
  knowledgeBankEntry: KnowledgeBankEntry;
}

const THEME_ATTRIBUTE_CANDIDATES: Record<LcaCodeTheme, string[]> = {
  topography: ["elevation", "height", "contourelevation", "contour"],
  slope: ["slope", "gradient", "aspect"],
  geology: ["geology", "parentmaterial", "lithology", "bedrock"],
  soil: ["soil", "musym", "nationalmusym", "mukey", "drainage"],
  vegetation: ["vegetation", "landcover", "land-cover", "cover", "woodland"],
  "land-use": ["landuse", "suitability", "building", "use"]
};

export function closeEvidenceRing(coordinates: Coordinate[]): Coordinate[] {
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

export function findIntersectingEvidence(
  areaRing: Coordinate[],
  evidenceFeatures: MapEvidenceFeature[]
): IntersectingEvidenceMatch[] {
  const areaPolygon = toTurfPolygon(areaRing);
  const areaSize = Math.max(area(areaPolygon), 1);

  return evidenceFeatures
    .map((feature) => {
      const intersectionArea = computeIntersectionArea(areaRing, feature);
      if (intersectionArea <= 0) {
        return null;
      }

      return {
        feature,
        intersectionArea,
        coverageRatio: intersectionArea / areaSize
      };
    })
    .filter((match): match is IntersectingEvidenceMatch => match !== null)
    .sort((left, right) => right.intersectionArea - left.intersectionArea);
}

export function scoreDominantThemeValues(
  areaRing: Coordinate[],
  evidenceFeatures: MapEvidenceFeature[],
  knowledgeBank = createKnowledgeBankStore()
): DominantThemeValue[] {
  const matches = findIntersectingEvidence(areaRing, evidenceFeatures);
  const areaPolygon = toTurfPolygon(areaRing);
  const areaSize = Math.max(area(areaPolygon), 1);
  const themeScores = new Map<
    string,
    {
      theme: LcaCodeTheme;
      sourceLayerId: string;
      sourceFeatureId?: string;
      sourceAttribute: string;
      sourceValue: string;
      score: number;
      coverageRatio: number;
    }
  >();

  for (const match of matches) {
    for (const theme of LCA_CODE_THEMES) {
      const attribute = findThemeAttribute(match.feature.attributes, theme);
      if (!attribute) {
        continue;
      }

      const sourceValue = match.feature.attributes[attribute];
      const key = `${theme}:${attribute}:${sourceValue.toLowerCase()}`;
      const existing = themeScores.get(key);
      const addedScore = match.intersectionArea;

      if (existing) {
        existing.score += addedScore;
        existing.coverageRatio = existing.score / areaSize;
      } else {
        themeScores.set(key, {
          theme,
          sourceLayerId: match.feature.layerId,
          sourceFeatureId: match.feature.id,
          sourceAttribute: attribute,
          sourceValue,
          score: addedScore,
          coverageRatio: addedScore / areaSize
        });
      }
    }
  }

  const dominantByTheme = new Map<LcaCodeTheme, DominantThemeValue>();

  for (const candidate of themeScores.values()) {
    const current = dominantByTheme.get(candidate.theme);
    if (!current || candidate.score > current.score) {
      dominantByTheme.set(candidate.theme, {
        ...candidate,
        knowledgeBankEntry: knowledgeBank.resolve(candidate.theme, candidate.sourceValue)
      });
    }
  }

  return LCA_CODE_THEMES.flatMap((theme) => {
    const value = dominantByTheme.get(theme);
    return value ? [value] : [];
  });
}

export function inferSpatialRelationshipType(
  subject: MapEvidenceFeature,
  target: MapEvidenceFeature
): "overlap" | "adjacency" | "containment" | "proximity" | null {
  if (subject.geometryType === "polygon" && target.geometryType === "polygon") {
    const subjectPolygon = toTurfPolygon(subject.coordinates);
    const targetPolygon = toTurfPolygon(target.coordinates);

    if (booleanContains(subjectPolygon, targetPolygon)) {
      return "containment";
    }

    if (booleanContains(targetPolygon, subjectPolygon)) {
      return "containment";
    }

    const intersectionArea = computeIntersectionArea(subject.coordinates, target);
    if (intersectionArea > 0) {
      return "overlap";
    }

    if (polygonAdjacencyDistance(subject.coordinates, target.coordinates) <= 12) {
      return "adjacency";
    }

    return null;
  }

  if (subject.geometryType === "point" && target.geometryType === "polygon") {
    const subjectPoint = point(subject.coordinates[0]);
    const targetPolygon = toTurfPolygon(target.coordinates);
    if (booleanPointInPolygon(subjectPoint, targetPolygon)) {
      return "containment";
    }

    const nearestDistance = distance(
      subjectPoint,
      point(target.coordinates[0]),
      { units: "meters" }
    );
    return nearestDistance <= 25 ? "proximity" : null;
  }

  if (subject.geometryType === "line" && target.geometryType === "polygon") {
    const line = lineString(subject.coordinates.map((coordinate) => [...coordinate]));
    const targetPolygon = toTurfPolygon(target.coordinates);
    if (booleanIntersects(line, targetPolygon)) {
      return "overlap";
    }

    return polygonAdjacencyDistance(subject.coordinates, target.coordinates) <= 12
      ? "adjacency"
      : null;
  }

  return null;
}

function computeIntersectionArea(
  areaRing: Coordinate[],
  feature: MapEvidenceFeature
): number {
  const areaPolygon = toTurfPolygon(areaRing);

  if (feature.geometryType === "polygon" && feature.coordinates.length >= 3) {
    const featurePolygon = toTurfPolygon(feature.coordinates);
    if (!booleanIntersects(areaPolygon, featurePolygon)) {
      return 0;
    }

    const intersection = intersect(
      featureCollection([areaPolygon, featurePolygon])
    );

    return intersection ? area(intersection) : 0;
  }

  if (feature.geometryType === "point" && feature.coordinates.length > 0) {
    const featurePoint = point(feature.coordinates[0]);
    return booleanPointInPolygon(featurePoint, areaPolygon) ? 1 : 0;
  }

  if (feature.geometryType === "line" && feature.coordinates.length >= 2) {
    const featureLine = lineString(feature.coordinates.map((coordinate) => [...coordinate]));
    return booleanIntersects(featureLine, areaPolygon) ? 1 : 0;
  }

  return 0;
}

function polygonAdjacencyDistance(left: Coordinate[], right: Coordinate[]) {
  let minimum = Number.POSITIVE_INFINITY;

  for (const leftCoordinate of left) {
    for (const rightCoordinate of right) {
      minimum = Math.min(
        minimum,
        distance(point(leftCoordinate), point(rightCoordinate), { units: "meters" })
      );
    }
  }

  return minimum;
}

function toTurfPolygon(coordinates: Coordinate[]) {
  const ring = closeEvidenceRing(coordinates).map(
    (coordinate) => [coordinate[0], coordinate[1]] as [number, number]
  );
  return polygon([ring]);
}

function findThemeAttribute(attributes: Record<string, string>, theme: LcaCodeTheme) {
  const normalizedEntries = Object.entries(attributes).map(([key, value]) => [
    key.toLowerCase(),
    key,
    value
  ] as const);

  for (const candidate of THEME_ATTRIBUTE_CANDIDATES[theme]) {
    const match = normalizedEntries.find(([normalizedKey]) => normalizedKey === candidate);
    if (match) {
      return match[1];
    }
  }

  return undefined;
}
