/*
 * ---metadata---
 * type: package-source
 * description: Shared geospatial and planning types for Landschaft apps.
 * last-updated: 2026-06-27
 * last-model: codex-gpt-5
 * last-change: throttle and retry Open-Meteo elevation requests
 * ---end-metadata---
 */
import { z } from "zod";

export const CoordinateSchema = z.tuple([z.number(), z.number()]);
export const Coordinate3Schema = z.tuple([z.number(), z.number(), z.number()]);

export const RingSchema = z.array(CoordinateSchema).min(4);

export const CodedAreaSchema = z.object({
  id: z.string(),
  label: z.string(),
  ring: RingSchema,
  layer: z.string(),
  code: z.string(),
  meaning: z.string(),
  confidence: z.number().min(0).max(1)
});

export type Coordinate = z.infer<typeof CoordinateSchema>;
export type Coordinate3 = z.infer<typeof Coordinate3Schema>;
export type Ring = z.infer<typeof RingSchema>;
export type CodedArea = z.infer<typeof CodedAreaSchema>;

export type TerrainAccuracyStatus =
  | "survey-grade"
  | "external-dem"
  | "conceptual"
  | "flat";

export const OrthophotoCornerSchema = z.object({
  label: z.enum(["NW", "NE", "SE", "SW"]),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180)
});

export interface OrthophotoCorner {
  label: "NW" | "NE" | "SE" | "SW";
  latitude: number;
  longitude: number;
}

export const ProjectMetadataSchema = z.object({
  id: z.string(),
  name: z.string(),
  coordinateReferenceSystem: z.string(),
  sourceImageName: z.string().optional(),
  corners: z.array(OrthophotoCornerSchema).length(4),
  realWorldExtentMeters: z.object({
    width: z.number().positive(),
    depth: z.number().positive()
  })
});

export interface ProjectMetadata {
  id: string;
  name: string;
  coordinateReferenceSystem: string;
  sourceImageName?: string;
  corners: OrthophotoCorner[];
  realWorldExtentMeters: {
    width: number;
    depth: number;
  };
}

export const TerrainModelSchema = z.object({
  accuracyStatus: z.enum(["survey-grade", "external-dem", "conceptual", "flat"]),
  elevationProvider: z.string(),
  gridSize: z.number().int().min(2),
  width: z.number().positive(),
  depth: z.number().positive(),
  minElevation: z.number(),
  maxElevation: z.number(),
  heightmap: z.array(z.number()),
  generatedAt: z.string()
});

export interface TerrainModel {
  accuracyStatus: TerrainAccuracyStatus;
  elevationProvider: string;
  gridSize: number;
  width: number;
  depth: number;
  minElevation: number;
  maxElevation: number;
  heightmap: number[];
  generatedAt: string;
}

export const TerrainGenerationQualitySchema = z.enum([
  "fast-preview",
  "balanced",
  "detailed"
]);

export type TerrainGenerationQuality = z.infer<
  typeof TerrainGenerationQualitySchema
>;

export const TerrainHeightSourceSchema = z.enum([
  "open-meteo",
  "sample-external-dem",
  "flat"
]);

export type TerrainHeightSource = z.infer<typeof TerrainHeightSourceSchema>;

export const TerrainGenerationRequestSchema = z.object({
  projectId: z.string().default("project-demo"),
  projectName: z.string().default("Untitled Terrain Project"),
  coordinateReferenceSystem: z.string().default("EPSG:4326"),
  sourceImageName: z.string().optional(),
  corners: z.array(OrthophotoCornerSchema).length(4),
  quality: TerrainGenerationQualitySchema.default("balanced"),
  heightSource: TerrainHeightSourceSchema.default("sample-external-dem")
});

export type TerrainGenerationRequest = z.input<
  typeof TerrainGenerationRequestSchema
>;

export type NormalizedTerrainGenerationRequest = z.output<
  typeof TerrainGenerationRequestSchema
>;

export interface TerrainGenerationResult {
  project: ProjectMetadata;
  terrain: TerrainModel;
  baseLayers: PlanningLayer[];
}

export interface TerrainSamplePoint {
  latitude: number;
  longitude: number;
}

export interface ElevationProvider {
  id: TerrainHeightSource;
  label: string;
  accuracyStatus: TerrainAccuracyStatus;
  sample(points: TerrainSamplePoint[]): Promise<number[]>;
}

export type PlanningLayerKind =
  | "terrain"
  | "orthophoto"
  | "foundational-map"
  | "lca"
  | "sensitivity-capacity"
  | "strategy"
  | "suitability"
  | "framework"
  | "concept-masterplan";

export const PlanningLayerKindSchema = z.enum([
  "terrain",
  "orthophoto",
  "foundational-map",
  "lca",
  "sensitivity-capacity",
  "strategy",
  "suitability",
  "framework",
  "concept-masterplan"
]);

export type ReviewStatus =
  | "draft"
  | "needs-review"
  | "reviewed"
  | "approved"
  | "rejected";

export const ReviewStatusSchema = z.enum([
  "draft",
  "needs-review",
  "reviewed",
  "approved",
  "rejected"
]);

export const PlanningLayerSchema = z.object({
  id: z.string(),
  name: z.string(),
  kind: PlanningLayerKindSchema,
  visible: z.boolean(),
  opacity: z.number().min(0).max(1),
  reviewStatus: ReviewStatusSchema
});

export interface PlanningLayer {
  id: string;
  name: string;
  kind: PlanningLayerKind;
  visible: boolean;
  opacity: number;
  reviewStatus: ReviewStatus;
}

export const ProjectSnapshotSchema = z.object({
  project: ProjectMetadataSchema,
  terrain: TerrainModelSchema,
  layers: z.array(PlanningLayerSchema),
  terrainGenerated: z.boolean(),
  selectedLayerId: z.string().nullable(),
  coordinateStep: z.number().int().min(0).max(4).nullable()
});

export type ProjectSnapshot = z.infer<typeof ProjectSnapshotSchema>;

export function createProjectMetadata(
  request: NormalizedTerrainGenerationRequest
): ProjectMetadata {
  return {
    id: request.projectId,
    name: request.projectName,
    coordinateReferenceSystem: request.coordinateReferenceSystem,
    sourceImageName: request.sourceImageName,
    corners: request.corners,
    realWorldExtentMeters: getExtentMeters(request.corners)
  };
}

export function generateTerrainModel(
  request: NormalizedTerrainGenerationRequest,
  generatedAt = new Date().toISOString()
): TerrainModel {
  const extent = getExtentMeters(request.corners);
  const gridSize = getGridSizeForQuality(request.quality);
  const heightmap =
    request.heightSource === "flat"
      ? createFlatHeightmap(gridSize)
      : createSampleExternalDemHeightmap(gridSize);

  return {
    accuracyStatus: request.heightSource === "flat" ? "flat" : "external-dem",
    elevationProvider:
      request.heightSource === "flat"
        ? "Flat project surface"
        : "Sample external DEM provider",
    gridSize,
    width: extent.width,
    depth: extent.depth,
    minElevation: Math.min(...heightmap),
    maxElevation: Math.max(...heightmap),
    heightmap,
    generatedAt
  };
}

export function generateTerrainProject(
  input: TerrainGenerationRequest,
  generatedAt?: string
): TerrainGenerationResult {
  const request = TerrainGenerationRequestSchema.parse(input);
  const project = createProjectMetadata(request);
  const terrain = generateTerrainModel(request, generatedAt);

  return {
    project,
    terrain,
    baseLayers: createBaseLayers()
  };
}

export async function generateTerrainProjectAsync(
  input: TerrainGenerationRequest,
  generatedAt?: string
): Promise<TerrainGenerationResult> {
  const request = TerrainGenerationRequestSchema.parse(input);

  if (request.heightSource !== "open-meteo") {
    return generateTerrainProject(request, generatedAt);
  }

  const project = createProjectMetadata(request);
  const terrain = await generateTerrainModelFromProvider(
    request,
    openMeteoElevationProvider,
    generatedAt
  );

  return {
    project,
    terrain,
    baseLayers: createBaseLayers()
  };
}

export async function generateTerrainModelFromProvider(
  request: NormalizedTerrainGenerationRequest,
  provider: ElevationProvider,
  generatedAt = new Date().toISOString()
): Promise<TerrainModel> {
  const extent = getExtentMeters(request.corners);
  const gridSize = getGridSizeForQuality(request.quality);
  const samplePoints = createGridSamplePoints(request.corners, gridSize);
  const heightmap = await provider.sample(samplePoints);

  if (heightmap.length !== samplePoints.length) {
    throw new Error(
      `Elevation provider returned ${heightmap.length} values for ${samplePoints.length} sample points.`
    );
  }

  return {
    accuracyStatus: provider.accuracyStatus,
    elevationProvider: provider.label,
    gridSize,
    width: extent.width,
    depth: extent.depth,
    minElevation: Math.min(...heightmap),
    maxElevation: Math.max(...heightmap),
    heightmap,
    generatedAt
  };
}

export function getExtentMeters(corners: OrthophotoCorner[]) {
  const north = getCorner(corners, "NW");
  const east = getCorner(corners, "NE");
  const south = getCorner(corners, "SW");

  return {
    width: Math.max(1, Math.round(getDistanceMeters(north, east))),
    depth: Math.max(1, Math.round(getDistanceMeters(north, south)))
  };
}

export const openMeteoElevationProvider: ElevationProvider = {
  id: "open-meteo",
  label: "Open-Meteo Elevation API (Copernicus DEM GLO-90)",
  accuracyStatus: "external-dem",
  async sample(points) {
    const batches = chunkArray(points, 100);
    const elevations: number[] = [];

    for (const [batchIndex, batch] of batches.entries()) {
      const url = new URL("https://api.open-meteo.com/v1/elevation");
      url.searchParams.set(
        "latitude",
        batch.map((point) => point.latitude.toFixed(6)).join(",")
      );
      url.searchParams.set(
        "longitude",
        batch.map((point) => point.longitude.toFixed(6)).join(",")
      );

      const response = await fetchWithRetry(url);
      if (!response.ok) {
        throw new Error(`Open-Meteo elevation request failed: ${response.status}`);
      }

      const payload = (await response.json()) as { elevation?: unknown };
      if (!Array.isArray(payload.elevation)) {
        throw new Error("Open-Meteo elevation response did not include elevations.");
      }

      elevations.push(
        ...payload.elevation.map((value) => {
          if (typeof value !== "number") {
            throw new Error("Open-Meteo elevation response included a non-number.");
          }

          return value;
        })
      );

      if (batchIndex < batches.length - 1) {
        await delay(250);
      }
    }

    return elevations;
  }
};

async function fetchWithRetry(url: URL) {
  let response = await fetch(url);

  for (let attempt = 0; attempt < 2 && shouldRetry(response); attempt += 1) {
    const retryAfterSeconds = Number(response.headers.get("retry-after"));
    const retryDelay = Number.isFinite(retryAfterSeconds)
      ? retryAfterSeconds * 1000
      : 900 * (attempt + 1);
    await delay(retryDelay);
    response = await fetch(url);
  }

  return response;
}

function shouldRetry(response: Response) {
  return response.status === 429 || response.status >= 500;
}

function delay(milliseconds: number) {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

function createBaseLayers(): PlanningLayer[] {
  return [
    {
      id: "orthophoto-base",
      name: "Orthophoto Base",
      kind: "orthophoto",
      visible: true,
      opacity: 1,
      reviewStatus: "draft"
    },
    {
      id: "terrain-mesh",
      name: "Terrain Mesh",
      kind: "terrain",
      visible: true,
      opacity: 1,
      reviewStatus: "draft"
    }
  ];
}

function createFlatHeightmap(gridSize: number) {
  return Array.from({ length: gridSize * gridSize }, () => 0);
}

function createSampleExternalDemHeightmap(gridSize: number) {
  return Array.from({ length: gridSize * gridSize }, (_, index) => {
    const x = index % gridSize;
    const y = Math.floor(index / gridSize);
    const nx = x / (gridSize - 1);
    const ny = y / (gridSize - 1);
    const ridge = Math.sin(nx * Math.PI * 2.4) * 5.8;
    const drainage = Math.cos((nx + ny) * Math.PI * 1.8) * 3.6;
    const slope = (1 - ny) * 11.5;

    return Number((ridge + drainage + slope + 42).toFixed(2));
  });
}

function createGridSamplePoints(
  corners: OrthophotoCorner[],
  gridSize: number
): TerrainSamplePoint[] {
  const nw = getCorner(corners, "NW");
  const ne = getCorner(corners, "NE");
  const se = getCorner(corners, "SE");
  const sw = getCorner(corners, "SW");
  const points: TerrainSamplePoint[] = [];

  for (let gy = 0; gy < gridSize; gy += 1) {
    const v = gy / (gridSize - 1);
    for (let gx = 0; gx < gridSize; gx += 1) {
      const u = gx / (gridSize - 1);
      const northLatitude = lerp(nw.latitude, ne.latitude, u);
      const northLongitude = lerp(nw.longitude, ne.longitude, u);
      const southLatitude = lerp(sw.latitude, se.latitude, u);
      const southLongitude = lerp(sw.longitude, se.longitude, u);

      points.push({
        latitude: lerp(northLatitude, southLatitude, v),
        longitude: lerp(northLongitude, southLongitude, v)
      });
    }
  }

  return points;
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function chunkArray<T>(items: T[], size: number) {
  const chunks: T[][] = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

function getCorner(corners: OrthophotoCorner[], label: OrthophotoCorner["label"]) {
  const corner = corners.find((candidate) => candidate.label === label);

  if (!corner) {
    throw new Error(`Missing ${label} orthophoto corner.`);
  }

  return corner;
}

function getDistanceMeters(
  start: Pick<OrthophotoCorner, "latitude" | "longitude">,
  end: Pick<OrthophotoCorner, "latitude" | "longitude">
) {
  const metersPerDegreeLatitude = 111_320;
  const averageLatitude = ((start.latitude + end.latitude) / 2) * (Math.PI / 180);
  const metersPerDegreeLongitude =
    metersPerDegreeLatitude * Math.cos(averageLatitude);
  const deltaLatitude = (end.latitude - start.latitude) * metersPerDegreeLatitude;
  const deltaLongitude =
    (end.longitude - start.longitude) * metersPerDegreeLongitude;

  return Math.hypot(deltaLatitude, deltaLongitude);
}

function getGridSizeForQuality(quality: TerrainGenerationQuality) {
  if (quality === "fast-preview") {
    return 17;
  }

  if (quality === "detailed") {
    return 65;
  }

  return 33;
}

export interface MapReadRequest {
  projectId: string;
  selectedLayerIds: string[];
  extentAreaId?: string;
  geometryDetail: "summary" | "simplified" | "full";
}

export interface MapWriteDraftRequest {
  projectId: string;
  targetLayerId?: string;
  createLayerName?: string;
  features: CodedArea[];
  reason: string;
}
