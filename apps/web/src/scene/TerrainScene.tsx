/*
 * ---metadata---
 * type: app-source
 * description: Three.js terrain preview scene for the Landschaft editor.
 * last-updated: 2026-06-27
 * last-model: codex-gpt-5
 * last-change: keep orthophoto texture separate from generated terrain mesh
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
import { useEffect, useMemo, useState } from "react";
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  RepeatWrapping,
  SRGBColorSpace,
  TextureLoader,
  type Texture
} from "three";
import * as THREE from "three/webgpu";
import type { PlanningLayer, ProjectMetadata, TerrainModel } from "@landschaft/shared";
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
const ONE_TO_ONE_VERTICAL_EXAGGERATION = 4.5;
// Solid base depth BELOW the terrain, expressed in real metres (scaled by
// displayScale into the scene). ~40 m of "geological block" under the lowest
// point reads as a carved model.
const BASE_DEPTH_METERS = 40;

/**
 * The terrain coordinate space.
 *
 * DATA stays in true metres (terrain.width/depth/elevation). `displayScale` is a
 * single uniform factor (horizontal == vertical, so proportions are never
 * distorted) that maps metres -> scene units. By default it fits the terrain
 * into TARGET_SCENE_SPAN so very large maps don't produce a huge scene; set it
 * to 1 for true 1:1 viewing. Scene origin (0,0) is the terrain centre.
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
  /** lowest surface point in scene units (terrain min is lifted to y=0) */
  baseY: number;
};

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
    baseY: -BASE_DEPTH_METERS * displayScale
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
  const baseY = space.baseY;
  const last = grid - 1;

  const top = (gx: number, gy: number): Vec3 => {
    const u = gx / last;
    const v = gy / last;
    return normalizedGridToLocal(u, v, sampleHeightAt(terrain, space, u, v), space);
  };
  const bottom = (gx: number, gy: number): Vec3 => {
    const t = gridCoordToLocal(gx, gy, grid, 0, space);
    return [t[0], baseY, t[2]];
  };
  // tri pushes one triangle with its three UVs.
  const tri = (
    a: Vec3,
    b: Vec3,
    c: Vec3,
    uvA: [number, number],
    uvB: [number, number],
    uvC: [number, number]
  ) => {
    positions.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    uvs.push(uvA[0], uvA[1], uvB[0], uvB[1], uvC[0], uvC[1]);
  };

  const gridUv = (gx: number, gy: number): [number, number] => [gx / last, gy / last];

  // --- GROUP 0: Top surface (fabric) ---
  let topTriCount = 0;
  for (let gy = 0; gy < last; gy += 1) {
    for (let gx = 0; gx < last; gx += 1) {
      const a = top(gx, gy);
      const b = top(gx + 1, gy);
      const c = top(gx + 1, gy + 1);
      const d = top(gx, gy + 1);
      const ua = gridUv(gx, gy);
      const ub = gridUv(gx + 1, gy);
      const uc = gridUv(gx + 1, gy + 1);
      const ud = gridUv(gx, gy + 1);
      tri(a, c, b, ua, uc, ub);
      tri(a, d, c, ua, ud, uc);
      topTriCount += 2;
    }
  }

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

  // Base cap at baseY — faces down.
  const c00 = bottom(0, 0);
  const c10 = bottom(last, 0);
  const c11 = bottom(last, last);
  const c01 = bottom(0, last);
  tri(c00, c10, c11, wallBot, wallBot, wallBot);
  tri(c00, c11, c01, wallBot, wallBot, wallBot);

  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  const totalTris = positions.length / 9;
  // Group 0 = fabric top, group 1 = solid terrain sides/base.
  geometry.addGroup(0, topTriCount * 3, 0);
  geometry.addGroup(topTriCount * 3, (totalTris - topTriCount) * 3, 1);

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
 * Surface height for a cell, in scene units. Real elevation above the terrain
 * minimum (metres) scaled uniformly by displayScale — same factor as the
 * horizontal axes, so vertical proportions are true (no exaggeration).
 */
function sampleHeightAt(
  terrain: TerrainModel,
  space: TerrainSpace,
  u: number,
  v: number
) {
  const elevation = sampleElevationAt(terrain, u, v);
  return (elevation - terrain.minElevation) * space.displayScale * space.verticalScale;
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

  // Surface spans y = 0 (terrain min) .. rangeMeters * displayScale (terrain max).
  const surfaceMax = space.rangeMeters * space.displayScale * space.verticalScale;
  const step = surfaceMax / (CONTOUR_LEVELS + 1);
  const lift = CONTOUR_LIFT * Math.max(space.displayScale, 0.0001) * 50;

  for (let level = 1; level <= CONTOUR_LEVELS; level += 1) {
    const threshold = step * level;

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

function useOrthophotoTexture(url: string | null) {
  const [texture, setTexture] = useState<Texture | null>(null);

  useEffect(() => {
    if (!url) {
      setTexture(null);
      return undefined;
    }

    let cancelled = false;
    const loader = new TextureLoader();
    loader.load(url, (loadedTexture) => {
      if (cancelled) {
        loadedTexture.dispose();
        return;
      }

      loadedTexture.colorSpace = SRGBColorSpace;
      loadedTexture.anisotropy = 4;
      loadedTexture.needsUpdate = true;
      setTexture(loadedTexture);
    });

    return () => {
      cancelled = true;
      setTexture((currentTexture) => {
        if (currentTexture) {
          currentTexture.dispose();
        }

        return null;
      });
    };
  }, [url]);

  return texture;
}

function TerrainMesh({
  terrain,
  space
}: {
  terrain: TerrainModel;
  space: TerrainSpace;
}) {
  const geometry = useMemo(() => buildTerrainGeometry(terrain, space), [terrain, space]);
  const materials = useMemo(() => {
    const topSurface = new THREE.MeshLambertNodeMaterial({
      color: new Color(TERRAIN_CLAY),
      map: createFeltTexture(),
      side: DoubleSide
    });
    const solid = new THREE.MeshLambertNodeMaterial({
      color: new Color(SOLID_TERRAIN_COLOR),
      map: createSolidTerrainTexture(),
      side: DoubleSide
    });
    return [topSurface, solid];
  }, []);

  return (
    <mesh castShadow geometry={geometry} material={materials} receiveShadow />
  );
}

function OrthophotoBaseMap({
  opacity,
  project,
  texture,
  viewScaleMode
}: {
  opacity: number;
  project: ProjectMetadata;
  texture: Texture | null;
  viewScaleMode: "fit" | "1:1";
}) {
  const space = useMemo(
    () => getProjectSpace(project, viewScaleMode === "1:1" ? 1 : undefined),
    [project, viewScaleMode]
  );
  const materials = useMemo(() => {
    const side = new THREE.MeshBasicNodeMaterial({
      color: new Color("#bdbdbd"),
      transparent: true,
      opacity
    });
    const top = new THREE.MeshBasicNodeMaterial({
      color: new Color("#ffffff"),
      map: texture ?? createFeltTexture(),
      transparent: true,
      opacity
    });

    return [side, side, top, side, side, side];
  }, [opacity, texture]);

  return (
    <group>
      <GroundPlane baseY={-0.12} />
      <mesh material={materials} position={[0, 0, 0]} receiveShadow>
        <boxGeometry args={[space.sizeX, 0.08, space.sizeZ]} />
      </mesh>
    </group>
  );
}

function ContourLines({ terrain, space }: { terrain: TerrainModel; space: TerrainSpace }) {
  const geometry = useMemo(() => buildContourGeometry(terrain, space), [terrain, space]);

  return (
    <lineSegments geometry={geometry}>
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
    <group position={[0, baseY - 0.01, 0]}>
      <mesh receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_PLANE_SIZE, GROUND_PLANE_SIZE]} />
        <meshBasicNodeMaterial color={new Color(GROUND_COLOR)} map={gridMap} />
      </mesh>
      <mesh position={[0, 0.005, 0]} receiveShadow rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[GROUND_PLANE_SIZE, GROUND_PLANE_SIZE]} />
        <shadowMaterial opacity={0.22} transparent />
      </mesh>
    </group>
  );
}

function TerrainContent() {
  const terrain = useEditorStore((state) => state.terrain);
  const layers = useEditorStore((state) => state.layers);
  const viewScaleMode = useEditorStore((state) => state.viewScaleMode);
  const terrainLayer = getLayer(layers, "terrain-mesh");
  const space = useMemo(
    () =>
      getTerrainSpace(
        terrain,
        viewScaleMode === "1:1" ? 1 : undefined,
        viewScaleMode === "1:1"
          ? ONE_TO_ONE_VERTICAL_EXAGGERATION
          : FIT_VERTICAL_EXAGGERATION
      ),
    [terrain, viewScaleMode]
  );

  return (
    <>
      <GroundPlane baseY={space.baseY} />
      {terrainLayer?.visible ?? true ? (
        <>
          <TerrainMesh terrain={terrain} space={space} />
          <ContourLines terrain={terrain} space={space} />
        </>
      ) : null}
    </>
  );
}

function OrthophotoContent() {
  const layers = useEditorStore((state) => state.layers);
  const project = useEditorStore((state) => state.project);
  const orthophotoPreviewUrl = useEditorStore((state) => state.orthophotoPreviewUrl);
  const viewScaleMode = useEditorStore((state) => state.viewScaleMode);
  const orthophotoTexture = useOrthophotoTexture(orthophotoPreviewUrl);
  const orthophotoLayer = getLayer(layers, "orthophoto-base");

  if (!orthophotoPreviewUrl || !orthophotoLayer?.visible) {
    return null;
  }

  return (
    <OrthophotoBaseMap
      opacity={orthophotoLayer.opacity}
      project={project}
      texture={orthophotoTexture}
      viewScaleMode={viewScaleMode}
    />
  );
}

function getLayer(layers: PlanningLayer[], id: string) {
  return layers.find((layer) => layer.id === id);
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
  zoom
}: {
  mode: "top-view" | "terrain-3d";
  far: number;
  near: number;
  position: [number, number, number];
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
    camera.lookAt(0, 0, 0);
  }, [camera, far, mode, near, position, zoom]);

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
  const terrainGenerated = useEditorStore((state) => state.terrainGenerated);
  const activeMode = useEditorStore((state) => state.activeMode);
  const viewScaleMode = useEditorStore((state) => state.viewScaleMode);

  const space = useMemo(
    () =>
      getTerrainSpace(
        terrain,
        viewScaleMode === "1:1" ? 1 : undefined,
        viewScaleMode === "1:1"
          ? ONE_TO_ONE_VERTICAL_EXAGGERATION
          : FIT_VERTICAL_EXAGGERATION
      ),
    [terrain, viewScaleMode]
  );

  const { controls, perspectiveStart, topStart } = useMemo(() => {
    const span = Math.max(space.sizeX, space.sizeZ, TARGET_SCENE_SPAN);
    const height = space.rangeMeters * space.displayScale * space.verticalScale;
    const radius = Math.hypot(span, height + Math.abs(space.baseY));
    const dist = radius * 1.35;
    const topDist = radius * 2.4;
    return {
      perspectiveStart: [dist * 0.8, dist * 0.66, dist * 0.8] as [
        number,
        number,
        number
      ],
      topStart: [0, topDist, 0] as [number, number, number],
      controls: {
        far: radius * 80,
        near: Math.max(radius / 2000, 0.01),
        minDistance: Math.max(radius * 0.02, 1),
        maxDistance: radius * 8,
        topMaxZoom: 60,
        topMinZoom: Math.max(0.02, TARGET_SCENE_SPAN / (span * 5)),
        topZoom: Math.max(0.05, TARGET_SCENE_SPAN / (span * 1.35))
      }
    };
  }, [space]);
  const isTopView = activeMode === "top-view";
  const cameraPosition = isTopView ? topStart : perspectiveStart;

  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={createWebGPURenderer as unknown as undefined}
      shadows
    >
      <color attach="background" args={[new Color(VIEW_BACKGROUND)]} />
      {isTopView ? (
        <OrthographicCamera
          far={controls.far}
          makeDefault
          near={controls.near}
          position={topStart}
          up={[0, 0, -1]}
          zoom={controls.topZoom}
        />
      ) : (
        <PerspectiveCamera
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
        zoom={isTopView ? controls.topZoom : undefined}
      />
      <SceneLights />
      <OrthophotoContent />
      {terrainGenerated ? <TerrainContent /> : null}
      {isTopView ? (
        <TopViewZoomControls
          maxZoom={controls.topMaxZoom}
          minZoom={controls.topMinZoom}
        />
      ) : (
        <OrbitControls
          dampingFactor={0.06}
          enableDamping
          enablePan={false}
          makeDefault
          maxDistance={controls.maxDistance}
          maxPolarAngle={Math.PI / 2.35}
          minDistance={controls.minDistance}
          minPolarAngle={0.52}
          target={[0, 0, 0]}
        />
      )}
    </Canvas>
  );
}
