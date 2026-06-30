/*
 * ---metadata---
 * type: app-source
 * description: MCP handlers for USA safe-location dataset discovery and import.
 * last-updated: 2026-06-30
 * last-model: codex-gpt-5
 * last-change: persist clipped provider raster exports as web-served assets
 * ---end-metadata---
 */
import { mkdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import {
  createProjectFitRasterGeoreference,
  generateTerrainProjectAsync,
  type OrthophotoCorner,
  type PlanningLayer,
  type ProjectMetadata,
  type TerrainGenerationRequest,
  type VectorFeature
} from "@landschaft/shared";

export type SafeDatasetId =
  | "naip-ortho"
  | "dem-3dep"
  | "usgs-contours"
  | "hydrography"
  | "transportation";

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

const requestTimeoutMs = 18_000;

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
    dataSource: "USGS The National Map / NAIP",
    datasets: [
      "naip-ortho",
      "dem-3dep",
      "usgs-contours",
      "hydrography",
      "transportation"
    ]
  }
];

const datasetLabels: Record<SafeDatasetId, string> = {
  "naip-ortho": "NAIP orthophoto",
  "dem-3dep": "3DEP DEM",
  "usgs-contours": "USGS contours",
  hydrography: "Hydrography",
  transportation: "Transportation"
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
    heightSource: "open-meteo"
  };
  const [manifest, terrainResult, contourFeatures] = await Promise.all([
    handleSafeDatasetManifest(location.id, selectedDatasetIds),
    generateTerrainProjectAsync(terrainRequest),
    selectedDatasetIds.includes("usgs-contours")
      ? fetchContourFeatures(location, 250).catch(() => [])
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
      "NAIP and DEM clipped TIFFs are persisted under the web public provider-assets directory.",
      "Hydrography and transportation are returned as TNM product references until vector extraction is added."
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

async function getDatasetManifestSource(
  location: SafeDatasetLocation,
  datasetId: SafeDatasetId
) {
  if (datasetId === "naip-ortho") {
    return {
      datasetId,
      label: datasetLabels[datasetId],
      provider: "USGS NAIP ImageServer",
      export: await fetchRasterExport(location, {
        serviceUrl:
          "https://imagery.nationalmap.gov/arcgis/rest/services/USGSNAIPImagery/ImageServer/exportImage",
        pixelType: "U8",
        size: "1536,1536",
        interpolation: "RSP_NearestNeighbor"
      })
    };
  }

  if (datasetId === "dem-3dep") {
    const products = await fetchTnmProducts(location, datasetId);
    return {
      datasetId,
      label: datasetLabels[datasetId],
      provider: "USGS 3DEP ImageServer / TNMAccess",
      export: await fetchRasterExport(location, {
        serviceUrl:
          "https://elevation.nationalmap.gov/arcgis/rest/services/3DEPElevation/ImageServer/exportImage",
        pixelType: "F32",
        size: "1024,1024",
        interpolation: "RSP_BilinearInterpolation",
        noData: "-9999"
      }),
      total: products.total ?? 0,
      products: (products.items ?? []).slice(0, 8).map(summarizeTnmProduct)
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

  const products = await fetchTnmProducts(location, datasetId);
  return {
    datasetId,
    label: datasetLabels[datasetId],
    provider: "USGS TNMAccess",
    total: products.total ?? 0,
    products: (products.items ?? []).slice(0, 8).map(summarizeTnmProduct)
  };
}

async function fetchRasterExport(
  location: SafeDatasetLocation,
  options: {
    serviceUrl: string;
    pixelType: string;
    size: string;
    interpolation: string;
    noData?: string;
  }
) {
  const url = new URL(options.serviceUrl);
  url.searchParams.set("f", "json");
  url.searchParams.set("bbox", bboxString(location));
  url.searchParams.set("bboxSR", "4326");
  url.searchParams.set("imageSR", "4326");
  url.searchParams.set("size", options.size);
  url.searchParams.set("format", "tiff");
  url.searchParams.set("pixelType", options.pixelType);
  url.searchParams.set("noData", options.noData ?? "0");
  url.searchParams.set("interpolation", options.interpolation);

  return fetchJson<RasterExportResponse>(url);
}

async function fetchTnmProducts(location: SafeDatasetLocation, datasetId: SafeDatasetId) {
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

async function fetchContourCount(location: SafeDatasetLocation) {
  const url = getContourQueryUrl(location, 1);
  url.searchParams.set("returnCountOnly", "true");
  url.searchParams.set("returnGeometry", "false");

  const payload = await fetchJson<{ count?: number }>(url);
  return payload.count ?? null;
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

function createProviderLayers(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  datasetIds: SafeDatasetId[],
  contourFeatures: ContourFeature[],
  assets: PersistedRasterAsset[]
): PlanningLayer[] {
  return datasetIds.map((datasetId) => {
    if (datasetId === "usgs-contours") {
      return createContourLayer(project, location, contourFeatures);
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

function createSourceReferenceLayer(
  project: ProjectMetadata,
  location: SafeDatasetLocation,
  datasetId: SafeDatasetId,
  asset?: PersistedRasterAsset
): PlanningLayer {
  const isRaster = datasetId === "naip-ortho" || datasetId === "dem-3dep";
  return {
    id: `safe-data-${datasetId}`,
    name: datasetLabels[datasetId],
    kind: datasetId === "naip-ortho" ? "orthophoto" : "foundational-map",
    visible: true,
    opacity: datasetId === "naip-ortho" ? 1 : 0.68,
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
          rasterGeoreference: createProjectFitRasterGeoreference(
            project,
            asset?.width ?? 1,
            asset?.height ?? 1
          )
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
    (source) =>
      (source.datasetId === "naip-ortho" || source.datasetId === "dem-3dep") &&
      source.export?.href
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
    await downloadFile(href, localPath);
    const stats = await stat(localPath);
    assets.push({
      datasetId: source.datasetId,
      sourceHref: href,
      localPath,
      publicPath,
      bytes: stats.size,
      width: source.export?.width ?? 1,
      height: source.export?.height ?? 1
    });
  }

  return assets;
}

async function downloadFile(url: string, localPath: string) {
  await mkdir(dirname(localPath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok || !response.body) {
    throw new Error(`Provider asset download failed: ${response.status}`);
  }

  await writeFile(localPath, Buffer.from(await response.arrayBuffer()));
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
  project: ProjectMetadata
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
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: { accept: "application/json" },
      signal: controller.signal
    });
    if (!response.ok) {
      throw new Error(`${url.hostname} request failed: ${response.status}`);
    }
    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
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
    default:
      return "#68706a";
  }
}

function safeRatio(numerator: number, denominator: number) {
  return denominator === 0 ? 0 : numerator / denominator;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}
