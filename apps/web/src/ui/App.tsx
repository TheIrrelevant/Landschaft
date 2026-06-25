/*
 * ---metadata---
 * type: app-source
 * description: Main Landschaft editor shell.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: redesigned editor shell for a compact GIS workflow
 * ---end-metadata---
 */
import { Layers, Map, MousePointer2, PanelRight, Route } from "lucide-react";
import { TerrainScene } from "../scene/TerrainScene";
import { useEditorStore } from "../state/editorStore";
import { TerrainSetupPanel } from "./TerrainSetupPanel";

export function App() {
  const { activeMode, project, setMode, terrain } = useEditorStore();

  return (
    <main className="editor-shell">
      <header className="app-bar">
        <div className="brand">
          <Map size={20} />
          <div>
            <strong>Landschaft</strong>
            <span>Vector-first landscape planning</span>
          </div>
        </div>
        <div className="project-strip">
          <span>{project.name}</span>
          <span>{project.coordinateReferenceSystem}</span>
          <span>{terrain.accuracyStatus}</span>
        </div>
        <button className="primary-action" type="button">
          <Route size={16} />
          Planning Workflow
        </button>
      </header>

      <aside className="sidebar">
        <TerrainSetupPanel />
        <LayerPanel />
      </aside>

      <section className="workspace">
        <header className="viewbar">
          <div className="view-title">
            <strong>Terrain Workspace</strong>
            <span>
              {project.realWorldExtentMeters.width}m x{" "}
              {project.realWorldExtentMeters.depth}m
            </span>
          </div>
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
            <div className="layer-header">
              <label>
                <input
                  checked={layer.visible}
                  onChange={() => toggleLayer(layer.id)}
                  type="checkbox"
                />
                <span>{layer.name}</span>
              </label>
              <small>{layer.kind}</small>
            </div>
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
  const { project, selectedArea, terrain } = useEditorStore();

  if (!selectedArea) {
    return (
      <section className="panel empty-state">
        <MousePointer2 size={20} />
        <p>Select a coded area to inspect planning intelligence.</p>
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
      <dl className="info-list">
        <div>
          <dt>Project CRS</dt>
          <dd>{project.coordinateReferenceSystem}</dd>
        </div>
        <div>
          <dt>Height Source</dt>
          <dd>{terrain.elevationProvider}</dd>
        </div>
        <div>
          <dt>Terrain Status</dt>
          <dd>{terrain.accuracyStatus}</dd>
        </div>
      </dl>
    </section>
  );
}
