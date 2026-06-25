/*
 * ---metadata---
 * type: app-source
 * description: Zustand store for Landschaft editor layers and selected area state.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: added layer reordering and blank default canvas state
 * ---end-metadata---
 */
import type {
  CodedArea,
  OrthophotoCorner,
  PlanningLayer,
  ProjectMetadata,
  TerrainModel
} from "@landschaft/shared";
import { create } from "zustand";

interface EditorState {
  layers: PlanningLayer[];
  project: ProjectMetadata;
  terrain: TerrainModel;
  terrainGenerated: boolean;
  orthophotoPreviewUrl: string | null;
  selectedArea: CodedArea | null;
  selectedLayerId: string | null;
  coordinateStep: number | null;
  inspectorOpen: boolean;
  activeMode: "top-view" | "terrain-3d";
  advanceCoordinateStep: () => void;
  closeInspector: () => void;
  generateTerrain: () => void;
  reorderLayer: (sourceLayerId: string, targetLayerId: string) => void;
  setCornerCoordinate: (
    label: OrthophotoCorner["label"],
    axis: "latitude" | "longitude",
    value: number
  ) => void;
  selectArea: (area: CodedArea | null) => void;
  selectLayer: (layerId: string) => void;
  setMode: (mode: EditorState["activeMode"]) => void;
  setOrthophotoPreview: (fileName: string, previewUrl: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  toggleLayer: (layerId: string) => void;
}

const defaultLayers: PlanningLayer[] = [
  {
    id: "orthophoto-base",
    name: "Orthophoto Base",
    kind: "orthophoto",
    visible: true,
    opacity: 1,
    reviewStatus: "draft"
  },
  {
    id: "lca-areas",
    name: "Landscape Character Areas",
    kind: "lca",
    visible: true,
    opacity: 0.72,
    reviewStatus: "draft"
  },
  {
    id: "strategy-map",
    name: "Strategy Map",
    kind: "strategy",
    visible: true,
    opacity: 0.64,
    reviewStatus: "draft"
  }
];

const defaultCorners: OrthophotoCorner[] = [
  { label: "NW", latitude: 41.0312, longitude: 29.0141 },
  { label: "NE", latitude: 41.0312, longitude: 29.0194 },
  { label: "SE", latitude: 41.0271, longitude: 29.0194 },
  { label: "SW", latitude: 41.0271, longitude: 29.0141 }
];

function createProject(corners: OrthophotoCorner[]): ProjectMetadata {
  const extent = getExtentMeters(corners);

  return {
    id: "project-demo",
    name: "Untitled Terrain Project",
    coordinateReferenceSystem: "EPSG:4326",
    corners,
    realWorldExtentMeters: extent
  };
}

function createTerrain(corners: OrthophotoCorner[]): TerrainModel {
  const extent = getExtentMeters(corners);
  const gridSize = 33;
  const heightmap = Array.from({ length: gridSize * gridSize }, (_, index) => {
    const x = index % gridSize;
    const y = Math.floor(index / gridSize);
    const nx = x / (gridSize - 1);
    const ny = y / (gridSize - 1);
    const ridge = Math.sin(nx * Math.PI * 2.4) * 5.8;
    const drainage = Math.cos((nx + ny) * Math.PI * 1.8) * 3.6;
    const slope = (1 - ny) * 11.5;

    return Number((ridge + drainage + slope + 42).toFixed(2));
  });

  return {
    accuracyStatus: "external-dem",
    elevationProvider: "Sample external DEM provider",
    gridSize,
    width: extent.width,
    depth: extent.depth,
    minElevation: Math.min(...heightmap),
    maxElevation: Math.max(...heightmap),
    heightmap,
    generatedAt: new Date().toISOString()
  };
}

function getExtentMeters(corners: OrthophotoCorner[]) {
  const north = corners.find((corner) => corner.label === "NW")!;
  const east = corners.find((corner) => corner.label === "NE")!;
  const south = corners.find((corner) => corner.label === "SW")!;

  return {
    width: Math.max(1, Math.round(getDistanceMeters(north, east))),
    depth: Math.max(1, Math.round(getDistanceMeters(north, south)))
  };
}

function getDistanceMeters(
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

const initialProject = createProject(defaultCorners);

export const useEditorStore = create<EditorState>((set) => ({
  layers: defaultLayers,
  project: initialProject,
  terrain: createTerrain(defaultCorners),
  terrainGenerated: false,
  orthophotoPreviewUrl: null,
  coordinateStep: null,
  inspectorOpen: false,
  selectedLayerId: null,
  selectedArea: {
    id: "a21kd49pe2",
    label: "Dry Exposed Slope Character",
    ring: [
      [34, 24],
      [24, 25],
      [20, 19],
      [24, 35],
      [34, 24]
    ],
    layer: "soil",
    code: "23",
    meaning: "Red soil on a gentle slope with settlement-edge pressure.",
    confidence: 0.74
  },
  activeMode: "terrain-3d",
  advanceCoordinateStep: () =>
    set((state) => ({
      coordinateStep:
        state.coordinateStep === null ? 0 : Math.min(state.coordinateStep + 1, 4)
    })),
  closeInspector: () => set({ inspectorOpen: false }),
  generateTerrain: () =>
    set((state) => ({
      project: createProject(state.project.corners),
      terrain: createTerrain(state.project.corners),
      terrainGenerated: true,
      coordinateStep: 4
    })),
  reorderLayer: (sourceLayerId, targetLayerId) =>
    set((state) => {
      const sourceIndex = state.layers.findIndex(
        (layer) => layer.id === sourceLayerId
      );
      const targetIndex = state.layers.findIndex(
        (layer) => layer.id === targetLayerId
      );

      if (sourceIndex < 0 || targetIndex < 0 || sourceIndex === targetIndex) {
        return state;
      }

      const layers = [...state.layers];
      const [movedLayer] = layers.splice(sourceIndex, 1);
      layers.splice(targetIndex, 0, movedLayer);

      return { layers };
    }),
  setCornerCoordinate: (label, axis, value) =>
    set((state) => {
      const corners = state.project.corners.map((corner) =>
        corner.label === label ? { ...corner, [axis]: value } : corner
      );

      return {
        project: {
          ...createProject(corners),
          sourceImageName: state.project.sourceImageName
        }
      };
    }),
  selectArea: (area) => set({ selectedArea: area }),
  selectLayer: (layerId) =>
    set({
      selectedLayerId: layerId,
      inspectorOpen: true
    }),
  setMode: (mode) => set({ activeMode: mode }),
  setOrthophotoPreview: (fileName, previewUrl) =>
    set((state) => ({
      coordinateStep: 0,
      orthophotoPreviewUrl: previewUrl,
      project: {
        ...state.project,
        sourceImageName: fileName
      }
    })),
  setLayerOpacity: (layerId, opacity) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer
      )
    })),
  toggleLayer: (layerId) =>
    set((state) => ({
      layers: state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      )
    }))
}));
