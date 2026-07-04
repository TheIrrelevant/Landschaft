/*
 * ---metadata---
 * type: package-source
 * description: Build knowledge-base spreadsheet rows from USGS, NAIP, and USDA map layers.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add national-map layer to knowledge-bank table and text export
 * ---end-metadata---
 */
import type { Coordinate, PlanningLayer, VectorFeature } from "./index.js";
import {
  formatBoundaryKindLabel,
  formatBuildingTypeLabel,
  formatStructureKindLabel,
  getNlcdClassesForLayer,
  getSafeDatasetId,
  lookupNhdFeatureName
} from "./nationalMapCatalog.js";
import {
  resolveKnowledgeBankMaterialColor,
  resolveRasterKnowledgeColor,
  resolveTransportDisplayName
} from "./mapFeatureColors.js";

export const KNOWLEDGE_BANK_BASE_HEADERS = [
  "Color",
  "Name",
  "Code",
  "Area (m²)",
  "Dataset",
  "Source",
  "Category"
] as const;

export const KNOWLEDGE_BANK_BASE_HEADER_KEYS = [
  "colorLabel",
  "name",
  "code",
  "area",
  "dataset",
  "source",
  "category"
] as const;

export interface KnowledgeBankRecord {
  materialColor: string;
  colorLabel: string;
  name: string;
  code: string;
  areaSquareMeters: number | null;
  dataset: string;
  source: string;
  category: string;
  extras: Record<string, string>;
}

export interface KnowledgeBankFromLayersResult {
  columnHeaders: string[];
  columnHeaderKeys: string[];
  rows: string[][];
  materialColors: string[];
  textSummary: string;
  recordCount: number;
  layerCount: number;
}

interface AggregatedRecord {
  materialColor: string;
  colorLabel: string;
  name: string;
  code: string;
  areaSquareMeters: number;
  dataset: string;
  source: string;
  category: string;
  extras: Record<string, string>;
}

export function isNationalMapKnowledgeLayer(layer: PlanningLayer) {
  if (layer.id.startsWith("safe-data-")) {
    return true;
  }

  const sourceName = layer.source?.sourceName ?? "";
  return /USGS|USDA|NAIP|NRCS|MRLC|NHD|TNM|NLCD/i.test(sourceName);
}

export function buildKnowledgeBankFromLayers(
  layers: PlanningLayer[]
): KnowledgeBankFromLayersResult {
  const nationalLayers = layers.filter(isNationalMapKnowledgeLayer);
  const records: KnowledgeBankRecord[] = [];

  for (const layer of nationalLayers) {
    records.push(...extractLayerKnowledgeRecords(layer));
  }

  const extraHeaderKeys = collectExtraHeaderKeys(records);
  const columnHeaderKeys = [...KNOWLEDGE_BANK_BASE_HEADER_KEYS, ...extraHeaderKeys];
  const columnHeaders = [
    ...KNOWLEDGE_BANK_BASE_HEADERS,
    ...extraHeaderKeys.map(formatAttributeHeader)
  ];

  const rows = records.map((record) =>
    columnHeaderKeys.map((key) => getRecordCellValue(record, key))
  );
  const materialColors = records.map((record) => record.materialColor);
  const textSummary = buildKnowledgeBankTextSummary(nationalLayers, records, columnHeaderKeys);

  return {
    columnHeaders,
    columnHeaderKeys,
    rows,
    materialColors,
    textSummary,
    recordCount: records.length,
    layerCount: nationalLayers.length
  };
}

function extractLayerKnowledgeRecords(layer: PlanningLayer): KnowledgeBankRecord[] {
  if (layer.features?.length) {
    return aggregateFeatureRecords(layer);
  }

  const nlcdClasses = getNlcdClassesForLayer(layer.id);
  if (nlcdClasses.length > 0) {
    return nlcdClasses.map((entry) => ({
      materialColor: resolveRasterKnowledgeColor(layer, entry.color),
      colorLabel: describeColor(entry.color),
      name: entry.name,
      code: entry.code,
      areaSquareMeters: null,
      dataset: layer.name,
      source: layer.source?.sourceName ?? "USGS The National Map / NAIP / USDA NRCS",
      category: layer.category ?? "dataset",
      extras: {
        geometry: "raster",
        landCover: entry.code
      }
    }));
  }

  if (layer.legend?.length) {
    return layer.legend.map((item, index) => ({
      materialColor: resolveRasterKnowledgeColor(layer, item.color),
      colorLabel: describeColor(item.color),
      name: item.label,
      code: abbreviateCode(item.label),
      areaSquareMeters: null,
      dataset: layer.name,
      source: layer.source?.sourceName ?? "USGS The National Map / NAIP / USDA NRCS",
      category: layer.category ?? "dataset",
      extras: {
        geometry: layer.geometryType ?? "raster",
        legendIndex: String(index + 1)
      }
    }));
  }

  return [
    {
      materialColor: resolveRasterKnowledgeColor(layer, layer.style?.fill ?? "#8a8a8a"),
      colorLabel: describeColor(layer.style?.fill ?? "#8a8a8a"),
      name: layer.name,
      code: abbreviateCode(layer.name),
      areaSquareMeters: null,
      dataset: layer.name,
      source: layer.source?.sourceName ?? "USGS The National Map / NAIP / USDA NRCS",
      category: layer.category ?? "dataset",
      extras: {
        geometry: layer.geometryType ?? "unknown"
      }
    }
  ];
}

function aggregateFeatureRecords(layer: PlanningLayer): KnowledgeBankRecord[] {
  const grouped = new Map<string, AggregatedRecord>();

  for (const feature of layer.features ?? []) {
    const key = getFeatureGroupKey(layer, feature);
    const materialColor = resolveKnowledgeBankMaterialColor(layer, feature);
    const area = feature.geometryType === "polygon" ? polygonAreaSquareMeters(feature.coordinates) : 0;
    const length = feature.geometryType === "line" ? lineLengthMeters(feature.coordinates) : 0;
    const code = deriveFeatureCode(layer, feature);
    const extras = pickFeatureExtras(feature.attributes, length);
    const existing = grouped.get(key);

    if (!existing) {
      grouped.set(key, {
        materialColor,
        colorLabel: describeColor(materialColor),
        name: resolveFeatureDisplayName(layer, feature),
        code,
        areaSquareMeters: area,
        dataset: layer.name,
        source: layer.source?.sourceName ?? feature.attributes.source ?? "USGS The National Map / NAIP / USDA NRCS",
        category: layer.category ?? "dataset",
        extras
      });
      continue;
    }

    existing.areaSquareMeters += area;
    if (length > 0) {
      const currentLength = Number.parseFloat(existing.extras.lengthM ?? "0");
      existing.extras.lengthM = String(Math.round(currentLength + length));
    }
    existing.extras = mergeExtras(existing.extras, extras);
    if (!existing.name && resolveFeatureDisplayName(layer, feature)) {
      existing.name = resolveFeatureDisplayName(layer, feature);
    }
  }

  return Array.from(grouped.values()).map((record) => ({
    materialColor: record.materialColor,
    colorLabel: record.colorLabel,
    name: record.name,
    code: record.code,
    areaSquareMeters: record.areaSquareMeters > 0 ? record.areaSquareMeters : null,
    dataset: record.dataset,
    source: record.source,
    category: record.category,
    extras: record.extras
  }));
}

function getFeatureGroupKey(layer: PlanningLayer, feature: VectorFeature) {
  const attributes = feature.attributes;
  const datasetId = getSafeDatasetId(layer.id);

  switch (datasetId) {
    case "soil":
      return attributes.musym ?? attributes.nationalmusym ?? attributes.mukey ?? feature.label;
    case "usgs-contours":
      return attributes.elevation ?? attributes.contourelevation ?? feature.label;
    case "hydrography":
      return attributes.fcode ?? attributes.gnis_name ?? feature.label;
    case "transportation":
      return `${attributes.layerKind ?? "road"}::${deriveFeatureCode(layer, feature)}`;
    case "boundaries":
      return `${attributes.layerKind ?? "boundary"}::${resolveFeatureDisplayName(layer, feature)}`;
    case "structures":
      return `${attributes.layerKind ?? "structure"}::${attributes.struct_name ?? attributes.name ?? feature.label}`;
    case "buildings":
      return attributes.building ?? attributes.name ?? feature.label;
    case "land-cover":
    case "woodland":
      return attributes.landCover ?? attributes.class ?? feature.label;
    default:
      if (layer.category === "ecology-vegetation") {
        return attributes.landCover ?? attributes.class ?? feature.label;
      }
      return `${deriveFeatureCode(layer, feature)}::${feature.label}`;
  }
}

function resolveFeatureDisplayName(layer: PlanningLayer, feature: VectorFeature) {
  const attributes = feature.attributes;
  const datasetId = getSafeDatasetId(layer.id);

  if (attributes.muname?.trim()) {
    return attributes.muname.trim();
  }

  if (datasetId === "hydrography") {
    const hydroName = lookupNhdFeatureName(attributes);
    if (hydroName) {
      return hydroName;
    }
  }

  if (datasetId === "transportation") {
    return resolveTransportDisplayName(
      attributes,
      attributes.layerKind ?? "",
      feature.label
    );
  }

  if (datasetId === "boundaries") {
    const placeName =
      attributes.name ??
      attributes.county_name ??
      attributes.incorp_name ??
      attributes.unit_name ??
      feature.label;
    const kindLabel = attributes.layerKind
      ? formatBoundaryKindLabel(attributes.layerKind)
      : "Boundary";
    return placeName && placeName !== kindLabel ? `${kindLabel}: ${placeName}` : kindLabel;
  }

  if (datasetId === "structures") {
    const structureName =
      attributes.struct_name ?? attributes.feature_name ?? attributes.name ?? feature.label;
    const kindLabel = attributes.layerKind
      ? formatStructureKindLabel(attributes.layerKind)
      : "Structure";
    return structureName && structureName !== kindLabel
      ? `${kindLabel}: ${structureName}`
      : kindLabel;
  }

  if (datasetId === "buildings") {
    const buildingName = attributes.name ?? attributes.building ?? feature.label;
    return attributes.building
      ? `${formatBuildingTypeLabel(attributes.building)}${buildingName ? `: ${buildingName}` : ""}`
      : buildingName;
  }

  if (datasetId === "usgs-contours") {
    const elevation = attributes.elevation ?? attributes.contourelevation;
    return elevation ? `Contour ${elevation} m` : feature.label;
  }

  if (attributes.gnis_name?.trim()) {
    return attributes.gnis_name.trim();
  }

  if (attributes.name?.trim()) {
    return attributes.name.trim();
  }

  const nlcdClass = attributes.landCover ?? attributes.class;
  if (nlcdClass) {
    const match = getNlcdClassesForLayer(layer.id).find((entry) => entry.code === nlcdClass);
    if (match) {
      return match.name;
    }
  }

  return feature.label;
}

function deriveFeatureCode(layer: PlanningLayer, feature: VectorFeature) {
  const attributes = feature.attributes;
  const datasetId = getSafeDatasetId(layer.id);

  if (datasetId === "soil") {
    return attributes.musym ?? attributes.nationalmusym ?? abbreviateCode(feature.label);
  }

  if (datasetId === "usgs-contours") {
    const elevation = attributes.elevation ?? attributes.contourelevation;
    return elevation ? `EL${elevation}` : abbreviateCode(feature.label);
  }

  if (datasetId === "hydrography" && attributes.fcode) {
    return attributes.fcode;
  }

  if (datasetId === "transportation") {
    return attributes.highway ?? attributes.layerKind ?? abbreviateCode(feature.label);
  }

  if (datasetId === "boundaries" || datasetId === "structures") {
    return attributes.layerKind ?? abbreviateCode(feature.label);
  }

  if (datasetId === "buildings") {
    return attributes.building ?? abbreviateCode(feature.label);
  }

  if (attributes.fcode) {
    return attributes.fcode;
  }

  if (attributes.landCover ?? attributes.class) {
    return String(attributes.landCover ?? attributes.class);
  }

  return abbreviateCode(feature.label);
}

function pickFeatureExtras(attributes: Record<string, string>, lengthMeters = 0) {
  const extras: Record<string, string> = {};
  const skip = new Set(["source", "muname"]);

  for (const [key, value] of Object.entries(attributes)) {
    if (skip.has(key) || !value.trim()) {
      continue;
    }

    extras[key] = value;
  }

  if (lengthMeters > 0) {
    extras.lengthM = String(Math.round(lengthMeters));
  }

  return extras;
}

function mergeExtras(left: Record<string, string>, right: Record<string, string>) {
  const merged = { ...left };

  for (const [key, value] of Object.entries(right)) {
    if (!merged[key]) {
      merged[key] = value;
      continue;
    }

    if (merged[key] !== value && !merged[key].includes(value)) {
      merged[key] = `${merged[key]}; ${value}`;
    }
  }

  return merged;
}

function collectExtraHeaderKeys(records: KnowledgeBankRecord[]) {
  const keys = new Set<string>();

  for (const record of records) {
    for (const key of Object.keys(record.extras)) {
      keys.add(key);
    }
  }

  return Array.from(keys).sort((left, right) => left.localeCompare(right));
}

function getRecordCellValue(record: KnowledgeBankRecord, key: string) {
  if (key === "colorLabel") {
    return record.colorLabel;
  }

  if (key === "name") {
    return record.name;
  }

  if (key === "code") {
    return record.code;
  }

  if (key === "area") {
    return record.areaSquareMeters == null ? "" : `${Math.round(record.areaSquareMeters)}`;
  }

  if (key === "dataset") {
    return record.dataset;
  }

  if (key === "source") {
    return record.source;
  }

  if (key === "category") {
    return record.category;
  }

  return record.extras[key] ?? "";
}

function buildKnowledgeBankTextSummary(
  layers: PlanningLayer[],
  records: KnowledgeBankRecord[],
  columnHeaderKeys: string[]
) {
  if (!records.length) {
    return "No USGS / NAIP / USDA NRCS map data is available in the current project.";
  }

  const lines: string[] = [
    "Knowledge base export from USGS The National Map / NAIP / USDA NRCS datasets.",
    `Layers: ${layers.map((layer) => layer.name).join(", ")}`,
    ""
  ];

  for (const record of records) {
    const values = columnHeaderKeys.map((key) => getRecordCellValue(record, key));
    lines.push(values.filter(Boolean).join(" ----- "));
  }

  return lines.join("\n");
}

export function polygonAreaSquareMeters(coordinates: Coordinate[]) {
  if (coordinates.length < 3) {
    return 0;
  }

  let sum = 0;
  for (let index = 0; index < coordinates.length; index += 1) {
    const [x1, y1] = coordinates[index] ?? [0, 0];
    const [x2, y2] = coordinates[(index + 1) % coordinates.length] ?? [0, 0];
    sum += x1 * y2 - x2 * y1;
  }

  return Math.abs(sum / 2);
}

export function lineLengthMeters(coordinates: Coordinate[]) {
  if (coordinates.length < 2) {
    return 0;
  }

  let length = 0;
  for (let index = 1; index < coordinates.length; index += 1) {
    const [x1, y1] = coordinates[index - 1] ?? [0, 0];
    const [x2, y2] = coordinates[index] ?? [0, 0];
    length += Math.hypot(x2 - x1, y2 - y1);
  }

  return length;
}

export function abbreviateCode(label: string) {
  const words = label.trim().split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return words
      .map((word) => word[0]?.toUpperCase() ?? "")
      .join("")
      .slice(0, 4);
  }

  return label.slice(0, 2).toUpperCase();
}

export function describeColor(hex: string) {
  const normalized = hex.replace("#", "").trim();
  if (normalized.length !== 6) {
    return hex;
  }

  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);

  if (red > 180 && green < 110 && blue < 110) {
    return "Red";
  }

  if (green > red + 20 && green > blue + 20) {
    return "Green";
  }

  if (red > 150 && green > 110 && blue < 100) {
    return "Brown";
  }

  if (red > 180 && green > 150 && blue < 130) {
    return "Tan";
  }

  if (blue > red + 20 && blue > green + 20) {
    return "Blue";
  }

  if (red < 90 && green < 90 && blue < 90) {
    return "Dark gray";
  }

  if (red > 200 && green > 200 && blue > 200) {
    return "Light gray";
  }

  return hex;
}

function formatAttributeHeader(key: string) {
  return key
    .replace(/_/g, " ")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/\b\w/g, (character) => character.toUpperCase());
}
