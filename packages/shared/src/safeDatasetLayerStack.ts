/*
 * ---metadata---
 * type: package-source
 * description: Default opacity and Photoshop-style stack order for safe dataset import layers.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: match layer panel order from user screenshot
 * ---end-metadata---
 */
import type { PlanningLayer } from "./index.js";

export type SafeDatasetLayerKey =
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

export const SAFE_DATASET_LAYER_OPACITY: Record<SafeDatasetLayerKey, number> = {
  "naip-ortho": 1,
  "dem-3dep": 0.5,
  "usgs-contours": 1,
  hydrography: 1,
  transportation: 1,
  soil: 0.4,
  "land-cover": 0.4,
  structures: 1,
  buildings: 1,
  woodland: 1,
  boundaries: 0.46
};

/**
 * Panel index 0 is the front / top composite layer.
 * Order follows the user-provided import list top-to-bottom.
 */
export const SAFE_DATASET_PANEL_STACK = [
  "safe-data-hydrography",
  "safe-data-transportation",
  "safe-data-land-cover",
  "safe-data-structures",
  "safe-data-buildings",
  "safe-data-boundaries",
  "safe-data-woodland",
  "safe-data-soil",
  "safe-data-usgs-contours",
  "safe-data-dem-3dep",
  "safe-data-naip-ortho",
  "terrain-mesh",
  "orthophoto-base",
  "project-boundary"
] as const;

export function getSafeDatasetLayerKey(layerId: string): SafeDatasetLayerKey | null {
  if (!layerId.startsWith("safe-data-")) {
    return null;
  }

  return layerId.slice("safe-data-".length) as SafeDatasetLayerKey;
}

export function getSafeDatasetDefaultOpacity(
  datasetId: SafeDatasetLayerKey
): number {
  return SAFE_DATASET_LAYER_OPACITY[datasetId];
}

export function applySafeDatasetLayerStack(layers: PlanningLayer[]): PlanningLayer[] {
  const rank = new Map(
    SAFE_DATASET_PANEL_STACK.map((layerId, index) => [layerId, index])
  );

  const normalized = layers.map((layer) => {
    const datasetId = getSafeDatasetLayerKey(layer.id);
    if (!datasetId) {
      return layer;
    }

    return {
      ...layer,
      opacity: getSafeDatasetDefaultOpacity(datasetId)
    };
  });

  return [...normalized].sort((layerA, layerB) => {
    const rankA = rank.get(layerA.id as (typeof SAFE_DATASET_PANEL_STACK)[number]) ?? 999;
    const rankB = rank.get(layerB.id as (typeof SAFE_DATASET_PANEL_STACK)[number]) ?? 999;

    if (rankA !== rankB) {
      return rankA - rankB;
    }

    return layerA.name.localeCompare(layerB.name);
  });
}
