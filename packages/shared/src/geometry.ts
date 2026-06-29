/*
 * ---metadata---
 * type: package-source
 * description: Project-extent geometry helpers and raster georeference contracts for Landschaft.
 * last-updated: 2026-06-28
 * last-model: composer
 * last-change: add extent bbox helpers and raster georeference schema
 * ---end-metadata---
 */
import { z } from "zod";

export const ProjectCoordinateSchema = z.tuple([z.number(), z.number()]);

export type ProjectCoordinate = z.infer<typeof ProjectCoordinateSchema>;

export const RasterGeoreferenceSchema = z.object({
  projectMin: ProjectCoordinateSchema,
  projectMax: ProjectCoordinateSchema,
  imageWidthPixels: z.number().positive(),
  imageHeightPixels: z.number().positive(),
  parsedFrom: z.enum(["world-file", "project-fit"]).optional(),
  worldFileSource: z.string().optional()
});

export interface RasterGeoreference {
  projectMin: ProjectCoordinate;
  projectMax: ProjectCoordinate;
  imageWidthPixels: number;
  imageHeightPixels: number;
  parsedFrom?: "world-file" | "project-fit";
  worldFileSource?: string;
}

export type ProjectExtentBbox = [number, number, number, number];

export interface ProjectExtentSource {
  realWorldExtentMeters: {
    width: number;
    depth: number;
  };
}

export function getProjectExtentBbox(project: ProjectExtentSource): ProjectExtentBbox {
  return [
    0,
    0,
    project.realWorldExtentMeters.width,
    project.realWorldExtentMeters.depth
  ];
}

export function isCoordinateInsideExtent(
  coordinate: ProjectCoordinate,
  project: ProjectExtentSource
): boolean {
  const [minX, minY, maxX, maxY] = getProjectExtentBbox(project);
  return (
    coordinate[0] >= minX &&
    coordinate[0] <= maxX &&
    coordinate[1] >= minY &&
    coordinate[1] <= maxY
  );
}

export function createProjectFitRasterGeoreference(
  project: ProjectExtentSource,
  imageWidthPixels: number,
  imageHeightPixels: number
): RasterGeoreference {
  const { width, depth } = project.realWorldExtentMeters;
  return {
    projectMin: [0, 0],
    projectMax: [width, depth],
    imageWidthPixels,
    imageHeightPixels,
    parsedFrom: "project-fit"
  };
}
