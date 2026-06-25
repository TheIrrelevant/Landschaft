/*
 * type: app-source
 * description: Main Landschaft editor shell.
 * last-updated: 2026-06-24
 * last-model: codex-gpt-5
 * last-change: added initial editor UI
 */
import { Layers, Map, MousePointer2, PanelRight, Route } from "lucide-react";
import { TerrainScene } from "../scene/TerrainScene";
import { useEditorStore } from "../state/editorStore";

export function App() {
  const { activeMode, setMode } = useEditorStore();

  return (
    <main className="editor-shell">
      <aside className="sidebar">
        <div className="brand">
          <Map size={22} />
          <div>
            <strong>Landschaft</strong>
            <span>Landscape planning editor</span>
          </div>
        </div>
        <LayerPanel />
      </aside>

      <section className="workspace">
        <header className="toolbar">
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
          <button className="primary-action" type="button">
            <Route size={16} />
            Planning Workflow
          </button>
        </header>

        <div className="canvas-area">
          <TerrainScene />
        </div>
      </section>

      <aside className="inspector">
        <AreaInspector />
      </aside>
    </main>
  );
}

function LayerPanel() {
  const { layers, setLayerOpacity, toggleLayer } = useEditorStore();

  return (
    <section className="panel">
      <h2>
        <Layers size={18} />
        Layers
      </h2>
      <div className="layer-list">
        {layers.map((layer) => (
          <article className="layer-row" key={layer.id}>
            <label>
              <input
                checked={layer.visible}
                onChange={() => toggleLayer(layer.id)}
                type="checkbox"
              />
              <span>{layer.name}</span>
            </label>
            <input
              aria-label={`${layer.name} opacity`}
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

function AreaInspector() {
  const { selectedArea } = useEditorStore();

  if (!selectedArea) {
    return (
      <section className="panel empty-state">
        <MousePointer2 size={20} />
        <p>Select a coded landscape area to inspect planning intelligence.</p>
      </section>
    );
  }

  return (
    <section className="panel">
      <h2>
        <PanelRight size={18} />
        Area Info
      </h2>
      <dl className="info-list">
        <div>
          <dt>ID</dt>
          <dd>{selectedArea.id}</dd>
        </div>
        <div>
          <dt>Label</dt>
          <dd>{selectedArea.label}</dd>
        </div>
        <div>
          <dt>Code</dt>
          <dd>{selectedArea.code}</dd>
        </div>
        <div>
          <dt>Meaning</dt>
          <dd>{selectedArea.meaning}</dd>
        </div>
        <div>
          <dt>Confidence</dt>
          <dd>{Math.round(selectedArea.confidence * 100)}%</dd>
        </div>
      </dl>
    </section>
  );
}
