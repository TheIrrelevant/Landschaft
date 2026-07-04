/*
 * ---metadata---
 * type: app-source
 * description: Three.js terrain preview scene for the Landschaft editor.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: keep orthophoto visible below woodland mask layer
 * ---end-metadata---
 */
import {
  OrbitControls,
  OrthographicCamera,
  PerspectiveCamera
} from "@react-three/drei";
import {
  Canvas,
  extend,
  type ThreeToJSXElements,
  useThree
} from "@react-three/fiber";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import { fromArrayBuffer } from "geotiff";
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide, FrontSide,
  Float32BufferAttribute,
  RepeatWrapping,
  ShapeUtils,
  SRGBColorSpace,
  TextureLoader,
  Vector2,
  type Texture
} from "three";
import * as THREE from "three/webgpu";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import type {
  Coordinate,
  PlanningLayer,
  ProjectMetadata,
  RasterGeoreference,
  TerrainModel
} from "@landschaft/shared";
import { useEditorStore } from "../state/editorStore";

declare module "@react-three/fiber" {
  // Required declaration-merge so R3F JSX knows the three/webgpu element types.
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface ThreeElements extends ThreeToJSXElements<typeof THREE> {}
}

extend(THREE as unknown as Parameters<typeof extend>[0]);

const WEBGPU_RENDERER_CACHE = new WeakMap<
  HTMLCanvasElement,
  Promise<THREE.WebGPURenderer>
>();

function createWebGPURenderer(props: { canvas?: HTMLCanvasElement }) {
  const canvas = props.canvas;
  const cached = canvas ? WEBGPU_RENDERER_CACHE.get(canvas) : undefined;
  if (cached) {
    return cached;
  }

  const promise = (async () => {
    const renderer = new THREE.WebGPURenderer({
      ...(props as ConstructorParameters<typeof THREE.WebGPURenderer>[0]),
      antialias: true
    });
    renderer.toneMapping = ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    (renderer as unknown as { localClippingEnabled: boolean }).localClippingEnabled =
      true;
    await renderer.init();
    return renderer;
  })();

  if (canvas) {
    WEBGPU_RENDERER_CACHE.set(canvas, promise);
  }

  return promise;
}

const VIEW_BACKGROUND = "#f2f2f2";
const GROUND_COLOR = "#ededed";
const TERRAIN_CLAY = "#d4d4d4";
const SOLID_TERRAIN_COLOR = "#cccccc";
const CONTOUR_COLOR = "#969696";
// Target scene span (world units) the terrain is fitted into by default. The
// underlying data stays in true metres; displayScale only affects presentation.
// 1:1 viewing = override displayScale to 1.
const TARGET_SCENE_SPAN = 40;
const RENDER_TERRAIN_GRID_SIZE = 129;
const CONTOUR_LEVELS = 14;
const CONTOUR_LIFT = 0.012;
const FIT_VERTICAL_EXAGGERATION = 2.4;
const GROUND_GRID_OFFSET = 0.08;
const RASTER_DRAPE_BASE_LIFT = 0.055;
const LAYER_STACK_LIFT_STEP = 0.035;
const VECTOR_OVERLAY_LIFT_BONUS = 0.08;
const BOUNDARY_LINE_LIFT = 0.018;
const MAX_CAMERA_RADIUS = 320;
const MAX_ONE_TO_ONE_RENDER_SPAN = TARGET_SCENE_SPAN;
const MAX_ONE_TO_ONE_WOODLAND_MARKERS = 64;
const MAX_ONE_TO_ONE_VECTOR_FEATURES = 420;
/** Only 100% opacity fully masks raster layers below in the stack. */
const FULL_LAYER_OPACITY = 1;
const TERRAIN_DRAPED_RASTER_LAYER_IDS = new Set([
  "safe-data-dem-3dep",
  "safe-data-land-cover"
]);
const SOIL_COLOR_PALETTE = [
  "#b89655",
  "#8fb56a",
  "#c7885f",
  "#d1b76a",
  "#87a982",
  "#b98f78",
  "#9f9a63",
  "#c2a173",
  "#7fa18f",
  "#d0a85c",
  "#a7b86c",
  "#b47c5f"
];
const BOUNDARY_KIND_COLORS: Record<string, string> = {
  county: "#7667b0",
  "incorporated-place": "#8d6aa8",
  "unincorporated-place": "#9a7ab4",
  "national-park": "#5f8f5c",
  "national-monument": "#7f8f5c",
  "national-forest": "#4f8a63",
  "national-wilderness": "#3f7f6b",
  "national-grassland": "#8da05a",
  "us-fish-wildlife-service": "#4f8f8a",
  "bureau-of-land-management": "#b09355"
};
const STRUCTURE_KIND_COLORS: Record<string, string> = {
  cemetery: "#757575",
  "post-office": "#8b6f42",
  "city-town-hall": "#6c5a9e",
  courthouse: "#6c5a9e",
  "historic-site": "#9a7845",
  hospital: "#b84e58",
  "ambulance-service": "#c6604f",
  "fire-station": "#bf4a3c",
  "police-station": "#3f5f93",
  "college-university": "#4c75a3",
  "technical-school": "#4c75a3",
  school: "#4c75a3",
  campground: "#5f8a52",
  trailhead: "#5f8a52",
  cabin: "#8b5f3d",
  shelter: "#7b6345",
  "picnic-area": "#6f8f4f",
  headquarters: "#6c5a9e",
  "visitor-center": "#5c8f8a",
  "ranger-station": "#4f7a55"
};
const BUILDING_TYPE_COLORS: Record<string, string> = {
  school: "#4c75a3",
  university: "#4c75a3",
  college: "#4c75a3",
  hospital: "#b84e58",
  public: "#6c5a9e",
  civic: "#6c5a9e",
  commercial: "#8b7a50",
  retail: "#9a8050",
  industrial: "#6f7378",
  warehouse: "#6f7378",
  residential: "#8f9dad",
  house: "#9a8a78",
  cabin: "#8b5f3d",
  yes: "#8f9dad"
};
/**
 * The terrain coordinate space.
 *
 * DATA stays in true metres (terrain.width/depth/elevation). Render height uses
 * a local datum so absolute elevations do not create a huge solid block.
 */
type TerrainSpace = {
  /** metres -> scene-units factor (uniform on all axes) */
  displayScale: number;
  /** display-only multiplier for reading subtle terrain relief */
  verticalScale: number;
  /** terrain footprint in scene units */
  sizeX: number;
  sizeZ: number;
  /** elevation span in metres */
  rangeMeters: number;
  /** absolute source elevation used as local render datum */
  minElevationMeters: number;
  /** local surface datum in scene units above the solid base */
  localDatumY: number;
  /** solid base position in scene units */
  baseY: number;
};

const LOCAL_TERRAIN_DATUM_METERS = 42;

type ProjectSpace = {
  displayScale: number;
  sizeX: number;
  sizeZ: number;
};

function getTerrainSpace(
  terrain: TerrainModel,
  scaleOverride?: number,
  verticalScale = FIT_VERTICAL_EXAGGERATION
): TerrainSpace {
  const maxMeters = Math.max(terrain.width, terrain.depth, 1);
  const displayScale = scaleOverride ?? TARGET_SCENE_SPAN / maxMeters;
  const rangeMeters = Math.max(terrain.maxElevation - terrain.minElevation, 0.01);

  return {
    displayScale,
    verticalScale,
    sizeX: terrain.width * displayScale,
    sizeZ: terrain.depth * displayScale,
    rangeMeters,
    minElevationMeters: terrain.minElevation,
    localDatumY: LOCAL_TERRAIN_DATUM_METERS * displayScale,
    baseY: 0
  };
}

function getProjectSpace(project: ProjectMetadata, scaleOverride?: number): ProjectSpace {
  const maxMeters = Math.max(
    project.realWorldExtentMeters.width,
    project.realWorldExtentMeters.depth,
    1
  );
  const displayScale = scaleOverride ?? TARGET_SCENE_SPAN / maxMeters;

  return {
    displayScale,
    sizeX: project.realWorldExtentMeters.width * displayScale,
    sizeZ: project.realWorldExtentMeters.depth * displayScale
  };
}

function getTerrainScaleOverride(
  terrain: TerrainModel,
  viewScaleMode: "fit" | "1:1"
) {
  if (viewScaleMode !== "1:1") {
    return undefined;
  }

  const maxMeters = Math.max(terrain.width, terrain.depth, 1);
  return Math.min(1, MAX_ONE_TO_ONE_RENDER_SPAN / maxMeters);
}

function getProjectScaleOverride(
  project: ProjectMetadata,
  viewScaleMode: "fit" | "1:1"
) {
  if (viewScaleMode !== "1:1") {
    return undefined;
  }

  const maxMeters = Math.max(
    project.realWorldExtentMeters.width,
    project.realWorldExtentMeters.depth,
    1
  );
  return Math.min(1, MAX_ONE_TO_ONE_RENDER_SPAN / maxMeters);
}

function getCanonicalTerrainGeometrySpace(terrain: TerrainModel) {
  return getTerrainSpace(terrain, 1, FIT_VERTICAL_EXAGGERATION);
}

type Vec3 = [number, number, number];

/**
 * Build a solid terrain block in local y-up space: heightmap top surface, four
 * side walls (skirts) dropping to a flat base, and a base cap. Shares
 * gridToLocal space with the contour lines. We rely on FrontSide + outward
 * winding for the walls/base, and computeVertexNormals for smooth top shading.
 */
function buildTerrainGeometry(terrain: TerrainModel, space: TerrainSpace) {
  const grid = getRenderGridSize(terrain);
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];
  const baseY = space.baseY;
  const last = grid - 1;

  const addVertex = (position: Vec3, uv: [number, number]) => {
    positions.push(position[0], position[1], position[2]);
    uvs.push(uv[0], uv[1]);
    return positions.length / 3 - 1;
  };
  const top = (gx: number, gy: number): Vec3 => {
    const u = gx / last;
    const v = gy / last;
    return normalizedGridToLocal(
      u,
      v,
      sampleHeightAt(terrain, space, u, v),
      space
    );
  };
  const bottom = (gx: number, gy: number): Vec3 => {
    const t = gridCoordToLocal(gx, gy, grid, 0, space);
    return [t[0], baseY, t[2]];
  };
  const indexedTri = (a: number, b: number, c: number) => {
    indices.push(a, b, c);
  };
  // tri pushes an isolated triangle for hard-edged walls and base faces.
  const tri = (
    a: Vec3,
    b: Vec3,
    c: Vec3,
    uvA: [number, number],
    uvB: [number, number],
    uvC: [number, number]
  ) => {
    indexedTri(addVertex(a, uvA), addVertex(b, uvB), addVertex(c, uvC));
  };

  const gridUv = (gx: number, gy: number): [number, number] => [gx / last, gy / last];
  const topVertexIndex = (gx: number, gy: number) => gy * grid + gx;

  // --- GROUP 0: Top surface (fabric) ---
  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      addVertex(top(gx, gy), gridUv(gx, gy));
    }
  }

  for (let gy = 0; gy < last; gy += 1) {
    for (let gx = 0; gx < last; gx += 1) {
      const a = topVertexIndex(gx, gy);
      const b = topVertexIndex(gx + 1, gy);
      const c = topVertexIndex(gx + 1, gy + 1);
      const d = topVertexIndex(gx, gy + 1);
      indexedTri(a, c, b);
      indexedTri(a, d, c);
    }
  }
  const topIndexCount = indices.length;

  // --- GROUP 1: Side walls + base (solid terrain) ---
  // Wall UVs span horizontal position (u) and vertical 0..1 (top=1, bottom=0).
  const wallTop: [number, number] = [0, 1];
  const wallBot: [number, number] = [0, 0];

  // North edge (gy = 0): faces -z.
  for (let gx = 0; gx < last; gx += 1) {
    const tA = top(gx, 0);
    const tB = top(gx + 1, 0);
    const bA = bottom(gx, 0);
    const bB = bottom(gx + 1, 0);
    tri(tA, bA, bB, wallTop, wallBot, wallBot);
    tri(tA, bB, tB, wallTop, wallBot, wallTop);
  }
  // South edge (gy = last): faces +z.
  for (let gx = 0; gx < last; gx += 1) {
    const tA = top(gx, last);
    const tB = top(gx + 1, last);
    const bA = bottom(gx, last);
    const bB = bottom(gx + 1, last);
    tri(tA, tB, bB, wallTop, wallTop, wallBot);
    tri(tA, bB, bA, wallTop, wallBot, wallBot);
  }
  // West edge (gx = 0): faces -x.
  for (let gy = 0; gy < last; gy += 1) {
    const tA = top(0, gy);
    const tB = top(0, gy + 1);
    const bA = bottom(0, gy);
    const bB = bottom(0, gy + 1);
    tri(tA, tB, bB, wallTop, wallTop, wallBot);
    tri(tA, bB, bA, wallTop, wallBot, wallBot);
  }
  // East edge (gx = last): faces +x.
  for (let gy = 0; gy < last; gy += 1) {
    const tA = top(last, gy);
    const tB = top(last, gy + 1);
    const bA = bottom(last, gy);
    const bB = bottom(last, gy + 1);
    tri(tA, bA, bB, wallTop, wallBot, wallBot);
    tri(tA, bB, tB, wallTop, wallBot, wallTop);
  }

  // Bottom cap: single downward-facing surface at baseY (replaces separate TerrainBaseCap plane).
  for (let gy = 0; gy < last; gy += 1) {
    for (let gx = 0; gx < last; gx += 1) {
      const bA = bottom(gx, gy);
      const bB = bottom(gx + 1, gy);
      const bC = bottom(gx + 1, gy + 1);
      const bD = bottom(gx, gy + 1);
      tri(bA, bC, bB, gridUv(gx, gy), gridUv(gx + 1, gy + 1), gridUv(gx + 1, gy));
      tri(bA, bD, bC, gridUv(gx, gy), gridUv(gx, gy + 1), gridUv(gx + 1, gy + 1));
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();

  // Group 0 = fabric top, group 1 = solid terrain sides/base.
  geometry.addGroup(0, topIndexCount, 0);
  geometry.addGroup(topIndexCount, indices.length - topIndexCount, 1);

  return geometry;
}

/**
 * Map a grid cell (gx, gy) + a scene-unit height into local scene space.
 * Terrain is centred on (0,0): plane-X -> scene-X, grid-row -> scene-Z. Sizes
 * are already metres * displayScale, so this places contour lines and the mesh
 * in the exact same space.
 */
function gridCoordToLocal(
  gx: number,
  gy: number,
  grid: number,
  height: number,
  space: TerrainSpace
): [number, number, number] {
  const u = gx / (grid - 1);
  const v = gy / (grid - 1);
  return normalizedGridToLocal(u, v, height, space);
}

function normalizedGridToLocal(
  u: number,
  v: number,
  height: number,
  space: TerrainSpace
): [number, number, number] {
  const x = (u - 0.5) * space.sizeX;
  const z = (v - 0.5) * space.sizeZ;
  return [x, height, z];
}

/**
 * Surface height for a cell, in scene units. Source elevation values remain
 * absolute in data, but render height is normalized to a local datum.
 */
function sampleHeightAt(
  terrain: TerrainModel,
  space: TerrainSpace,
  u: number,
  v: number
) {
  const elevation = sampleElevationAt(terrain, u, v);
  return elevationToSceneHeight(elevation, space);
}

function elevationToSceneHeight(elevation: number, space: TerrainSpace) {
  return (
    space.localDatumY +
    (elevation - space.minElevationMeters) * space.displayScale * space.verticalScale
  );
}

function sampleElevationAt(terrain: TerrainModel, u: number, v: number) {
  const sourceGrid = terrain.gridSize;
  const sourceLast = sourceGrid - 1;
  const sourceX = clamp(u, 0, 1) * sourceLast;
  const sourceY = clamp(v, 0, 1) * sourceLast;
  const x0 = Math.floor(sourceX);
  const y0 = Math.floor(sourceY);
  const x1 = Math.min(x0 + 1, sourceLast);
  const y1 = Math.min(y0 + 1, sourceLast);
  const tx = sourceX - x0;
  const ty = sourceY - y0;
  const h00 = heightmapValueAt(terrain, x0, y0);
  const h10 = heightmapValueAt(terrain, x1, y0);
  const h01 = heightmapValueAt(terrain, x0, y1);
  const h11 = heightmapValueAt(terrain, x1, y1);
  const north = lerp(h00, h10, tx);
  const south = lerp(h01, h11, tx);

  return lerp(north, south, ty);
}

function heightmapValueAt(terrain: TerrainModel, gx: number, gy: number) {
  return terrain.heightmap[gy * terrain.gridSize + gx] ?? terrain.minElevation;
}

function getRenderGridSize(terrain: TerrainModel) {
  return Math.max(terrain.gridSize, RENDER_TERRAIN_GRID_SIZE);
}

function projectUvFromGeoreference(
  u: number,
  v: number,
  project: ProjectMetadata,
  georef: RasterGeoreference
): [number, number] {
  const projectX = u * project.realWorldExtentMeters.width;
  const projectY = v * project.realWorldExtentMeters.depth;
  const rasterWidth = Math.max(georef.projectMax[0] - georef.projectMin[0], 0.01);
  const rasterDepth = Math.max(georef.projectMax[1] - georef.projectMin[1], 0.01);
  const rasterU = (projectX - georef.projectMin[0]) / rasterWidth;
  const rasterV = 1 - (projectY - georef.projectMin[1]) / rasterDepth;

  return [clamp(rasterU, 0, 1), clamp(rasterV, 0, 1)];
}

function buildDrapedRasterGeometry(
  terrain: TerrainModel,
  terrainSpace: TerrainSpace,
  project: ProjectMetadata,
  georef: RasterGeoreference,
  lift: number
) {
  const grid = getRenderGridSize(terrain);
  const last = grid - 1;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  for (let gy = 0; gy < grid; gy += 1) {
    for (let gx = 0; gx < grid; gx += 1) {
      const u = gx / last;
      const v = gy / last;
      const height = sampleHeightAt(terrain, terrainSpace, u, v) + lift;
      const [x, y, z] = normalizedGridToLocal(u, v, height, terrainSpace);
      const [rasterU, rasterV] = projectUvFromGeoreference(u, v, project, georef);
      positions.push(x, y, z);
      uvs.push(rasterU, rasterV);
    }
  }

  for (let gy = 0; gy < last; gy += 1) {
    for (let gx = 0; gx < last; gx += 1) {
      const a = gy * grid + gx;
      const b = gy * grid + gx + 1;
      const c = (gy + 1) * grid + gx + 1;
      const d = (gy + 1) * grid + gx;
      indices.push(a, c, b);
      indices.push(a, d, c);
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function lerp(start: number, end: number, amount: number) {
  return start + (end - start) * amount;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

/**
 * Extract isohypse (contour) line segments from the heightmap using marching
 * squares. For each grid cell we look at its 4 corner heights, and for each
 * contour level that passes through the cell we emit a line segment by linearly
 * interpolating the crossing points along the cell edges. Segments are produced
 * directly in local scene space so they sit on the 3D surface.
 */
function buildContourGeometry(terrain: TerrainModel, space: TerrainSpace) {
  const grid = getRenderGridSize(terrain);
  const positions: number[] = [];

  const surfaceMin = elevationToSceneHeight(terrain.minElevation, space);
  const surfaceMax = elevationToSceneHeight(terrain.maxElevation, space);
  const step = (surfaceMax - surfaceMin) / (CONTOUR_LEVELS + 1);
  const lift = CONTOUR_LIFT * Math.max(space.displayScale, 0.0001) * 50;

  for (let level = 1; level <= CONTOUR_LEVELS; level += 1) {
    const threshold = surfaceMin + step * level;

    for (let gy = 0; gy < grid - 1; gy += 1) {
      for (let gx = 0; gx < grid - 1; gx += 1) {
        const last = grid - 1;
        const h00 = sampleHeightAt(terrain, space, gx / last, gy / last);
        const h10 = sampleHeightAt(terrain, space, (gx + 1) / last, gy / last);
        const h01 = sampleHeightAt(terrain, space, gx / last, (gy + 1) / last);
        const h11 = sampleHeightAt(
          terrain,
          space,
          (gx + 1) / last,
          (gy + 1) / last
        );

        // Corner positions in grid coords: TL(gx,gy) TR(gx+1,gy) BL(gx,gy+1) BR(gx+1,gy+1)
        const crossings: Array<[number, number]> = [];

        // top edge: TL -> TR
        pushEdgeCrossing(crossings, threshold, gx, gy, h00, gx + 1, gy, h10);
        // right edge: TR -> BR
        pushEdgeCrossing(crossings, threshold, gx + 1, gy, h10, gx + 1, gy + 1, h11);
        // bottom edge: BR -> BL
        pushEdgeCrossing(crossings, threshold, gx + 1, gy + 1, h11, gx, gy + 1, h01);
        // left edge: BL -> TL
        pushEdgeCrossing(crossings, threshold, gx, gy + 1, h01, gx, gy, h00);

        // Connect crossings pairwise into segments (2 crossings = 1 line).
        for (let c = 0; c + 1 < crossings.length; c += 2) {
          const a = crossings[c];
          const b = crossings[c + 1];
          const pa = gridCoordToLocal(a[0], a[1], grid, threshold + lift, space);
          const pb = gridCoordToLocal(b[0], b[1], grid, threshold + lift, space);
          positions.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
        }
      }
    }
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

function pushEdgeCrossing(
  out: Array<[number, number]>,
  threshold: number,
  ax: number,
  ay: number,
  ah: number,
  bx: number,
  by: number,
  bh: number
) {
  const aAbove = ah >= threshold;
  const bAbove = bh >= threshold;
  if (aAbove === bAbove) {
    return;
  }

  const t = (threshold - ah) / (bh - ah);
  out.push([ax + (bx - ax) * t, ay + (by - ay) * t]);
}

function createFeltTexture() {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#ebebeb";
  ctx.fillRect(0, 0, size, size);

  // Felt = many soft, overlapping low-contrast fibre dabs (not single-pixel
  // noise, which reads as dirt). Short translucent strokes in random directions
  // build a woolly, matte textile surface.
  const strokes = 26000;
  for (let i = 0; i < strokes; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    const angle = Math.random() * Math.PI;
    const len = 3 + Math.random() * 6;
    const dark = Math.random() > 0.5;
    ctx.strokeStyle = dark
      ? "rgba(150,150,150,0.05)"
      : "rgba(255,255,255,0.06)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + Math.cos(angle) * len, y + Math.sin(angle) * len);
    ctx.stroke();
  }

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(3, 3);
  texture.anisotropy = 4;
  return texture;
}

function createSolidTerrainTexture() {
  const size = 256;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = "#cfcfcf";
  ctx.fillRect(0, 0, size, size);

  // Fine granular speckle to read as a solid extruded mass (neutral, no colour).
  const grain = ctx.getImageData(0, 0, size, size);
  for (let i = 0; i < grain.data.length; i += 4) {
    const n = (Math.random() - 0.5) * 22;
    grain.data[i] += n;
    grain.data[i + 1] += n;
    grain.data[i + 2] += n;
  }
  ctx.putImageData(grain, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(6, 2);
  texture.anisotropy = 4;
  return texture;
}

const orthophotoTextureCache = new Map<string, Texture>();

function loadOrthophotoTexture(url: string) {
  const cached = orthophotoTextureCache.get(url);
  if (cached) {
    return Promise.resolve(cached);
  }

  const loader = /\.(tif|tiff)(\?|$)/i.test(url)
    ? loadGeoTiffTexture(url)
    : loadImageTexture(url);

  return loader.then((texture) => {
    orthophotoTextureCache.set(url, texture);
    return texture;
  });
}

function useOrthophotoTexture(url: string | null) {
  const [texture, setTexture] = useState<Texture | null>(() =>
    url ? orthophotoTextureCache.get(url) ?? null : null
  );

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return undefined;
    }

    const cached = orthophotoTextureCache.get(url);
    if (cached) {
      setTexture(cached);
      return undefined;
    }

    let cancelled = false;

    loadOrthophotoTexture(url)
      .then((loadedTexture) => {
        if (!cancelled) {
          setTexture(loadedTexture);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setTexture(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return texture;
}

function loadImageTexture(url: string) {
  return new Promise<Texture>((resolve, reject) => {
    const loader = new TextureLoader();
    loader.load(
      url,
      (loadedTexture) => {
        loadedTexture.colorSpace = SRGBColorSpace;
        loadedTexture.anisotropy = 4;
        loadedTexture.needsUpdate = true;
        resolve(loadedTexture);
      },
      undefined,
      reject
    );
  });
}

function isOrthophotoGeoTiffUrl(url: string) {
  return /naip-ortho|orthophoto/i.test(url);
}

function isLandCoverGeoTiffUrl(url: string) {
  return /land-cover|nlcd/i.test(url);
}

function isWoodlandGeoTiffUrl(url: string) {
  return /woodland/i.test(url);
}

async function loadGeoTiffTexture(url: string) {
  if (isOrthophotoGeoTiffUrl(url)) {
    return loadGeoTiffRgbTexture(url);
  }

  if (isWoodlandGeoTiffUrl(url)) {
    return loadGeoTiffWoodlandTexture(url);
  }

  if (isLandCoverGeoTiffUrl(url)) {
    return loadGeoTiffLandCoverTexture(url);
  }

  return loadGeoTiffScalarTexture(url);
}

async function loadGeoTiffRgbTexture(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GeoTIFF texture request failed: ${response.status}`);
  }

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const sampleCount = image.getSamplesPerPixel();
  const rgbSamples = sampleCount >= 3 ? [0, 1, 2] : [0];
  const raster = (await image.readRasters({
    interleave: true,
    samples: rgbSamples
  })) as ArrayLike<number>;
  const stride = rgbSamples.length;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("GeoTIFF texture canvas could not be created.");
  }

  const imageData = context.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    const offset = index * 4;
    if (stride >= 3) {
      imageData.data[offset] = clampByte(Number(raster[index * stride]));
      imageData.data[offset + 1] = clampByte(Number(raster[index * stride + 1]));
      imageData.data[offset + 2] = clampByte(Number(raster[index * stride + 2]));
    } else {
      const tone = clampByte(Number(raster[index]));
      imageData.data[offset] = tone;
      imageData.data[offset + 1] = tone;
      imageData.data[offset + 2] = tone;
    }
    imageData.data[offset + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function lerpRgb(
  start: [number, number, number],
  end: [number, number, number],
  tone: number
): [number, number, number] {
  const clamped = Math.min(Math.max(tone, 0), 1);
  return [
    Math.round(start[0] + (end[0] - start[0]) * clamped),
    Math.round(start[1] + (end[1] - start[1]) * clamped),
    Math.round(start[2] + (end[2] - start[2]) * clamped)
  ];
}

function elevationToDivergingRgb(
  elevation: number,
  minElevation: number,
  maxElevation: number
): [number, number, number] {
  const green: [number, number, number] = [46, 168, 62];
  const blue: [number, number, number] = [42, 104, 220];
  const red: [number, number, number] = [220, 58, 42];
  const span = Math.max(maxElevation - minElevation, 0.0001);

  if (minElevation < 0 && maxElevation > 0) {
    if (elevation >= 0) {
      return lerpRgb(green, red, elevation / Math.max(maxElevation, 0.0001));
    }

    return lerpRgb(green, blue, elevation / Math.min(minElevation, -0.0001));
  }

  const tone = Math.min(Math.max((elevation - minElevation) / span, 0), 1);
  if (maxElevation <= 0) {
    return lerpRgb(blue, green, tone);
  }

  return lerpRgb(green, red, tone);
}

const NLCD_LAND_COVER_COLORS: Record<number, [number, number, number, number]> = {
  11: [70, 107, 159, 220],
  12: [209, 222, 248, 220],
  21: [222, 197, 197, 210],
  22: [217, 146, 130, 215],
  23: [235, 0, 0, 215],
  24: [171, 0, 0, 215],
  31: [179, 172, 159, 210],
  41: [104, 171, 95, 220],
  42: [28, 95, 44, 220],
  43: [181, 197, 143, 220],
  52: [204, 184, 121, 215],
  71: [223, 223, 194, 205],
  81: [220, 217, 57, 205],
  82: [171, 108, 40, 205],
  90: [184, 217, 235, 220],
  95: [108, 159, 184, 220]
};

const NLCD_WOODLAND_CLASSES = new Set([41, 42, 43, 52]);
type WoodlandMarkerKind = "deciduous" | "evergreen" | "mixed" | "shrub";
type WoodlandMarker = {
  id: string;
  kind: WoodlandMarkerKind;
  coordinate: Coordinate;
};

async function loadGeoTiffLandCoverTexture(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GeoTIFF texture request failed: ${response.status}`);
  }

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const raster = (await image.readRasters({
    interleave: true,
    samples: [0]
  })) as ArrayLike<number>;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("GeoTIFF texture canvas could not be created.");
  }

  const imageData = context.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    const value = Number(raster[index]);
    const [red, green, blue, alpha] =
      NLCD_LAND_COVER_COLORS[value] ?? ([104, 112, 106, 160] as const);
    const offset = index * 4;
    imageData.data[offset] = red;
    imageData.data[offset + 1] = green;
    imageData.data[offset + 2] = blue;
    imageData.data[offset + 3] = value > 0 ? alpha : 0;
  }
  context.putImageData(imageData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

async function loadGeoTiffWoodlandTexture(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GeoTIFF texture request failed: ${response.status}`);
  }

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const raster = (await image.readRasters({
    interleave: true,
    samples: [0]
  })) as ArrayLike<number>;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("GeoTIFF texture canvas could not be created.");
  }

  const imageData = context.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    const value = Number(raster[index]);
    const offset = index * 4;
    if (NLCD_WOODLAND_CLASSES.has(value)) {
      imageData.data[offset] = 42;
      imageData.data[offset + 1] = 112;
      imageData.data[offset + 2] = 61;
      imageData.data[offset + 3] = value === 52 ? 165 : 230;
    } else {
      imageData.data[offset + 3] = 0;
    }
  }
  context.putImageData(imageData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

async function loadWoodlandMarkers(
  url: string,
  georef: RasterGeoreference,
  maxMarkers = 620
): Promise<WoodlandMarker[]> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GeoTIFF woodland request failed: ${response.status}`);
  }

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const raster = (await image.readRasters({
    interleave: true,
    samples: [0]
  })) as ArrayLike<number>;
  const markers: WoodlandMarker[] = [];
  const sampleStep = Math.max(10, Math.floor(Math.max(width, height) / 58));
  const rasterWidth = Math.max(georef.projectMax[0] - georef.projectMin[0], 0.01);
  const rasterDepth = Math.max(georef.projectMax[1] - georef.projectMin[1], 0.01);

  for (let y = Math.floor(sampleStep / 2); y < height; y += sampleStep) {
    for (let x = Math.floor(sampleStep / 2); x < width; x += sampleStep) {
      const value = Number(raster[y * width + x]);
      if (!NLCD_WOODLAND_CLASSES.has(value)) {
        continue;
      }

      const hash = (x * 73856093) ^ (y * 19349663);
      if (Math.abs(hash) % 3 === 0) {
        continue;
      }

      const u = x / Math.max(width - 1, 1);
      const v = y / Math.max(height - 1, 1);
      markers.push({
        id: `woodland-${x}-${y}`,
        kind: getWoodlandMarkerKind(value),
        coordinate: [
          georef.projectMin[0] + u * rasterWidth,
          georef.projectMin[1] + v * rasterDepth
        ]
      });

      if (markers.length >= maxMarkers) {
        return markers;
      }
    }
  }

  return markers;
}

function getWoodlandMarkerKind(value: number): WoodlandMarkerKind {
  if (value === 42) {
    return "evergreen";
  }
  if (value === 43) {
    return "mixed";
  }
  if (value === 52) {
    return "shrub";
  }
  return "deciduous";
}

function useWoodlandMarkers(
  url: string | null,
  georef: RasterGeoreference | undefined
) {
  const [markers, setMarkers] = useState<WoodlandMarker[]>([]);

  useEffect(() => {
    if (!url || !georef) {
      setMarkers([]);
      return undefined;
    }

    let cancelled = false;
    loadWoodlandMarkers(url, georef)
      .then((nextMarkers) => {
        if (!cancelled) {
          setMarkers(nextMarkers);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setMarkers([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url, georef]);

  return markers;
}

async function loadGeoTiffScalarTexture(url: string) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`GeoTIFF texture request failed: ${response.status}`);
  }

  const tiff = await fromArrayBuffer(await response.arrayBuffer());
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const raster = (await image.readRasters({
    interleave: true,
    samples: [0]
  })) as ArrayLike<number>;
  const range = getRasterDisplayRange(raster, 1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("GeoTIFF texture canvas could not be created.");
  }

  const imageData = context.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    const value = Number(raster[index]);
    const [red, green, blue] =
      !Number.isFinite(value) || value <= -9999
        ? ([42, 104, 220] as [number, number, number])
        : elevationToDivergingRgb(value, range.min, range.max);
    const offset = index * 4;
    imageData.data[offset] = red;
    imageData.data[offset + 1] = green;
    imageData.data[offset + 2] = blue;
    imageData.data[offset + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.flipY = true;
  texture.anisotropy = 4;
  texture.needsUpdate = true;
  return texture;
}

function clampByte(value: number) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.round(Math.min(Math.max(value, 0), 255));
}

function getRasterDisplayRange(raster: ArrayLike<number>, stride: number) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < raster.length; index += stride) {
    for (let channel = 0; channel < stride; channel += 1) {
      const value = Number(raster[index + channel]);
      if (!Number.isFinite(value) || value <= -9999) {
        continue;
      }
      min = Math.min(min, value);
      max = Math.max(max, value);
    }
  }

  return {
    min: Number.isFinite(min) ? min : 0,
    max: Number.isFinite(max) && max > min ? max : min + 1
  };
}

function TerrainMesh({
  hideTopSurface,
  terrain,
  space
}: {
  hideTopSurface: boolean;
  terrain: TerrainModel;
  space: TerrainSpace;
}) {
  const geometry = useMemo(
    () => buildTerrainGeometry(terrain, getCanonicalTerrainGeometrySpace(terrain)),
    [terrain]
  );
  const materials = useMemo(() => {
    const topSurface = new THREE.MeshLambertNodeMaterial({
      color: new Color(TERRAIN_CLAY),
      map: createFeltTexture(),
      side: DoubleSide,
      transparent: hideTopSurface,
      opacity: hideTopSurface ? 0 : 1,
      depthWrite: !hideTopSurface
    });
    const solid = new THREE.MeshLambertNodeMaterial({
      color: new Color(SOLID_TERRAIN_COLOR),
      map: createSolidTerrainTexture(),
      side: DoubleSide
    });
    return [topSurface, solid];
  }, [hideTopSurface]);

  return (
    <mesh
      castShadow
      geometry={geometry}
      material={materials}
      scale={[space.displayScale, space.displayScale, space.displayScale]}
    />
  );
}

function OrthophotoBaseMap({
  forceOverlay,
  opacity,
  project,
  renderOrder,
  texture,
  viewScaleMode
}: {
  forceOverlay: boolean;
  opacity: number;
  project: ProjectMetadata;
  renderOrder: number;
  texture: Texture | null;
  viewScaleMode: "fit" | "1:1";
}) {
  const space = useMemo(
    () => getProjectSpace(project, getProjectScaleOverride(project, viewScaleMode)),
    [project, viewScaleMode]
  );
  const materials = useMemo(() => {
    const side = new THREE.MeshBasicNodeMaterial({
      color: new Color("#bdbdbd"),
      depthTest: !forceOverlay,
      depthWrite: !forceOverlay,
      transparent: true,
      opacity
    });
    const top = new THREE.MeshBasicNodeMaterial({
      color: new Color("#ffffff"),
      depthTest: !forceOverlay,
      depthWrite: !forceOverlay,
      map: texture ?? createFeltTexture(),
      transparent: true,
      opacity
    });

    return [side, side, top, side, side, side];
  }, [forceOverlay, opacity, texture]);

  return (
    <group>
      <mesh
        material={materials}
        position={[0, 0, 0]}
        receiveShadow
        renderOrder={renderOrder}
      >
        <boxGeometry args={[space.sizeX, 0.08, space.sizeZ]} />
      </mesh>
    </group>
  );
}

function ContourLines({
  space,
  terrain,
  visible
}: {
  space: TerrainSpace;
  terrain: TerrainModel;
  visible: boolean;
}) {
  const geometry = useMemo(
    () => buildContourGeometry(terrain, getCanonicalTerrainGeometrySpace(terrain)),
    [terrain]
  );

  return (
    <lineSegments
      geometry={geometry}
      scale={[space.displayScale, space.displayScale, space.displayScale]}
      visible={visible}
    >
      <lineBasicMaterial color={CONTOUR_COLOR} transparent opacity={0.6} />
    </lineSegments>
  );
}

// Very large fixed ground so it reads as an infinite reference plane that does
// NOT scale with the terrain / view mode.
const GROUND_PLANE_SIZE = 20000;
// One grid cell = this many scene units (a cell repeats across the plane).
const GROUND_CELL_SIZE = 4;

function createCrosshairGroundTexture() {
  const cell = 128;
  const canvas = document.createElement("canvas");
  canvas.width = cell;
  canvas.height = cell;
  const ctx = canvas.getContext("2d")!;

  ctx.fillStyle = GROUND_COLOR;
  ctx.fillRect(0, 0, cell, cell);

  // Faint cell grid lines along two edges.
  ctx.strokeStyle = "rgba(150,150,150,0.14)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(cell - 0.5, 0);
  ctx.lineTo(cell - 0.5, cell);
  ctx.moveTo(0, cell - 0.5);
  ctx.lineTo(cell, cell - 0.5);
  ctx.stroke();

  // Small crosshair "+" at the cell corner.
  const arm = 5;
  ctx.strokeStyle = "rgba(130,130,130,0.4)";
  ctx.beginPath();
  ctx.moveTo(cell - arm, cell - 0.5);
  ctx.lineTo(cell + arm, cell - 0.5);
  ctx.moveTo(cell - 0.5, cell - arm);
  ctx.lineTo(cell - 0.5, cell + arm);
  ctx.stroke();

  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.repeat.set(
    GROUND_PLANE_SIZE / GROUND_CELL_SIZE,
    GROUND_PLANE_SIZE / GROUND_CELL_SIZE
  );
  texture.anisotropy = 4;
  return texture;
}

function GroundPlane({ baseY }: { baseY: number }) {
  const gridMap = useMemo(() => createCrosshairGroundTexture(), []);

  return (
    <group position={[0, baseY - GROUND_GRID_OFFSET, 0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_PLANE_SIZE, GROUND_PLANE_SIZE]} />
        <meshBasicNodeMaterial color={new Color(GROUND_COLOR)} map={gridMap} />
      </mesh>
    </group>
  );
}

function TerrainLayerContent({
  hideTopSurface,
  showContours,
  space,
  terrain
}: {
  hideTopSurface: boolean;
  showContours: boolean;
  space: TerrainSpace;
  terrain: TerrainModel;
}) {
  return (
    <>
      <TerrainMesh hideTopSurface={hideTopSurface} terrain={terrain} space={space} />
      <ContourLines
        terrain={terrain}
        space={space}
        visible={!hideTopSurface && showContours}
      />
    </>
  );
}

function OrthophotoLayerContent({
  forceOverlay,
  renderOrder
}: {
  forceOverlay: boolean;
  renderOrder: number;
}) {
  const layers = useEditorStore((state) => state.layers);
  const project = useEditorStore((state) => state.project);
  const orthophotoPreviewUrl = useEditorStore((state) => state.orthophotoPreviewUrl);
  const orthophotoTexture = useOrthophotoTexture(orthophotoPreviewUrl);
  const orthophotoLayer = getLayer(layers, "orthophoto-base");

  if (!orthophotoPreviewUrl || !orthophotoLayer?.visible) {
    return null;
  }

  return (
    <OrthophotoBaseMap
      forceOverlay={forceOverlay}
      opacity={orthophotoLayer.opacity}
      project={project}
      renderOrder={renderOrder}
      texture={orthophotoTexture}
      viewScaleMode="fit"
    />
  );
}

function getProjectClippingPlanes(projectSpace: ProjectSpace) {
  const halfX = projectSpace.sizeX / 2;
  const halfZ = projectSpace.sizeZ / 2;

  return [
    new THREE.Plane(new THREE.Vector3(1, 0, 0), halfX),
    new THREE.Plane(new THREE.Vector3(-1, 0, 0), halfX),
    new THREE.Plane(new THREE.Vector3(0, 0, 1), halfZ),
    new THREE.Plane(new THREE.Vector3(0, 0, -1), halfZ)
  ];
}

function getRasterScenePlacement(
  layer: PlanningLayer,
  project: ProjectMetadata,
  projectSpace: ProjectSpace,
  lift: number,
  terrain: TerrainModel,
  terrainGenerated: boolean,
  terrainSpace: TerrainSpace
) {
  const baseY = terrainGenerated
    ? elevationToSceneHeight(terrain.maxElevation, terrainSpace) + lift
    : lift;
  const georef = layer.rasterGeoreference;

  if (!georef) {
    return {
      position: [0, baseY, 0] as [number, number, number],
      sizeX: projectSpace.sizeX,
      sizeZ: projectSpace.sizeZ
    };
  }

  const width = georef.projectMax[0] - georef.projectMin[0];
  const depth = georef.projectMax[1] - georef.projectMin[1];
  const centerU =
    (georef.projectMin[0] + georef.projectMax[0]) /
    2 /
    project.realWorldExtentMeters.width;
  const centerV =
    (georef.projectMin[1] + georef.projectMax[1]) /
    2 /
    project.realWorldExtentMeters.depth;

  return {
    position: [
      (centerU - 0.5) * projectSpace.sizeX,
      baseY,
      (centerV - 0.5) * projectSpace.sizeZ
    ] as [number, number, number],
    sizeX: (width / project.realWorldExtentMeters.width) * projectSpace.sizeX,
    sizeZ: (depth / project.realWorldExtentMeters.depth) * projectSpace.sizeZ
  };
}



function getLayerPanelIndex(layers: PlanningLayer[], layerId: string) {
  return layers.findIndex((layer) => layer.id === layerId);
}

/** Photoshop-style stack: panel row 0 is the front / top composite layer. */
function getLayerRenderOrder(layers: PlanningLayer[], layerId: string) {
  const panelIndex = getLayerPanelIndex(layers, layerId);
  if (panelIndex < 0) {
    return 1;
  }

  return layers.length - panelIndex + 2;
}

function getLayerStackLift(layers: PlanningLayer[], layerId: string) {
  const panelIndex = getLayerPanelIndex(layers, layerId);
  if (panelIndex < 0) {
    return RASTER_DRAPE_BASE_LIFT;
  }

  const distanceFromBottom = layers.length - 1 - panelIndex;
  return RASTER_DRAPE_BASE_LIFT + distanceFromBottom * LAYER_STACK_LIFT_STEP;
}

function getVectorLayerLift(layers: PlanningLayer[], layerId: string) {
  return getLayerStackLift(layers, layerId) + VECTOR_OVERLAY_LIFT_BONUS;
}

function getDrapedRasterMaterialOpacity(layer: PlanningLayer) {
  return layer.opacity;
}

function isFullyOpaqueLayer(layer: PlanningLayer) {
  return layer.opacity >= FULL_LAYER_OPACITY;
}

function canSuppressLowerRasterLayers(layer: PlanningLayer) {
  return layer.id !== "safe-data-woodland";
}

function isFullCoverageLayer(layer: PlanningLayer, terrainGenerated: boolean) {
  if (!layer.visible || layer.geometryType !== "raster" || !layer.rasterPreviewUrl) {
    return false;
  }

  if (!canSuppressLowerRasterLayers(layer)) {
    return false;
  }

  return (
    (terrainGenerated &&
      Boolean(layer.rasterGeoreference) &&
      (layer.kind === "orthophoto" || TERRAIN_DRAPED_RASTER_LAYER_IDS.has(layer.id))) ||
    Boolean(layer.rasterGeoreference)
  );
}

/** Photoshop Normal: any opaque full-coverage raster above hides raster layers below it. */
function isLayerSuppressedByAdobeStack(
  layers: PlanningLayer[],
  layerId: string,
  terrainGenerated: boolean
) {
  const targetLayer = layers.find((layer) => layer.id === layerId);
  if (!targetLayer || targetLayer.geometryType !== "raster") {
    return false;
  }

  const panelIndex = getLayerPanelIndex(layers, layerId);
  if (panelIndex < 0) {
    return false;
  }

  return layers
    .slice(0, panelIndex)
    .some(
      (layer) =>
        layer.visible &&
        isFullyOpaqueLayer(layer) &&
        isFullCoverageLayer(layer, terrainGenerated)
    );
}

function shouldDrapeRasterLayer(layer: PlanningLayer, terrainGenerated: boolean) {
  return (
    terrainGenerated &&
    layer.geometryType === "raster" &&
    Boolean(layer.rasterGeoreference) &&
    Boolean(layer.rasterPreviewUrl) &&
    (layer.kind === "orthophoto" || TERRAIN_DRAPED_RASTER_LAYER_IDS.has(layer.id))
  );
}

function getActiveDrapedRasterAboveTerrain(
  layers: PlanningLayer[],
  terrainGenerated: boolean
) {
  const terrainIndex = getLayerPanelIndex(layers, "terrain-mesh");
  if (terrainIndex < 0) {
    return null;
  }

  for (const layer of layers.slice(0, terrainIndex)) {
    if (
      layer.visible &&
      shouldDrapeRasterLayer(layer, terrainGenerated) &&
      !isLayerSuppressedByAdobeStack(layers, layer.id, terrainGenerated)
    ) {
      return layer;
    }
  }

  return null;
}

function getLayersInCompositeOrder(layers: PlanningLayer[]) {
  return layers
    .map((layer, panelIndex) => ({ layer, panelIndex }))
    .filter(({ layer }) => layer.visible)
    .sort((a, b) => b.panelIndex - a.panelIndex);
}

function DrapedRasterMesh({
  georef,
  layer,
  project,
  renderOrder,
  stackLift,
  terrain,
  terrainSpace,
  visible
}: {
  georef: RasterGeoreference;
  layer: PlanningLayer;
  project: ProjectMetadata;
  renderOrder: number;
  stackLift: number;
  terrain: TerrainModel;
  terrainSpace: TerrainSpace;
  visible: boolean;
}) {
  const rasterTexture = useOrthophotoTexture(layer.rasterPreviewUrl ?? null);
  const materialOpacity = getDrapedRasterMaterialOpacity(layer);
  const fullyOpaque = materialOpacity >= FULL_LAYER_OPACITY;
  const geometry = useMemo(
    () =>
      buildDrapedRasterGeometry(
        terrain,
        terrainSpace,
        project,
        georef,
        stackLift
      ),
    [terrain, terrainSpace, project, georef, stackLift]
  );

  if (!rasterTexture) {
    return null;
  }

  return (
    <mesh geometry={geometry} renderOrder={renderOrder} visible={visible}>
      <meshBasicNodeMaterial
        color={new Color("#ffffff")}
        depthTest={false}
        depthWrite={false}
        map={rasterTexture}
        opacity={materialOpacity}
        side={FrontSide}
        transparent={!fullyOpaque}
      />
    </mesh>
  );
}

function WoodlandModelLayer({
  layer,
  project,
  projectSpace,
  renderOrder,
  terrain,
  terrainGenerated,
  terrainSpace,
  viewScaleMode
}: {
  layer: PlanningLayer;
  project: ProjectMetadata;
  projectSpace: ProjectSpace;
  renderOrder: number;
  terrain: TerrainModel;
  terrainGenerated: boolean;
  terrainSpace: TerrainSpace;
  viewScaleMode: "fit" | "1:1";
}) {
  const markers = useWoodlandMarkers(
    layer.rasterPreviewUrl ?? null,
    layer.rasterGeoreference
  );
  const visibleMarkers =
    viewScaleMode === "1:1"
      ? markers.slice(0, MAX_ONE_TO_ONE_WOODLAND_MARKERS)
      : markers;
  const markerScale =
    viewScaleMode === "1:1" ? 5.5 : clamp(terrainSpace.displayScale * 95, 0.34, 1.25);
  const lift = RASTER_DRAPE_BASE_LIFT + VECTOR_OVERLAY_LIFT_BONUS + markerScale * 0.55;

  if (!visibleMarkers.length) {
    return null;
  }

  return (
    <group renderOrder={renderOrder + 20}>
      {visibleMarkers.map((marker) => {
        const position = projectCoordinateToScene(
          marker.coordinate,
          project,
          projectSpace,
          terrain,
          terrainSpace,
          terrainGenerated,
          lift
        );

        return (
          <WoodlandMarkerMesh
            key={marker.id}
            kind={marker.kind}
            position={position}
            renderOrder={renderOrder + 20}
            scale={markerScale}
          />
        );
      })}
    </group>
  );
}

function WoodlandMarkerMesh({
  kind,
  position,
  renderOrder,
  scale
}: {
  kind: WoodlandMarkerKind;
  position: [number, number, number];
  renderOrder: number;
  scale: number;
}) {
  const fill = new Color("#5f5f5f");
  const dark = new Color("#474747");
  const materialProps = {
    depthTest: true,
    depthWrite: true
  };

  if (kind === "evergreen") {
    return (
      <group frustumCulled={false} position={position} renderOrder={renderOrder}>
        <mesh
          frustumCulled={false}
          position={[0, scale * 0.58, 0]}
          renderOrder={renderOrder}
        >
          <coneGeometry args={[scale * 0.42, scale * 1.15, 5]} />
          <meshBasicNodeMaterial color={fill} {...materialProps} />
        </mesh>
        <mesh
          frustumCulled={false}
          position={[0, scale * 0.16, 0]}
          renderOrder={renderOrder}
        >
          <cylinderGeometry args={[scale * 0.07, scale * 0.09, scale * 0.34, 5]} />
          <meshBasicNodeMaterial color={dark} {...materialProps} />
        </mesh>
      </group>
    );
  }

  if (kind === "shrub") {
    return (
      <group frustumCulled={false} position={position} renderOrder={renderOrder}>
        <mesh
          frustumCulled={false}
          position={[0, scale * 0.18, 0]}
          renderOrder={renderOrder}
          scale={[1.2, 0.42, 0.9]}
        >
          <dodecahedronGeometry args={[scale * 0.36, 0]} />
          <meshBasicNodeMaterial color={fill} {...materialProps} />
        </mesh>
      </group>
    );
  }

  if (kind === "mixed") {
    return (
      <group frustumCulled={false} position={position} renderOrder={renderOrder}>
        <mesh
          frustumCulled={false}
          position={[-scale * 0.16, scale * 0.42, 0]}
          renderOrder={renderOrder}
        >
          <sphereGeometry args={[scale * 0.28, 7, 5]} />
          <meshBasicNodeMaterial color={fill} {...materialProps} />
        </mesh>
        <mesh
          frustumCulled={false}
          position={[scale * 0.18, scale * 0.48, 0]}
          renderOrder={renderOrder}
        >
          <coneGeometry args={[scale * 0.28, scale * 0.78, 5]} />
          <meshBasicNodeMaterial color={fill} {...materialProps} />
        </mesh>
      </group>
    );
  }

  return (
    <group frustumCulled={false} position={position} renderOrder={renderOrder}>
      <mesh
        frustumCulled={false}
        position={[0, scale * 0.42, 0]}
        renderOrder={renderOrder}
      >
        <sphereGeometry args={[scale * 0.34, 8, 6]} />
        <meshBasicNodeMaterial color={fill} {...materialProps} />
      </mesh>
      <mesh
        frustumCulled={false}
        position={[0, scale * 0.15, 0]}
        renderOrder={renderOrder}
      >
        <cylinderGeometry args={[scale * 0.06, scale * 0.08, scale * 0.3, 5]} />
        <meshBasicNodeMaterial color={dark} {...materialProps} />
      </mesh>
    </group>
  );
}

function StructureModelLayer({
  layer,
  project,
  projectSpace,
  renderOrder,
  selectFeatureInLayer,
  terrain,
  terrainGenerated,
  terrainSpace,
  viewScaleMode
}: {
  layer: PlanningLayer;
  project: ProjectMetadata;
  projectSpace: ProjectSpace;
  renderOrder: number;
  selectFeatureInLayer: (layerId: string, featureId: string) => void;
  terrain: TerrainModel;
  terrainGenerated: boolean;
  terrainSpace: TerrainSpace;
  viewScaleMode: "fit" | "1:1";
}) {
  const features = getRenderableFeatures(layer, viewScaleMode).filter(
    (feature) => feature.geometryType === "point"
  );
  const setHoveredFeature = useEditorStore((state) => state.setHoveredFeature);
  const blockSize = clamp(terrainSpace.displayScale * 140, 0.46, 1.25);
  const blockHeight = blockSize * 1.45;
  const lift = RASTER_DRAPE_BASE_LIFT + blockSize * 0.08;

  if (!features.length) {
    return null;
  }

  return (
    <group renderOrder={renderOrder + 16}>
      {features.map((feature) => {
        const coordinate = feature.coordinates[0];
        if (!coordinate) {
          return null;
        }

        const base = projectCoordinateToScene(
          coordinate,
          project,
          projectSpace,
          terrain,
          terrainSpace,
          terrainGenerated,
          lift
        );
        const color = getStructureFeatureColor(feature);
        const position: Vec3 = [base[0], base[1] + blockHeight / 2, base[2]];
        const handleClick = (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          selectFeatureInLayer(layer.id, feature.id);
        };
        const handlePointerOut = (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          document.body.style.cursor = "";
          setHoveredFeature(null, null);
        };
        const handlePointerOver = (event: { stopPropagation: () => void }) => {
          event.stopPropagation();
          document.body.style.cursor = "pointer";
          setHoveredFeature(layer.id, feature.id);
        };

        return (
          <mesh
            castShadow
            frustumCulled={false}
            key={feature.id}
            onClick={handleClick}
            onPointerOut={handlePointerOut}
            onPointerOver={handlePointerOver}
            position={position}
            renderOrder={renderOrder + 16}
          >
            <boxGeometry args={[blockSize, blockHeight, blockSize]} />
            <meshBasicNodeMaterial
              color={new Color(color)}
              depthTest
              depthWrite
            />
          </mesh>
        );
      })}
    </group>
  );
}

function BuildingModelLayer({
  layer,
  project,
  projectSpace,
  renderOrder,
  selectFeatureInLayer,
  terrain,
  terrainGenerated,
  terrainSpace,
  viewScaleMode
}: {
  layer: PlanningLayer;
  project: ProjectMetadata;
  projectSpace: ProjectSpace;
  renderOrder: number;
  selectFeatureInLayer: (layerId: string, featureId: string) => void;
  terrain: TerrainModel;
  terrainGenerated: boolean;
  terrainSpace: TerrainSpace;
  viewScaleMode: "fit" | "1:1";
}) {
  const features = getRenderableFeatures(layer, viewScaleMode).filter(
    (feature) => feature.geometryType === "polygon"
  );
  const setHoveredFeature = useEditorStore((state) => state.setHoveredFeature);

  if (!features.length) {
    return null;
  }

  return (
    <group renderOrder={renderOrder + 14}>
      {features.map((feature) => (
        <BuildingMesh
          feature={feature}
          key={feature.id}
          layer={layer}
          project={project}
          projectSpace={projectSpace}
          renderOrder={renderOrder + 14}
          selectFeatureInLayer={selectFeatureInLayer}
          setHoveredFeature={setHoveredFeature}
          terrain={terrain}
          terrainGenerated={terrainGenerated}
          terrainSpace={terrainSpace}
        />
      ))}
    </group>
  );
}

function BuildingMesh({
  feature,
  layer,
  project,
  projectSpace,
  renderOrder,
  selectFeatureInLayer,
  setHoveredFeature,
  terrain,
  terrainGenerated,
  terrainSpace
}: {
  feature: NonNullable<PlanningLayer["features"]>[number];
  layer: PlanningLayer;
  project: ProjectMetadata;
  projectSpace: ProjectSpace;
  renderOrder: number;
  selectFeatureInLayer: (layerId: string, featureId: string) => void;
  setHoveredFeature: (layerId: string | null, featureId: string | null) => void;
  terrain: TerrainModel;
  terrainGenerated: boolean;
  terrainSpace: TerrainSpace;
}) {
  const heightMeters = getBuildingHeightMeters(feature);
  const height = heightMeters * terrainSpace.displayScale * terrainSpace.verticalScale;
  const color = getBuildingFeatureColor(feature);
  const geometry = useMemo(
    () =>
      buildBuildingExtrusionGeometry(
        feature,
        project,
        projectSpace,
        terrain,
        terrainSpace,
        terrainGenerated,
        height,
        RASTER_DRAPE_BASE_LIFT
      ),
    [feature, project, projectSpace, terrain, terrainSpace, terrainGenerated, height]
  );

  if (!geometry) {
    return null;
  }

  const handleClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    selectFeatureInLayer(layer.id, feature.id);
  };
  const handlePointerOut = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    document.body.style.cursor = "";
    setHoveredFeature(null, null);
  };
  const handlePointerOver = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    document.body.style.cursor = "pointer";
    setHoveredFeature(layer.id, feature.id);
  };

  return (
    <mesh
      castShadow
      frustumCulled={false}
      geometry={geometry}
      onClick={handleClick}
      onPointerOut={handlePointerOut}
      onPointerOver={handlePointerOver}
      renderOrder={renderOrder}
    >
      <meshBasicNodeMaterial
        color={new Color(color)}
        depthTest
        depthWrite
        side={DoubleSide}
      />
    </mesh>
  );
}

function FoundationalLayerContent({
  layer,
  layers,
  terrain,
  terrainGenerated,
  terrainSpace,
  viewScaleMode
}: {
  layer: PlanningLayer;
  layers: PlanningLayer[];
  terrain: TerrainModel;
  terrainGenerated: boolean;
  terrainSpace: TerrainSpace;
  viewScaleMode: "fit" | "1:1";
}) {
  if (!layer.visible) {
    return null;
  }

  if (isLayerSuppressedByAdobeStack(layers, layer.id, terrainGenerated)) {
    return null;
  }

  const renderOrder = getLayerRenderOrder(layers, layer.id);
  const project = useEditorStore((state) => state.project);
  const selectFeatureInLayer = useEditorStore((state) => state.selectFeatureInLayer);
  const projectSpace = useMemo(() => getProjectSpace(project), [project]);
  const rasterTexture = useOrthophotoTexture(layer.rasterPreviewUrl ?? null);
  const stackLift = getLayerStackLift(layers, layer.id);
  const lift =
    layer.id === "safe-data-boundaries"
      ? BOUNDARY_LINE_LIFT
      : layer.geometryType === "line" ||
        layer.geometryType === "mixed" ||
        layer.geometryType === "polygon"
      ? getVectorLayerLift(layers, layer.id)
      : stackLift;
  const clippingPlanes = useMemo(
    () =>
      layer.id === "project-boundary"
        ? undefined
        : getProjectClippingPlanes(projectSpace),
    [layer.id, projectSpace]
  );

  if (layer.geometryType === "raster") {
    if (layer.id === "safe-data-woodland" && layer.rasterGeoreference) {
      return (
        <WoodlandModelLayer
          layer={layer}
          project={project}
          projectSpace={projectSpace}
          renderOrder={renderOrder}
          terrain={terrain}
          terrainGenerated={terrainGenerated}
          terrainSpace={terrainSpace}
          viewScaleMode={viewScaleMode}
        />
      );
    }

    if (shouldDrapeRasterLayer(layer, terrainGenerated)) {
      return (
        <DrapedRasterMesh
          georef={layer.rasterGeoreference!}
          layer={layer}
          project={project}
          renderOrder={renderOrder}
          stackLift={stackLift}
          terrain={terrain}
          terrainSpace={terrainSpace}
          visible={viewScaleMode !== "1:1"}
        />
      );
    }

    const placement = getRasterScenePlacement(
      layer,
      project,
      projectSpace,
      lift,
      terrain,
      terrainGenerated,
      terrainSpace
    );

    return (
      <mesh
        position={placement.position}
        renderOrder={renderOrder}
        rotation={[-Math.PI / 2, 0, 0]}
      >
        <planeGeometry args={[placement.sizeX, placement.sizeZ]} />
        <meshBasicNodeMaterial
          clippingPlanes={clippingPlanes}
          clipIntersection={false}
          color={new Color(layer.style?.fill ?? "#4aa3cf")}
          depthTest={false}
          depthWrite={false}
          map={rasterTexture ?? undefined}
          opacity={layer.opacity}
          side={FrontSide}
          transparent={!isFullyOpaqueLayer(layer)}
        />
      </mesh>
    );
  }

  if (!layer.features?.length) {
    return null;
  }

  if (layer.id === "safe-data-structures") {
    return (
      <StructureModelLayer
        layer={layer}
        project={project}
        projectSpace={projectSpace}
        renderOrder={renderOrder}
        selectFeatureInLayer={selectFeatureInLayer}
        terrain={terrain}
        terrainGenerated={terrainGenerated}
        terrainSpace={terrainSpace}
        viewScaleMode={viewScaleMode}
      />
    );
  }

  if (layer.id === "safe-data-buildings") {
    return (
      <BuildingModelLayer
        layer={layer}
        project={project}
        projectSpace={projectSpace}
        renderOrder={renderOrder}
        selectFeatureInLayer={selectFeatureInLayer}
        terrain={terrain}
        terrainGenerated={terrainGenerated}
        terrainSpace={terrainSpace}
        viewScaleMode={viewScaleMode}
      />
    );
  }

  return (
    <group renderOrder={renderOrder}>
      {getRenderableFeatures(layer, viewScaleMode).map((feature) => (
        <FeatureOverlay
          clippingPlanes={clippingPlanes}
          feature={feature}
          key={feature.id}
          layer={layer}
          lift={lift}
          project={project}
          projectSpace={projectSpace}
          renderOrder={renderOrder}
          selectFeatureInLayer={selectFeatureInLayer}
          terrain={terrain}
          terrainGenerated={terrainGenerated}
          terrainSpace={terrainSpace}
          renderPolygonFill={viewScaleMode !== "1:1" || layer.id === "safe-data-boundaries"}
        />
      ))}
    </group>
  );
}

function FeatureOverlay({
  clippingPlanes,
  feature,
  layer,
  lift,
  project,
  projectSpace,
  renderOrder,
  selectFeatureInLayer,
  terrain,
  terrainGenerated,
  terrainSpace,
  renderPolygonFill
}: {
  clippingPlanes?: THREE.Plane[];
  feature: NonNullable<PlanningLayer["features"]>[number];
  layer: PlanningLayer;
  lift: number;
  project: ProjectMetadata;
  projectSpace: ProjectSpace;
  renderOrder: number;
  selectFeatureInLayer: (layerId: string, featureId: string) => void;
  terrain: TerrainModel;
  terrainGenerated: boolean;
  terrainSpace: TerrainSpace;
  renderPolygonFill: boolean;
}) {
  const geometry = useMemo(
    () =>
      buildVectorFeatureGeometry(
        feature,
        project,
        projectSpace,
        terrain,
        terrainSpace,
        terrainGenerated,
        lift
      ),
    [feature, project, projectSpace, terrain, terrainSpace, terrainGenerated, lift]
  );
  const polygonFillGeometry = useMemo(
    () => {
      if (feature.geometryType !== "polygon" || !renderPolygonFill) {
        return null;
      }

      return layer.id === "safe-data-boundaries"
        ? buildDrapedPolygonFillGeometry(
            feature,
            project,
            terrain,
            terrainSpace,
            terrainGenerated,
            lift - LAYER_STACK_LIFT_STEP * 0.18
          )
        : buildPolygonFillGeometry(
            feature,
            project,
            projectSpace,
            terrain,
            terrainSpace,
            terrainGenerated,
            lift - LAYER_STACK_LIFT_STEP * 0.18
          );
    },
    [
      feature,
      layer.id,
      project,
      projectSpace,
      terrain,
      terrainSpace,
      terrainGenerated,
      lift,
      renderPolygonFill
    ]
  );
  const setHoveredFeature = useEditorStore((state) => state.setHoveredFeature);

  if (!geometry) {
    return null;
  }

  const handleClick = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    selectFeatureInLayer(layer.id, feature.id);
  };
  const handlePointerOut = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    document.body.style.cursor = "";
    setHoveredFeature(null, null);
  };
  const handlePointerOver = (event: { stopPropagation: () => void }) => {
    event.stopPropagation();
    document.body.style.cursor = "pointer";
    setHoveredFeature(layer.id, feature.id);
  };
  const fillColor = getFeatureFillColor(layer, feature);
  const strokeColor = getFeatureStrokeColor(layer, feature);
  const fillOpacity = getFeatureFillOpacity(layer);
  const depthAwareOverlay = layer.id === "safe-data-boundaries";
  const terrainDrapedFill = layer.id === "safe-data-boundaries";

  return (
    <group
      renderOrder={renderOrder}
      onClick={handleClick}
      onPointerOut={handlePointerOut}
      onPointerOver={handlePointerOver}
    >
      {polygonFillGeometry ? (
        <mesh geometry={polygonFillGeometry} renderOrder={renderOrder}>
          <meshBasicNodeMaterial
            clippingPlanes={clippingPlanes}
            clipIntersection={false}
            color={new Color(fillColor)}
            depthTest={terrainDrapedFill ? false : depthAwareOverlay}
            depthWrite={false}
            opacity={fillOpacity}
            side={terrainDrapedFill ? FrontSide : DoubleSide}
            transparent={fillOpacity < FULL_LAYER_OPACITY}
          />
        </mesh>
      ) : null}
      <lineSegments geometry={geometry} renderOrder={renderOrder + 1}>
        <lineBasicMaterial
          clippingPlanes={clippingPlanes}
          clipIntersection={false}
          color={strokeColor}
          depthTest={depthAwareOverlay}
          depthWrite={false}
          linewidth={layer.style?.strokeWidth ?? 2}
          opacity={Math.min(1, Math.max(0.24, layer.opacity))}
          transparent
        />
      </lineSegments>
    </group>
  );
}

const LayeredSceneContent = memo(function LayeredSceneContent() {
  const layers = useEditorStore((state) => state.layers);
  const terrain = useEditorStore((state) => state.terrain);
  const terrainGenerated = useEditorStore((state) => state.terrainGenerated);
  const terrainSpace = useMemo(
    () => getTerrainSpace(terrain, undefined, FIT_VERTICAL_EXAGGERATION),
    [terrain]
  );
  const terrainLayerIndex = layers.findIndex((layer) => layer.id === "terrain-mesh");
  const orthophotoLayerIndex = layers.findIndex(
    (layer) => layer.id === "orthophoto-base"
  );
  const orthophotoAboveTerrain =
    orthophotoLayerIndex >= 0 &&
    (terrainLayerIndex < 0 || orthophotoLayerIndex < terrainLayerIndex);
  const activeDrapedRaster = useMemo(
    () => getActiveDrapedRasterAboveTerrain(layers, terrainGenerated),
    [layers, terrainGenerated]
  );
  const activeDrapedTexture = useOrthophotoTexture(
    activeDrapedRaster?.rasterPreviewUrl ?? null
  );
  const hideTerrainSurface = Boolean(
    activeDrapedRaster &&
      activeDrapedTexture &&
      isFullyOpaqueLayer(activeDrapedRaster)
  );
  const compositeLayers = getLayersInCompositeOrder(layers);

  return (
    <>
      {!terrainGenerated ? <GroundPlane baseY={-0.12} /> : null}
      <group>
        {compositeLayers.map(({ layer }) => {
          if (layer.id === "orthophoto-base") {
            return (
              <OrthophotoLayerContent
                forceOverlay={orthophotoAboveTerrain}
                key={layer.id}
                renderOrder={getLayerRenderOrder(layers, layer.id)}
              />
            );
          }

          if (layer.id === "terrain-mesh" && terrainGenerated) {
            return (
              <TerrainLayerContent
                hideTopSurface={hideTerrainSurface}
                key={layer.id}
                showContours
                space={terrainSpace}
                terrain={terrain}
              />
            );
          }

          if (
            layer.kind === "foundational-map" ||
            layer.kind === "lca" ||
            (layer.kind === "orthophoto" && layer.id !== "orthophoto-base")
          ) {
            return (
              <FoundationalLayerContent
                key={layer.id}
                layer={layer}
                layers={layers}
                terrain={terrain}
                terrainGenerated={terrainGenerated}
                terrainSpace={terrainSpace}
                viewScaleMode="fit"
              />
            );
          }

          return null;
        })}
      </group>
    </>
  );
});

function getLayer(layers: PlanningLayer[], id: string) {
  return layers.find((layer) => layer.id === id);
}

function getRenderableFeatures(layer: PlanningLayer, viewScaleMode: "fit" | "1:1") {
  const features = layer.features ?? [];
  if (viewScaleMode !== "1:1" || features.length <= MAX_ONE_TO_ONE_VECTOR_FEATURES) {
    return features;
  }

  return features.slice(0, MAX_ONE_TO_ONE_VECTOR_FEATURES);
}

function buildVectorFeatureGeometry(
  feature: NonNullable<PlanningLayer["features"]>[number],
  project: ProjectMetadata,
  projectSpace: ProjectSpace,
  terrain: TerrainModel,
  terrainSpace: TerrainSpace,
  terrainGenerated: boolean,
  lift: number
) {
  const positions: number[] = [];
  if (feature.geometryType === "point") {
    for (const coordinate of feature.coordinates) {
      const center = projectCoordinateToScene(
        coordinate,
        project,
        projectSpace,
        terrain,
        terrainSpace,
        terrainGenerated,
        lift
      );
      const markerSize = Math.max(projectSpace.sizeX, projectSpace.sizeZ) * 0.012;
      positions.push(
        center[0] - markerSize,
        center[1],
        center[2],
        center[0] + markerSize,
        center[1],
        center[2],
        center[0],
        center[1],
        center[2] - markerSize,
        center[0],
        center[1],
        center[2] + markerSize
      );
    }
  } else {
    const coordinates =
      feature.geometryType === "polygon"
        ? closeRing(feature.coordinates)
        : feature.coordinates;

    for (let index = 0; index < coordinates.length - 1; index += 1) {
      const start = projectCoordinateToScene(
        coordinates[index],
        project,
        projectSpace,
        terrain,
        terrainSpace,
        terrainGenerated,
        lift
      );
      const end = projectCoordinateToScene(
        coordinates[index + 1],
        project,
        projectSpace,
        terrain,
        terrainSpace,
        terrainGenerated,
        lift
      );
      positions.push(...start, ...end);
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

function buildPolygonFillGeometry(
  feature: NonNullable<PlanningLayer["features"]>[number],
  project: ProjectMetadata,
  projectSpace: ProjectSpace,
  terrain: TerrainModel,
  terrainSpace: TerrainSpace,
  terrainGenerated: boolean,
  lift: number
) {
  const coordinates = removeClosingCoordinate(feature.coordinates);
  if (coordinates.length < 3) {
    return null;
  }

  const scenePoints = coordinates.map((coordinate) =>
    projectCoordinateToScene(
      coordinate,
      project,
      projectSpace,
      terrain,
      terrainSpace,
      terrainGenerated,
      lift
    )
  );
  const shapePoints = scenePoints.map((point) => new Vector2(point[0], point[2]));
  const triangles = ShapeUtils.triangulateShape(shapePoints, []);
  const positions: number[] = [];

  for (const triangle of triangles) {
    for (const pointIndex of triangle) {
      const point = scenePoints[pointIndex];
      positions.push(point[0], point[1], point[2]);
    }
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  return geometry;
}

function buildDrapedPolygonFillGeometry(
  feature: NonNullable<PlanningLayer["features"]>[number],
  project: ProjectMetadata,
  terrain: TerrainModel,
  terrainSpace: TerrainSpace,
  terrainGenerated: boolean,
  lift: number
) {
  const ring = removeClosingCoordinate(feature.coordinates);
  if (ring.length < 3) {
    return null;
  }

  const bounds = getCoordinateBounds(ring);
  const grid = getRenderGridSize(terrain);
  const last = grid - 1;
  const minGx = clamp(Math.floor((bounds.minX / project.realWorldExtentMeters.width) * last), 0, last - 1);
  const maxGx = clamp(Math.ceil((bounds.maxX / project.realWorldExtentMeters.width) * last), 1, last);
  const minGy = clamp(Math.floor((bounds.minY / project.realWorldExtentMeters.depth) * last), 0, last - 1);
  const maxGy = clamp(Math.ceil((bounds.maxY / project.realWorldExtentMeters.depth) * last), 1, last);
  const positions: number[] = [];

  const pointAtGrid = (gx: number, gy: number): Coordinate => [
    (gx / last) * project.realWorldExtentMeters.width,
    (gy / last) * project.realWorldExtentMeters.depth
  ];
  const scenePoint = (coordinate: Coordinate): Vec3 => {
    const u = clamp(coordinate[0] / project.realWorldExtentMeters.width, 0, 1);
    const v = clamp(coordinate[1] / project.realWorldExtentMeters.depth, 0, 1);
    const x = (u - 0.5) * terrainSpace.sizeX;
    const z = (v - 0.5) * terrainSpace.sizeZ;
    const y = terrainGenerated ? sampleHeightAt(terrain, terrainSpace, u, v) + lift : lift;
    return [x, y, z];
  };
  const pushTriangle = (a: Coordinate, b: Coordinate, c: Coordinate) => {
    positions.push(...scenePoint(a), ...scenePoint(b), ...scenePoint(c));
  };

  for (let gy = minGy; gy < maxGy; gy += 1) {
    for (let gx = minGx; gx < maxGx; gx += 1) {
      const northWest = pointAtGrid(gx, gy);
      const northEast = pointAtGrid(gx + 1, gy);
      const southEast = pointAtGrid(gx + 1, gy + 1);
      const southWest = pointAtGrid(gx, gy + 1);
      const center: Coordinate = [
        (northWest[0] + southEast[0]) / 2,
        (northWest[1] + southEast[1]) / 2
      ];

      if (!isCoordinateInsideRing(center, ring)) {
        continue;
      }

      pushTriangle(northWest, southEast, northEast);
      pushTriangle(northWest, southWest, southEast);
    }
  }

  if (positions.length === 0) {
    return buildPolygonFillGeometry(
      feature,
      project,
      getProjectSpace(project),
      terrain,
      terrainSpace,
      terrainGenerated,
      lift
    );
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function buildBuildingExtrusionGeometry(
  feature: NonNullable<PlanningLayer["features"]>[number],
  project: ProjectMetadata,
  projectSpace: ProjectSpace,
  terrain: TerrainModel,
  terrainSpace: TerrainSpace,
  terrainGenerated: boolean,
  height: number,
  lift: number
) {
  const coordinates = removeClosingCoordinate(feature.coordinates);
  if (coordinates.length < 3) {
    return null;
  }

  const basePoints = coordinates.map((coordinate) =>
    projectCoordinateToScene(
      coordinate,
      project,
      projectSpace,
      terrain,
      terrainSpace,
      terrainGenerated,
      lift
    )
  );
  const topPoints = basePoints.map((point) => [point[0], point[1] + height, point[2]] as Vec3);
  const shapePoints = basePoints.map((point) => new Vector2(point[0], point[2]));
  const triangles = ShapeUtils.triangulateShape(shapePoints, []);
  const positions: number[] = [];

  for (const triangle of triangles) {
    for (const pointIndex of triangle) {
      positions.push(...topPoints[pointIndex]);
    }
  }

  for (let index = 0; index < basePoints.length; index += 1) {
    const nextIndex = (index + 1) % basePoints.length;
    const baseA = basePoints[index];
    const baseB = basePoints[nextIndex];
    const topA = topPoints[index];
    const topB = topPoints[nextIndex];
    positions.push(...baseA, ...topB, ...baseB);
    positions.push(...baseA, ...topA, ...topB);
  }

  if (positions.length === 0) {
    return null;
  }

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function getCoordinateBounds(coordinates: Coordinate[]) {
  return coordinates.reduce(
    (bounds, coordinate) => ({
      minX: Math.min(bounds.minX, coordinate[0]),
      minY: Math.min(bounds.minY, coordinate[1]),
      maxX: Math.max(bounds.maxX, coordinate[0]),
      maxY: Math.max(bounds.maxY, coordinate[1])
    }),
    {
      minX: Number.POSITIVE_INFINITY,
      minY: Number.POSITIVE_INFINITY,
      maxX: Number.NEGATIVE_INFINITY,
      maxY: Number.NEGATIVE_INFINITY
    }
  );
}

function isCoordinateInsideRing(point: Coordinate, ring: Coordinate[]) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const xi = ring[i][0];
    const yi = ring[i][1];
    const xj = ring[j][0];
    const yj = ring[j][1];
    const intersects =
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi || 1e-9) + xi;
    if (intersects) {
      inside = !inside;
    }
  }
  return inside;
}

function closeRing(coordinates: Coordinate[]) {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (!first || !last || (first[0] === last[0] && first[1] === last[1])) {
    return coordinates;
  }

  return [...coordinates, first];
}

function removeClosingCoordinate(coordinates: Coordinate[]) {
  const first = coordinates[0];
  const last = coordinates[coordinates.length - 1];
  if (!first || !last || first[0] !== last[0] || first[1] !== last[1]) {
    return coordinates;
  }

  return coordinates.slice(0, -1);
}

function getFeatureFillColor(
  layer: PlanningLayer,
  feature: NonNullable<PlanningLayer["features"]>[number]
) {
  if (layer.id === "safe-data-soil") {
    return getSoilFeatureColor(feature);
  }
  if (layer.id === "safe-data-boundaries") {
    return getBoundaryFeatureColor(feature);
  }

  return layer.style?.fill ?? "#4aa3cf";
}

function getFeatureStrokeColor(
  layer: PlanningLayer,
  feature: NonNullable<PlanningLayer["features"]>[number]
) {
  if (layer.id === "safe-data-soil") {
    return darkenHex(getSoilFeatureColor(feature), 0.28);
  }
  if (layer.id === "safe-data-boundaries") {
    return darkenHex(getBoundaryFeatureColor(feature), 0.24);
  }

  return layer.style?.stroke ?? "#2f6f4e";
}

function getFeatureFillOpacity(layer: PlanningLayer) {
  if (layer.id === "safe-data-boundaries") {
    return layer.opacity;
  }

  return Math.min(0.72, Math.max(0.18, layer.opacity * 0.62));
}

function getBoundaryFeatureColor(
  feature: NonNullable<PlanningLayer["features"]>[number]
) {
  const layerKind = String(feature.attributes?.layerKind ?? "");
  return BOUNDARY_KIND_COLORS[layerKind] ?? "#7a6fb0";
}

function getStructureFeatureColor(
  feature: NonNullable<PlanningLayer["features"]>[number]
) {
  const layerKind = String(feature.attributes?.layerKind ?? "");
  return STRUCTURE_KIND_COLORS[layerKind] ?? "#8b5c4a";
}

function getBuildingFeatureColor(
  feature: NonNullable<PlanningLayer["features"]>[number]
) {
  const buildingType = String(feature.attributes?.building ?? "yes");
  return BUILDING_TYPE_COLORS[buildingType] ?? "#8f9dad";
}

function getBuildingHeightMeters(
  feature: NonNullable<PlanningLayer["features"]>[number]
) {
  const explicitHeight = parseHeightMeters(feature.attributes?.height);
  if (explicitHeight) {
    return explicitHeight;
  }

  const levels = Number.parseFloat(String(feature.attributes?.["building:levels"] ?? ""));
  if (Number.isFinite(levels) && levels > 0) {
    return clamp(levels * 3.2, 3.2, 80);
  }

  const buildingType = String(feature.attributes?.building ?? "");
  if (buildingType === "school" || buildingType === "public" || buildingType === "civic") {
    return 10;
  }
  if (buildingType === "commercial" || buildingType === "retail") {
    return 8;
  }
  if (buildingType === "industrial" || buildingType === "warehouse") {
    return 9;
  }
  if (buildingType === "cabin" || buildingType === "house" || buildingType === "residential") {
    return 5.5;
  }

  return 6;
}

function parseHeightMeters(value: unknown) {
  if (value === null || value === undefined) {
    return null;
  }

  const raw = String(value).trim().toLowerCase();
  if (!raw) {
    return null;
  }

  const numeric = Number.parseFloat(raw.replace(",", "."));
  if (!Number.isFinite(numeric) || numeric <= 0) {
    return null;
  }

  return raw.includes("ft") || raw.includes("'")
    ? clamp(numeric * 0.3048, 2.5, 120)
    : clamp(numeric, 2.5, 120);
}

function getSoilFeatureColor(feature: NonNullable<PlanningLayer["features"]>[number]) {
  const key =
    feature.attributes?.musym ??
    feature.attributes?.nationalmusym ??
    feature.attributes?.mukey ??
    feature.label;
  return SOIL_COLOR_PALETTE[hashString(String(key)) % SOIL_COLOR_PALETTE.length];
}

function hashString(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }
  return hash;
}

function darkenHex(hex: string, amount: number) {
  const normalized = hex.replace("#", "");
  const red = Number.parseInt(normalized.slice(0, 2), 16);
  const green = Number.parseInt(normalized.slice(2, 4), 16);
  const blue = Number.parseInt(normalized.slice(4, 6), 16);
  return `#${[red, green, blue]
    .map((channel) =>
      Math.round(channel * (1 - amount))
        .toString(16)
        .padStart(2, "0")
    )
    .join("")}`;
}

function projectCoordinateToScene(
  coordinate: Coordinate,
  project: ProjectMetadata,
  projectSpace: ProjectSpace,
  terrain: TerrainModel,
  terrainSpace: TerrainSpace,
  terrainGenerated: boolean,
  lift: number
): Vec3 {
  const u = clamp(coordinate[0] / project.realWorldExtentMeters.width, 0, 1);
  const v = clamp(coordinate[1] / project.realWorldExtentMeters.depth, 0, 1);
  const x = (u - 0.5) * projectSpace.sizeX;
  const z = (v - 0.5) * projectSpace.sizeZ;
  const y = terrainGenerated ? sampleHeightAt(terrain, terrainSpace, u, v) + lift : lift;

  return [x, y, z];
}

/**
 * Re-frames the camera whenever the camera target/limits change (e.g. switching
 * Fit <-> 1:1), since R3F only reads the <Canvas camera> prop on first mount.
 */
function CameraRig({
  mode,
  far,
  near,
  position,
  target,
  zoom
}: {
  mode: "top-view" | "terrain-3d";
  far: number;
  near: number;
  position: [number, number, number];
  target: [number, number, number];
  zoom?: number;
}) {
  const camera = useThree((state) => state.camera);

  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.up.set(0, mode === "top-view" ? 0 : 1, mode === "top-view" ? -1 : 0);
    if ("zoom" in camera && zoom) {
      camera.zoom = zoom;
    }
    if ("far" in camera) {
      camera.far = far;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target[0], target[1], target[2]);
  }, [camera, far, mode, near, position, target, zoom]);

  return null;
}

function TopViewZoomControls({
  maxZoom,
  minZoom
}: {
  maxZoom: number;
  minZoom: number;
}) {
  const camera = useThree((state) => state.camera);
  const gl = useThree((state) => state.gl);

  useEffect(() => {
    const element = gl.domElement;
    const onWheel = (event: WheelEvent) => {
      if (!("zoom" in camera)) {
        return;
      }

      event.preventDefault();
      const zoomStep = event.deltaY > 0 ? 0.9 : 1.1;
      camera.zoom = Math.min(maxZoom, Math.max(minZoom, camera.zoom * zoomStep));
      camera.updateProjectionMatrix();
    };

    element.addEventListener("wheel", onWheel, { passive: false });

    return () => {
      element.removeEventListener("wheel", onWheel);
    };
  }, [camera, gl, maxZoom, minZoom]);

  return null;
}

function PerspectiveCameraControls({
  dampingFactor,
  far,
  maxDistance,
  maxPolarAngle,
  minDistance,
  minPolarAngle,
  near,
  position,
  target
}: {
  dampingFactor: number;
  far: number;
  maxDistance: number;
  maxPolarAngle: number;
  minDistance: number;
  minPolarAngle: number;
  near: number;
  position: [number, number, number];
  target: [number, number, number];
}) {
  const camera = useThree((state) => state.camera);
  const controlsRef = useRef<OrbitControlsImpl | null>(null);

  useEffect(() => {
    camera.position.set(position[0], position[1], position[2]);
    camera.up.set(0, 1, 0);
    if ("far" in camera) {
      camera.far = far;
      camera.near = near;
      camera.updateProjectionMatrix();
    }
    camera.lookAt(target[0], target[1], target[2]);

    const controls = controlsRef.current;
    if (!controls) {
      return;
    }

    controls.enabled = true;
    controls.minDistance = minDistance;
    controls.maxDistance = maxDistance;
    controls.minPolarAngle = minPolarAngle;
    controls.maxPolarAngle = maxPolarAngle;
    controls.target.set(target[0], target[1], target[2]);
    controls.update();
  }, [
    camera,
    far,
    maxDistance,
    maxPolarAngle,
    minDistance,
    minPolarAngle,
    near,
    position,
    target
  ]);

  return (
    <OrbitControls
      ref={controlsRef}
      dampingFactor={dampingFactor}
      enableDamping
      enablePan
      makeDefault
      maxDistance={maxDistance}
      maxPolarAngle={maxPolarAngle}
      minDistance={minDistance}
      minPolarAngle={minPolarAngle}
      target={target}
    />
  );
}

/**
 * Single "sun" lighting model. One strong directional light drives all shading
 * and shadows. A neutral grey hemisphere + faint ambient act as a colourless
 * sky-dome fill so shadowed faces are not pure black — but they add NO colour,
 * keeping the editor neutral so map layers own all colour.
 */
function SceneLights() {
  return (
    <>
      <ambientLight color="#ffffff" intensity={0.28} />
      <hemisphereLight color="#e2e2e2" groundColor="#b4b4b4" intensity={0.7} />
      <directionalLight
        castShadow
        color="#ffffff"
        intensity={3.0}
        position={[22, 48, 18]}
        shadow-bias={-0.002}
        shadow-camera-bottom={-60}
        shadow-camera-far={200}
        shadow-camera-left={-60}
        shadow-camera-right={60}
        shadow-camera-top={60}
        shadow-mapSize-height={2048}
        shadow-mapSize-width={2048}
        shadow-normalBias={0.3}
        shadow-radius={2}
      />
    </>
  );
}

export function TerrainScene() {
  const terrain = useEditorStore((state) => state.terrain);
  const activeMode = useEditorStore((state) => state.activeMode);
  const viewScaleMode = useEditorStore((state) => state.viewScaleMode);

  const space = useMemo(
    () =>
      getTerrainSpace(
        terrain,
        getTerrainScaleOverride(terrain, viewScaleMode),
        FIT_VERTICAL_EXAGGERATION
      ),
    [terrain, viewScaleMode]
  );

  const { controls, perspectiveStart, target, topStart } = useMemo(() => {
    const span = Math.max(space.sizeX, space.sizeZ, TARGET_SCENE_SPAN);
    const surfaceTop = elevationToSceneHeight(terrain.maxElevation, space);
    const height = surfaceTop - space.baseY;
    const targetY = space.baseY + height * 0.55;
    const radius = Math.min(Math.hypot(span, height), MAX_CAMERA_RADIUS);
    const detailZoom = viewScaleMode === "1:1" ? 0.45 : 1;
    const topZoomMultiplier = viewScaleMode === "1:1" ? 2.65 : 1;
    const dist = radius * 1.35 * detailZoom;
    const topDist = radius * 2.4 * detailZoom;
    return {
      target: [0, targetY, 0] as [number, number, number],
      perspectiveStart: [dist * 0.8, targetY + dist * 0.66, dist * 0.8] as [
        number,
        number,
        number
      ],
      topStart: [0, targetY + topDist, 0] as [number, number, number],
      controls: {
        far: radius * 80,
        near: Math.max(radius / 2000, 0.01),
        minDistance: Math.max(radius * 0.02, 1),
        maxDistance: radius * 8,
        topMaxZoom: 60,
        topMinZoom: Math.max(0.02, TARGET_SCENE_SPAN / (span * 5)),
        topZoom: Math.max(
          0.05,
          (TARGET_SCENE_SPAN / (span * 1.35)) * topZoomMultiplier
        )
      }
    };
  }, [space, terrain.maxElevation, viewScaleMode]);
  const isTopView = activeMode === "top-view";
  const cameraPosition = isTopView ? topStart : perspectiveStart;
  const cameraKey = activeMode;

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={createWebGPURenderer as unknown as undefined}
      shadows
    >
      <color attach="background" args={[new Color(VIEW_BACKGROUND)]} />
      {isTopView ? (
        <OrthographicCamera
          key={`top-camera-${cameraKey}`}
          far={controls.far}
          makeDefault
          near={controls.near}
          position={topStart}
          up={[0, 0, -1]}
          zoom={controls.topZoom}
        />
      ) : (
        <PerspectiveCamera
          key={`perspective-camera-${cameraKey}`}
          far={controls.far}
          fov={27}
          makeDefault
          near={controls.near}
          position={perspectiveStart}
        />
      )}
      <CameraRig
        far={controls.far}
        mode={activeMode}
        near={controls.near}
        position={cameraPosition}
        target={target}
        zoom={isTopView ? controls.topZoom : undefined}
      />
      <SceneLights />
      <LayeredSceneContent />
      {isTopView ? (
        <TopViewZoomControls
          maxZoom={controls.topMaxZoom}
          minZoom={controls.topMinZoom}
        />
      ) : (
        <PerspectiveCameraControls
          key={`orbit-${cameraKey}`}
          dampingFactor={0.06}
          far={controls.far}
          maxDistance={controls.maxDistance}
          maxPolarAngle={Math.PI / 2.35}
          minDistance={controls.minDistance}
          minPolarAngle={0.52}
          near={controls.near}
          position={cameraPosition}
          target={target}
        />
      )}
    </Canvas>
  );
}
