/*
 * ---metadata---
 * type: app-source
 * description: Main Landschaft editor shell.
 * last-updated: 2026-06-25
 * last-model: cursor-composer
 * last-change: collapsed inspector tab with vertical pill layout
 * ---end-metadata---
 */
import {
  ChevronsLeft,
  ChevronsRight,
  SlidersHorizontal,
  X
} from "lucide-react";
import { useState } from "react";
import { TerrainScene } from "../scene/TerrainScene";
import { useEditorStore } from "../state/editorStore";
import { LandschaftLogo } from "./LandschaftLogo";
import { LayersPanel } from "./LayersPanel";
import { TerrainSetupPanel } from "./TerrainSetupPanel";
import { UserPanel } from "./UserPanel";
import { ViewportOverlay } from "./ViewportOverlay";

export function App() {
  const { activeMode, inspectorOpen, selectedLayerId, selectLayer, setMode } =
    useEditorStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  return (
    <main className={`editor-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-content">
          <header className="brand">
            <LandschaftLogo size={22} />
            <strong>Landschaft</strong>
          </header>
          <TerrainSetupPanel />
          <LayersPanel />
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
          <div aria-label="View mode" className="view-toggle" role="group">
            <button
              aria-pressed={activeMode === "terrain-3d"}
              className={activeMode === "terrain-3d" ? "active" : ""}
              onClick={() => setMode("terrain-3d")}
              type="button"
            >
              3D View
            </button>
            <button
              aria-pressed={activeMode === "top-view"}
              className={activeMode === "top-view" ? "active" : ""}
              onClick={() => setMode("top-view")}
              type="button"
            >
              2D View
            </button>
          </div>
          <TerrainScene />
          <ViewportOverlay />
          {!inspectorOpen ? (
            <button
              aria-controls="layer-inspector"
              aria-expanded={false}
              aria-label="Open inspector"
              className="inspector-tab"
              onClick={() => {
                if (selectedLayerId) {
                  selectLayer(selectedLayerId);
                }
              }}
              type="button"
            >
              <span className="inspector-tab-icon" aria-hidden="true">
                <SlidersHorizontal size={14} strokeWidth={1.75} />
              </span>
              <span className="inspector-tab-label">Inspector</span>
            </button>
          ) : null}
        </div>
      </section>

      <LayerInspector />
    </main>
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
    <aside className="inspector-drawer" id="layer-inspector">
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
