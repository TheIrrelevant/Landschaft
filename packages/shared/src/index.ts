/*
 * ---metadata---
 * type: package-source
 * description: Shared geospatial and planning types for Landschaft apps.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: added terrain import workflow contracts
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

export interface OrthophotoCorner {
  label: "NW" | "NE" | "SE" | "SW";
  latitude: number;
  longitude: number;
}

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

export type ReviewStatus =
  | "draft"
  | "needs-review"
  | "reviewed"
  | "approved"
  | "rejected";

export interface PlanningLayer {
  id: string;
  name: string;
  kind: PlanningLayerKind;
  visible: boolean;
  opacity: number;
  reviewStatus: ReviewStatus;
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
