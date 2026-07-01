/*
 * ---metadata---
 * type: app-source
 * description: MCP handlers for USA safe-location dataset discovery and import.
 * last-updated: 2026-07-01
 * last-model: codex-gpt-5
 * last-change: clarify provider network fetch failures
 * ---end-metadata---
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  generateTerrainProjectAsync,
  getExtentMeters,
  type OrthophotoCorner,
  type PlanningLayer,
  type ProjectMetadata,
  type RasterGeoreference,
  type TerrainGenerationRequest,
  type VectorFeature
} from "@landschaft/shared";

export type SafeDatasetId =
  | "naip-ortho"
  | "dem-3dep"
  | "usgs-contours"
  | "hydrography"
  | "transportation"
  | "soil"
  | "land-cover"
  | "flood-hazard";

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

interface TnmProduct {
  title?: string;
  format?: string;
  downloadURL?: string;
  previewGraphicURL?: string;
  publicationDate?: string;
  lastUpdated?: string;
  sizeInBytes?: number;
  boundingBox?: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
}

interface TnmProductsResponse {
  total?: number;
  items?: TnmProduct[];
}

type TnmProductsResult = TnmProductsResponse & {
  unavailableReason?: string;
};

interface RasterExportResponse {
  href?: string;
  width?: number;
  height?: number;
  extent?: {
    xmin: number;
    ymin: number;
    xmax: number;
    ymax: number;
  };
}

interface PersistedRasterAsset {
  datasetId: SafeDatasetId;
  sourceHref: string;
  localPath: string;
  publicPath: string;
  bytes: number;
  width: number;
  height: number;
  rasterGeoreference: RasterGeoreference;
}

interface ArcGisPoint {
  x: number;
  y: number;
}

interface ContourFeature {
  attributes?: {
    contourelevation?: number;
    contourinterval?: number;
  };
  geometry?: {
    paths?: ArcGisPoint[][] | number[][][];
  };
}

interface ContourResponse {
  features?: ContourFeature[];
}

interface HydroFeature {
  attributes?: Record<string, string | number | null | undefined>;
  geometry?: {
    paths?: ArcGisPoint[][] | number[][][];
    rings?: ArcGisPoint[][] | number[][][];
  };
}

interface HydroResponse {
  features?: HydroFeature[];
}

const nhdHydroLayerIds = {
  flowlineSmall: 4,
  flowlineLarge: 6,
  waterbodyLarge: 12
} as const;

interface TransportFeature {
  attributes?: Record<string, string | number | null | undefined>;
  geometry?: {
    paths?: ArcGisPoint[][] | number[][][];
  };
}

interface TransportResponse {
  features?: TransportFeature[];
}

interface PolygonFeature {
  attributes?: Record<string, string | number | null | undefined>;
  geometry?: {
    rings?: ArcGisPoint[][] | number[][][];
  };
}

interface PolygonResponse {
  features?: PolygonFeature[];
}

const transportLayerConfig = [
  { layerId: 29, kind: "highway" },
  { layerId: 30, kind: "secondary-highway" },
  { layerId: 31, kind: "connecting-road" },
  { layerId: 32, kind: "local-road" },
  { layerId: 33, kind: "ramp" },
  { layerId: 37, kind: "trail" }
] as const;

const transportPageSize = 1_000;
const transportMaxFeaturesPerLayer = 3_000;

const jsonRequestTimeoutMs = 45_000;
const rasterDownloadTimeoutMs = 120_000;

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
    dataSource: "USGS The National Map / NAIP / USDA NRCS / FEMA",
    datasets: [
      "naip-ortho",
      "dem-3dep",
      "usgs-contours",
      "hydrography",
      "transportation",
      "soil",
      "land-cover",
      "flood-hazard"
    ]
  }
];

const datasetLabels: Record<SafeDatasetId, string> = {
  "naip-ortho": "NAIP orthophoto",
  "dem-3dep": "3DEP DEM",
  "usgs-contours": "USGS contours",
  hydrography: "Hydrography",
  transportation: "Transportation",
  soil: "USDA soils",
  "land-cover": "NLCD land cover",
  "flood-hazard": "FEMA flood hazard"
};

const tnmDatasets: Partial<Record<SafeDatasetId, string[]>> = {
  "dem-3dep": [
    "Digital Elevation Model (DEM) 1 meter",
    "National Elevation Dataset (NED) 1/3 arc-second"
  ],
  hydrography: ["National Hydrography Dataset (NHD) Best Resolution"],
  transportation: ["National Transportation Dataset (NTD)"]
};

export function handleSafeDatasetSearch(query: string) {
  const normalizedQuery = query.trim().toLowerCase();
  const locations = safeDatasetLocations.filter((location) =>
    `${location.name} ${location.region} ${location.country}`
      .toLowerCase()
      .includes(normalizedQuery)
  );

  return {
    query,
    country: "USA",
    locations
  };
}

export async function handleSafeDatasetManifest(
  locationId: string,
  datasetIds?: SafeDatasetId[]
) {
  const location = getSafeDatasetLocation(locationId);
  const selectedDatasetIds = normalizeDatasetIds(location, datasetIds);
  const sources = await Promise.all(
    selectedDatasetIds.map((datasetId) => getDatasetManifestSource(location, datasetId))
  );

  return {
    location,
    selectedDatasetIds,
    sources,
    importOrder: selectedDatasetIds,
    notes: [
      "All requests use the selected AOI bbox.",
      "NAIP and 3DEP raster exports are requested as clipped TIFFs from provider ImageServer endpoints.",
      "A follow-up worker can persist these hrefs to local assets and reproject them to the target CRS."
    ]
  };
}

export async function handleSafeDatasetImport(
  locationId: string,
  datasetIds?: SafeDatasetId[],
  options: { persistAssets?: boolean } = {}
) {
  const location = getSafeDatasetLocation(locationId);
  const selectedDatasetIds = normalizeDatasetIds(location, datasetIds);
  const corners = getCornersFromLocation(location);
  const terrainRequest: TerrainGenerationRequest = {
    projectId: location.id,
    projectName: location.name,
    coordinateReferenceSystem: "EPSG:4326",
    sourceImageName: `${location.name} safe dataset`,
    corners,
    quality: "fast-preview",
    heightSource: selectedDatasetIds.includes("usgs-contours")
      ? "usgs-contours"
      : "open-meteo"
  };
  const [
    manifest,
    terrainResult,
    contourFeatures,
    hydroFeatures,
    transportFeatures,
    soilFeatures,
    floodFeatures
  ] =
    await Promise.all([
      handleSafeDatasetManifest(location.id, selectedDatasetIds),
      generateTerrainProjectAsync(terrainRequest),
      selectedDatasetIds.includes("usgs-contours")
        ? fetchContourFeatures(location, 250).catch(() => [])
        : Promise.resolve([]),
      selectedDatasetIds.includes("hydrography")
        ? fetchHydrographyFeatures(location, 280).catch(() => [])
        : Promise.resolve([]),
      selectedDatasetIds.includes("transportation")
        ? fetchTransportationFeatures(location).catch(() => [])
        : Promise.resolve([]),
      selectedDatasetIds.includes("soil")
        ? fetchSoilFeatures(location, 120).catch(() => [])
        : Promise.resolve([]),
      selectedDatasetIds.includes("flood-hazard")
        ? fetchFloodHazardFeatures(location, 300).catch(() => [])
        : Promise.resolve([])
    ]);
  const assets =
    options.persistAssets === false
      ? []
      : await persistRasterAssets(location, manifest.sources);
  const providerLayers = createProviderLayers(
    terrainResult.project,
    location,
    selectedDatasetIds,
    contourFeatures,
    hydroFeatures,
    transportFeatures,
    soilFeatures,
    floodFeatures,
    assets
  );
  const baseLayers = terrainResult.baseLayers.filter(
    (layer) => layer.id !== "orthophoto-base"
  );

  return {
    location,
    manifest,
    project: terrainResult.project,
    terrain: terrainResult.terrain,
    layers: [...providerLayers, ...baseLayers],
    assets,
    status: "imported",
    limitations: [
      "NAIP and DEM clipped TIFFs are persisted under the web public provider-assets directory."
    ]
  };
}

function getSafeDatasetLocation(locationId: string) {
  const location = safeDatasetLocations.find((candidate) => candidate.id === locationId);
  if (!location) {
    throw new Error(`Unknown safe dataset location: ${locationId}`);
  }

  return location;
}

function normalizeDatasetIds(location: SafeDatasetLocation, datasetIds?: SafeDatasetId[]) {
  const requested = datasetIds?.length ? datasetIds : location.datasets;
  return requested.filter((datasetId) => location.datasets.includes(datasetId));
}

function getRasterExportOptions(datasetId: SafeDatasetId) {
  if (datasetId === "naip-ortho") {
    return {
      serviceUrl:
        "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage",
      pixelType: "U8",
      size: "1536,1536",
      interpolation: "RSP_NearestNeighbor"
    };
  }

  if (datasetId === "dem-3dep") {
    return {
      serviceUrl:
        "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage",
      pixelType: "F32",
      size: "1024,1024",
      interpolation: "RSP_BilinearInterpolation",
      noData: "-9999"
    };
  }

  if (datasetId === "land-cover") {
    return {
      serviceUrl:
        "https://di-nlcd.img.arcgis.com/arcgis/rest/services/USA_NLCD_Annual_LandCover/ImageServer/exportImage",
      pixelType: "U8",
      size: "1024,1024",
      interpolation: "RSP_NearestNeighbor",
      noData: "0"
    };
  }

  return null;
}

async function getDatasetManifestSource(
  location: SafeDatasetLocation,
  datasetId: SafeDatasetId
) {
  const rasterExportOptions = getRasterExportOptions(datasetId);

  if (datasetId === "naip-ortho" && rasterExportOptions) {
    return {
      datasetId,
      label: datasetLabels[datasetId],
      provider: "USGS NAIP ImageServer",
      export: await fetchRasterExport(location, rasterExportOptions)
    };
  }

  if (datasetId === "dem-3dep" && rasterExportOptions) {
    const [rasterExport, products] = await Promise.all([
      fetchRasterExport(location, rasterExportOptions),
      fetchTnmProducts(location, datasetId).catch((error) =>
        createUnavailableTnmProducts(error)
      )
    ]);
    return {
      datasetId,
      label: datasetLabels[datasetId],
      provider: "USGS 3DEP ImageServer / TNMAccess",
      export: rasterExport,
      total: products.total ?? 0,
      products: (products.items ?? []).slice(0, 8).map(summarizeTnmProduct),
      ...(products.unavailableReason
        ? { providerStatus: "metadata-unavailable", unavailableReason: products.unavailableReason }
        : {})
    };
  }

  if (datasetId === "usgs-contours") {
    return {
      datasetId,
      label: datasetLabels[datasetId],
      provider: "USGS National Map Contours",
      queryUrl: getContourQueryUrl(location, 250).toString(),
      featureCount: await fetchContourCount(location).catch(() => null)
    };
  }

  if (datasetId === "land-cover" && rasterExportOptions) {
    return {
      datasetId,
      label: datasetLabels[datasetId],
      provider: "USGS MRLC NLCD Annual Land Cover ImageServer",
      export: await fetchRasterExport(location, rasterExportOptions)
    };
  }

  if (datasetId === "soil") {
    return {
      datasetId,
      label: datasetLabels[datasetId],
      provider: "USDA NRCS Soil Data Access WFS",
      queryUrl: getSoilQueryUrl(location, 120).toString()
    };
  }

  if (datasetId === "flood-hazard") {
    return {
      datasetId,
      label: datasetLabels[datasetId],
      provider: "FEMA National Flood Hazard Layer",
      queryUrl: getFloodHazardQueryUrl(location, 300).toString()
    };
  }

  const products = await fetchTnmProducts(location, datasetId).catch((error) =>
    createUnavailableTnmProducts(error)
  );
  return {
    datasetId,
    label: datasetLabels[datasetId],
    provider: "USGS TNMAccess",
    total: products.total ?? 0,
    products: (products.items ?? []).slice(0, 8).map(summarizeTnmProduct),
    ...(products.unavailableReason
      ? { providerStatus: "metadata-unavailable", unavailableReason: products.unavailableReason }
      : {})
  };
}

type RasterExportOptions = {
  serviceUrl: string;
  pixelType: string;
  size: string;
  interpolation: string;
  noData?: string;
};

function buildRasterExportUrl(
  location: SafeDatasetLocation,
  options: RasterExportOptions,
  responseFormat: "json" | "image"
) {
  const url = new URL(options.serviceUrl);
  url.searchParams.set("f", responseFormat);
  url.searchParams.set("bbox", bboxString(location));
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("imageSR", "4326");
  url.searchParams.set("size", options.size);
  url.searchParams.set("format", "tiff");
  url.searchParams.set("pixelType", options.pixelType);
  url.searchParams.set("noData", options.noData ?? "0");
  url.searchParams.set("interpolation", options.interpolation);

  return url;
}

async function fetchRasterExport(
  location: SafeDatasetLocation,
  options: RasterExportOptions
) {
  return fetchJson<RasterExportResponse>(buildRasterExportUrl(location, options, "json"));
}

async function fetchTnmProducts(
  location: SafeDatasetLocation,
  datasetId: SafeDatasetId
): Promise<TnmProductsResult> {
  const datasets = tnmDatasets[datasetId] ?? [];
  const responses = await Promise.all(
    datasets.map((dataset) => {
      const url = new URL("https://tnmaccess.nationalmap.gov/api/v1/products");
      url.searchParams.set("bbox", bboxString(location));
      url.searchParams.set("datasets", dataset);
      url.searchParams.set("outputFormat", "json");
      if (datasetId === "dem-3dep") {
        url.searchParams.set("prodFormats", "GeoTIFF");
      }
      return fetchJson<TnmProductsResponse>(url);
    })
  );
  const items = responses.flatMap((response) => response.items ?? []);

  return {
    total: responses.reduce((total, response) => total + (response.total ?? 0), 0),
    items
  };
}

function createUnavailableTnmProducts(error: unknown): TnmProductsResult {
  return {
    total: 0,
    items: [],
    unavailableReason:
      error instanceof Error
        ? error.message
        : "TNMAccess product metadata is unavailable."
  };
}

async function fetchContourCount(location: SafeDatasetLocation) {
  const url = getContourQueryUrl(location, 1);
  url.searchParams.set("returnCountOnly", "true");
  url.searchParams.set("returnGeometry", "false");

  const payload = await fetchJson<{ count?: number }>(url);
  return payload.count ?? null;
}

async function fetchTransportationFeatures(location: SafeDatasetLocation) {
  const responses = await Promise.all(
    transportLayerConfig.map((layer) =>
      fetchTransportLayerFeatures(location, layer.layerId, layer.kind).catch(
        () => [] as Array<{ kind: string; feature: TransportFeature }>
      )
    )
  );
  return responses.flat();
}

async function fetchTransportLayerFeatures(
  location: SafeDatasetLocation,
  layerId: number,
  layerKind: (typeof transportLayerConfig)[number]["kind"]
) {
  const features: Array<{ kind: string; feature: TransportFeature }> = [];
  let offset = 0;

  while (features.length < transportMaxFeaturesPerLayer) {
    const remaining = transportMaxFeaturesPerLayer - features.length;
    const pageSize = Math.min(transportPageSize, remaining);
    const payload = await fetchJson<TransportResponse>(
      getTransportQueryUrl(location, layerId, pageSize, layerKind, offset)
    );
    const batch = payload.features ?? [];
    features.push(
      ...batch.map((feature) => ({
        kind: layerKind,
        feature
      }))
    );

    if (batch.length < pageSize) {
      break;
    }

    offset += batch.length;
  }

  return features;
}

function getTransportQueryUrl(
  location: SafeDatasetLocation,
  layerId: number,
  limit: number,
  layerKind: (typeof transportLayerConfig)[number]["kind"],
  offset = 0
) {
  const url = new URL(
    `https://carto.nationalmap.gov/arcgis/rest/services/transportation/MapServer/${layerId}/query`
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("where", "1=1");
  url.searchParams.set(
    "outFields",
    layerKind === "trail" ? "maplabel,name" : "name,us_route,state_route,mtfcc_code,tnmfrc"
  );
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("geometry", bboxString(location));
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("resultRecordCount", String(limit));
  if (offset > 0) {
    url.searchParams.set("resultOffset", String(offset));
  }
  return url;
}

async function fetchHydrographyFeatures(location: SafeDatasetLocation, limit: number) {
  const perLayerLimit = Math.max(40, Math.ceil(limit / 3));
  const layerIds = [
    nhdHydroLayerIds.flowlineSmall,
    nhdHydroLayerIds.flowlineLarge,
    nhdHydroLayerIds.waterbodyLarge
  ];
  const responses = await Promise.all(
    layerIds.map((layerId) =>
      fetchJson<HydroResponse>(getHydroQueryUrl(location, layerId, perLayerLimit)).catch(
        () => ({ features: [] as HydroFeature[] })
      )
    )
  );
  return responses.flatMap((response) => response.features ?? []);
}

function getHydroQueryUrl(location: SafeDatasetLocation, layerId: number, limit: number) {
  const url = new URL(
    `https://hydro.nationalmap.gov/arcgis/rest/services/nhd/MapServer/${layerId}/query`
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "gnis_name,ftype,fcode");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("geometry", bboxString(location));
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("resultRecordCount", String(limit));
  return url;
}

async function fetchContourFeatures(location: SafeDatasetLocation, limit: number) {
  const payload = await fetchJson<ContourResponse>(getContourQueryUrl(location, limit));
  return payload.features ?? [];
}

function getContourQueryUrl(location: SafeDatasetLocation, limit: number) {
  const url = new URL(
    "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer/26/query"
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "contourelevation,contourinterval");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("geometry", bboxString(location));
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("resultRecordCount", String(limit));
  return url;
}

async function fetchSoilFeatures(location: SafeDatasetLocation, limit: number) {
  const response = await fetchText(getSoilQueryUrl(location, limit));
  return parseSoilGml(response);
}

function getSoilQueryUrl(location: SafeDatasetLocation, limit: number) {
  const url = new URL(
    "https://sdmdataaccess.sc.egov.usda.gov/Spatial/SDMWGS84Geographic.wfs"
  );
  url.searchParams.set("SERVICE", "WFS");
  url.searchParams.set("VERSION", "1.1.0");
  url.searchParams.set("REQUEST", "GetFeature");
  url.searchParams.set("TYPENAME", "MapunitPoly");
  url.searchParams.set("BBOX", bboxString(location));
  url.searchParams.set("MAXFEATURES", String(limit));
  url.searchParams.set("OUTPUTFORMAT", "GML3");
  return url;
}

async function fetchFloodHazardFeatures(location: SafeDatasetLocation, limit: number) {
  const payload = await fetchJson<PolygonResponse>(
    getFloodHazardQueryUrl(location, limit)
  );
  return payload.features ?? [];
}

function getFloodHazardQueryUrl(location: SafeDatasetLocation, limit: number) {
  const url = new URL(
    "https://hazards.fema.gov/gis/nfhl/rest/services/public/NFHL/MapServer/28/query"
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("where", "1=1");
  url.searchParams.set(
    "outFields",
    "FLD_ZONE,ZONE_SUBTY,SFHA_TF,STATIC_BFE,V_DATUM,DEPTH,LEN_UNIT"
  );
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set("geometry", bboxString(location));
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("resultRecordCount", String(limit));
  return url;
}

function createProviderLayers(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  datasetIds: SafeDatasetId[],
  contourFeatures: ContourFeature[],
  hydroFeatures: HydroFeature[],
  transportFeatures: Array<{ kind: string; feature: TransportFeature }>,
  soilFeatures: PolygonFeature[],
  floodFeatures: PolygonFeature[],
  assets: PersistedRasterAsset[]
): PlanningLayer[] {
  return datasetIds.map((datasetId) => {
    if (datasetId === "usgs-contours") {
      return createContourLayer(project, location, contourFeatures);
    }

    if (datasetId === "hydrography") {
      return createHydrographyLayer(project, location, hydroFeatures);
    }

    if (datasetId === "transportation") {
      return createTransportationLayer(project, location, transportFeatures);
    }

    if (datasetId === "soil") {
      return createSoilLayer(project, location, soilFeatures);
    }

    if (datasetId === "flood-hazard") {
      return createFloodHazardLayer(project, location, floodFeatures);
    }

    return createSourceReferenceLayer(
      project,
      location,
      datasetId,
      assets.find((asset) => asset.datasetId === datasetId)
    );
  });
}

function createContourLayer(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  contourFeatures: ContourFeature[]
): PlanningLayer {
  const features = contourFeatures.flatMap((feature, featureIndex) =>
    contourFeatureToVectorFeatures(project, feature, featureIndex)
  );

  return {
    id: "safe-data-usgs-contours",
    name: datasetLabels["usgs-contours"],
    kind: "foundational-map",
    visible: true,
    opacity: 0.72,
    reviewStatus: "draft",
    category: "geomorphology",
    geometryType: "line",
    source: createLayerSource(project, location, "usgs-contours"),
    style: {
      stroke: "#5f6f8a",
      fill: "#5f6f8a",
      strokeWidth: 1.25
    },
    legend: [{ label: "USGS contour line", color: "#5f6f8a" }],
    features,
    planningImpactNotes: [
      `${features.length} contour paths imported from the USGS contour service.`,
      `Target processing CRS: ${location.targetCrs}.`
    ],
    locked: true
  };
}

function createHydrographyLayer(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  hydroFeatures: HydroFeature[]
): PlanningLayer {
  const features = hydroFeatures.flatMap((feature, featureIndex) =>
    hydroFeatureToVectorFeatures(project, feature, featureIndex)
  );

  return {
    id: "safe-data-hydrography",
    name: datasetLabels.hydrography,
    kind: "foundational-map",
    visible: true,
    opacity: 0.88,
    reviewStatus: "draft",
    category: "hydrology",
    geometryType: "mixed",
    source: createLayerSource(project, location, "hydrography"),
    style: {
      stroke: "#2f7fb8",
      fill: "#4aa3cf",
      strokeWidth: 2
    },
    legend: [
      { label: "NHD flowline", color: "#2f7fb8" },
      { label: "NHD waterbody", color: "#4aa3cf" }
    ],
    features,
    planningImpactNotes: [
      `${features.length} hydro features imported from the USGS NHD MapServer.`,
      `Target processing CRS: ${location.targetCrs}.`
    ],
    locked: true
  };
}

function createTransportationLayer(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  transportFeatures: Array<{ kind: string; feature: TransportFeature }>
): PlanningLayer {
  const features = transportFeatures.flatMap(({ kind, feature }, featureIndex) =>
    transportFeatureToVectorFeatures(project, feature, featureIndex, kind)
  );

  return {
    id: "safe-data-transportation",
    name: datasetLabels.transportation,
    kind: "foundational-map",
    visible: true,
    opacity: 0.84,
    reviewStatus: "draft",
    category: "infrastructure-utilities",
    geometryType: "line",
    source: createLayerSource(project, location, "transportation"),
    style: {
      stroke: "#5a5f66",
      fill: "#5a5f66",
      strokeWidth: 1.5
    },
    legend: [
      { label: "Highways and arterials", color: "#4a4f56" },
      { label: "Local roads and trails", color: "#5a5f66" }
    ],
    features,
    planningImpactNotes: [
      `${features.length} transportation paths imported from the USGS National Map transportation service.`,
      `Target processing CRS: ${location.targetCrs}.`
    ],
    locked: true
  };
}

function createSoilLayer(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  soilFeatures: PolygonFeature[]
): PlanningLayer {
  const features = soilFeatures.flatMap((feature, featureIndex) =>
    polygonFeatureToVectorFeatures(
      project,
      feature,
      featureIndex,
      "soil-map-unit",
      "USDA NRCS Soil Data Access",
      "Provider soil map unit for drainage, erosion, planting, and suitability review."
    )
  );

  return {
    id: "safe-data-soil",
    name: datasetLabels.soil,
    kind: "foundational-map",
    visible: true,
    opacity: 0.58,
    reviewStatus: "draft",
    category: "soil",
    geometryType: "polygon",
    source: createLayerSource(project, location, "soil"),
    style: {
      stroke: "#8a6f3f",
      fill: "#b89655",
      strokeWidth: 1
    },
    legend: [{ label: "SSURGO map unit", color: "#b89655" }],
    features,
    planningImpactNotes: [
      `${features.length} soil map unit polygons imported from USDA NRCS Soil Data Access.`,
      `Target processing CRS: ${location.targetCrs}.`
    ],
    locked: true
  };
}

function createFloodHazardLayer(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  floodFeatures: PolygonFeature[]
): PlanningLayer {
  const features = floodFeatures.flatMap((feature, featureIndex) =>
    polygonFeatureToVectorFeatures(
      project,
      feature,
      featureIndex,
      "fema-flood-zone",
      "FEMA National Flood Hazard Layer",
      "Provider flood hazard polygon for regulatory flood risk and suitability review."
    )
  );

  return {
    id: "safe-data-flood-hazard",
    name: datasetLabels["flood-hazard"],
    kind: "foundational-map",
    visible: true,
    opacity: 0.5,
    reviewStatus: "draft",
    category: "risk-suitability",
    geometryType: "polygon",
    source: createLayerSource(project, location, "flood-hazard"),
    style: {
      stroke: "#7c4d78",
      fill: "#b874a8",
      strokeWidth: 1.25
    },
    legend: [{ label: "NFHL flood hazard zone", color: "#b874a8" }],
    features,
    planningImpactNotes: [
      features.length > 0
        ? `${features.length} flood hazard polygons imported from FEMA NFHL.`
        : "No FEMA NFHL flood hazard polygons intersected this AOI; the layer is retained as a source-coverage record.",
      "FEMA zones A, AE, AO, AH, and VE indicate mapped high-risk flood hazard areas; Zone X indicates lower or minimal mapped flood risk.",
      `Target processing CRS: ${location.targetCrs}.`
    ],
    locked: true
  };
}

function createSourceReferenceLayer(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  datasetId: SafeDatasetId,
  asset?: PersistedRasterAsset
): PlanningLayer {
  const isRaster = isRasterDataset(datasetId);
  return {
    id: `safe-data-${datasetId}`,
    name: datasetLabels[datasetId],
    kind: datasetId === "naip-ortho" ? "orthophoto" : "foundational-map",
    visible: true,
    opacity: getDefaultProviderLayerOpacity(datasetId),
    reviewStatus: "draft",
    category: getLayerCategory(datasetId),
    geometryType: isRaster ? "raster" : "mixed",
    source: createLayerSource(project, location, datasetId),
    style: {
      stroke: getLayerColor(datasetId),
      fill: getLayerColor(datasetId),
      strokeWidth: 1.5
    },
    legend: [{ label: datasetLabels[datasetId], color: getLayerColor(datasetId) }],
    ...(isRaster
      ? {
          rasterPreviewUrl: asset?.publicPath,
          rasterGeoreference: asset?.rasterGeoreference
        }
      : {}),
    planningImpactNotes: [
      asset
        ? `Persisted provider asset: ${asset.publicPath}.`
        : isRaster
        ? "Provider ImageServer returned a clipped TIFF export href for this AOI."
        : "Source reference returned by MCP; vector extraction worker is the next backend step.",
      `AOI: ${location.name}, ${location.region}.`
    ],
    locked: true
  };
}

async function persistRasterAssets(
  location: SafeDatasetLocation,
  sources: Array<{ datasetId: SafeDatasetId; export?: RasterExportResponse }>
) {
  const rasterSources = sources.filter(
    (source) => isRasterDataset(source.datasetId) && source.export?.href
  );
  const assets: PersistedRasterAsset[] = [];

  for (const source of rasterSources) {
    const href = source.export?.href;
    if (!href) {
      continue;
    }

    const publicPath = `/provider-assets/${location.id}/${source.datasetId}.tif`;
    const localPath = join(
      await findRepoRoot(),
      "apps",
      "web",
      "public",
      "provider-assets",
      location.id,
      `${source.datasetId}.tif`
    );
    const rasterExportOptions = getRasterExportOptions(source.datasetId);
    if (!rasterExportOptions) {
      continue;
    }

    await downloadRasterExport(location, rasterExportOptions, localPath);
    const stats = await stat(localPath);
    assets.push({
      datasetId: source.datasetId,
      sourceHref: href,
      localPath,
      publicPath,
      bytes: stats.size,
      width: source.export?.width ?? 1,
      height: source.export?.height ?? 1,
      rasterGeoreference: createRasterGeoreferenceFromExport(
        location,
        source.export,
        source.export?.width ?? 1,
        source.export?.height ?? 1
      )
    });
  }

  return assets;
}

async function downloadRasterExport(
  location: SafeDatasetLocation,
  options: RasterExportOptions,
  localPath: string
) {
  await mkdir(dirname(localPath), { recursive: true });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), rasterDownloadTimeoutMs);
  const url = buildRasterExportUrl(location, options, "image");

  try {
    const response = await fetch(url, {
      signal: controller.signal
    });
    if (!response.ok || !response.body) {
      throw new Error(`Provider asset download failed: ${response.status}`);
    }

    await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
  } catch (error) {
    throw formatProviderFetchError(
      error,
      `${url.hostname} raster download`,
      rasterDownloadTimeoutMs
    );
  } finally {
    clearTimeout(timeout);
  }
}

async function findRepoRoot() {
  let current = process.cwd();

  for (let depth = 0; depth < 5; depth += 1) {
    try {
      const packageJson = JSON.parse(
        await readFile(join(current, "package.json"), "utf8")
      ) as { name?: string };
      if (packageJson.name === "landschaft") {
        return current;
      }
    } catch {
      // Keep walking upward until the workspace package is found.
    }

    const parent = dirname(current);
    if (parent === current) {
      break;
    }
    current = parent;
  }

  throw new Error("Could not locate Landschaft workspace root.");
}

function createRasterGeoreferenceFromExport(
  location: SafeDatasetLocation,
  rasterExport: RasterExportResponse | undefined,
  imageWidthPixels: number,
  imageHeightPixels: number
): RasterGeoreference {
  const extent = rasterExport?.extent ?? {
    xmin: location.bbox.west,
    ymin: location.bbox.south,
    xmax: location.bbox.east,
    ymax: location.bbox.north
  };
  const corners = getCornersFromLocation(location);
  const projectLike = {
    corners,
    realWorldExtentMeters: getExtentMeters(corners)
  };
  const projectMin = mapCoordinateToProject([extent.xmin, extent.ymin], projectLike);
  const projectMax = mapCoordinateToProject([extent.xmax, extent.ymax], projectLike);

  return {
    projectMin: [
      Math.min(projectMin[0], projectMax[0]),
      Math.min(projectMin[1], projectMax[1])
    ],
    projectMax: [
      Math.max(projectMin[0], projectMax[0]),
      Math.max(projectMin[1], projectMax[1])
    ],
    imageWidthPixels,
    imageHeightPixels,
    parsedFrom: "geotiff"
  };
}

function contourFeatureToVectorFeatures(
  project: ProjectMetadata,
  feature: ContourFeature,
  featureIndex: number
): VectorFeature[] {
  const elevation = feature.attributes?.contourelevation;
  const interval = feature.attributes?.contourinterval;
  const paths = feature.geometry?.paths ?? [];

  return paths.map((path, pathIndex) => {
    const points = path.map((point) =>
      Array.isArray(point)
        ? mapCoordinateToProject([Number(point[0]), Number(point[1])], project)
        : mapCoordinateToProject([point.x, point.y], project)
    );

    return {
      id: `usgs-contour-${featureIndex + 1}-${pathIndex + 1}`,
      label:
        typeof elevation === "number"
          ? `Contour ${Math.round(elevation)}`
          : `Contour ${featureIndex + 1}`,
      geometryType: "line",
      coordinates: points,
      attributes: {
        source: "USGS National Map Contours",
        ...(typeof elevation === "number" ? { elevation: String(elevation) } : {}),
        ...(typeof interval === "number" ? { interval: String(interval) } : {})
      },
      planningImpact:
        "Provider contour line for terrain and landscape morphology review."
    };
  });
}

function hydroFeatureToVectorFeatures(
  project: ProjectMetadata,
  feature: HydroFeature,
  featureIndex: number
): VectorFeature[] {
  const attributes = feature.attributes ?? {};
  const name =
    attributes.gnis_name ??
    attributes.GNIS_NAME ??
    attributes.ftype_desc ??
    `Hydro ${featureIndex + 1}`;
  const label = typeof name === "string" || typeof name === "number" ? String(name) : `Hydro ${featureIndex + 1}`;
  const attributeEntries: Record<string, string> = {
    source: "USGS National Hydrography Dataset"
  };
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) {
      continue;
    }
    attributeEntries[key] = String(value);
  }

  const vectorFeatures: VectorFeature[] = [];
  const paths = feature.geometry?.paths ?? [];
  for (const [pathIndex, path] of paths.entries()) {
    const coordinates = path.map((point) =>
      Array.isArray(point)
        ? mapCoordinateToProject([Number(point[0]), Number(point[1])], project)
        : mapCoordinateToProject([point.x, point.y], project)
    );
    if (coordinates.length < 2) {
      continue;
    }
    vectorFeatures.push({
      id: `nhd-flowline-${featureIndex + 1}-${pathIndex + 1}`,
      label,
      geometryType: "line",
      coordinates,
      attributes: attributeEntries,
      planningImpact: "Provider hydro flowline for drainage and watercourse review."
    });
  }

  const rings = feature.geometry?.rings ?? [];
  for (const [ringIndex, ring] of rings.entries()) {
    const coordinates = ring.map((point) =>
      Array.isArray(point)
        ? mapCoordinateToProject([Number(point[0]), Number(point[1])], project)
        : mapCoordinateToProject([point.x, point.y], project)
    );
    if (coordinates.length < 3) {
      continue;
    }
    vectorFeatures.push({
      id: `nhd-waterbody-${featureIndex + 1}-${ringIndex + 1}`,
      label,
      geometryType: "polygon",
      coordinates,
      attributes: attributeEntries,
      planningImpact: "Provider hydro waterbody for pond, lake, and wetland review."
    });
  }

  return vectorFeatures;
}

function transportFeatureToVectorFeatures(
  project: ProjectMetadata,
  feature: TransportFeature,
  featureIndex: number,
  layerKind: string
): VectorFeature[] {
  const attributes = feature.attributes ?? {};
  const label = getTransportFeatureLabel(attributes, layerKind, featureIndex);
  const attributeEntries: Record<string, string> = {
    source: "USGS National Map Transportation",
    layerKind
  };
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) {
      continue;
    }
    attributeEntries[key] = String(value);
  }

  const paths = feature.geometry?.paths ?? [];
  const vectorFeatures: VectorFeature[] = [];
  for (const [pathIndex, path] of paths.entries()) {
    const coordinates = path.map((point) =>
      Array.isArray(point)
        ? mapCoordinateToProject([Number(point[0]), Number(point[1])], project)
        : mapCoordinateToProject([point.x, point.y], project)
    );
    if (coordinates.length < 2) {
      continue;
    }
    vectorFeatures.push({
      id: `ntd-${layerKind}-${featureIndex + 1}-${pathIndex + 1}`,
      label,
      geometryType: "line",
      coordinates,
      attributes: attributeEntries,
      planningImpact: "Provider transportation path for circulation and access review."
    });
  }
  return vectorFeatures;
}

function polygonFeatureToVectorFeatures(
  project: ProjectMetadata,
  feature: PolygonFeature,
  featureIndex: number,
  idPrefix: string,
  source: string,
  planningImpact: string
): VectorFeature[] {
  const attributes = feature.attributes ?? {};
  const attributeEntries: Record<string, string> = { source };
  for (const [key, value] of Object.entries(attributes)) {
    if (value === null || value === undefined) {
      continue;
    }
    attributeEntries[key] = String(value);
  }

  const label = getPolygonFeatureLabel(attributes, idPrefix, featureIndex);
  const vectorFeatures: VectorFeature[] = [];
  const rings = feature.geometry?.rings ?? [];
  for (const [ringIndex, ring] of rings.entries()) {
    const coordinates = ring.map((point) =>
      Array.isArray(point)
        ? mapCoordinateToProject([Number(point[0]), Number(point[1])], project)
        : mapCoordinateToProject([point.x, point.y], project)
    );
    if (coordinates.length < 3) {
      continue;
    }
    vectorFeatures.push({
      id: `${idPrefix}-${featureIndex + 1}-${ringIndex + 1}`,
      label,
      geometryType: "polygon",
      coordinates,
      attributes: attributeEntries,
      planningImpact
    });
  }

  return vectorFeatures;
}

function getPolygonFeatureLabel(
  attributes: Record<string, string | number | null | undefined>,
  fallbackPrefix: string,
  featureIndex: number
) {
  const candidate =
    attributes.musym ??
    attributes.nationalmusym ??
    attributes.mukey ??
    attributes.FLD_ZONE ??
    attributes.ZONE_SUBTY;
  if (typeof candidate === "string" && candidate.trim()) {
    return candidate.trim();
  }
  if (typeof candidate === "number") {
    return String(candidate);
  }
  return `${fallbackPrefix.replace(/-/g, " ")} ${featureIndex + 1}`;
}

function getTransportFeatureLabel(
  attributes: Record<string, string | number | null | undefined>,
  layerKind: string,
  featureIndex: number
) {
  const name = attributes.name ?? attributes.maplabel;
  if (typeof name === "string" && name.trim()) {
    return name.trim();
  }
  if (typeof attributes.us_route === "string" && attributes.us_route.trim()) {
    return `US Route ${attributes.us_route.trim()}`;
  }
  if (typeof attributes.state_route === "string" && attributes.state_route.trim()) {
    return `State Route ${attributes.state_route.trim()}`;
  }

  return `${layerKind.replace(/-/g, " ")} ${featureIndex + 1}`;
}

function createLayerSource(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  datasetId: SafeDatasetId
) {
  return {
    sourceName: `${datasetLabels[datasetId]} / ${location.name}`,
    sourceType: "external-api" as const,
    sourceDate: new Date().toISOString().slice(0, 10),
    coordinateReferenceSystem: project.coordinateReferenceSystem,
    accuracyStatus: "public-dataset" as const,
    confidence: 0.86
  };
}

function getCornersFromLocation(location: SafeDatasetLocation): OrthophotoCorner[] {
  return [
    { label: "NW", latitude: location.bbox.north, longitude: location.bbox.west },
    { label: "NE", latitude: location.bbox.north, longitude: location.bbox.east },
    { label: "SE", latitude: location.bbox.south, longitude: location.bbox.east },
    { label: "SW", latitude: location.bbox.south, longitude: location.bbox.west }
  ];
}

function mapCoordinateToProject(
  mapCoordinate: [number, number],
  project: Pick<ProjectMetadata, "corners" | "realWorldExtentMeters">
): [number, number] {
  const longitudes = project.corners.map((corner) => corner.longitude);
  const latitudes = project.corners.map((corner) => corner.latitude);
  const minLongitude = Math.min(...longitudes);
  const maxLongitude = Math.max(...longitudes);
  const minLatitude = Math.min(...latitudes);
  const maxLatitude = Math.max(...latitudes);
  const u = safeRatio(mapCoordinate[0] - minLongitude, maxLongitude - minLongitude);
  const v = 1 - safeRatio(mapCoordinate[1] - minLatitude, maxLatitude - minLatitude);

  return [
    clamp(u * project.realWorldExtentMeters.width, 0, project.realWorldExtentMeters.width),
    clamp(v * project.realWorldExtentMeters.depth, 0, project.realWorldExtentMeters.depth)
  ];
}

function summarizeTnmProduct(product: TnmProduct) {
  return {
    title: product.title,
    format: product.format,
    publicationDate: product.publicationDate,
    lastUpdated: product.lastUpdated,
    sizeInBytes: product.sizeInBytes,
    downloadURL: product.downloadURL,
    previewGraphicURL: product.previewGraphicURL,
    boundingBox: product.boundingBox
  };
}

async function fetchJson<T>(url: URL): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), jsonRequestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${url.hostname} request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } catch (error) {
    throw formatProviderFetchError(error, url.hostname, jsonRequestTimeoutMs);
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchText(url: URL): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), jsonRequestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/xml,text/xml" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${url.hostname} request failed: ${response.status}`);
    }
    return await response.text();
  } catch (error) {
    throw formatProviderFetchError(error, url.hostname, jsonRequestTimeoutMs);
  } finally {
    clearTimeout(timeout);
  }
}

function parseSoilGml(gml: string): PolygonFeature[] {
  const features: PolygonFeature[] = [];
  const featureMatches = gml.matchAll(/<ms:mapunitpoly\b[\s\S]*?<\/ms:mapunitpoly>/g);
  for (const match of featureMatches) {
    const featureXml = match[0];
    const rings = Array.from(
      featureXml.matchAll(/<gml:posList[^>]*>([\s\S]*?)<\/gml:posList>/g)
    )
      .map((ringMatch) => parseGmlPosList(ringMatch[1]))
      .filter((ring) => ring.length >= 3);

    if (rings.length === 0) {
      continue;
    }

    features.push({
      attributes: {
        areasymbol: getXmlTagValue(featureXml, "areasymbol"),
        musym: getXmlTagValue(featureXml, "musym"),
        nationalmusym: getXmlTagValue(featureXml, "nationalmusym"),
        mukey: getXmlTagValue(featureXml, "mukey"),
        muareaacres: getXmlTagValue(featureXml, "muareaacres")
      },
      geometry: { rings }
    });
  }
  return features;
}

function parseGmlPosList(posList: string): number[][] {
  const values = posList
    .trim()
    .split(/\s+/)
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value));
  const points: number[][] = [];
  for (let index = 0; index < values.length - 1; index += 2) {
    points.push([values[index + 1], values[index]]);
  }
  return points;
}

function getXmlTagValue(xml: string, localName: string) {
  const pattern = new RegExp(`<ms:${localName}>([\\s\\S]*?)<\\/ms:${localName}>`);
  return decodeXmlEntities(pattern.exec(xml)?.[1]?.trim() ?? "");
}

function decodeXmlEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
}

function formatProviderFetchError(
  error: unknown,
  source: string,
  timeoutMs: number
): Error {
  if (error instanceof Error && error.name === "AbortError") {
    return new Error(
      `${source} timed out after ${Math.round(timeoutMs / 1000)}s. USGS services can be slow — retry in a moment or import fewer datasets at once.`
    );
  }

  if (error instanceof Error && error.message === "fetch failed") {
    return new Error(
      `${source} request failed before receiving a response. Check the network connection or retry with fewer datasets selected.`
    );
  }

  return error instanceof Error
    ? new Error(`${source} request failed: ${error.message}`)
    : new Error(`${source} request failed: ${String(error)}`);
}

function bboxString(location: SafeDatasetLocation) {
  return [
    location.bbox.west,
    location.bbox.south,
    location.bbox.east,
    location.bbox.north
  ].join(",");
}

function getLayerCategory(datasetId: SafeDatasetId): PlanningLayer["category"] {
  switch (datasetId) {
    case "naip-ortho":
      return "land-use-settlement";
    case "dem-3dep":
    case "usgs-contours":
      return "geomorphology";
    case "hydrography":
      return "hydrology";
    case "transportation":
      return "infrastructure-utilities";
    case "soil":
      return "soil";
    case "land-cover":
      return "ecology-vegetation";
    case "flood-hazard":
      return "risk-suitability";
    default:
      return "designer-created";
  }
}

function getLayerColor(datasetId: SafeDatasetId) {
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
    case "flood-hazard":
      return "#b874a8";
    default:
      return "#68706a";
  }
}

function isRasterDataset(datasetId: SafeDatasetId) {
  return datasetId === "naip-ortho" || datasetId === "dem-3dep" || datasetId === "land-cover";
}

function getDefaultProviderLayerOpacity(datasetId: SafeDatasetId) {
  if (datasetId === "land-cover") {
    return 0.72;
  }
  return isRasterDataset(datasetId) ? 1 : 0.68;
}

function safeRatio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
