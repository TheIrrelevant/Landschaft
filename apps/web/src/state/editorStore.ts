/*
 * ---metadata---
 * type: app-source
 * description: Zustand store for Landschaft editor layers and selected area state.
 * last-updated: 2026-06-27
 * last-model: codex-gpt-5
 * last-change: generate terrain state through shared backend contract
 * ---end-metadata---
 */
import {
  generateTerrainProject,
  type CodedArea,
  type OrthophotoCorner,
  type PlanningLayer,
  type ProjectMetadata,
  type TerrainGenerationRequest,
  type TerrainModel
} from "@landschaft/shared";
import { create } from "zustand";

type EditorMode = "top-view" | "terrain-3d";

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
  activeMode: EditorMode;
  /** "fit" auto-scales the terrain into the scene; "1:1" shows true metres. */
  viewScaleMode: "fit" | "1:1";
  setViewScaleMode: (mode: EditorState["viewScaleMode"]) => void;
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
  setMode: (mode: EditorMode) => void;
  setOrthophotoPreview: (fileName: string, previewUrl: string) => void;
  setLayerOpacity: (layerId: string, opacity: number) => void;
  toggleLayer: (layerId: string) => void;
}

const defaultCorners: OrthophotoCorner[] = [
  { label: "NW", latitude: 41.0312, longitude: 29.0141 },
  { label: "NE", latitude: 41.0312, longitude: 29.0194 },
  { label: "SE", latitude: 41.0271, longitude: 29.0194 },
  { label: "SW", latitude: 41.0271, longitude: 29.0141 }
];

const baseTerrainRequest: TerrainGenerationRequest = {
  projectId: "project-demo",
  projectName: "Untitled Terrain Project",
  coordinateReferenceSystem: "EPSG:4326",
  corners: defaultCorners,
  quality: "balanced",
  heightSource: "sample-external-dem"
};

const initialTerrainProject = generateTerrainProject(baseTerrainRequest);

function createProject(corners: OrthophotoCorner[], sourceImageName?: string) {
  return generateTerrainProject({
    ...baseTerrainRequest,
    sourceImageName,
    corners
  }).project;
}

function createTerrainRequest(project: ProjectMetadata): TerrainGenerationRequest {
  return {
    projectId: project.id,
    projectName: project.name,
    coordinateReferenceSystem: project.coordinateReferenceSystem,
    sourceImageName: project.sourceImageName,
    corners: project.corners,
    quality: "balanced",
    heightSource: "sample-external-dem"
  };
}

export const useEditorStore = create<EditorState>((set) => ({
  layers: [],
  project: initialTerrainProject.project,
  terrain: initialTerrainProject.terrain,
  terrainGenerated: false,
  orthophotoPreviewUrl: null,
  coordinateStep: null,
  inspectorOpen: false,
  viewScaleMode: "fit",
  selectedLayerId: null,
  selectedArea: null,
  activeMode: "terrain-3d",
  advanceCoordinateStep: () =>
    set((state) => ({
      coordinateStep:
        state.coordinateStep === null ? 0 : Math.min(state.coordinateStep + 1, 4)
    })),
  closeInspector: () => set({ inspectorOpen: false }),
  generateTerrain: () =>
    set((state) => {
      const result = generateTerrainProject(createTerrainRequest(state.project));

      return {
        project: result.project,
        terrain: result.terrain,
        layers: result.baseLayers,
        selectedLayerId: result.baseLayers[0]?.id ?? null,
        selectedArea: null,
        terrainGenerated: true,
        inspectorOpen: false,
        coordinateStep: 4
      };
    }),
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
        project: createProject(corners, state.project.sourceImageName)
      };
    }),
  selectArea: (area) => set({ selectedArea: area }),
  selectLayer: (layerId) =>
    set({
      selectedLayerId: layerId,
      inspectorOpen: true
    }),
  setMode: (mode) => set({ activeMode: mode }),
  setViewScaleMode: (mode) => set({ viewScaleMode: mode }),
  setOrthophotoPreview: (fileName, previewUrl) =>
    set((state) => {
      if (state.orthophotoPreviewUrl) {
        URL.revokeObjectURL(state.orthophotoPreviewUrl);
      }

      return {
        coordinateStep: 0,
        orthophotoPreviewUrl: previewUrl,
        project: {
          ...state.project,
          sourceImageName: fileName
        },
        layers: [],
        selectedLayerId: null,
        selectedArea: null,
        terrainGenerated: false,
        inspectorOpen: false
      };
    }),
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
