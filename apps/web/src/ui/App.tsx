/*
 * ---metadata---
 * type: app-source
 * description: Main Landschaft editor shell.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: show LCA code anatomy and evidence citations in inspector
 * ---end-metadata---
 */
import {
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ChevronsLeft,
  ChevronsRight,
  Copy,
  SlidersHorizontal,
  Trash2,
  X
} from "lucide-react";
import { useState } from "react";
import { TerrainScene } from "../scene/TerrainScene";
import { useEditorStore } from "../state/editorStore";
import { LandschaftLogo } from "./LandschaftLogo";
import { LayersPanel } from "./LayersPanel";
import { TerrainSetupPanel } from "./TerrainSetupPanel";
import { ToolDock } from "./ToolDock";
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
          <ToolDock />
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
  const {
    closeInspector,
    deleteSelectedFeature,
    duplicateSelectedFeature,
    exportSelectedLayerGeoJson,
    inspectorOpen,
    layers,
    mergeSelectedFeatureWithNext,
    moveSelectedFeature,
    moveSelectedVertex,
    project,
    selectedFeatureId,
    selectedLayerId,
    selectedVertexIndex,
    selectFeature,
    selectFeatureVertex,
    setSnapEnabled,
    snapEnabled,
    setSelectedFeatureReviewStatus,
    setSelectedLayerReviewStatus,
    splitSelectedFeatureAtVertex,
    terrain
  } = useEditorStore();
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);
  const selectedFeature =
    selectedLayer?.features?.find((feature) => feature.id === selectedFeatureId) ??
    selectedLayer?.features?.[0];
  const moveStep = Math.max(
    1,
    Math.round(
      Math.min(
        project.realWorldExtentMeters.width,
        project.realWorldExtentMeters.depth
      ) * 0.025
    )
  );
  const lcaCodeAnatomy =
    selectedLayer?.kind === "lca" && selectedFeature
      ? parseLcaCodeAnatomy(selectedFeature.attributes.codeAnatomy)
      : [];
  const lcaEvidenceCitations =
    selectedLayer?.kind === "lca" && selectedFeature
      ? parseLcaEvidenceCitations(selectedFeature.attributes.evidenceCitations)
      : [];
  const visibleFeatureAttributes = selectedFeature
    ? Object.entries(selectedFeature.attributes).filter(
        ([key]) => !hiddenLcaAttributeKeys.has(key)
      )
    : [];

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
          <dd>
            {selectedLayer.source?.coordinateReferenceSystem ??
              project.coordinateReferenceSystem}
          </dd>
        </div>
        {selectedLayer.source ? (
          <>
            <div>
              <dt>Source</dt>
              <dd>{selectedLayer.source.sourceName}</dd>
            </div>
            <div>
              <dt>Accuracy</dt>
              <dd>
                {formatLabel(selectedLayer.source.accuracyStatus)} /{" "}
                {Math.round(selectedLayer.source.confidence * 100)}%
              </dd>
            </div>
          </>
        ) : (
          <div>
            <dt>Elevation source</dt>
            <dd>{terrain.elevationProvider}</dd>
          </div>
        )}
        {selectedLayer.rasterGeoreference ? (
          <div>
            <dt>Raster georeference</dt>
            <dd>
              {formatLabel(selectedLayer.rasterGeoreference.parsedFrom ?? "project-fit")}
            </dd>
          </div>
        ) : null}
      </dl>
      {selectedLayer.features?.length ? (
        <section className="inspector-section">
          <div className="feature-actions">
            <button
              className="feature-action"
              onClick={exportSelectedLayerGeoJson}
              type="button"
            >
              Export GeoJSON
            </button>
            <label className="feature-action">
              <input
                checked={snapEnabled}
                onChange={(event) => setSnapEnabled(event.target.checked)}
                type="checkbox"
              />
              Snap
            </label>
          </div>
        </section>
      ) : null}
      {selectedLayer.legend?.length ? (
        <section className="inspector-section">
          <h2>Legend</h2>
          <div className="legend-list">
            {selectedLayer.legend.map((item) => (
              <span className="legend-item" key={item.label}>
                <span
                  className="legend-swatch"
                  style={{ backgroundColor: item.color }}
                />
                {item.label}
              </span>
            ))}
          </div>
        </section>
      ) : null}
      {selectedLayer.features?.[0] ? (
        <section className="inspector-section">
          <h2>Features</h2>
          <div className="feature-list">
            {selectedLayer.features.map((feature) => (
              <button
                className={selectedFeature?.id === feature.id ? "active" : ""}
                key={feature.id}
                onClick={() => selectFeature(feature.id)}
                type="button"
              >
                <span>{feature.label}</span>
                <small>{feature.geometryType}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
      {selectedFeature ? (
        <section className="inspector-section">
          <h2>{selectedFeature.label}</h2>
          {selectedLayer.kind === "lca" ? (
            <div className="feature-actions">
              <button
                className="feature-action"
                onClick={() => setSelectedFeatureReviewStatus("approved")}
                type="button"
              >
                Approve area
              </button>
              <button
                className="feature-action"
                onClick={() => setSelectedFeatureReviewStatus("needs-review")}
                type="button"
              >
                Needs review
              </button>
              <button
                className="feature-action danger"
                onClick={() => setSelectedFeatureReviewStatus("rejected")}
                type="button"
              >
                Reject area
              </button>
              <button
                className="feature-action"
                onClick={() => setSelectedLayerReviewStatus("approved")}
                type="button"
              >
                Approve layer
              </button>
            </div>
          ) : null}
          <dl className="info-list compact">
            <div>
              <dt>Geometry</dt>
              <dd>{selectedFeature.geometryType}</dd>
            </div>
            <div>
              <dt>Vertices</dt>
              <dd>{selectedFeature.coordinates.length}</dd>
            </div>
            <div className="vertex-list">
              {selectedFeature.coordinates.map((coordinate, index) => (
                <button
                  className={
                    selectedVertexIndex === index ? "vertex-chip active" : "vertex-chip"
                  }
                  key={`${selectedFeature.id}-vertex-${index}`}
                  onClick={() =>
                    selectFeatureVertex(
                      selectedVertexIndex === index ? null : index
                    )
                  }
                  type="button"
                >
                  {index}: {Math.round(coordinate[0])} m, {Math.round(coordinate[1])} m
                </button>
              ))}
            </div>
            {visibleFeatureAttributes.map(([key, value]) => (
              <div key={key}>
                <dt>{formatLabel(key)}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
          {lcaCodeAnatomy.length ? (
            <section className="lca-evidence-section">
              <h3>Code Anatomy</h3>
              <div className="lca-anatomy-list">
                {lcaCodeAnatomy.map((segment) => (
                  <article
                    className="lca-anatomy-item"
                    key={`${selectedFeature.id}-code-${segment.position}-${segment.segment}`}
                  >
                    <strong>{segment.segment}</strong>
                    <span>{formatLabel(segment.theme)}</span>
                    <p>{segment.meaning}</p>
                    <small>
                      {segment.sourceLayerId} / {Math.round(segment.confidence * 100)}%
                    </small>
                  </article>
                ))}
              </div>
            </section>
          ) : null}
          {lcaEvidenceCitations.length ? (
            <section className="lca-evidence-section">
              <h3>Evidence Citations</h3>
              <ul className="lca-citation-list">
                {lcaEvidenceCitations.map((citation) => (
                  <li key={citation.id}>
                    <strong>{citation.label}</strong>
                    <span>{citation.sourceLayerId}</span>
                    <p>{citation.excerpt}</p>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
          {!selectedLayer.locked ? (
            <>
              {selectedVertexIndex !== null ? (
                <div className="feature-move-pad" aria-label="Move selected vertex">
                  <span className="move-step">Vertex {moveStep} m</span>
                  <button
                    aria-label="Move vertex up"
                    onClick={() => moveSelectedVertex(0, -moveStep)}
                    type="button"
                  >
                    <ArrowUp size={13} strokeWidth={1.75} />
                  </button>
                  <button
                    aria-label="Move vertex left"
                    onClick={() => moveSelectedVertex(-moveStep, 0)}
                    type="button"
                  >
                    <ArrowLeft size={13} strokeWidth={1.75} />
                  </button>
                  <button
                    aria-label="Move vertex right"
                    onClick={() => moveSelectedVertex(moveStep, 0)}
                    type="button"
                  >
                    <ArrowRight size={13} strokeWidth={1.75} />
                  </button>
                  <button
                    aria-label="Move vertex down"
                    onClick={() => moveSelectedVertex(0, moveStep)}
                    type="button"
                  >
                    <ArrowDown size={13} strokeWidth={1.75} />
                  </button>
                </div>
              ) : null}
              <div className="feature-move-pad" aria-label="Move selected feature">
                <span className="move-step">{moveStep} m</span>
                <button
                  aria-label="Move feature up"
                  onClick={() => moveSelectedFeature(0, -moveStep)}
                  type="button"
                >
                  <ArrowUp size={13} strokeWidth={1.75} />
                </button>
                <button
                  aria-label="Move feature left"
                  onClick={() => moveSelectedFeature(-moveStep, 0)}
                  type="button"
                >
                  <ArrowLeft size={13} strokeWidth={1.75} />
                </button>
                <button
                  aria-label="Move feature right"
                  onClick={() => moveSelectedFeature(moveStep, 0)}
                  type="button"
                >
                  <ArrowRight size={13} strokeWidth={1.75} />
                </button>
                <button
                  aria-label="Move feature down"
                  onClick={() => moveSelectedFeature(0, moveStep)}
                  type="button"
                >
                  <ArrowDown size={13} strokeWidth={1.75} />
                </button>
              </div>
              <div className="feature-actions">
                {selectedFeature.geometryType === "line" &&
                selectedVertexIndex !== null &&
                selectedVertexIndex > 0 &&
                selectedVertexIndex < selectedFeature.coordinates.length - 1 ? (
                  <button
                    className="feature-action"
                    onClick={() => splitSelectedFeatureAtVertex(selectedVertexIndex)}
                    type="button"
                  >
                    Split at vertex
                  </button>
                ) : null}
                <button
                  className="feature-action"
                  onClick={mergeSelectedFeatureWithNext}
                  type="button"
                >
                  Merge with next
                </button>
                <button
                  className="feature-action"
                  onClick={duplicateSelectedFeature}
                  type="button"
                >
                  <Copy size={13} strokeWidth={1.75} />
                  Duplicate
                </button>
                <button
                  className="feature-action danger"
                  onClick={deleteSelectedFeature}
                  type="button"
                >
                  <Trash2 size={13} strokeWidth={1.75} />
                  Delete
                </button>
              </div>
            </>
          ) : null}
          <p className="impact-note">{selectedFeature.planningImpact}</p>
        </section>
      ) : null}
      {selectedLayer.planningImpactNotes?.length ? (
        <section className="inspector-section">
          <h2>Planning Notes</h2>
          <ul className="impact-list">
            {selectedLayer.planningImpactNotes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </section>
      ) : null}
    </aside>
  );
}

function formatLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

interface InspectorCodeSegment {
  segment: string;
  position: number;
  theme: string;
  sourceLayerId: string;
  meaning: string;
  confidence: number;
}

interface InspectorEvidenceCitation {
  id: string;
  sourceLayerId: string;
  label: string;
  excerpt: string;
}

const hiddenLcaAttributeKeys = new Set([
  "codeAnatomy",
  "evidenceCitations"
]);

function parseLcaCodeAnatomy(value?: string): InspectorCodeSegment[] {
  const parsed = parseJsonArray(value);
  return parsed.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    return [
      {
        segment: getString(item.segment, "LCA"),
        position: getNumber(item.position, index + 1),
        theme: getString(item.theme, "landscape-character"),
        sourceLayerId: getString(item.sourceLayerId, "derived-lca"),
        meaning: getString(item.meaning, "Draft knowledge-bank segment."),
        confidence: getNumber(item.confidence, 0.5)
      }
    ];
  });
}

function parseLcaEvidenceCitations(value?: string): InspectorEvidenceCitation[] {
  const parsed = parseJsonArray(value);
  return parsed.flatMap((item, index) => {
    if (!isRecord(item)) {
      return [];
    }

    return [
      {
        id: getString(item.id, `citation-${index + 1}`),
        sourceLayerId: getString(item.sourceLayerId, "derived-lca"),
        label: getString(item.label, `Evidence ${index + 1}`),
        excerpt: getString(item.excerpt, "No evidence excerpt stored.")
      }
    ];
  });
}

function parseJsonArray(value?: string): unknown[] {
  if (!value) {
    return [];
  }

  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value : fallback;
}

function getNumber(value: unknown, fallback: number) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
