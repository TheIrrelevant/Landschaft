/*
 * ---metadata---
 * type: package-source
 * description: Catalog labels and colors for USGS, NAIP, USDA, and NLCD national-map datasets.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add NLCD, NHD, transport, structure, and boundary knowledge-bank catalogs
 * ---end-metadata---
 */

export interface NationalMapCatalogEntry {
  code: string;
  name: string;
  color: string;
}

export const NLCD_LAND_COVER_CLASSES: NationalMapCatalogEntry[] = [
  { code: "11", name: "Open Water", color: "#466b9f" },
  { code: "12", name: "Perennial Ice/Snow", color: "#d1def8" },
  { code: "21", name: "Developed, Open Space", color: "#dec5c5" },
  { code: "22", name: "Developed, Low Intensity", color: "#d99282" },
  { code: "23", name: "Developed, Medium Intensity", color: "#eb0000" },
  { code: "24", name: "Developed, High Intensity", color: "#ab0000" },
  { code: "31", name: "Barren Land", color: "#b3ac9f" },
  { code: "41", name: "Deciduous Forest", color: "#68ab5f" },
  { code: "42", name: "Evergreen Forest", color: "#1c5f2c" },
  { code: "43", name: "Mixed Forest", color: "#b5c58f" },
  { code: "52", name: "Shrub/Scrub", color: "#ccb879" },
  { code: "71", name: "Grassland/Herbaceous", color: "#dfd9c2" },
  { code: "81", name: "Pasture/Hay", color: "#dcd939" },
  { code: "82", name: "Cultivated Crops", color: "#ab6c28" },
  { code: "90", name: "Woody Wetlands", color: "#b8d9eb" },
  { code: "95", name: "Emergent Herbaceous Wetlands", color: "#6c9fb8" }
];

export const NLCD_WOODLAND_CLASS_CODES = new Set(["41", "42", "43", "52"]);

export const BOUNDARY_KIND_LABELS: Record<string, string> = {
  county: "County boundary",
  "incorporated-place": "Incorporated place",
  "unincorporated-place": "Unincorporated place",
  "national-park": "National park",
  "national-monument": "National monument",
  "national-forest": "National forest",
  "national-wilderness": "National wilderness",
  "national-grassland": "National grassland",
  "us-fish-wildlife-service": "US Fish and Wildlife Service land",
  "bureau-of-land-management": "Bureau of Land Management land"
};

export const STRUCTURE_KIND_LABELS: Record<string, string> = {
  cemetery: "Cemetery",
  "post-office": "Post office",
  "city-town-hall": "City or town hall",
  courthouse: "Courthouse",
  "historic-site": "Historic site",
  hospital: "Hospital",
  "ambulance-service": "Ambulance service",
  "fire-station": "Fire station",
  "police-station": "Police station",
  "college-university": "College or university",
  "technical-school": "Technical school",
  school: "School",
  campground: "Campground",
  trailhead: "Trailhead",
  cabin: "Cabin",
  shelter: "Shelter",
  "picnic-area": "Picnic area",
  headquarters: "Headquarters",
  "visitor-center": "Visitor center",
  "ranger-station": "Ranger station"
};

export const TRANSPORT_KIND_LABELS: Record<string, string> = {
  highway: "Primary highway",
  "secondary-highway": "Secondary highway",
  "connecting-road": "Connecting road",
  "local-road": "Local road",
  ramp: "Ramp",
  trail: "Trail"
};

export const BUILDING_TYPE_LABELS: Record<string, string> = {
  school: "School building",
  university: "University building",
  college: "College building",
  hospital: "Hospital building",
  public: "Public building",
  civic: "Civic building",
  commercial: "Commercial building",
  retail: "Retail building",
  industrial: "Industrial building",
  warehouse: "Warehouse",
  residential: "Residential building",
  house: "House",
  cabin: "Cabin",
  yes: "Building"
};

const NHD_FCODE_LABELS: Record<string, string> = {
  "33400": "Stream/River",
  "33600": "Canal/Ditch",
  "39000": "Lake/Pond",
  "43600": "Reservoir",
  "46600": "Swamp/Marsh",
  "46000": "Estuary",
  "55800": "Artificial path",
  "56600": "Coastline"
};

export function getNlcdClassesForLayer(layerId: string) {
  if (layerId.includes("woodland")) {
    return NLCD_LAND_COVER_CLASSES.filter((entry) => NLCD_WOODLAND_CLASS_CODES.has(entry.code));
  }

  if (layerId.includes("land-cover")) {
    return NLCD_LAND_COVER_CLASSES;
  }

  return [];
}

export function getNlcdClassByCode(code: string) {
  return NLCD_LAND_COVER_CLASSES.find((entry) => entry.code === code);
}

export function lookupNhdFeatureName(attributes: Record<string, string>) {
  if (attributes.gnis_name?.trim()) {
    return attributes.gnis_name.trim();
  }

  if (attributes.ftype_desc?.trim()) {
    return attributes.ftype_desc.trim();
  }

  if (attributes.fcode?.trim()) {
    return NHD_FCODE_LABELS[attributes.fcode.trim()] ?? `NHD feature ${attributes.fcode.trim()}`;
  }

  return "";
}

export function formatBoundaryKindLabel(layerKind: string) {
  return BOUNDARY_KIND_LABELS[layerKind] ?? layerKind.replace(/-/g, " ");
}

export function formatStructureKindLabel(layerKind: string) {
  return STRUCTURE_KIND_LABELS[layerKind] ?? layerKind.replace(/-/g, " ");
}

export function formatTransportKindLabel(layerKind: string) {
  return TRANSPORT_KIND_LABELS[layerKind] ?? layerKind.replace(/-/g, " ");
}

export function formatBuildingTypeLabel(buildingType: string) {
  return BUILDING_TYPE_LABELS[buildingType] ?? buildingType.replace(/-/g, " ");
}

export function formatLayerKindLabel(layerKind: string) {
  return layerKind
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getSafeDatasetId(layerId: string) {
  return layerId.startsWith("safe-data-") ? layerId.slice("safe-data-".length) : layerId;
}

export function isRasterKnowledgeLayer(layer: { id: string; geometryType?: string }) {
  const datasetId = getSafeDatasetId(layer.id);
  return (
    datasetId === "naip-ortho" ||
    datasetId === "dem-3dep" ||
    datasetId === "land-cover" ||
    datasetId === "woodland" ||
    layer.geometryType === "raster"
  );
}
