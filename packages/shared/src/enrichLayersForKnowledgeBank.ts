/*
 * ---metadata---
 * type: package-source
 * description: Unified async enrichment for all national-map layers before knowledge-base export.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: route soil, vector, and raster layers through one knowledge-bank enrich entrypoint
 * ---end-metadata---
 */
import type { PlanningLayer } from "./index.js";
import { enrichLayersWithSoilMapUnitNames } from "./soilMapUnitNames.js";

export async function enrichLayersForKnowledgeBank(layers: PlanningLayer[]) {
  return enrichLayersWithSoilMapUnitNames(layers);
}
