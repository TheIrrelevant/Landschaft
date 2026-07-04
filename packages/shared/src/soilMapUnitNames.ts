/*
 * ---metadata---
 * type: package-source
 * description: Resolve SSURGO map unit names from USDA Soil Data Access tabular API.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: fetch muname by mukey for soil knowledge-base and import labels
 * ---end-metadata---
 */
import type { PlanningLayer } from "./index.js";

const SDA_TABULAR_URL = "https://sdmdataaccess.sc.egov.usda.gov/Tabular/post.rest";
const MUKEY_BATCH_SIZE = 100;

export function isSoilKnowledgeLayer(layer: PlanningLayer) {
  return layer.category === "soil" || layer.id.includes("soil");
}

export function collectSoilMukeysFromLayers(layers: PlanningLayer[]) {
  const mukeys = new Set<string>();

  for (const layer of layers) {
    if (!isSoilKnowledgeLayer(layer)) {
      continue;
    }

    for (const feature of layer.features ?? []) {
      const mukey = feature.attributes.mukey?.trim();
      if (mukey) {
        mukeys.add(mukey);
      }
    }
  }

  return Array.from(mukeys);
}

export async function fetchMapUnitNamesByMukey(mukeys: string[]) {
  const uniqueMukeys = Array.from(new Set(mukeys.map((mukey) => mukey.trim()).filter(Boolean)));
  const namesByMukey: Record<string, string> = {};

  for (let index = 0; index < uniqueMukeys.length; index += MUKEY_BATCH_SIZE) {
    const chunk = uniqueMukeys.slice(index, index + MUKEY_BATCH_SIZE);
    const inList = chunk.map((mukey) => `'${mukey.replace(/'/g, "''")}'`).join(",");
    const query = `SELECT mukey, muname FROM mapunit WHERE mukey IN (${inList})`;
    const response = await fetch(SDA_TABULAR_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, format: "JSON" })
    });

    if (!response.ok) {
      throw new Error(`USDA soil name lookup failed: ${response.status}`);
    }

    const payload = (await response.json()) as { Table?: [string, string][] };
    for (const [mukey, muname] of payload.Table ?? []) {
      if (mukey && muname) {
        namesByMukey[mukey] = muname;
      }
    }
  }

  return namesByMukey;
}

export async function enrichLayersWithSoilMapUnitNames(layers: PlanningLayer[]) {
  const mukeys = collectSoilMukeysFromLayers(layers);
  if (!mukeys.length) {
    return layers;
  }

  const namesByMukey = await fetchMapUnitNamesByMukey(mukeys);
  if (!Object.keys(namesByMukey).length) {
    return layers;
  }

  return layers.map((layer) => {
    if (!isSoilKnowledgeLayer(layer) || !layer.features?.length) {
      return layer;
    }

    return {
      ...layer,
      features: layer.features.map((feature) => {
        const mukey = feature.attributes.mukey?.trim();
        const muname = mukey ? namesByMukey[mukey] : undefined;
        if (!muname) {
          return feature;
        }

        return {
          ...feature,
          label: muname,
          attributes: {
            ...feature.attributes,
            muname
          }
        };
      })
    };
  });
}
