/*
 * ---metadata---
 * type: package-source
 * description: Shared geospatial and planning types for Landschaft apps.
 * last-updated: 2026-06-27
 * last-model: codex-gpt-5
 * last-change: add contour terrace polygons to terrain models
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
  contourInterval: z.number().positive().optional(),
  contourTerraces: z
    .array(
      z.object({
        elevation: z.number(),
        points: z.array(CoordinateSchema).min(3)
      })
    )
    .optional(),
  contourDiagnostics: z
    .object({
      featureCount: z.number().int().nonnegative(),
      pathCount: z.number().int().nonnegative(),
      openPathCount: z.number().int().nonnegative(),
      closedPathCount: z.number().int().nonnegative(),
      segmentCount: z.number().int().nonnegative(),
      ringCount: z.number().int().nonnegative(),
      elevations: z.array(z.number()),
      elevationStats: z.array(
        z.object({
          elevation: z.number(),
          pathCount: z.number().int().nonnegative(),
          openPathCount: z.number().int().nonnegative(),
          closedPathCount: z.number().int().nonnegative(),
          ringCount: z.number().int().nonnegative()
        })
      )
    })
    .optional(),
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
  contourInterval?: number;
  contourTerraces?: {
    elevation: number;
    points: Coordinate[];
  }[];
  contourDiagnostics?: {
    featureCount: number;
    pathCount: number;
    openPathCount: number;
    closedPathCount: number;
    segmentCount: number;
    ringCount: number;
    elevations: number[];
    elevationStats: {
      elevation: number;
      pathCount: number;
      openPathCount: number;
      closedPathCount: number;
      ringCount: number;
    }[];
  };
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
  "usgs-contours",
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

  if (request.heightSource === "usgs-contours") {
    const project = createProjectMetadata(request);
    const terrain = await generateTerrainModelFromUsgsContours(request, generatedAt);

    return {
      project,
      terrain,
      baseLayers: createBaseLayers()
    };
  }

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

type UsgsContourFeature = {
  attributes?: {
    contourelevation?: unknown;
    contourinterval?: unknown;
  };
  geometry?: {
    paths?: number[][][];
  };
};

type ContourSegment = {
  start: TerrainSamplePoint;
  end: TerrainSamplePoint;
  elevation: number;
  interval?: number;
};

type ContourRing = {
  points: TerrainSamplePoint[];
  elevation: number;
};

async function generateTerrainModelFromUsgsContours(
  request: NormalizedTerrainGenerationRequest,
  generatedAt = new Date().toISOString()
): Promise<TerrainModel> {
  const extent = getExtentMeters(request.corners);
  const gridSize = getContourGridSizeForQuality(request.quality);
  const samplePoints = createGridSamplePoints(request.corners, gridSize);
  const {
    diagnostics: contourDiagnostics,
    rings: contourRings,
    segments: contourSegments
  } =
    await fetchUsgsContourGeometry(request.corners);

  if (contourSegments.length === 0) {
    throw new Error(
      "No USGS contour lines with elevation attributes were found for this extent."
    );
  }

  const rawHeightmap = samplePoints.map((point) =>
    interpolateElevationFromContours(point, contourSegments)
  );
  const heightmap = applyClosedContourRings(
    smoothHeightmap(rawHeightmap, gridSize, 1),
    samplePoints,
    contourRings
  );
  const contourInterval = inferContourInterval(contourSegments);
  const contourTerraces = createContourTerraces(request.corners, contourRings);

  return {
    accuracyStatus: "external-dem",
    elevationProvider: "USGS National Map Contours",
    gridSize,
    width: extent.width,
    depth: extent.depth,
    minElevation: Math.min(...heightmap),
    maxElevation: Math.max(...heightmap),
    ...(contourInterval ? { contourInterval } : {}),
    contourTerraces,
    contourDiagnostics,
    heightmap,
    generatedAt
  };
}

async function fetchUsgsContourGeometry(corners: OrthophotoCorner[]) {
  const bbox = getBoundingBox(corners);
  const url = new URL(
    "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer/26/query"
  );
  url.searchParams.set("f", "json");
  url.searchParams.set("where", "1=1");
  url.searchParams.set("outFields", "contourelevation,contourinterval");
  url.searchParams.set("returnGeometry", "true");
  url.searchParams.set(
    "geometry",
    `${bbox.minLongitude},${bbox.minLatitude},${bbox.maxLongitude},${bbox.maxLatitude}`
  );
  url.searchParams.set("geometryType", "esriGeometryEnvelope");
  url.searchParams.set("inSR", "4326");
  url.searchParams.set("outSR", "4326");
  url.searchParams.set("spatialRel", "esriSpatialRelIntersects");
  url.searchParams.set("resultRecordCount", "2000");

  const response = await fetchWithRetry(url);
  if (!response.ok) {
    throw new Error(`USGS contour request failed: ${response.status}`);
  }

  const payload = (await response.json()) as { features?: UsgsContourFeature[] };
  const features = payload.features ?? [];
  const rings: ContourRing[] = [];
  const segments: ContourSegment[] = [];
  let closedPathCount = 0;
  let openPathCount = 0;
  let pathCount = 0;
  const elevations = new Set<number>();
  const statsByElevation = new Map<
    number,
    {
      closedPathCount: number;
      openPathCount: number;
      pathCount: number;
      ringCount: number;
    }
  >();

  for (const feature of features) {
    const elevation = feature.attributes?.contourelevation;
    const interval = feature.attributes?.contourinterval;
    if (typeof elevation !== "number") {
      continue;
    }
    elevations.add(elevation);
    const elevationStats =
      statsByElevation.get(elevation) ??
      {
        closedPathCount: 0,
        openPathCount: 0,
        pathCount: 0,
        ringCount: 0
      };
    statsByElevation.set(elevation, elevationStats);

    for (const path of feature.geometry?.paths ?? []) {
      pathCount += 1;
      elevationStats.pathCount += 1;
      const pathPoints = toTerrainSamplePath(path);
      if (isClosedContourPath(pathPoints)) {
        closedPathCount += 1;
        elevationStats.closedPathCount += 1;
        elevationStats.ringCount += 1;
        rings.push({
          points: pathPoints.slice(0, -1),
          elevation
        });
      } else {
        openPathCount += 1;
        elevationStats.openPathCount += 1;
      }

      for (let index = 0; index < path.length - 1; index += 1) {
        const [startLongitude, startLatitude] = path[index] ?? [];
        const [endLongitude, endLatitude] = path[index + 1] ?? [];
        if (
          typeof startLatitude !== "number" ||
          typeof startLongitude !== "number" ||
          typeof endLatitude !== "number" ||
          typeof endLongitude !== "number"
        ) {
          continue;
        }

        segments.push({
          start: { latitude: startLatitude, longitude: startLongitude },
          end: { latitude: endLatitude, longitude: endLongitude },
          elevation,
          interval: typeof interval === "number" && interval > 0 ? interval : undefined
        });
      }
    }
  }

  return {
    diagnostics: {
      featureCount: features.length,
      pathCount,
      openPathCount,
      closedPathCount,
      segmentCount: segments.length,
      ringCount: rings.length,
      elevations: Array.from(elevations).sort((a, b) => a - b),
      elevationStats: Array.from(statsByElevation.entries())
        .sort(([elevationA], [elevationB]) => elevationA - elevationB)
        .map(([elevation, stats]) => ({
          elevation,
          ...stats
        }))
    },
    rings,
    segments
  };
}

function toTerrainSamplePath(path: number[][]) {
  return path.flatMap((coordinate): TerrainSamplePoint[] => {
    const [longitude, latitude] = coordinate;
    if (typeof latitude !== "number" || typeof longitude !== "number") {
      return [];
    }

    return [{ latitude, longitude }];
  });
}

function isClosedContourPath(path: TerrainSamplePoint[]) {
  if (path.length < 4) {
    return false;
  }

  const first = path[0];
  const last = path[path.length - 1];
  if (!first || !last) {
    return false;
  }

  return getCoordinateDistanceMeters(first, last) < 3;
}

function applyClosedContourRings(
  heightmap: number[],
  samplePoints: TerrainSamplePoint[],
  rings: ContourRing[]
) {
  if (rings.length === 0) {
    return heightmap;
  }

  return heightmap.map((height, index) => {
    const point = samplePoints[index];
    if (!point) {
      return height;
    }

    let ringHeight = height;
    for (const ring of rings) {
      if (isPointInContourRing(point, ring.points)) {
        ringHeight = Math.max(ringHeight, ring.elevation);
      }
    }

    return Number(ringHeight.toFixed(2));
  });
}

function createContourTerraces(
  corners: OrthophotoCorner[],
  rings: ContourRing[]
) {
  const bbox = getBoundingBox(corners);
  const longitudeSpan = Math.max(bbox.maxLongitude - bbox.minLongitude, 0.000001);
  const latitudeSpan = Math.max(bbox.maxLatitude - bbox.minLatitude, 0.000001);

  return rings
    .map((ring) => ({
      elevation: ring.elevation,
      points: ring.points
        .map((point): Coordinate => [
          (point.longitude - bbox.minLongitude) / longitudeSpan,
          (bbox.maxLatitude - point.latitude) / latitudeSpan
        ])
        .filter(([u, v]) => u >= 0 && u <= 1 && v >= 0 && v <= 1)
    }))
    .filter((terrace) => terrace.points.length >= 3);
}

function isPointInContourRing(
  point: TerrainSamplePoint,
  ring: TerrainSamplePoint[]
) {
  let inside = false;

  for (
    let currentIndex = 0, previousIndex = ring.length - 1;
    currentIndex < ring.length;
    previousIndex = currentIndex, currentIndex += 1
  ) {
    const current = ring[currentIndex];
    const previous = ring[previousIndex];
    if (!current || !previous) {
      continue;
    }

    const crossesLatitude =
      current.latitude > point.latitude !== previous.latitude > point.latitude;
    if (!crossesLatitude) {
      continue;
    }

    const intersectionLongitude =
      ((previous.longitude - current.longitude) *
        (point.latitude - current.latitude)) /
        (previous.latitude - current.latitude) +
      current.longitude;

    if (point.longitude < intersectionLongitude) {
      inside = !inside;
    }
  }

  return inside;
}

function interpolateElevationFromContours(
  point: TerrainSamplePoint,
  contours: ContourSegment[]
) {
  const nearest = contours
    .map((contour) => ({
      elevation: contour.elevation,
      distance: getPointToSegmentDistanceMeters(point, contour.start, contour.end)
    }))
    .sort((a, b) => a.distance - b.distance)
    .slice(0, 32);

  const exact = nearest.find((sample) => sample.distance < 0.5);
  if (exact) {
    return exact.elevation;
  }

  let weightedElevation = 0;
  let totalWeight = 0;

  for (const sample of nearest) {
    const weight = 1 / Math.max(sample.distance ** 1.6, 1);
    weightedElevation += sample.elevation * weight;
    totalWeight += weight;
  }

  return weightedElevation / totalWeight;
}

function inferContourInterval(contours: ContourSegment[]) {
  const declaredInterval = contours.find((contour) => contour.interval)?.interval;
  if (declaredInterval) {
    return declaredInterval;
  }

  const elevations = Array.from(
    new Set(contours.map((contour) => Number(contour.elevation.toFixed(2))))
  ).sort((a, b) => a - b);
  const deltas = elevations
    .slice(1)
    .map((elevation, index) => Number((elevation - elevations[index]).toFixed(2)))
    .filter((delta) => delta > 0);

  return deltas[0] ?? undefined;
}

function getPointToSegmentDistanceMeters(
  point: TerrainSamplePoint,
  start: TerrainSamplePoint,
  end: TerrainSamplePoint
) {
  const averageLatitude =
    ((point.latitude + start.latitude + end.latitude) / 3) * (Math.PI / 180);
  const metersPerDegreeLatitude = 111_320;
  const metersPerDegreeLongitude =
    metersPerDegreeLatitude * Math.cos(averageLatitude);
  const px = point.longitude * metersPerDegreeLongitude;
  const py = point.latitude * metersPerDegreeLatitude;
  const ax = start.longitude * metersPerDegreeLongitude;
  const ay = start.latitude * metersPerDegreeLatitude;
  const bx = end.longitude * metersPerDegreeLongitude;
  const by = end.latitude * metersPerDegreeLatitude;
  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(px - ax, py - ay);
  }

  const t = Math.min(
    1,
    Math.max(0, ((px - ax) * dx + (py - ay) * dy) / lengthSquared)
  );
  const closestX = ax + dx * t;
  const closestY = ay + dy * t;

  return Math.hypot(px - closestX, py - closestY);
}

function smoothHeightmap(heightmap: number[], gridSize: number, passes: number) {
  let current = heightmap;

  for (let pass = 0; pass < passes; pass += 1) {
    current = current.map((value, index) => {
      const x = index % gridSize;
      const y = Math.floor(index / gridSize);

      if (x === 0 || y === 0 || x === gridSize - 1 || y === gridSize - 1) {
        return value;
      }

      const north = current[(y - 1) * gridSize + x] ?? value;
      const east = current[y * gridSize + x + 1] ?? value;
      const south = current[(y + 1) * gridSize + x] ?? value;
      const west = current[y * gridSize + x - 1] ?? value;

      return value * 0.5 + (north + east + south + west) * 0.125;
    });
  }

  return current.map((value) => Number(value.toFixed(2)));
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
  return getCoordinateDistanceMeters(start, end);
}

function getCoordinateDistanceMeters(
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

function getBoundingBox(corners: OrthophotoCorner[]) {
  const latitudes = corners.map((corner) => corner.latitude);
  const longitudes = corners.map((corner) => corner.longitude);

  return {
    minLatitude: Math.min(...latitudes),
    maxLatitude: Math.max(...latitudes),
    minLongitude: Math.min(...longitudes),
    maxLongitude: Math.max(...longitudes)
  };
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

function getContourGridSizeForQuality(quality: TerrainGenerationQuality) {
  if (quality === "fast-preview") {
    return 65;
  }

  if (quality === "detailed") {
    return 129;
  }

  return 97;
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
