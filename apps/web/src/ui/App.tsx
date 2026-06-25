/*
 * ---metadata---
 * type: app-source
 * description: Main Landschaft editor shell.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: aligned sidebar and layers with approved minimal UI direction
 * ---end-metadata---
 */
import {
  Blend,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  GripVertical,
  Map,
  Settings,
  X
} from "lucide-react";
import { useState } from "react";
import { TerrainScene } from "../scene/TerrainScene";
import { useEditorStore } from "../state/editorStore";
import { TerrainSetupPanel } from "./TerrainSetupPanel";

export function App() {
  const { activeMode, setMode } = useEditorStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <main className={`editor-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-content">
          <div className="brand">
            <Map size={20} />
            <div>
              <strong>Landschaft</strong>
              <span>Landscape editor</span>
            </div>
          </div>
          <TerrainSetupPanel />
          <LayerPanel />
          <UserPanel />
        </div>
        <button
          aria-label={sidebarCollapsed ? "Open sidebar" : "Close sidebar"}
          className="sidebar-toggle"
          onClick={() => setSidebarCollapsed((isCollapsed) => !isCollapsed)}
          type="button"
        >
          {sidebarCollapsed ? <ChevronsRight size={16} /> : <ChevronsLeft size={16} />}
        </button>
      </aside>

      <section className="workspace">
        <div className="canvas-area">
          <div className="segmented-control">
            <button
              className={activeMode === "terrain-3d" ? "active" : ""}
              onClick={() => setMode("terrain-3d")}
              type="button"
            >
              3D View
            </button>
            <button
              className={activeMode === "top-view" ? "active" : ""}
              onClick={() => setMode("top-view")}
              type="button"
            >
              2D View
            </button>
          </div>
          <TerrainScene />
          <button className="inspector-tab" type="button">
            Inspector
          </button>
        </div>
      </section>

      <LayerInspector />
    </main>
  );
}

function LayerPanel() {
  const {
    layers,
    reorderLayer,
    selectedLayerId,
    selectLayer,
    setLayerOpacity,
    toggleLayer
  } = useEditorStore();
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragTargetLayerId, setDragTargetLayerId] = useState<string | null>(null);
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);
  const selectedOpacity = selectedLayer?.opacity ?? 1;

  return (
    <section className="layers-panel">
      <div className="layers-title-row">
        <strong>Layers</strong>
      </div>

      <div className="layer-control-row">
        <label>
          Blend
          <button type="button">
            Normal
            <ChevronDown size={13} />
          </button>
        </label>
        <Blend size={15} />
      </div>

      <div className="layer-control-row">
        <label>
          Opacity
          <input
            max="100"
            min="0"
            onChange={(event) => {
              if (selectedLayer) {
                setLayerOpacity(selectedLayer.id, Number(event.target.value) / 100);
              }
            }}
            type="number"
            value={Math.round(selectedOpacity * 100)}
          />
        </label>
        <span>%</span>
      </div>

      <div className="layer-list">
        {layers.map((layer) => (
          <article
            className={`layer-row ${selectedLayerId === layer.id ? "active" : ""} ${
              dragTargetLayerId === layer.id ? "drag-target" : ""
            }`}
            draggable
            onDragEnd={() => {
              setDraggedLayerId(null);
              setDragTargetLayerId(null);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setDragTargetLayerId(layer.id);
            }}
            onDragStart={() => setDraggedLayerId(layer.id)}
            onDrop={(event) => {
              event.preventDefault();

              if (draggedLayerId) {
                reorderLayer(draggedLayerId, layer.id);
              }

              setDraggedLayerId(null);
              setDragTargetLayerId(null);
            }}
            key={layer.id}
            onClick={() => selectLayer(layer.id)}
          >
            <GripVertical className="drag-handle" size={15} />
            <button
              aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
              className="visibility-button"
              onClick={(event) => {
                event.stopPropagation();
                toggleLayer(layer.id);
              }}
              type="button"
            >
              {layer.visible ? <Eye size={16} /> : <EyeOff size={16} />}
            </button>
            <div className="layer-thumbnail" />
            <div className="layer-meta">
              <strong>{layer.name}</strong>
              <span>{layer.kind}</span>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function UserPanel() {
  return (
    <footer className="user-panel">
      <div className="avatar">YO</div>
      <div>
        <strong>Yamac Ozkan</strong>
        <span>Workspace owner</span>
      </div>
      <button aria-label="Settings" type="button">
        <Settings size={15} />
      </button>
    </footer>
  );
}

function LayerInspector() {
  const { closeInspector, inspectorOpen, layers, project, selectedLayerId, terrain } =
    useEditorStore();
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);

  if (!inspectorOpen || !selectedLayer) {
    return null;
  }

  return (
    <aside className="inspector-drawer">
      <header>
        <strong>{selectedLayer.name}</strong>
        <button aria-label="Close inspector" onClick={closeInspector} type="button">
          <X size={16} />
        </button>
      </header>
      <dl className="info-list">
        <div>
          <dt>Layer type</dt>
          <dd>{selectedLayer.kind}</dd>
        </div>
        <div>
          <dt>Review status</dt>
          <dd>{selectedLayer.reviewStatus}</dd>
        </div>
        <div>
          <dt>Opacity</dt>
          <dd>{Math.round(selectedLayer.opacity * 100)}%</dd>
        </div>
        <div>
          <dt>CRS</dt>
          <dd>{project.coordinateReferenceSystem}</dd>
        </div>
        <div>
          <dt>Elevation source</dt>
          <dd>{terrain.elevationProvider}</dd>
        </div>
      </dl>
    </aside>
  );
}
