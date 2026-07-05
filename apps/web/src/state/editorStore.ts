/*
 * ---metadata---
 * type: app-source
 * description: Zustand store for Landschaft editor layers and selected area state.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: disable auto-opening inspector drawer on selection
 * ---end-metadata---
 */
import {
  buildMapEvidence,
  createCodedLandscapeUnitLayerFromEvidence,
  createLcaLayerFromDraft,
  applySafeDatasetLayerStack,
  buildKnowledgeBankFromLayers,
  enrichLayersForKnowledgeBank,
  generateMockLcaDraft,
  getSafeDatasetDefaultOpacity,
  parseKnowledgeBankRows,
  LCA_DEFAULT_OLLAMA_MODEL,
  LCA_LLM_PROVIDER,
  LCA_OLLAMA_ANALYSIS_ENABLED,
  LCA_OLLAMA_ANALYSIS_PAUSED_MESSAGE,
  type LcaAnalysisMode,
  type LcaOutputQuality,
  getDefaultLcaInputLayerIds,
  createProjectFitRasterGeoreference,
  generateTerrainProject,
  generateTerrainProjectAsync,
  ProjectSnapshotSchema,
  type CodedArea,
  type KnowledgeBankEntry,
  type LcaDraftAnalysisResult,
  type OrthophotoCorner,
  type PlanningLayer,
  type ProjectMetadata,
  type ProjectSnapshot,
  type RasterGeoreference,
  type ReviewStatus,
  type TerrainGenerationRequest,
  type TerrainHeightSource,
  type TerrainModel,
  type VectorFeature
} from "@landschaft/shared";
import { create } from "zustand";
import {
  createEmptyKnowledgeBankSheet,
  normalizeKnowledgeBankSheet,
  sheetFromKnowledgeBankLayers,
  updateSheetCell,
  type KnowledgeBankSheetSnapshot
} from "../ui/knowledgeBankSheet";
import {
  clipVectorFeaturesToExtent,
  createRasterGeoreferenceFromWorldFile,
  exportLayerAsGeoJson,
  parseWorldFile,
  snapCoordinate
} from "../geo/projectGeometry";
import {
  clearProjectSnapshot,
  loadKnowledgeBankSheetFromPersistence,
  loadKnowledgeBankSheetLegacySync,
  loadProjectSnapshotFromPersistence,
  loadProjectSnapshotLegacySync,
  saveKnowledgeBankSheet,
  saveProjectSnapshot
} from "./projectPersistence";

type EditorMode = "top-view" | "terrain-3d";
type EditorWorkflowMode = "design" | "lca-analysis";
type SafeDatasetId =
  | "naip-ortho"
  | "dem-3dep"
  | "usgs-contours"
  | "hydrography"
  | "transportation"
  | "soil"
  | "land-cover"
  | "structures"
  | "buildings"
  | "boundaries"
  | "woodland";
type SafeDatasetImportStatus = "idle" | "ready" | "importing" | "complete" | "error";
const safeDatasetBridgeUrl =
  import.meta.env.VITE_LANDSCHAFT_MCP_HTTP_URL ?? "http://127.0.0.1:8787";

interface SafeDatasetLocation {
  id: string;
  name: string;
  region: string;
  country: "USA";
  bbox: {
    west: number;
    south: number;
    east: number;
    north: number;
  };
  targetCrs: string;
  dataSource: string;
  datasets: SafeDatasetId[];
}

interface SafeDatasetBackendImportResult {
  project: ProjectMetadata;
  terrain: TerrainModel;
  layers: PlanningLayer[];
  assets?: {
    datasetId: SafeDatasetId;
    publicPath: string;
    bytes: number;
  }[];
  status: "imported";
}

interface LcaBackendAnalysisResult {
  status: "analysis-ready";
  analysis: LcaDraftAnalysisResult;
  layer: PlanningLayer;
}

interface LcaRunLogEntry {
  id: string;
  elapsedMs: number;
  level: "info" | "success" | "warning" | "error";
  message: string;
  detail?: string;
}

type EditorPersistedState = Pick<
  EditorState,
  | "coordinateStep"
  | "layers"
  | "project"
  | "orthophotoPreviewUrl"
  | "selectedFeatureId"
  | "selectedLayerId"
  | "terrain"
  | "terrainGenerated"
>;

interface EditorState {
  layers: PlanningLayer[];
  project: ProjectMetadata;
  terrain: TerrainModel;
  terrainGenerated: boolean;
  terrainGenerating: boolean;
  terrainGenerationError: string | null;
  terrainHeightSource: TerrainHeightSource;
  safeDatasetLocations: SafeDatasetLocation[];
  safeDatasetLocationId: string | null;
  safeDatasetSearchQuery: string;
  safeDatasetSelectedIds: SafeDatasetId[];
  safeDatasetImportStatus: SafeDatasetImportStatus;
  safeDatasetImportMessage: string | null;
  orthophotoPreviewUrl: string | null;
  hoveredFeatureId: string | null;
  hoveredLayerId: string | null;
  selectedArea: CodedArea | null;
  selectedFeatureId: string | null;
  selectedLayerId: string | null;
  selectedVertexIndex: number | null;
  snapEnabled: boolean;
  lcaPurpose: string;
  lcaSelectedLayerIds: string[];
  lcaAnalyzing: boolean;
  lcaAnalysisError: string | null;
  lcaRunLogs: LcaRunLogEntry[];
  workflowMode: EditorWorkflowMode;
  lcaAnalysisMode: LcaAnalysisMode;
  lcaOutputQuality: LcaOutputQuality;
  lcaProvider: typeof LCA_LLM_PROVIDER;
  lcaModel: string;
  lcaAvailableModels: string[];
  lcaModelsLoading: boolean;
  lcaModelsError: string | null;
  knowledgeBaseOpen: boolean;
  knowledgeBankGrid: string[][];
  knowledgeBankColumnWidths: number[];
  knowledgeBankRowHeights: number[];
  knowledgeBankColumnHeaders: string[];
  knowledgeBankMaterialColors: string[];
  knowledgeBankTextSummary: string;
  knowledgeBankImportMessage: string | null;
  coordinateStep: number | null;
  inspectorOpen: boolean;
  activeMode: EditorMode;
  /** "fit" auto-scales the terrain into the scene; "1:1" shows true metres. */
  viewScaleMode: "fit" | "1:1";
  addDrawingFeature: (geometryType: VectorFeature["geometryType"]) => void;
  importGeoJsonLayer: (fileName: string, fileText: string) => void;
  importKmlLayer: (fileName: string, fileText: string) => void;
  importRasterOverlay: (
    fileName: string,
    previewUrl: string,
    options?: {
      worldFileText?: string;
      rasterGeoreference?: RasterGeoreference;
      imageWidthPixels: number;
      imageHeightPixels: number;
    }
  ) => void;
  importSampleRasterLayer: () => void;
  importSampleVectorLayer: () => void;
  setViewScaleMode: (mode: EditorState["viewScaleMode"]) => void;
  advanceCoordinateStep: () => void;
  closeInspector: () => void;
  deleteLayer: (layerId: string) => void;
  deleteSelectedFeature: () => void;
  duplicateSelectedFeature: () => void;
  generateTerrain: () => Promise<void>;
  moveSelectedFeature: (deltaX: number, deltaY: number) => void;
  moveSelectedVertex: (deltaX: number, deltaY: number) => void;
  splitSelectedFeatureAtVertex: (vertexIndex: number) => void;
  mergeSelectedFeatureWithNext: () => void;
  exportSelectedLayerGeoJson: () => void;
  setSnapEnabled: (enabled: boolean) => void;
  selectFeatureVertex: (vertexIndex: number | null) => void;
  setLcaPurpose: (purpose: string) => void;
  toggleLcaInputLayer: (layerId: string) => void;
  enterLcaAnalysisMode: () => void;
  exitLcaAnalysisMode: () => void;
  openKnowledgeBase: () => void;
  closeKnowledgeBase: () => void;
  importKnowledgeBankSheet: (fileName: string, grid: string[][]) => void;
  syncKnowledgeBankFromLayers: () => Promise<void>;
  setKnowledgeBankCell: (row: number, col: number, value: string) => void;
  setKnowledgeBankColumnWidth: (col: number, width: number) => void;
  setKnowledgeBankRowHeight: (row: number, height: number) => void;
  setLcaAnalysisMode: (mode: LcaAnalysisMode) => void;
  setLcaOutputQuality: (quality: LcaOutputQuality) => void;
  setLcaModel: (model: string) => void;
  fetchLcaModels: () => Promise<void>;
  runLcaDraftAnalysis: () => Promise<void>;
  setSelectedFeatureReviewStatus: (reviewStatus: ReviewStatus) => void;
  setSelectedLayerReviewStatus: (reviewStatus: ReviewStatus) => void;
  reorderLayer: (sourceLayerId: string, targetLayerId: string) => void;
  setHoveredFeature: (layerId: string | null, featureId: string | null) => void;
  setCornerCoordinate: (
    label: OrthophotoCorner["label"],
    axis: "latitude" | "longitude",
    value: number
  ) => void;
  selectArea: (area: CodedArea | null) => void;
  selectFeature: (featureId: string) => void;
  selectFeatureInLayer: (layerId: string, featureId: string) => void;
  selectLayer: (layerId: string) => void;
  setMode: (mode: EditorMode) => void;
  setTerrainHeightSource: (heightSource: TerrainHeightSource) => void;
  selectSafeDatasetLocation: (locationId: string) => void;
  setSafeDatasetSearchQuery: (query: string) => void;
  startSafeDatasetImport: () => Promise<void>;
  toggleSafeDataset: (datasetId: SafeDatasetId) => void;
  setOrthophotoPreview: (fileName: string, previewUrl: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  toggleLayer: (layerId: string) => void;
}

const safeDatasetCatalog: Record<
  SafeDatasetId,
  { label: string; provider: string; category: PlanningLayer["category"] }
> = {
  "naip-ortho": {
    label: "NAIP orthophoto",
    provider: "USGS NAIP ImageServer",
    category: "land-use-settlement"
  },
  "dem-3dep": {
    label: "3DEP DEM",
    provider: "USGS 3D Elevation Program",
    category: "geomorphology"
  },
  "usgs-contours": {
    label: "USGS contours",
    provider: "USGS National Map Contours",
    category: "geomorphology"
  },
  hydrography: {
    label: "Hydrography",
    provider: "USGS National Hydrography Dataset",
    category: "hydrology"
  },
  transportation: {
    label: "Transportation",
    provider: "USGS National Map Transportation",
    category: "infrastructure-utilities"
  },
  soil: {
    label: "USDA soils",
    provider: "USDA NRCS Soil Data Access",
    category: "soil"
  },
  "land-cover": {
    label: "NLCD land cover",
    provider: "USGS MRLC NLCD",
    category: "ecology-vegetation"
  },
  structures: {
    label: "Structures",
    provider: "USGS National Structures Dataset",
    category: "infrastructure-utilities"
  },
  buildings: {
    label: "Buildings",
    provider: "OpenStreetMap Overpass API",
    category: "land-use-settlement"
  },
  boundaries: {
    label: "Boundaries",
    provider: "USGS National Boundary Dataset",
    category: "land-use-settlement"
  },
  woodland: {
    label: "Woodland",
    provider: "USGS Woodland Tint / USGS Topo",
    category: "ecology-vegetation"
  }
};

const safeDatasetLocations: SafeDatasetLocation[] = [
  {
    id: "boulder-flatirons-co",
    name: "Boulder Flatirons",
    region: "Colorado",
    country: "USA",
    bbox: {
      west: -105.306,
      south: 39.985,
      east: -105.252,
      north: 40.028
    },
    targetCrs: "EPSG:26913",
    dataSource: "USGS The National Map / NAIP / USDA NRCS",
    datasets: [
      "naip-ortho",
      "dem-3dep",
      "usgs-contours",
      "hydrography",
      "transportation",
      "soil",
      "land-cover",
      "structures",
      "buildings",
      "boundaries",
      "woodland"
    ]
  }
];

const defaultCorners: OrthophotoCorner[] = [
  { label: "NW", latitude: 41.0312, longitude: 29.0141 },
  { label: "NE", latitude: 41.0312, longitude: 29.0194 },
  { label: "SE", latitude: 41.0271, longitude: 29.0194 },
  { label: "SW", latitude: 41.0271, longitude: 29.0141 }
];

const baseTerrainRequest: TerrainGenerationRequest = {
  projectId: "project-demo",
  projectName: "Untitled Terrain Project",
  coordinateReferenceSystem: "EPSG:4326",
  corners: defaultCorners,
  quality: "balanced",
  heightSource: "sample-external-dem"
};

const initialTerrainProject = generateTerrainProject(baseTerrainRequest);
export function canDeleteLayer(layer: PlanningLayer) {
  return Boolean(layer.id);
}

function createProject(corners: OrthophotoCorner[], sourceImageName?: string) {
  return generateTerrainProject({
    ...baseTerrainRequest,
    sourceImageName,
    corners
  }).project;
}

function createOrthophotoLayer(): PlanningLayer {
  return {
    id: "orthophoto-base",
    name: "Orthophoto Base",
    kind: "orthophoto",
    visible: true,
    opacity: 1,
    reviewStatus: "draft"
  };
}

function createSampleSoilVectorLayer(project: ProjectMetadata): PlanningLayer {
  const { width, depth } = project.realWorldExtentMeters;

  return {
    id: "soil-drainage-vector",
    name: "Soil Drainage Zones",
    kind: "foundational-map",
    visible: true,
    opacity: 0.72,
    reviewStatus: "draft",
    category: "soil",
    geometryType: "polygon",
    source: {
      sourceName: "Sample project GeoJSON import",
      sourceType: "user-upload",
      sourceDate: "2026-06-28",
      coordinateReferenceSystem: project.coordinateReferenceSystem,
      accuracyStatus: "manual",
      confidence: 0.68
    },
    style: {
      stroke: "#2f6f4e",
      fill: "#80b874",
      strokeWidth: 2
    },
    legend: [
      { label: "Well drained planting soil", color: "#80b874" },
      { label: "Poor drainage review zone", color: "#d8b35a" }
    ],
    features: [
      {
        id: "soil-zone-a",
        label: "North planting soil",
        geometryType: "polygon",
        coordinates: [
          [width * 0.12, depth * 0.14],
          [width * 0.58, depth * 0.12],
          [width * 0.64, depth * 0.48],
          [width * 0.2, depth * 0.54],
          [width * 0.12, depth * 0.14]
        ],
        attributes: {
          soil: "Loam",
          drainage: "Moderate",
          suitability: "Planting bed and meadow"
        },
        planningImpact:
          "Supports planting areas with moderate soil improvement and erosion cover."
      },
      {
        id: "soil-zone-b",
        label: "Low drainage pocket",
        geometryType: "polygon",
        coordinates: [
          [width * 0.52, depth * 0.5],
          [width * 0.88, depth * 0.46],
          [width * 0.82, depth * 0.82],
          [width * 0.48, depth * 0.76],
          [width * 0.52, depth * 0.5]
        ],
        attributes: {
          soil: "Clay loam",
          drainage: "Poor",
          suitability: "Rain garden or drainage review"
        },
        planningImpact:
          "Avoid compacted hardscape without subdrainage; consider water-sensitive planting."
      }
    ],
    planningImpactNotes: [
      "Planting strategy should respond to drainage classes.",
      "Poor drainage zones need review before paving or lawn design."
    ],
    locked: false
  };
}

function createSampleHydrologyRasterLayer(project: ProjectMetadata): PlanningLayer {
  return {
    id: "hydrology-flow-raster",
    name: "Hydrology Flow Overlay",
    kind: "foundational-map",
    visible: true,
    opacity: 0.46,
    reviewStatus: "draft",
    category: "hydrology",
    geometryType: "raster",
    source: {
      sourceName: "Sample clipped raster overlay",
      sourceType: "user-upload",
      sourceDate: "2026-06-28",
      coordinateReferenceSystem: project.coordinateReferenceSystem,
      accuracyStatus: "conceptual",
      confidence: 0.56
    },
    style: {
      stroke: "#246a91",
      fill: "#4aa3cf",
      strokeWidth: 1
    },
    legend: [
      { label: "Likely surface flow", color: "#4aa3cf" },
      { label: "Retention opportunity", color: "#1f6f8f" }
    ],
    planningImpactNotes: [
      "Use as an early drainage guide only.",
      "Confirm flow paths with survey and field observation."
    ],
    locked: false
  };
}

function createImportedRasterLayer(
  project: ProjectMetadata,
  fileName: string,
  previewUrl: string,
  rasterGeoreference: RasterGeoreference
): PlanningLayer {
  return {
    id: createLayerId(fileName, "raster"),
    name: cleanLayerName(fileName),
    kind: "foundational-map",
    visible: true,
    opacity: 0.58,
    reviewStatus: "draft",
    category: "risk-suitability",
    geometryType: "raster",
    source: {
      sourceName: fileName,
      sourceType: "user-upload",
      sourceDate: new Date().toISOString().slice(0, 10),
      coordinateReferenceSystem: project.coordinateReferenceSystem,
      accuracyStatus: rasterGeoreference.parsedFrom === "world-file" ? "survey-grade" : "manual",
      confidence: rasterGeoreference.parsedFrom === "world-file" ? 0.78 : 0.5
    },
    style: {
      stroke: "#7a5c9d",
      fill: "#7a5c9d",
      strokeWidth: 1
    },
    legend: [{ label: "Uploaded raster overlay", color: "#7a5c9d" }],
    rasterPreviewUrl: previewUrl,
    rasterGeoreference,
    planningImpactNotes: [
      rasterGeoreference.parsedFrom === "world-file"
        ? "Raster placement uses parsed world-file georeference metadata."
        : "Raster overlays stretch to project extent until georeferencing metadata is provided."
    ],
    locked: false
  };
}

function createImportedGeoJsonLayer(
  project: ProjectMetadata,
  fileName: string,
  fileText: string
): PlanningLayer {
  const payload = JSON.parse(fileText) as GeoJsonPayload;
  const features = clipVectorFeaturesToExtent(
    normalizeGeoJsonFeatures(payload, project),
    project
  );
  if (features.length === 0) {
    throw new Error("GeoJSON did not contain supported point, line, or polygon features.");
  }

  return {
    id: createLayerId(fileName, "geojson"),
    name: cleanLayerName(fileName),
    kind: "foundational-map",
    visible: true,
    opacity: 0.7,
    reviewStatus: "draft",
    category: "designer-created",
    geometryType: inferLayerGeometryType(features),
    source: {
      sourceName: fileName,
      sourceType: "user-upload",
      sourceDate: new Date().toISOString().slice(0, 10),
      coordinateReferenceSystem: project.coordinateReferenceSystem,
      accuracyStatus: "manual",
      confidence: 0.72
    },
    style: {
      stroke: "#6f4a2f",
      fill: "#c78a47",
      strokeWidth: 2
    },
    legend: [{ label: "Imported GeoJSON feature", color: "#c78a47" }],
    features,
    planningImpactNotes: [
      "Imported coordinates are normalized into the project coordinate model."
    ],
    locked: false
  };
}

function createImportedKmlLayer(
  project: ProjectMetadata,
  fileName: string,
  fileText: string
): PlanningLayer {
  const features = clipVectorFeaturesToExtent(
    normalizeKmlFeatures(fileText, project),
    project
  );
  if (features.length === 0) {
    throw new Error("KML did not contain supported placemark geometries.");
  }

  return {
    id: createLayerId(fileName, "kml"),
    name: cleanLayerName(fileName),
    kind: "foundational-map",
    visible: true,
    opacity: 0.7,
    reviewStatus: "draft",
    category: "designer-created",
    geometryType: inferLayerGeometryType(features),
    source: {
      sourceName: fileName,
      sourceType: "user-upload",
      sourceDate: new Date().toISOString().slice(0, 10),
      coordinateReferenceSystem: project.coordinateReferenceSystem,
      accuracyStatus: "manual",
      confidence: 0.68
    },
    style: {
      stroke: "#4d6f2f",
      fill: "#92ad55",
      strokeWidth: 2
    },
    legend: [{ label: "Imported KML placemark", color: "#92ad55" }],
    features,
    planningImpactNotes: [
      "Imported KML placemarks are normalized into the project coordinate model."
    ],
    locked: false
  };
}

function createDesignerDrawingLayer(project: ProjectMetadata): PlanningLayer {
  return {
    id: "designer-vector-drawings",
    name: "Designer Vector Drawings",
    kind: "foundational-map",
    visible: true,
    opacity: 0.88,
    reviewStatus: "draft",
    category: "designer-created",
    geometryType: "mixed",
    source: {
      sourceName: "Designer-created project vectors",
      sourceType: "manual",
      sourceDate: new Date().toISOString().slice(0, 10),
      coordinateReferenceSystem: project.coordinateReferenceSystem,
      accuracyStatus: "manual",
      confidence: 0.76
    },
    style: {
      stroke: "#b65f2a",
      fill: "#d9965b",
      strokeWidth: 2
    },
    legend: [{ label: "Editable project vector", color: "#d9965b" }],
    features: [],
    planningImpactNotes: [
      "Designer-created vectors remain coordinate-based project data."
    ],
    locked: false
  };
}

function createDrawingFeature(
  project: ProjectMetadata,
  geometryType: VectorFeature["geometryType"],
  featureIndex: number
): VectorFeature {
  const { width, depth } = project.realWorldExtentMeters;
  const offset = Math.min(featureIndex * 0.035, 0.22);
  const coordinatesByType: Record<VectorFeature["geometryType"], [number, number][]> = {
    point: [[width * (0.5 + offset), depth * 0.5]],
    line: [
      [width * (0.24 + offset), depth * 0.62],
      [width * (0.45 + offset), depth * 0.48],
      [width * (0.68 + offset), depth * 0.58]
    ],
    polygon: [
      [width * (0.36 + offset), depth * 0.28],
      [width * (0.56 + offset), depth * 0.3],
      [width * (0.6 + offset), depth * 0.46],
      [width * (0.4 + offset), depth * 0.48],
      [width * (0.36 + offset), depth * 0.28]
    ]
  };

  return {
    id: `designer-${geometryType}-${Date.now()}`,
    label: `New ${formatFeatureType(geometryType)} ${featureIndex + 1}`,
    geometryType,
    coordinates: coordinatesByType[geometryType],
    attributes: {
      status: "Draft",
      source: "Manual drawing",
      geometry: geometryType
    },
    planningImpact:
      "Draft vector feature ready for later vertex editing, measurement, and export."
  };
}

function insertOrReplaceLayer(layers: PlanningLayer[], nextLayer: PlanningLayer) {
  const existingIndex = layers.findIndex((layer) => layer.id === nextLayer.id);
  if (existingIndex >= 0) {
    return layers.map((layer) => (layer.id === nextLayer.id ? nextLayer : layer));
  }

  const terrainIndex = layers.findIndex((layer) => layer.id === "terrain-mesh");
  const insertIndex = terrainIndex >= 0 ? terrainIndex : layers.length;
  const nextLayers = [...layers];
  nextLayers.splice(insertIndex, 0, nextLayer);
  return nextLayers;
}

function getSafeDatasetLocation(locationId: string | null) {
  return (
    safeDatasetLocations.find((location) => location.id === locationId) ??
    safeDatasetLocations[0]
  );
}

function getCornersFromSafeLocation(
  location: SafeDatasetLocation
): OrthophotoCorner[] {
  return [
    { label: "NW", latitude: location.bbox.north, longitude: location.bbox.west },
    { label: "NE", latitude: location.bbox.north, longitude: location.bbox.east },
    { label: "SE", latitude: location.bbox.south, longitude: location.bbox.east },
    { label: "SW", latitude: location.bbox.south, longitude: location.bbox.west }
  ];
}

function createSafeDatasetLayers(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  datasetIds: SafeDatasetId[]
): PlanningLayer[] {
  return applySafeDatasetLayerStack(
    datasetIds.map((datasetId) => {
    const dataset = safeDatasetCatalog[datasetId];
    return {
      id: `safe-data-${datasetId}`,
      name: dataset.label,
      kind: datasetId === "naip-ortho" ? "orthophoto" : "foundational-map",
      visible: true,
      opacity: getDefaultSafeDatasetOpacity(datasetId),
      reviewStatus: "draft",
      category: dataset.category,
      geometryType: isSafeDatasetRaster(datasetId)
        ? "raster"
        : datasetId === "usgs-contours" || datasetId === "transportation"
        ? "line"
        : datasetId === "soil" || datasetId === "boundaries"
        ? "polygon"
        : datasetId === "buildings"
        ? "polygon"
        : datasetId === "structures"
        ? "point"
        : "mixed",
      source: {
        sourceName: `${dataset.provider} / ${location.name}`,
        sourceType: "external-api",
        sourceDate: new Date().toISOString().slice(0, 10),
        coordinateReferenceSystem: project.coordinateReferenceSystem,
        accuracyStatus: "public-dataset",
        confidence: 0.86
      },
      style: {
        stroke: getSafeDatasetColor(datasetId),
        fill: getSafeDatasetColor(datasetId),
        strokeWidth: datasetId === "transportation" ? 2 : 1.5
      },
      legend: [{ label: dataset.label, color: getSafeDatasetColor(datasetId) }],
      planningImpactNotes: [
        "Queued for MCP-backed provider import.",
        `AOI: ${location.name}, ${location.region}.`,
        `Target processing CRS: ${location.targetCrs}.`
      ],
      locked: true
    };
  })
  );
}

function getSafeDatasetColor(datasetId: SafeDatasetId) {
  switch (datasetId) {
    case "naip-ortho":
      return "#6f7f68";
    case "dem-3dep":
      return "#8c7a52";
    case "usgs-contours":
      return "#5f6f8a";
    case "hydrography":
      return "#367aa2";
    case "transportation":
      return "#5a5f66";
    case "soil":
      return "#b89655";
    case "land-cover":
      return "#5d8c4a";
    case "structures":
      return "#8b5c4a";
    case "buildings":
      return "#8f9dad";
    case "boundaries":
      return "#7a6fb0";
    case "woodland":
      return "#3f7a4f";
    default:
      return "#68706a";
  }
}

function isSafeDatasetRaster(datasetId: SafeDatasetId) {
  return (
    datasetId === "naip-ortho" ||
    datasetId === "dem-3dep" ||
    datasetId === "land-cover" ||
    datasetId === "woodland"
  );
}

function getDefaultSafeDatasetOpacity(datasetId: SafeDatasetId) {
  return getSafeDatasetDefaultOpacity(datasetId);
}

function createTerrainRequest(
  project: ProjectMetadata,
  heightSource: TerrainHeightSource
): TerrainGenerationRequest {
  return {
    projectId: project.id,
    projectName: project.name,
    coordinateReferenceSystem: project.coordinateReferenceSystem,
    sourceImageName: project.sourceImageName,
    corners: project.corners,
    quality: heightSource === "usgs-contours" ? "detailed" : "fast-preview",
    heightSource
  };
}

function normalizeStoredKnowledgeBankSheet(
  parsed: Partial<KnowledgeBankSheetSnapshot> | null
): KnowledgeBankSheetSnapshot {
  if (!parsed || !Array.isArray(parsed.rows)) {
    return createEmptyKnowledgeBankSheet();
  }

  return normalizeKnowledgeBankSheet(
    parsed.rows,
    Array.isArray(parsed.columnWidths) ? parsed.columnWidths : [],
    Array.isArray(parsed.rowHeights) ? parsed.rowHeights : [],
    {
      columnHeaders: Array.isArray(parsed.columnHeaders) ? parsed.columnHeaders : undefined,
      materialColors: Array.isArray(parsed.materialColors) ? parsed.materialColors : undefined,
      textSummary: typeof parsed.textSummary === "string" ? parsed.textSummary : undefined
    }
  );
}

function loadKnowledgeBankSheet(): KnowledgeBankSheetSnapshot {
  const legacySheet = loadKnowledgeBankSheetLegacySync();
  return normalizeStoredKnowledgeBankSheet(legacySheet);
}

function applyKnowledgeBankSheetToState(sheet: KnowledgeBankSheetSnapshot) {
  saveKnowledgeBankSheet(sheet);
  return {
    knowledgeBankGrid: sheet.rows,
    knowledgeBankColumnWidths: sheet.columnWidths,
    knowledgeBankRowHeights: sheet.rowHeights,
    knowledgeBankColumnHeaders: sheet.columnHeaders ?? [],
    knowledgeBankMaterialColors: sheet.materialColors ?? [],
    knowledgeBankTextSummary: sheet.textSummary ?? ""
  };
}

function countFilledSheetRows(rows: string[][]) {
  return rows.filter((row) => row.some((cell) => cell.trim())).length;
}

function extractImportedKnowledgeBankEntries(
  sheet: KnowledgeBankSheetSnapshot
): KnowledgeBankEntry[] {
  const headerIndex = sheet.rows.findIndex((row) => row.some((cell) => cell.trim()));
  if (headerIndex < 0) {
    return [];
  }

  const headers = sheet.rows[headerIndex]?.map((cell) => cell.trim()) ?? [];
  if (!hasKnowledgeBankMappingHeaders(headers)) {
    return [];
  }

  const records = sheet.rows.slice(headerIndex + 1).flatMap((row) => {
    if (!row.some((cell) => cell.trim())) {
      return [];
    }

    const record: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (header) {
        record[header] = row[index] ?? "";
      }
    });
    return [record];
  });

  return parseKnowledgeBankRows(records, {
    importSource: "knowledge-base-sheet"
  }).entries;
}

function hasKnowledgeBankMappingHeaders(headers: string[]) {
  const normalized = headers.map((header) =>
    header.trim().toLowerCase().replace(/[\s_-]+/g, "")
  );
  const hasTheme = normalized.some((header) =>
    ["theme", "category", "themecategory", "codetheme"].includes(header)
  );
  const hasSourceValue = normalized.some((header) =>
    ["sourcevalue", "value", "gisvalue"].includes(header)
  );

  return hasTheme && hasSourceValue;
}

function loadProjectSnapshot(): ProjectSnapshot | null {
  const legacySnapshot = loadProjectSnapshotLegacySync();
  if (!legacySnapshot) {
    return null;
  }

  const result = ProjectSnapshotSchema.safeParse(legacySnapshot);
  return result.success ? result.data : null;
}

function toProjectSnapshot(state: EditorPersistedState): ProjectSnapshot {
  return {
    project: state.project,
    terrain: state.terrain,
    layers: state.layers,
    terrainGenerated: state.terrainGenerated,
    selectedLayerId: state.selectedLayerId,
    selectedFeatureId: state.selectedFeatureId,
    coordinateStep: state.coordinateStep,
    orthophotoPreviewUrl: state.orthophotoPreviewUrl
  };
}

function toLcaProjectSnapshot(
  state: EditorPersistedState,
  selectedLayerIds: string[]
): ProjectSnapshot {
  const selectedLayerIdSet = new Set(selectedLayerIds);
  return {
    ...toProjectSnapshot(state),
    layers: state.layers.filter((layer) => selectedLayerIdSet.has(layer.id)),
    selectedLayerId: selectedLayerIds[0] ?? null,
    selectedFeatureId: null
  };
}

const storedProjectSnapshot = loadProjectSnapshot();
const storedKnowledgeBankSheet = loadKnowledgeBankSheet();

function applyProjectSnapshotToState(snapshot: ProjectSnapshot) {
  return {
    project: snapshot.project,
    terrain: snapshot.terrain,
    layers: snapshot.layers,
    terrainGenerated: snapshot.terrainGenerated,
    selectedLayerId: snapshot.selectedLayerId,
    selectedFeatureId: snapshot.selectedFeatureId ?? null,
    coordinateStep: snapshot.coordinateStep ?? null,
    orthophotoPreviewUrl: snapshot.orthophotoPreviewUrl ?? null
  };
}

export const useEditorStore = create<EditorState>((set, get) => ({
  layers: storedProjectSnapshot?.layers ?? [],
  project: storedProjectSnapshot?.project ?? initialTerrainProject.project,
  terrain: storedProjectSnapshot?.terrain ?? initialTerrainProject.terrain,
  terrainGenerated: storedProjectSnapshot?.terrainGenerated ?? false,
  terrainGenerating: false,
  terrainGenerationError: null,
  terrainHeightSource: "open-meteo",
  safeDatasetLocations,
  safeDatasetLocationId: safeDatasetLocations[0]?.id ?? null,
  safeDatasetSearchQuery: "",
  safeDatasetSelectedIds: safeDatasetLocations[0]?.datasets ?? [],
  safeDatasetImportStatus: "idle",
  safeDatasetImportMessage: null,
  orthophotoPreviewUrl: storedProjectSnapshot?.orthophotoPreviewUrl ?? null,
  coordinateStep: storedProjectSnapshot?.coordinateStep ?? null,
  inspectorOpen: false,
  viewScaleMode: "fit",
  selectedLayerId: storedProjectSnapshot?.selectedLayerId ?? null,
  selectedFeatureId: storedProjectSnapshot?.selectedFeatureId ?? null,
  selectedVertexIndex: null,
  snapEnabled: true,
  lcaPurpose: "Baseline landscape character assessment for site planning.",
  lcaSelectedLayerIds: [],
  lcaAnalyzing: false,
  lcaAnalysisError: null,
  lcaRunLogs: [],
  workflowMode: "design",
  lcaAnalysisMode: "desk-study",
  lcaOutputQuality: "professional",
  lcaProvider: LCA_LLM_PROVIDER,
  lcaModel: LCA_DEFAULT_OLLAMA_MODEL,
  lcaAvailableModels: [],
  lcaModelsLoading: false,
  lcaModelsError: null,
  knowledgeBaseOpen: false,
  knowledgeBankGrid: storedKnowledgeBankSheet.rows,
  knowledgeBankColumnWidths: storedKnowledgeBankSheet.columnWidths,
  knowledgeBankRowHeights: storedKnowledgeBankSheet.rowHeights,
  knowledgeBankColumnHeaders: storedKnowledgeBankSheet.columnHeaders ?? [],
  knowledgeBankMaterialColors: storedKnowledgeBankSheet.materialColors ?? [],
  knowledgeBankTextSummary: storedKnowledgeBankSheet.textSummary ?? "",
  knowledgeBankImportMessage: null,
  hoveredFeatureId: null,
  hoveredLayerId: null,
  selectedArea: null,
  activeMode: "terrain-3d",
  addDrawingFeature: (geometryType) =>
    set((state) => {
      const existingLayer =
        state.layers.find((layer) => layer.id === "designer-vector-drawings") ??
        createDesignerDrawingLayer(state.project);
      const existingFeatures = existingLayer.features ?? [];
      const feature = createDrawingFeature(
        state.project,
        geometryType,
        existingFeatures.length
      );
      const layer: PlanningLayer = {
        ...existingLayer,
        features: [
          ...existingFeatures,
          ...clipVectorFeaturesToExtent([feature], state.project)
        ],
        geometryType: inferLayerGeometryType([...existingFeatures, feature])
      };
      const layers = insertOrReplaceLayer(state.layers, layer);
      const nextState = {
        workflowMode: "lca-analysis" as const,
        activeMode: "top-view" as const,
        layers,
        selectedLayerId: layer.id,
        selectedFeatureId: feature.id,
        inspectorOpen: true
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  importGeoJsonLayer: (fileName, fileText) =>
    set((state) => {
      const layer = createImportedGeoJsonLayer(state.project, fileName, fileText);
      const layers = insertOrReplaceLayer(state.layers, layer);
      const nextState = {
        workflowMode: "lca-analysis" as const,
        activeMode: "top-view" as const,
        layers,
        selectedLayerId: layer.id,
        selectedFeatureId: layer.features?.[0]?.id ?? null,
        inspectorOpen: true
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  importKmlLayer: (fileName, fileText) =>
    set((state) => {
      const layer = createImportedKmlLayer(state.project, fileName, fileText);
      const layers = insertOrReplaceLayer(state.layers, layer);
      const nextState = {
        workflowMode: "lca-analysis" as const,
        activeMode: "top-view" as const,
        layers,
        selectedLayerId: layer.id,
        selectedFeatureId: layer.features?.[0]?.id ?? null,
        inspectorOpen: true
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  importRasterOverlay: (fileName, previewUrl, options) =>
    set((state) => {
      const imageWidthPixels = options?.imageWidthPixels ?? 1;
      const imageHeightPixels = options?.imageHeightPixels ?? 1;
      const rasterGeoreference = options?.rasterGeoreference
        ? options.rasterGeoreference
        : options?.worldFileText
        ? createRasterGeoreferenceFromWorldFile(
            parseWorldFile(options.worldFileText),
            imageWidthPixels,
            imageHeightPixels,
            state.project,
            fileName
          )
        : createProjectFitRasterGeoreference(
            state.project,
            imageWidthPixels,
            imageHeightPixels
          );
      const layer = createImportedRasterLayer(
        state.project,
        fileName,
        previewUrl,
        rasterGeoreference
      );
      const layers = insertOrReplaceLayer(state.layers, layer);
      const nextState = {
        workflowMode: "lca-analysis" as const,
        activeMode: "top-view" as const,
        layers,
        selectedLayerId: layer.id,
        selectedFeatureId: null,
        inspectorOpen: true
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  importSampleRasterLayer: () =>
    set((state) => {
      const layer = createSampleHydrologyRasterLayer(state.project);
      const layers = insertOrReplaceLayer(state.layers, layer);
      const nextState = {
        layers,
        selectedLayerId: layer.id,
        selectedFeatureId: null,
        inspectorOpen: true
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  importSampleVectorLayer: () =>
    set((state) => {
      const layer = createSampleSoilVectorLayer(state.project);
      const layers = insertOrReplaceLayer(state.layers, layer);
      const nextState = {
        layers,
        selectedLayerId: layer.id,
        selectedFeatureId: layer.features?.[0]?.id ?? null,
        inspectorOpen: true
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  advanceCoordinateStep: () =>
    set((state) => ({
      coordinateStep:
        state.coordinateStep === null ? 0 : Math.min(state.coordinateStep + 1, 4)
    })),
  closeInspector: () => set({ inspectorOpen: false }),
  deleteLayer: (layerId) =>
    set((state) => {
      const layer = state.layers.find((item) => item.id === layerId);
      if (!layer || !canDeleteLayer(layer)) {
        return state;
      }

      const layers = state.layers.filter((item) => item.id !== layerId);
      const wasSelected = state.selectedLayerId === layerId;
      const nextState = {
        layers,
        selectedLayerId: wasSelected
          ? (layers.find((item) => item.id === "terrain-mesh")?.id ??
            layers.find((item) => item.id === "orthophoto-base")?.id ??
            layers[0]?.id ??
            null)
          : state.selectedLayerId,
        selectedFeatureId: wasSelected ? null : state.selectedFeatureId,
        selectedVertexIndex: wasSelected ? null : state.selectedVertexIndex,
        inspectorOpen: wasSelected ? false : state.inspectorOpen
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  deleteSelectedFeature: () =>
    set((state) => {
      if (!state.selectedLayerId || !state.selectedFeatureId) {
        return state;
      }

      const selectedLayer = state.layers.find(
        (layer) => layer.id === state.selectedLayerId
      );
      if (!selectedLayer || selectedLayer.locked || !selectedLayer.features?.length) {
        return state;
      }

      const features = selectedLayer.features.filter(
        (feature) => feature.id !== state.selectedFeatureId
      );
      const layers = state.layers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              features,
              geometryType: features.length
                ? inferLayerGeometryType(features)
                : layer.geometryType
            }
          : layer
      );
      const selectedFeatureId = features[0]?.id ?? null;
      const nextState = {
        layers,
        selectedFeatureId,
        hoveredFeatureId:
          state.hoveredFeatureId === state.selectedFeatureId
            ? null
            : state.hoveredFeatureId,
        hoveredLayerId:
          state.hoveredFeatureId === state.selectedFeatureId
            ? null
            : state.hoveredLayerId
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  duplicateSelectedFeature: () =>
    set((state) => {
      if (!state.selectedLayerId || !state.selectedFeatureId) {
        return state;
      }

      const selectedLayer = state.layers.find(
        (layer) => layer.id === state.selectedLayerId
      );
      const selectedFeature = selectedLayer?.features?.find(
        (feature) => feature.id === state.selectedFeatureId
      );
      if (!selectedLayer || selectedLayer.locked || !selectedFeature) {
        return state;
      }

      const duplicate = duplicateFeature(
        selectedFeature,
        state.project,
        selectedLayer.features?.length ?? 0
      );
      const clippedDuplicate =
        clipVectorFeaturesToExtent([duplicate], state.project)[0] ?? duplicate;
      const features = [...(selectedLayer.features ?? []), clippedDuplicate];
      const layers = state.layers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              features,
              geometryType: inferLayerGeometryType(features)
            }
          : layer
      );
      const nextState = {
        layers,
        selectedFeatureId: clippedDuplicate.id,
        inspectorOpen: true
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  generateTerrain: async () => {
    const state = get();
    set({ terrainGenerating: true, terrainGenerationError: null });

    try {
      const result = await generateTerrainProjectAsync(
        createTerrainRequest(state.project, state.terrainHeightSource)
      );
      const preservedContextLayers = state.layers.filter(
        (layer) =>
          layer.kind === "foundational-map" && layer.id !== "project-boundary"
      );
      const baseLayers = result.baseLayers
        .map((layer) => ({ ...layer, visible: true }))
        .sort((layerA, layerB) => {
          if (layerA.id === "terrain-mesh") {
            return -1;
          }

          if (layerB.id === "terrain-mesh") {
            return 1;
          }

          return 0;
        });
      const layers = [...preservedContextLayers, ...baseLayers];
      const nextState = {
        project: result.project,
        terrain: result.terrain,
        layers,
        orthophotoPreviewUrl: state.orthophotoPreviewUrl,
        selectedLayerId: "terrain-mesh",
        selectedFeatureId: null,
        selectedArea: null,
        terrainGenerated: true,
        inspectorOpen: false,
        coordinateStep: 4,
        terrainGenerating: false,
        terrainGenerationError: null
      };
      saveProjectSnapshot(toProjectSnapshot(nextState));

      set(nextState);
    } catch (error) {
      set({
        terrainGenerating: false,
        terrainGenerationError:
          error instanceof Error
            ? error.message
            : "Terrain generation failed."
      });
    }
  },
  moveSelectedFeature: (deltaX, deltaY) =>
    set((state) => {
      if (!state.selectedLayerId || !state.selectedFeatureId) {
        return state;
      }

      const selectedLayer = state.layers.find(
        (layer) => layer.id === state.selectedLayerId
      );
      if (!selectedLayer || selectedLayer.locked || !selectedLayer.features?.length) {
        return state;
      }

      const layers = state.layers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              features: layer.features?.map((feature) =>
                feature.id === state.selectedFeatureId
                  ? finalizeFeatureTransform(
                      feature,
                      moveCoordinates(feature.coordinates, state.project, deltaX, deltaY),
                      state.project,
                      state.layers,
                      state.snapEnabled,
                      {
                        layerId: selectedLayer.id,
                        featureId: feature.id
                      }
                    )
                  : feature
              )
            }
          : layer
      );
      const nextState = { layers };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  moveSelectedVertex: (deltaX, deltaY) =>
    set((state) => {
      if (
        !state.selectedLayerId ||
        !state.selectedFeatureId ||
        state.selectedVertexIndex === null
      ) {
        return state;
      }

      const selectedLayer = state.layers.find(
        (layer) => layer.id === state.selectedLayerId
      );
      const selectedFeature = selectedLayer?.features?.find(
        (feature) => feature.id === state.selectedFeatureId
      );
      if (!selectedLayer || selectedLayer.locked || !selectedFeature) {
        return state;
      }

      const nextCoordinates = selectedFeature.coordinates.map((coordinate, index) => {
        if (index !== state.selectedVertexIndex) {
          return coordinate;
        }

        return [
          clampProjectCoordinate(
            coordinate[0] + deltaX,
            state.project.realWorldExtentMeters.width
          ),
          clampProjectCoordinate(
            coordinate[1] + deltaY,
            state.project.realWorldExtentMeters.depth
          )
        ] as VectorFeature["coordinates"][number];
      });
      const layers = state.layers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              features: layer.features?.map((feature) =>
                feature.id === selectedFeature.id
                  ? finalizeFeatureTransform(
                      feature,
                      nextCoordinates,
                      state.project,
                      state.layers,
                      state.snapEnabled,
                      {
                        layerId: selectedLayer.id,
                        featureId: feature.id
                      }
                    )
                  : feature
              )
            }
          : layer
      );
      const nextState = { layers };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  splitSelectedFeatureAtVertex: (vertexIndex) =>
    set((state) => {
      if (!state.selectedLayerId || !state.selectedFeatureId) {
        return state;
      }

      const selectedLayer = state.layers.find(
        (layer) => layer.id === state.selectedLayerId
      );
      const selectedFeature = selectedLayer?.features?.find(
        (feature) => feature.id === state.selectedFeatureId
      );
      if (
        !selectedLayer ||
        selectedLayer.locked ||
        !selectedFeature ||
        selectedFeature.geometryType !== "line" ||
        vertexIndex <= 0 ||
        vertexIndex >= selectedFeature.coordinates.length - 1
      ) {
        return state;
      }

      const firstSegment = clipVectorFeaturesToExtent(
        [
          {
            ...selectedFeature,
            id: `${selectedFeature.id}-split-a-${Date.now()}`,
            label: `${selectedFeature.label} A`,
            coordinates: selectedFeature.coordinates.slice(0, vertexIndex + 1)
          }
        ],
        state.project
      );
      const secondSegment = clipVectorFeaturesToExtent(
        [
          {
            ...selectedFeature,
            id: `${selectedFeature.id}-split-b-${Date.now()}`,
            label: `${selectedFeature.label} B`,
            coordinates: selectedFeature.coordinates.slice(vertexIndex)
          }
        ],
        state.project
      );
      const replacement = [...firstSegment, ...secondSegment];
      if (replacement.length === 0) {
        return state;
      }

      const features = (selectedLayer.features ?? []).flatMap((feature) =>
        feature.id === selectedFeature.id ? replacement : [feature]
      );
      const layers = state.layers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              features,
              geometryType: inferLayerGeometryType(features)
            }
          : layer
      );
      const nextState = {
        layers,
        selectedFeatureId: replacement[0]?.id ?? null,
        selectedVertexIndex: null
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  mergeSelectedFeatureWithNext: () =>
    set((state) => {
      if (!state.selectedLayerId || !state.selectedFeatureId) {
        return state;
      }

      const selectedLayer = state.layers.find(
        (layer) => layer.id === state.selectedLayerId
      );
      if (!selectedLayer || selectedLayer.locked || !selectedLayer.features?.length) {
        return state;
      }

      const featureIndex = selectedLayer.features.findIndex(
        (feature) => feature.id === state.selectedFeatureId
      );
      const currentFeature = selectedLayer.features[featureIndex];
      const nextFeature = selectedLayer.features[featureIndex + 1];
      if (
        !currentFeature ||
        !nextFeature ||
        currentFeature.geometryType !== nextFeature.geometryType ||
        currentFeature.geometryType === "point"
      ) {
        return state;
      }

      const mergedCoordinates =
        currentFeature.geometryType === "line"
          ? [...currentFeature.coordinates, ...nextFeature.coordinates.slice(1)]
          : [
              ...currentFeature.coordinates.slice(0, -1),
              ...nextFeature.coordinates
            ];
      const merged = clipVectorFeaturesToExtent(
        [
          {
            ...currentFeature,
            id: `${currentFeature.id}-merged-${Date.now()}`,
            label: `${currentFeature.label} + ${nextFeature.label}`,
            coordinates: mergedCoordinates
          }
        ],
        state.project
      );
      if (merged.length === 0) {
        return state;
      }

      const features = selectedLayer.features
        .filter((feature) => feature.id !== nextFeature.id)
        .map((feature) => (feature.id === currentFeature.id ? merged[0] : feature));
      const layers = state.layers.map((layer) =>
        layer.id === selectedLayer.id
          ? {
              ...layer,
              features,
              geometryType: inferLayerGeometryType(features)
            }
          : layer
      );
      const nextState = {
        layers,
        selectedFeatureId: merged[0].id,
        selectedVertexIndex: null
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  exportSelectedLayerGeoJson: () => {
    const state = get();
    if (!state.selectedLayerId) {
      return;
    }

    const selectedLayer = state.layers.find(
      (layer) => layer.id === state.selectedLayerId
    );
    if (!selectedLayer?.features?.length) {
      return;
    }

    const payload = exportLayerAsGeoJson(selectedLayer, state.project);
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/geo+json"
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${selectedLayer.name.replace(/\s+/g, "-").toLowerCase()}.geojson`;
    anchor.click();
    URL.revokeObjectURL(url);
  },
  setSnapEnabled: (enabled) => set({ snapEnabled: enabled }),
  selectFeatureVertex: (vertexIndex) => set({ selectedVertexIndex: vertexIndex }),
  setLcaPurpose: (purpose) => set({ lcaPurpose: purpose }),
  toggleLcaInputLayer: (layerId) =>
    set((state) => {
      const isSelected = state.lcaSelectedLayerIds.includes(layerId);
      return {
        lcaSelectedLayerIds: isSelected
          ? state.lcaSelectedLayerIds.filter((id) => id !== layerId)
          : [...state.lcaSelectedLayerIds, layerId]
      };
    }),
  enterLcaAnalysisMode: () => {
    set({
      workflowMode: "lca-analysis",
      activeMode: "top-view",
      lcaAnalysisError: LCA_OLLAMA_ANALYSIS_ENABLED
        ? null
        : LCA_OLLAMA_ANALYSIS_PAUSED_MESSAGE
    });
    if (LCA_OLLAMA_ANALYSIS_ENABLED) {
      void get().fetchLcaModels();
    }
  },
  exitLcaAnalysisMode: () => set({ workflowMode: "design" }),
  openKnowledgeBase: () =>
    set({
      knowledgeBaseOpen: true,
      knowledgeBankImportMessage: null
    }),
  closeKnowledgeBase: () => set({ knowledgeBaseOpen: false }),
  importKnowledgeBankSheet: (fileName, grid) =>
    set(() => {
      const sheet = normalizeKnowledgeBankSheet(grid, [], []);
      const filledRowCount = countFilledSheetRows(grid);
      return {
        ...applyKnowledgeBankSheetToState(sheet),
        knowledgeBankImportMessage: `Imported ${filledRowCount} rows from ${fileName}.`
      };
    }),
  syncKnowledgeBankFromLayers: async () => {
    const state = get();
    set({ knowledgeBankImportMessage: "Resolving soil map unit names from USDA NRCS..." });

    try {
      const enrichedLayers = await enrichLayersForKnowledgeBank(state.layers);
      const result = buildKnowledgeBankFromLayers(enrichedLayers);
      const sheet = sheetFromKnowledgeBankLayers(result);
      set({
        ...applyKnowledgeBankSheetToState(sheet),
        knowledgeBankImportMessage:
          result.recordCount > 0
            ? `Synced ${result.recordCount} rows from ${result.layerCount} USGS / NAIP / USDA datasets.`
            : "No USGS / NAIP / USDA NRCS map layers found to sync."
      });
    } catch (error) {
      set({
        knowledgeBankImportMessage:
          error instanceof Error ? error.message : "Knowledge base sync failed."
      });
    }
  },
  setKnowledgeBankCell: (row, col, value) =>
    set((state) => {
      const sheet = updateSheetCell(
        {
          rows: state.knowledgeBankGrid,
          columnWidths: state.knowledgeBankColumnWidths,
          rowHeights: state.knowledgeBankRowHeights,
          columnHeaders: state.knowledgeBankColumnHeaders,
          materialColors: state.knowledgeBankMaterialColors,
          textSummary: state.knowledgeBankTextSummary
        },
        row,
        col,
        value
      );
      return applyKnowledgeBankSheetToState(sheet);
    }),
  setKnowledgeBankColumnWidth: (col, width) =>
    set((state) => {
      const columnWidths = state.knowledgeBankColumnWidths.map((currentWidth, index) =>
        index === col ? width : currentWidth
      );
      const sheet: KnowledgeBankSheetSnapshot = {
        rows: state.knowledgeBankGrid,
        columnWidths,
        rowHeights: state.knowledgeBankRowHeights,
        columnHeaders: state.knowledgeBankColumnHeaders,
        materialColors: state.knowledgeBankMaterialColors,
        textSummary: state.knowledgeBankTextSummary
      };
      return applyKnowledgeBankSheetToState(sheet);
    }),
  setKnowledgeBankRowHeight: (row, height) =>
    set((state) => {
      const rowHeights = state.knowledgeBankRowHeights.map((currentHeight, index) =>
        index === row ? height : currentHeight
      );
      const sheet: KnowledgeBankSheetSnapshot = {
        rows: state.knowledgeBankGrid,
        columnWidths: state.knowledgeBankColumnWidths,
        rowHeights,
        columnHeaders: state.knowledgeBankColumnHeaders,
        materialColors: state.knowledgeBankMaterialColors,
        textSummary: state.knowledgeBankTextSummary
      };
      return applyKnowledgeBankSheetToState(sheet);
    }),
  setLcaAnalysisMode: (mode) => set({ lcaAnalysisMode: mode }),
  setLcaOutputQuality: (quality) => set({ lcaOutputQuality: quality }),
  setLcaModel: (model) => set({ lcaModel: model }),
  fetchLcaModels: async () => {
    set({ lcaModelsLoading: true, lcaModelsError: null });

    try {
      const models = await fetchLcaModels(safeDatasetBridgeUrl);
      set({
        lcaAvailableModels: models,
        lcaModelsLoading: false,
        lcaModel: models.includes(get().lcaModel)
          ? get().lcaModel
          : models.includes(LCA_DEFAULT_OLLAMA_MODEL)
            ? LCA_DEFAULT_OLLAMA_MODEL
            : models[0] ?? LCA_DEFAULT_OLLAMA_MODEL
      });
    } catch (error) {
      set({
        lcaModelsLoading: false,
        lcaModelsError:
          error instanceof Error ? error.message : "Failed to load Ollama Cloud models."
      });
    }
  },
  runLcaDraftAnalysis: async () => {
    if (!LCA_OLLAMA_ANALYSIS_ENABLED) {
      set({
        lcaAnalyzing: false,
        lcaAnalysisError: LCA_OLLAMA_ANALYSIS_PAUSED_MESSAGE
      });
      return;
    }

    const state = get();
    const requestId = createLcaRequestId();
    const startedAt = performance.now();
    const addRunLog = (
      message: string,
      level: LcaRunLogEntry["level"] = "info",
      detail?: string
    ) => {
      const elapsedMs = Math.round(performance.now() - startedAt);
      set((current) => ({
        lcaRunLogs: [
          ...current.lcaRunLogs,
          {
            id: `${requestId}-${current.lcaRunLogs.length}`,
            elapsedMs,
            level,
            message,
            detail
          }
        ].slice(-80)
      }));
    };

    set({ lcaAnalyzing: true, lcaAnalysisError: null, lcaRunLogs: [] });
    addRunLog("Run started.", "info", `requestId=${requestId}`);

    try {
      const selectedLayerIds = state.lcaSelectedLayerIds.length
        ? state.lcaSelectedLayerIds
        : getDefaultLcaInputLayerIds(state.layers);

      if (selectedLayerIds.length === 0) {
        throw new Error("Select at least one input layer for LCA analysis.");
      }

      addRunLog(
        "Input layers selected.",
        "info",
        selectedLayerIds.join(", ")
      );
      await waitForUiFrame();

      let fallbackMessage: string | null = null;
      let layer: PlanningLayer;
      const knowledgeBankEntries = extractImportedKnowledgeBankEntries({
        rows: state.knowledgeBankGrid,
        columnWidths: state.knowledgeBankColumnWidths,
        rowHeights: state.knowledgeBankRowHeights,
        columnHeaders: state.knowledgeBankColumnHeaders,
        materialColors: state.knowledgeBankMaterialColors,
        textSummary: state.knowledgeBankTextSummary
      });

      try {
        addRunLog("Creating selected-layer project snapshot.");
        const projectSnapshot = toLcaProjectSnapshot(state, selectedLayerIds);
        const featureCount = projectSnapshot.layers.reduce(
          (total, inputLayer) => total + (inputLayer.features?.length ?? 0),
          0
        );
        addRunLog(
          "Project snapshot ready.",
          "success",
          `${projectSnapshot.layers.length} layers, ${featureCount} features`
        );
        const result = await fetchLcaAnalysis(
          state.project.id,
          selectedLayerIds,
          state.lcaPurpose,
          projectSnapshot,
          state.lcaAnalysisMode,
          state.lcaOutputQuality,
          state.lcaModel,
          knowledgeBankEntries,
          requestId,
          addRunLog
        );
        layer = result.layer;
        addRunLog("LCA layer received from backend.", "success", layer.name);
      } catch (backendError) {
        addRunLog(
          "Backend analysis failed; generating local fallback draft.",
          "warning",
          backendError instanceof Error ? backendError.message : "Unknown backend error."
        );
        const evidence = buildMapEvidence(
          { project: state.project, layers: state.layers },
          {
            projectId: state.project.id,
            selectedLayerIds,
            geometryDetail: "simplified"
          }
        );
        const analysis = generateMockLcaDraft({
          purpose: state.lcaPurpose,
          evidence,
          analysisMode: state.lcaAnalysisMode,
          outputQuality: state.lcaOutputQuality,
          knowledgeBankEntries
        });
        layer = createCodedLandscapeUnitLayerFromEvidence(
          state.project,
          evidence,
          analysis
        ) ?? createLcaLayerFromDraft(state.project, analysis.areas, analysis);
        fallbackMessage = `Ollama Cloud was not reached — generated a local mock draft instead. ${
          backendError instanceof Error ? backendError.message : "Unknown backend error."
        }`;
        addRunLog("Local fallback LCA layer created.", "warning", layer.name);
      }

      const layers = insertOrReplaceLayer(state.layers, layer);
      addRunLog("Saving LCA layer into project state.", "info", layer.id);
      const nextState = {
        workflowMode: "lca-analysis" as const,
        activeMode: "top-view" as const,
        layers,
        lcaAnalyzing: false,
        lcaAnalysisError: fallbackMessage,
        lcaSelectedLayerIds: selectedLayerIds,
        selectedLayerId: layer.id,
        selectedFeatureId: layer.features?.[0]?.id ?? null,
        selectedVertexIndex: null,
        inspectorOpen: false
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));
      set(nextState);
      addRunLog("Run complete.", fallbackMessage ? "warning" : "success");
    } catch (error) {
      addRunLog(
        "Run failed.",
        "error",
        error instanceof Error ? error.message : "LCA analysis failed."
      );
      set({
        lcaAnalyzing: false,
        lcaAnalysisError:
          error instanceof Error ? error.message : "LCA analysis failed."
      });
    }
  },
  setSelectedFeatureReviewStatus: (reviewStatus) =>
    set((state) => {
      if (!state.selectedLayerId || !state.selectedFeatureId) {
        return state;
      }

      const layers = state.layers.map((layer) =>
        layer.id === state.selectedLayerId
          ? {
              ...layer,
              features: layer.features?.map((feature) =>
                feature.id === state.selectedFeatureId
                  ? {
                      ...feature,
                      attributes: {
                        ...feature.attributes,
                        reviewStatus
                      }
                    }
                  : feature
              )
            }
          : layer
      );
      const nextState = { layers };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  setSelectedLayerReviewStatus: (reviewStatus) =>
    set((state) => {
      if (!state.selectedLayerId) {
        return state;
      }

      const layers = state.layers.map((layer) =>
        layer.id === state.selectedLayerId ? { ...layer, reviewStatus } : layer
      );
      const nextState = { layers };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  reorderLayer: (sourceLayerId, targetLayerId) =>
    set((state) => {
      const sourceIndex = state.layers.findIndex(
        (layer) => layer.id === sourceLayerId
      );
      const targetIndex = state.layers.findIndex(
        (layer) => layer.id === targetLayerId
      );

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return state;
      }

      const layers = [...state.layers];
      const [movedLayer] = layers.splice(sourceIndex, 1);
      layers.splice(targetIndex, 0, movedLayer);
      saveProjectSnapshot(toProjectSnapshot({ ...state, layers }));
      return { layers };
    }),
  setHoveredFeature: (layerId, featureId) =>
    set({
      hoveredLayerId: layerId,
      hoveredFeatureId: featureId
    }),
  setCornerCoordinate: (label, axis, value) =>
    set((state) => {
      const corners = state.project.corners.map((corner) =>
        corner.label === label ? { ...corner, [axis]: value } : corner
      );

      const project = createProject(corners, state.project.sourceImageName);
      saveProjectSnapshot(toProjectSnapshot({ ...state, project }));

      return { project };
    }),
  selectArea: (area) => set({ selectedArea: area }),
  selectFeature: (featureId) =>
    set((state) => {
      saveProjectSnapshot(
        toProjectSnapshot({ ...state, selectedFeatureId: featureId })
      );

      return {
        selectedFeatureId: featureId
      };
    }),
  selectFeatureInLayer: (layerId, featureId) =>
    set((state) => {
      const layer = state.layers.find((item) => item.id === layerId);
      const feature = layer?.features?.find((item) => item.id === featureId);
      const selectedArea =
        layer?.kind === "lca" && feature ? toCodedAreaFromFeature(feature) : null;
      saveProjectSnapshot(
        toProjectSnapshot({
          ...state,
          selectedLayerId: layerId,
          selectedFeatureId: featureId
        })
      );

      return {
        selectedLayerId: layerId,
        selectedFeatureId: featureId,
        selectedArea
      };
    }),
  selectLayer: (layerId) =>
    set((state) => {
      const layer = state.layers.find((item) => item.id === layerId);
      const selectedFeatureId = layer?.features?.[0]?.id ?? null;
      saveProjectSnapshot(
        toProjectSnapshot({ ...state, selectedLayerId: layerId, selectedFeatureId })
      );

      return {
      selectedLayerId: layerId,
      selectedFeatureId
      };
    }),
  setMode: (mode) => set({ activeMode: mode }),
  setViewScaleMode: (mode) => set({ viewScaleMode: mode }),
  setTerrainHeightSource: (heightSource) =>
    set({ terrainHeightSource: heightSource }),
  setSafeDatasetSearchQuery: (query) => set({ safeDatasetSearchQuery: query }),
  selectSafeDatasetLocation: (locationId) =>
    set(() => {
      const location = getSafeDatasetLocation(locationId);
      return {
        safeDatasetLocationId: location.id,
        safeDatasetSelectedIds: location.datasets,
        safeDatasetImportStatus: "ready" as const,
        safeDatasetImportMessage: `${location.name} selected.`
      };
    }),
  toggleSafeDataset: (datasetId) =>
    set((state) => {
      const isSelected = state.safeDatasetSelectedIds.includes(datasetId);
      return {
        safeDatasetSelectedIds: isSelected
          ? state.safeDatasetSelectedIds.filter((id) => id !== datasetId)
          : [...state.safeDatasetSelectedIds, datasetId],
        safeDatasetImportStatus: "ready" as const,
        safeDatasetImportMessage: null
      };
    }),
  startSafeDatasetImport: async () => {
    const state = get();
    const location = getSafeDatasetLocation(state.safeDatasetLocationId);
    const datasetIds = state.safeDatasetSelectedIds.filter((datasetId) =>
      location.datasets.includes(datasetId)
    );

    if (datasetIds.length === 0) {
      set({
        safeDatasetImportStatus: "error",
        safeDatasetImportMessage: "Select at least one dataset.",
        terrainGenerationError: "Select at least one dataset."
      });
      return;
    }

    const corners = getCornersFromSafeLocation(location);
    const project = {
      ...createProject(corners, `${location.name} safe dataset`),
      name: location.name,
      sourceImageName: `${location.name} safe dataset`
    };
    const queuedLayers = createSafeDatasetLayers(project, location, datasetIds);
    const heightSource: TerrainHeightSource = datasetIds.includes("usgs-contours")
      ? "usgs-contours"
      : "open-meteo";

    set({
      activeMode: "terrain-3d",
      project,
      terrainHeightSource: heightSource,
      layers: queuedLayers,
      selectedLayerId: queuedLayers[0]?.id ?? null,
      selectedFeatureId: null,
      selectedArea: null,
      selectedVertexIndex: null,
      terrainGenerated: false,
      terrainGenerating: true,
      terrainGenerationError: null,
      safeDatasetImportStatus: "importing",
      safeDatasetImportMessage: `Importing ${datasetIds.length} dataset sources from ${location.dataSource}.`,
      inspectorOpen: false,
      coordinateStep: 4,
      orthophotoPreviewUrl: null
    });

    try {
      const result = await fetchSafeDatasetImport(location.id, datasetIds);
      const layers = applySafeDatasetLayerStack(result.layers);
      const enrichedImportLayers = await enrichLayersForKnowledgeBank(layers);
      const knowledgeBankSheet = sheetFromKnowledgeBankLayers(
        buildKnowledgeBankFromLayers(enrichedImportLayers)
      );
      saveKnowledgeBankSheet(knowledgeBankSheet);
      const nextState = {
        activeMode: "terrain-3d" as const,
        project: result.project,
        terrain: result.terrain,
        layers: enrichedImportLayers,
        orthophotoPreviewUrl: null,
        selectedLayerId: "terrain-mesh",
        selectedFeatureId: null,
        selectedArea: null,
        selectedVertexIndex: null,
        terrainGenerated: true,
        terrainGenerating: false,
        terrainGenerationError: null,
        terrainHeightSource: "open-meteo" as const,
        safeDatasetImportStatus: "complete" as const,
        safeDatasetImportMessage: summarizeSafeDatasetImport(result),
        inspectorOpen: false,
        coordinateStep: 4
      };
      saveProjectSnapshot(toProjectSnapshot(nextState));
      set({
        ...nextState,
        ...applyKnowledgeBankSheetToState(knowledgeBankSheet),
        knowledgeBankImportMessage: `Knowledge base updated with ${knowledgeBankSheet.rows.filter((row) => row.some((cell) => cell.trim())).length} rows from imported datasets.`
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Safe dataset import failed.";
      set({
        terrainGenerating: false,
        terrainGenerationError: null,
        safeDatasetImportStatus: "error",
        safeDatasetImportMessage: message
      });
    }
  },
  setOrthophotoPreview: (fileName, previewUrl) =>
    set((state) => {
      if (state.orthophotoPreviewUrl) {
        URL.revokeObjectURL(state.orthophotoPreviewUrl);
      }
      clearProjectSnapshot();

      const project = {
        ...state.project,
        sourceImageName: fileName
      };
      const layers = [createOrthophotoLayer()];
      const nextState = {
        activeMode: "top-view" as const,
        coordinateStep: 0,
        orthophotoPreviewUrl: previewUrl,
        project,
        layers,
        selectedLayerId: "orthophoto-base",
        selectedFeatureId: null,
        selectedArea: null,
        terrainGenerated: false,
        terrainGenerationError: null,
        inspectorOpen: false
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  setLayerOpacity: (layerId, opacity) =>
    set((state) => {
      const clampedOpacity = Math.min(1, Math.max(0, opacity));
      const layers = state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity: clampedOpacity } : layer
      );
      saveProjectSnapshot(toProjectSnapshot({ ...state, layers }));

      return { layers };
    }),
  toggleLayer: (layerId) =>
    set((state) => {
      const layers = state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      );
      saveProjectSnapshot(toProjectSnapshot({ ...state, layers }));

      return { layers };
    })
}));

export async function hydrateEditorPersistence() {
  const [projectSnapshot, knowledgeBankSheet] = await Promise.all([
    loadProjectSnapshotFromPersistence(),
    loadKnowledgeBankSheetFromPersistence()
  ]);

  const nextState: Partial<EditorState> = {};

  if (projectSnapshot) {
    const parsed = ProjectSnapshotSchema.safeParse(projectSnapshot);
    if (parsed.success) {
      Object.assign(nextState, applyProjectSnapshotToState(parsed.data));
    }
  }

  if (knowledgeBankSheet) {
    Object.assign(
      nextState,
      applyKnowledgeBankSheetToState(normalizeStoredKnowledgeBankSheet(knowledgeBankSheet))
    );
  }

  if (Object.keys(nextState).length > 0) {
    useEditorStore.setState(nextState);
  }
}


async function fetchSafeDatasetImport(
  locationId: string,
  datasetIds: SafeDatasetId[]
): Promise<SafeDatasetBackendImportResult> {
  let response: Response;

  try {
    response = await fetch(`${safeDatasetBridgeUrl}/safe-dataset/import`, {
      body: JSON.stringify({
        locationId,
        datasetIds,
        persistAssets: true
      }),
      headers: {
        "content-type": "application/json"
      },
      method: "POST"
    });
  } catch (error) {
    throw new Error(
      `Safe dataset backend is unavailable at ${safeDatasetBridgeUrl}. Start the MCP server with npm run dev:mcp or set VITE_LANDSCHAFT_MCP_HTTP_URL.`,
      { cause: error }
    );
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(
      payload?.error ??
        "Safe dataset backend is unavailable. Start the MCP server with npm run dev:mcp."
    );
  }

  return (await response.json()) as SafeDatasetBackendImportResult;
}

async function fetchLcaModels(bridgeUrl: string): Promise<string[]> {
  let response: Response;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 20_000);

  try {
    response = await fetch(`${bridgeUrl}/lca/models`, {
      signal: controller.signal
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("LCA model listing timed out after 20 seconds.");
    }

    throw new Error(
      `LCA model listing is unavailable at ${bridgeUrl}. Start the MCP server with npm run dev:mcp.`,
      { cause: error }
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(
      payload?.error ??
        "LCA model listing is unavailable. Start the MCP server with npm run dev:mcp."
    );
  }

  const payload = (await response.json()) as { models?: string[] };
  return payload.models ?? [];
}

const LCA_ANALYZE_TIMEOUT_MS = 200_000;

async function fetchLcaAnalysis(
  projectId: string,
  selectedLayerIds: string[],
  purpose: string,
  projectSnapshot: ProjectSnapshot,
  analysisMode: LcaAnalysisMode,
  outputQuality: LcaOutputQuality,
  model: string,
  knowledgeBankEntries: KnowledgeBankEntry[],
  requestId: string,
  onLog: (
    message: string,
    level?: LcaRunLogEntry["level"],
    detail?: string
  ) => void
): Promise<LcaBackendAnalysisResult> {
  let response: Response;

  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), LCA_ANALYZE_TIMEOUT_MS);

  try {
    onLog("Serializing backend request payload.");
    const requestBody = JSON.stringify({
      requestId,
      projectId,
      selectedLayerIds,
      geometryDetail: "summary",
      purpose,
      analysisMode,
      outputQuality,
      model,
      provider: "ollama-cloud",
      knowledgeBankEntries,
      projectSnapshot
    });
    onLog(
      "Payload serialized.",
      "success",
      `${Math.round(new Blob([requestBody]).size / 1024)} KB`
    );
    await waitForUiFrame();
    onLog("Posting request to MCP LCA bridge.", "info", safeDatasetBridgeUrl);
    response = await fetch(`${safeDatasetBridgeUrl}/lca/analyze`, {
      body: requestBody,
      headers: {
        "content-type": "application/json"
      },
      method: "POST",
      signal: controller.signal
    });
    onLog("MCP bridge returned response headers.", "success", `HTTP ${response.status}`);
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error(
        `LCA analysis timed out after ${Math.round(LCA_ANALYZE_TIMEOUT_MS / 1000)} seconds. Try fewer input layers or DeepSeek V4 Flash.`
      );
    }
    throw new Error(
      `LCA backend is unavailable at ${safeDatasetBridgeUrl}. Start the MCP server with npm run dev:mcp or set VITE_LANDSCHAFT_MCP_HTTP_URL.`,
      { cause: error }
    );
  } finally {
    window.clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const payload = (await response.json().catch(() => null)) as
      | { error?: string }
      | null;
    throw new Error(
      payload?.error ??
        "LCA backend is unavailable. Start the MCP server with npm run dev:mcp."
    );
  }

  onLog("Reading backend JSON response.");
  return (await response.json()) as LcaBackendAnalysisResult;
}

function createLcaRequestId() {
  return `lca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function waitForUiFrame() {
  return new Promise<void>((resolve) => {
    window.requestAnimationFrame(() => resolve());
  });
}

function summarizeSafeDatasetImport(result: SafeDatasetBackendImportResult) {
  const providerLayers = result.layers.filter((layer) => layer.id !== "terrain-mesh");
  const featureCount = providerLayers.reduce(
    (total, layer) => total + (layer.features?.length ?? 0),
    0
  );
  const assetCount = result.assets?.length ?? 0;

  return `Imported ${providerLayers.length} provider layers, ${featureCount} vector features, and ${assetCount} raster assets through the MCP backend.`;
}

type GeoJsonPayload = {
  type?: string;
  features?: GeoJsonFeature[];
  geometry?: GeoJsonGeometry;
  properties?: Record<string, unknown>;
};

type GeoJsonFeature = {
  type?: string;
  geometry?: GeoJsonGeometry | null;
  properties?: Record<string, unknown> | null;
};

type GeoJsonGeometry = {
  type?: string;
  coordinates?: unknown;
};

function normalizeGeoJsonFeatures(
  payload: GeoJsonPayload,
  project: ProjectMetadata
): VectorFeature[] {
  const sourceFeatures =
    payload.type === "FeatureCollection"
      ? payload.features ?? []
      : payload.type === "Feature"
        ? [payload as GeoJsonFeature]
        : [{ type: "Feature", geometry: payload.geometry ?? payload }];

  return sourceFeatures.flatMap((feature, index) =>
    normalizeGeoJsonFeature(feature, index, project)
  );
}

function normalizeGeoJsonFeature(
  feature: GeoJsonFeature,
  index: number,
  project: ProjectMetadata
): VectorFeature[] {
  const geometry = feature.geometry;
  if (!geometry?.type || !geometry.coordinates) {
    return [];
  }

  const attributes = normalizeAttributes(feature.properties ?? {});
  const label =
    attributes.name ?? attributes.Name ?? attributes.label ?? `Feature ${index + 1}`;

  switch (geometry.type) {
    case "Point":
      return [
        createVectorFeature(
          index,
          label,
          "point",
          [toProjectCoordinate(geometry.coordinates, project)],
          attributes
        )
      ];
    case "LineString":
      return [
        createVectorFeature(
          index,
          label,
          "line",
          toProjectPath(geometry.coordinates, project),
          attributes
        )
      ];
    case "Polygon":
      return [
        createVectorFeature(
          index,
          label,
          "polygon",
          toProjectPath(firstRing(geometry.coordinates), project),
          attributes
        )
      ];
    case "MultiPolygon":
      return multiPolygonRings(geometry.coordinates).map((ring, ringIndex) =>
        createVectorFeature(
          index + ringIndex,
          `${label} ${ringIndex + 1}`,
          "polygon",
          toProjectPath(ring, project),
          attributes
        )
      );
    default:
      return [];
  }
}

function normalizeKmlFeatures(fileText: string, project: ProjectMetadata) {
  const document = new DOMParser().parseFromString(fileText, "application/xml");
  const parserError = document.querySelector("parsererror");
  if (parserError) {
    throw new Error("KML file could not be parsed.");
  }

  const placemarks = Array.from(document.getElementsByTagName("Placemark"));
  return placemarks.flatMap((placemark, index) =>
    normalizeKmlPlacemark(placemark, index, project)
  );
}

function normalizeKmlPlacemark(
  placemark: Element,
  index: number,
  project: ProjectMetadata
) {
  const name = textContent(placemark, "name") || `Placemark ${index + 1}`;
  const description = textContent(placemark, "description");
  const attributes: Record<string, string> = {
    name,
    ...(description ? { description } : {})
  };
  const pointCoordinates = childCoordinateText(placemark, "Point");
  const lineCoordinates = childCoordinateText(placemark, "LineString");
  const polygonCoordinates = Array.from(placemark.getElementsByTagName("Polygon"))
    .map((polygon) => childCoordinateText(polygon, "LinearRing"))
    .filter(Boolean);
  const features: VectorFeature[] = [];

  if (pointCoordinates) {
    features.push(
      createVectorFeature(
        index,
        name,
        "point",
        [toProjectCoordinate(parseKmlCoordinate(pointCoordinates)[0], project)],
        attributes
      )
    );
  }

  if (lineCoordinates) {
    features.push(
      createVectorFeature(
        index + features.length,
        name,
        "line",
        parseKmlCoordinate(lineCoordinates).map((coordinate) =>
          toProjectCoordinate(coordinate, project)
        ),
        attributes
      )
    );
  }

  for (const coordinates of polygonCoordinates) {
    features.push(
      createVectorFeature(
        index + features.length,
        name,
        "polygon",
        parseKmlCoordinate(coordinates).map((coordinate) =>
          toProjectCoordinate(coordinate, project)
        ),
        attributes
      )
    );
  }

  return features;
}

function createVectorFeature(
  index: number,
  label: string,
  geometryType: VectorFeature["geometryType"],
  coordinates: VectorFeature["coordinates"],
  attributes: Record<string, string>
): VectorFeature {
  return {
    id: `imported-feature-${index + 1}`,
    label,
    geometryType,
    coordinates,
    attributes,
    planningImpact:
      "Review this imported feature against terrain, soil, drainage, and future design layers."
  };
}

function duplicateFeature(
  feature: VectorFeature,
  project: ProjectMetadata,
  featureIndex: number
): VectorFeature {
  const offsetX = project.realWorldExtentMeters.width * 0.025;
  const offsetY = project.realWorldExtentMeters.depth * 0.025;

  return {
    ...feature,
    id: `${feature.id}-copy-${Date.now()}`,
    label: `${feature.label} Copy`,
    coordinates: feature.coordinates.map(([x, y]) => [
      clampProjectCoordinate(x + offsetX, project.realWorldExtentMeters.width),
      clampProjectCoordinate(y + offsetY, project.realWorldExtentMeters.depth)
    ]),
    attributes: {
      ...feature.attributes,
      status: "Draft",
      source: feature.attributes.source ?? "Duplicated feature",
      duplicateIndex: String(featureIndex + 1)
    }
  };
}

function toCodedAreaFromFeature(feature: VectorFeature): CodedArea {
  const ring = [...feature.coordinates];
  const first = ring[0];
  const last = ring[ring.length - 1];
  if (first && last && (first[0] !== last[0] || first[1] !== last[1])) {
    ring.push(first);
  }

  return {
    id: feature.attributes.lcaCodedId ?? feature.id,
    label: feature.label,
    ring: ring as CodedArea["ring"],
    layer: "lca",
    code: feature.attributes.characterCode ?? "LCA",
    meaning: feature.attributes.meaning ?? feature.planningImpact,
    confidence: Number(feature.attributes.confidence ?? 0.5)
  };
}

function moveCoordinates(
  coordinates: VectorFeature["coordinates"],
  project: ProjectMetadata,
  deltaX: number,
  deltaY: number
): VectorFeature["coordinates"] {
  return coordinates.map(
    ([x, y]) =>
      [
        clampProjectCoordinate(x + deltaX, project.realWorldExtentMeters.width),
        clampProjectCoordinate(y + deltaY, project.realWorldExtentMeters.depth)
      ] as [number, number]
  );
}

function finalizeFeatureTransform(
  feature: VectorFeature,
  coordinates: VectorFeature["coordinates"],
  project: ProjectMetadata,
  layers: PlanningLayer[],
  snapEnabled: boolean,
  identity: { layerId: string; featureId: string }
): VectorFeature {
  const snapRadius = Math.max(
    1,
    Math.min(project.realWorldExtentMeters.width, project.realWorldExtentMeters.depth) *
      0.02
  );
  const snapped = snapEnabled
    ? coordinates.map((coordinate) =>
        snapCoordinate(coordinate, project, layers, identity, snapRadius)
      )
    : coordinates;

  return (
    clipVectorFeaturesToExtent(
      [
        {
          ...feature,
          coordinates: snapped
        }
      ],
      project
    )[0] ?? {
      ...feature,
      coordinates: snapped,
      attributes: {
        ...feature.attributes,
        coordinateSpace: "project-metres"
      }
    }
  );
}

function textContent(parent: Element, tagName: string) {
  return parent.getElementsByTagName(tagName)[0]?.textContent?.trim() ?? "";
}

function childCoordinateText(parent: Element, geometryTagName: string) {
  const geometry = parent.getElementsByTagName(geometryTagName)[0];
  return geometry?.getElementsByTagName("coordinates")[0]?.textContent?.trim() ?? "";
}

function parseKmlCoordinate(value: string) {
  return value
    .trim()
    .split(/\s+/)
    .map((coordinate) => coordinate.split(",").map(Number))
    .filter(
      (coordinate): coordinate is [number, number] =>
        Number.isFinite(coordinate[0]) && Number.isFinite(coordinate[1])
    );
}

function toProjectPath(value: unknown, project: ProjectMetadata) {
  return Array.isArray(value)
    ? value.map((coordinate) => toProjectCoordinate(coordinate, project))
    : [];
}

function toProjectCoordinate(value: unknown, project: ProjectMetadata): [number, number] {
  if (
    !Array.isArray(value) ||
    typeof value[0] !== "number" ||
    typeof value[1] !== "number"
  ) {
    return [0, 0];
  }

  const longitude = value[0];
  const latitude = value[1];
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

function firstRing(value: unknown) {
  return Array.isArray(value) && Array.isArray(value[0]) ? value[0] : [];
}

function multiPolygonRings(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((polygon) => (Array.isArray(polygon) ? [polygon[0]] : []));
}

function normalizeAttributes(properties: Record<string, unknown>) {
  return Object.fromEntries(
    Object.entries(properties).map(([key, value]) => [
      key,
      typeof value === "string" ? value : JSON.stringify(value)
    ])
  );
}

function inferLayerGeometryType(features: VectorFeature[]): PlanningLayer["geometryType"] {
  const geometryTypes = new Set(features.map((feature) => feature.geometryType));
  if (geometryTypes.size > 1) {
    return "mixed";
  }

  return features[0]?.geometryType ?? "mixed";
}

function formatFeatureType(geometryType: VectorFeature["geometryType"]) {
  return geometryType.charAt(0).toUpperCase() + geometryType.slice(1);
}

function createLayerId(fileName: string, suffix: string) {
  return `${suffix}-${fileName
    .toLowerCase()
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}`;
}

function cleanLayerName(fileName: string) {
  return fileName.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ");
}

function safeRatio(value: number, range: number) {
  if (Math.abs(range) < 0.0000001) {
    return 0;
  }

  return Math.min(Math.max(value / range, 0), 1);
}

function clampProjectCoordinate(value: number, maximum: number) {
  return Math.min(Math.max(value, 0), maximum);
}
