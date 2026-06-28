/*
 * ---metadata---
 * type: app-source
 * description: Zustand store for Landschaft editor layers and selected area state.
 * last-updated: 2026-06-28
 * last-model: codex-gpt-5
 * last-change: insert generated mesh layer above existing layers
 * ---end-metadata---
 */
import {
  generateTerrainProject,
  generateTerrainProjectAsync,
  ProjectSnapshotSchema,
  type CodedArea,
  type OrthophotoCorner,
  type PlanningLayer,
  type ProjectMetadata,
  type ProjectSnapshot,
  type TerrainGenerationRequest,
  type TerrainHeightSource,
  type TerrainModel
} from "@landschaft/shared";
import { create } from "zustand";

type EditorMode = "top-view" | "terrain-3d";
type EditorPersistedState = Pick<
  EditorState,
  | "coordinateStep"
  | "layers"
  | "project"
  | "orthophotoPreviewUrl"
  | "selectedLayerId"
  | "terrain"
  | "terrainGenerated"
>;

interface EditorState {
  layers: PlanningLayer[];
  project: ProjectMetadata;
  terrain: TerrainModel;
  terrainGenerated: boolean;
  terrainGenerating: boolean;
  terrainGenerationError: string | null;
  terrainHeightSource: TerrainHeightSource;
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
  generateTerrain: () => Promise<void>;
  reorderLayer: (sourceLayerId: string, targetLayerId: string) => void;
  setCornerCoordinate: (
    label: OrthophotoCorner["label"],
    axis: "latitude" | "longitude",
    value: number
  ) => void;
  selectArea: (area: CodedArea | null) => void;
  selectLayer: (layerId: string) => void;
  setMode: (mode: EditorMode) => void;
  setTerrainHeightSource: (heightSource: TerrainHeightSource) => void;
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
const PROJECT_SNAPSHOT_STORAGE_KEY = "landschaft.project.snapshot.v3";

function createProject(corners: OrthophotoCorner[], sourceImageName?: string) {
  return generateTerrainProject({
    ...baseTerrainRequest,
    sourceImageName,
    corners
  }).project;
}

function createOrthophotoLayer(): PlanningLayer {
  return {
    id: "orthophoto-base",
    name: "Orthophoto Base",
    kind: "orthophoto",
    visible: true,
    opacity: 1,
    reviewStatus: "draft"
  };
}

function createTerrainRequest(
  project: ProjectMetadata,
  heightSource: TerrainHeightSource
): TerrainGenerationRequest {
  return {
    projectId: project.id,
    projectName: project.name,
    coordinateReferenceSystem: project.coordinateReferenceSystem,
    sourceImageName: project.sourceImageName,
    corners: project.corners,
    quality: heightSource === "usgs-contours" ? "detailed" : "fast-preview",
    heightSource
  };
}

function loadProjectSnapshot(): ProjectSnapshot | null {
  if (typeof window === "undefined") {
    return null;
  }

  const rawSnapshot = window.localStorage.getItem(PROJECT_SNAPSHOT_STORAGE_KEY);
  if (!rawSnapshot) {
    return null;
  }

  try {
    const parsedSnapshot = JSON.parse(rawSnapshot) as unknown;
    const result = ProjectSnapshotSchema.safeParse(parsedSnapshot);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

function saveProjectSnapshot(snapshot: ProjectSnapshot) {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.setItem(
    PROJECT_SNAPSHOT_STORAGE_KEY,
    JSON.stringify(snapshot)
  );
}

function clearProjectSnapshot() {
  if (typeof window === "undefined") {
    return;
  }

  window.localStorage.removeItem(PROJECT_SNAPSHOT_STORAGE_KEY);
}

function toProjectSnapshot(state: EditorPersistedState): ProjectSnapshot {
  return {
    project: state.project,
    terrain: state.terrain,
    layers: state.layers,
    terrainGenerated: state.terrainGenerated,
    selectedLayerId: state.selectedLayerId,
    coordinateStep: state.coordinateStep,
    orthophotoPreviewUrl: state.orthophotoPreviewUrl
  };
}

const storedProjectSnapshot = loadProjectSnapshot();

export const useEditorStore = create<EditorState>((set, get) => ({
  layers: storedProjectSnapshot?.layers ?? [],
  project: storedProjectSnapshot?.project ?? initialTerrainProject.project,
  terrain: storedProjectSnapshot?.terrain ?? initialTerrainProject.terrain,
  terrainGenerated: storedProjectSnapshot?.terrainGenerated ?? false,
  terrainGenerating: false,
  terrainGenerationError: null,
  terrainHeightSource: "usgs-contours",
  orthophotoPreviewUrl: storedProjectSnapshot?.orthophotoPreviewUrl ?? null,
  coordinateStep: storedProjectSnapshot?.coordinateStep ?? null,
  inspectorOpen: false,
  viewScaleMode: "fit",
  selectedLayerId: storedProjectSnapshot?.selectedLayerId ?? null,
  selectedArea: null,
  activeMode: "terrain-3d",
  advanceCoordinateStep: () =>
    set((state) => ({
      coordinateStep:
        state.coordinateStep === null ? 0 : Math.min(state.coordinateStep + 1, 4)
    })),
  closeInspector: () => set({ inspectorOpen: false }),
  generateTerrain: async () => {
    const state = get();
    set({ terrainGenerating: true, terrainGenerationError: null });

    try {
      const result = await generateTerrainProjectAsync(
        createTerrainRequest(state.project, state.terrainHeightSource)
      );
      const layers = result.baseLayers
        .map((layer) => ({ ...layer, visible: true }))
        .sort((layerA, layerB) => {
          if (layerA.id === "terrain-mesh") {
            return -1;
          }

          if (layerB.id === "terrain-mesh") {
            return 1;
          }

          return 0;
        });
      const nextState = {
        project: result.project,
        terrain: result.terrain,
        layers,
        orthophotoPreviewUrl: state.orthophotoPreviewUrl,
        selectedLayerId: "terrain-mesh",
        selectedArea: null,
        terrainGenerated: true,
        inspectorOpen: false,
        coordinateStep: 4,
        terrainGenerating: false,
        terrainGenerationError: null
      };
      saveProjectSnapshot(toProjectSnapshot(nextState));

      set(nextState);
    } catch (error) {
      set({
        terrainGenerating: false,
        terrainGenerationError:
          error instanceof Error
            ? error.message
            : "Terrain generation failed."
      });
    }
  },
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
      saveProjectSnapshot(toProjectSnapshot({ ...state, layers }));
      return { layers };
    }),
  setCornerCoordinate: (label, axis, value) =>
    set((state) => {
      const corners = state.project.corners.map((corner) =>
        corner.label === label ? { ...corner, [axis]: value } : corner
      );

      const project = createProject(corners, state.project.sourceImageName);
      saveProjectSnapshot(toProjectSnapshot({ ...state, project }));

      return { project };
    }),
  selectArea: (area) => set({ selectedArea: area }),
  selectLayer: (layerId) =>
    set({
      selectedLayerId: layerId,
      inspectorOpen: true
    }),
  setMode: (mode) => set({ activeMode: mode }),
  setViewScaleMode: (mode) => set({ viewScaleMode: mode }),
  setTerrainHeightSource: (heightSource) =>
    set({ terrainHeightSource: heightSource }),
  setOrthophotoPreview: (fileName, previewUrl) =>
    set((state) => {
      if (state.orthophotoPreviewUrl) {
        URL.revokeObjectURL(state.orthophotoPreviewUrl);
      }
      clearProjectSnapshot();

      const layers = [createOrthophotoLayer()];
      const nextState = {
        activeMode: "top-view" as const,
        coordinateStep: 0,
        orthophotoPreviewUrl: previewUrl,
        project: {
          ...state.project,
          sourceImageName: fileName
        },
        layers,
        selectedLayerId: "orthophoto-base",
        selectedArea: null,
        terrainGenerated: false,
        terrainGenerationError: null,
        inspectorOpen: false
      };
      saveProjectSnapshot(toProjectSnapshot({ ...state, ...nextState }));

      return nextState;
    }),
  setLayerOpacity: (layerId, opacity) =>
    set((state) => {
      const layers = state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, opacity } : layer
      );
      saveProjectSnapshot(toProjectSnapshot({ ...state, layers }));

      return { layers };
    }),
  toggleLayer: (layerId) =>
    set((state) => {
      const layers = state.layers.map((layer) =>
        layer.id === layerId ? { ...layer, visible: !layer.visible } : layer
      );
      saveProjectSnapshot(toProjectSnapshot({ ...state, layers }));

      return { layers };
    })
}));
