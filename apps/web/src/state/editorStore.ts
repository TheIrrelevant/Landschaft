/*
 * type: app-source
 * description: Zustand store for Landschaft editor layers and selected area state.
 * last-updated: 2026-06-24
 * last-model: codex-gpt-5
 * last-change: added initial editor state
 */
import type { CodedArea, PlanningLayer } from "@landschaft/shared";
import { create } from "zustand";

interface EditorState {
  layers: PlanningLayer[];
  selectedArea: CodedArea | null;
  activeMode: "top-view" | "terrain-3d";
  selectArea: (area: CodedArea | null) => void;
  setMode: (mode: EditorState["activeMode"]) => void;
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

export const useEditorStore = create<EditorState>((set) => ({
  layers: defaultLayers,
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
  selectArea: (area) => set({ selectedArea: area }),
  setMode: (mode) => set({ activeMode: mode }),
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
