/*
 * ---metadata---
 * type: app-source
 * description: Main Landschaft editor shell.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: disable inspector drawer side panel on selection
 * ---end-metadata---
 */
import { ChevronsLeft, ChevronsRight } from "lucide-react";
import { useEffect, useState } from "react";
import { TerrainScene } from "../scene/TerrainScene";
import { hydrateEditorPersistence, useEditorStore } from "../state/editorStore";
import { LandschaftLogo } from "./LandschaftLogo";
import { LcaAnalysisPanel } from "./LcaAnalysisPanel";
import { LayersPanel } from "./LayersPanel";
import { TerrainSetupPanel } from "./TerrainSetupPanel";
import { KnowledgeBaseOverlay } from "./KnowledgeBaseOverlay";
import { ToolDock } from "./ToolDock";
import { UserPanel } from "./UserPanel";
import { ViewportOverlay } from "./ViewportOverlay";

export function App() {
  const { activeMode, setMode } = useEditorStore();
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    void hydrateEditorPersistence();
  }, []);

  return (
    <main className={`editor-shell ${sidebarCollapsed ? "sidebar-collapsed" : ""}`}>
      <aside className="sidebar">
        <div className="sidebar-content">
          <header className="brand">
            <LandschaftLogo size={22} />
            <strong>Landschaft</strong>
          </header>
          <TerrainSetupPanel />
          <LcaAnalysisPanel />
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
          <ToolDock />
          <KnowledgeBaseOverlay />

        </div>
      </section>

    </main>
  );
}
