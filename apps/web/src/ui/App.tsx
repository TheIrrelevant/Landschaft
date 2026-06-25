/*
 * ---metadata---
 * type: app-source
 * description: Main Landschaft editor shell.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: removed top navigation and added Photoshop-style layer sidebar
 * ---end-metadata---
 */
import {
  Blend,
  ChevronDown,
  Eye,
  EyeOff,
  Image,
  Layers,
  Lock,
  Map,
  SlidersHorizontal,
  X
} from "lucide-react";
import { TerrainScene } from "../scene/TerrainScene";
import { useEditorStore } from "../state/editorStore";
import { TerrainSetupPanel } from "./TerrainSetupPanel";

export function App() {
  const { activeMode, setMode } = useEditorStore();

  return (
    <main className="editor-shell">
      <aside className="sidebar">
        <div className="brand">
          <Map size={20} />
          <div>
            <strong>Landschaft</strong>
            <span>Landscape editor</span>
          </div>
        </div>
        <TerrainSetupPanel />
        <LayerPanel />
      </aside>

      <section className="workspace">
        <div className="canvas-area">
          <div className="segmented-control">
            <button
              className={activeMode === "terrain-3d" ? "active" : ""}
              onClick={() => setMode("terrain-3d")}
              type="button"
            >
              3D Terrain
            </button>
            <button
              className={activeMode === "top-view" ? "active" : ""}
              onClick={() => setMode("top-view")}
              type="button"
            >
              Top View
            </button>
          </div>
          <TerrainScene />
        </div>
      </section>

      <LayerInspector />
    </main>
  );
}

function LayerPanel() {
  const {
    layers,
    selectedLayerId,
    selectLayer,
    setLayerOpacity,
    toggleLayer
  } = useEditorStore();

  return (
    <section className="layers-panel">
      <div className="panel-tabs">
        <button className="active" type="button">
          Layers
        </button>
        <button type="button">Channels</button>
        <button type="button">Paths</button>
      </div>

      <div className="layer-filter-row">
        <button type="button">
          <SlidersHorizontal size={14} />
          Kind
          <ChevronDown size={13} />
        </button>
        <Image size={15} />
        <Blend size={15} />
        <Layers size={15} />
      </div>

      <div className="layer-control-row">
        <button type="button">
          Normal
          <ChevronDown size={13} />
        </button>
        <label>
          Opacity
          <input
            max="100"
            min="0"
            readOnly
            type="number"
            value={100}
          />
        </label>
      </div>

      <div className="layer-lock-row">
        <span>Lock:</span>
        <Lock size={14} />
        <span>Fill:</span>
        <strong>100%</strong>
      </div>

      <div className="layer-list">
        {layers.map((layer) => (
          <article
            className={`layer-row ${selectedLayerId === layer.id ? "active" : ""}`}
            key={layer.id}
            onClick={() => selectLayer(layer.id)}
          >
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
            <input
              aria-label={`${layer.name} opacity`}
              className="layer-opacity"
              max="1"
              min="0"
              onChange={(event) =>
                setLayerOpacity(layer.id, Number(event.target.value))
              }
              step="0.01"
              type="range"
              value={layer.opacity}
            />
          </article>
        ))}
      </div>
    </section>
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
