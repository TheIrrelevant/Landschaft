/*
 * type: package-source
 * description: Shared geospatial and planning types for Landschaft apps.
 * last-updated: 2026-06-24
 * last-model: codex-gpt-5
 * last-change: added first shared type contracts
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
