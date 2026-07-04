/*
 * ---metadata---
 * type: package-source
 * description: Deterministic map-feature colors for soil and other national-map knowledge rows.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: align knowledge-base swatch colors with all safe dataset layer types
 * ---end-metadata---
 */
import type { PlanningLayer, VectorFeature } from "./index.js";
import {
  formatTransportKindLabel,
  getNlcdClassByCode,
  getSafeDatasetId
} from "./nationalMapCatalog.js";

export const SOIL_COLOR_PALETTE = [
  "#b89655",
  "#8fb56a",
  "#c7885f",
  "#d1b76a",
  "#87a982",
  "#b98f78",
  "#9f9a63",
  "#c2a173",
  "#7fa18f",
  "#d0a85c",
  "#a7b86c",
  "#b47c5f"
] as const;

export const MAP_FEATURE_COLOR_PALETTE = [
  "#5f8f8a",
  "#6f7f68",
  "#8c7a52",
  "#5f6f8a",
  "#367aa2",
  "#5a5f66",
  "#5d8c4a",
  "#8b5c4a",
  "#8f9dad",
  "#7a6fb0",
  "#3f7a4f",
  "#b89655"
] as const;

export const BOUNDARY_KIND_COLORS: Record<string, string> = {
  county: "#7667b0",
  "incorporated-place": "#8d6aa8",
  "unincorporated-place": "#9a7ab4",
  "national-park": "#5f8f5c",
  "national-monument": "#7f8f5c",
  "national-forest": "#4f8a63",
  "national-wilderness": "#3f7f6b",
  "national-grassland": "#8da05a",
  "us-fish-wildlife-service": "#4f8f8a",
  "bureau-of-land-management": "#b09355"
};

export const STRUCTURE_KIND_COLORS: Record<string, string> = {
  cemetery: "#757575",
  "post-office": "#8b6f42",
  "city-town-hall": "#6c5a9e",
  courthouse: "#6c5a9e",
  "historic-site": "#9a7845",
  hospital: "#b84e58",
  "ambulance-service": "#b84e58",
  "fire-station": "#c4573d",
  "police-station": "#4f5f8a",
  "college-university": "#4c75a3",
  "technical-school": "#4c75a3",
  school: "#4c75a3",
  campground: "#5f8f5a",
  trailhead: "#6f8a4f",
  cabin: "#8b5f3d",
  shelter: "#8b6a4a",
  "picnic-area": "#9a8a4a",
  headquarters: "#6c5a9e",
  "visitor-center": "#5c8f8a",
  "ranger-station": "#4f7a55"
};

export const BUILDING_TYPE_COLORS: Record<string, string> = {
  school: "#4c75a3",
  university: "#4c75a3",
  college: "#4c75a3",
  hospital: "#b84e58",
  public: "#6c5a9e",
  civic: "#6c5a9e",
  commercial: "#8b7a50",
  retail: "#9a8050",
  industrial: "#6f7378",
  warehouse: "#6f7378",
  residential: "#8f9dad",
  house: "#9a8a78",
  cabin: "#8b5f3d",
  yes: "#8f9dad"
};

export const TRANSPORT_KIND_COLORS: Record<string, string> = {
  highway: "#4a4f56",
  "secondary-highway": "#5a5f66",
  "connecting-road": "#6a6f76",
  "local-road": "#7a7f86",
  ramp: "#8a8f96",
  trail: "#5f7a52"
};

export function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function getPaletteColorForKey(key: string, palette: readonly string[] = MAP_FEATURE_COLOR_PALETTE) {
  if (!key.trim()) {
    return "#8a8a8a";
  }

  return palette[hashString(key) % palette.length] ?? "#8a8a8a";
}

export function getSoilMapUnitColor(feature: Pick<VectorFeature, "attributes" | "label">) {
  const key =
    feature.attributes.musym ??
    feature.attributes.nationalmusym ??
    feature.attributes.mukey ??
    feature.label;

  return getPaletteColorForKey(String(key), SOIL_COLOR_PALETTE);
}

export function getBoundaryFeatureColor(feature: Pick<VectorFeature, "attributes">) {
  const layerKind = String(feature.attributes.layerKind ?? "");
  return BOUNDARY_KIND_COLORS[layerKind] ?? "#7a6fb0";
}

export function getStructureFeatureColor(feature: Pick<VectorFeature, "attributes">) {
  const layerKind = String(feature.attributes.layerKind ?? "");
  return STRUCTURE_KIND_COLORS[layerKind] ?? "#8b5c4a";
}

export function getBuildingFeatureColor(feature: Pick<VectorFeature, "attributes">) {
  const buildingType = String(feature.attributes.building ?? "yes");
  return BUILDING_TYPE_COLORS[buildingType] ?? "#8f9dad";
}

export function getTransportFeatureColor(feature: Pick<VectorFeature, "attributes">) {
  const layerKind = String(feature.attributes.layerKind ?? "");
  return TRANSPORT_KIND_COLORS[layerKind] ?? getPaletteColorForKey(layerKind || feature.attributes.highway || "road");
}

export function getHydroFeatureColor(feature: Pick<VectorFeature, "attributes" | "label">) {
  const key = feature.attributes.fcode ?? feature.attributes.ftype ?? feature.label;
  return getPaletteColorForKey(String(key), ["#2f7fb8", "#4aa3cf", "#367aa2", "#5f9fd6", "#1f6f98"]);
}

export function getContourFeatureColor(feature: Pick<VectorFeature, "attributes" | "label">) {
  const elevation = feature.attributes.elevation ?? feature.attributes.contourelevation;
  return getPaletteColorForKey(String(elevation ?? feature.label), ["#5f6f8a", "#6a7a94", "#7b8798"]);
}

export function resolveKnowledgeBankMaterialColor(layer: PlanningLayer, feature: VectorFeature) {
  const datasetId = getSafeDatasetId(layer.id);

  switch (datasetId) {
    case "soil":
      return getSoilMapUnitColor(feature);
    case "boundaries":
      return getBoundaryFeatureColor(feature);
    case "structures":
      return getStructureFeatureColor(feature);
    case "buildings":
      return getBuildingFeatureColor(feature);
    case "transportation":
      return getTransportFeatureColor(feature);
    case "hydrography":
      return getHydroFeatureColor(feature);
    case "usgs-contours":
      return getContourFeatureColor(feature);
    default: {
      const landCoverCode = feature.attributes.landCover ?? feature.attributes.class;
      const nlcdClass = landCoverCode ? getNlcdClassByCode(String(landCoverCode)) : undefined;
      if (nlcdClass) {
        return nlcdClass.color;
      }

      const legendMatch = layer.legend?.find((item) => item.label === feature.label);
      if (legendMatch?.color) {
        return legendMatch.color;
      }

      const paletteKey =
        feature.attributes.layerKind ??
        feature.attributes.fcode ??
        feature.attributes.highway ??
        feature.attributes.building ??
        `${datasetId}::${feature.label}`;

      return getPaletteColorForKey(String(paletteKey));
    }
  }
}

export function resolveRasterKnowledgeColor(layer: PlanningLayer, entryColor: string) {
  const datasetId = getSafeDatasetId(layer.id);
  if (datasetId === "dem-3dep") {
    return "#8c7a52";
  }
  if (datasetId === "naip-ortho") {
    return "#6f7f68";
  }

  return entryColor;
}

export function resolveTransportDisplayName(
  attributes: Record<string, string>,
  layerKind: string,
  fallbackLabel: string
) {
  if (attributes.name?.trim()) {
    return attributes.name.trim();
  }

  if (attributes.maplabel?.trim()) {
    return attributes.maplabel.trim();
  }

  if (attributes.us_route?.trim()) {
    return `US Route ${attributes.us_route.trim()}`;
  }

  if (attributes.state_route?.trim()) {
    return `State Route ${attributes.state_route.trim()}`;
  }

  if (layerKind) {
    return formatTransportKindLabel(layerKind);
  }

  return fallbackLabel;
}
