/*
 * ---metadata---
 * type: app-source
 * description: Explicit LCA analysis mode panel for purpose, scope, and layer selection.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add explicit LCA analysis workflow panel
 * ---end-metadata---
 */
import { Sparkles, X } from "lucide-react";
import { useEditorStore } from "../state/editorStore";

export function LcaAnalysisPanel() {
  const {
    exitLcaAnalysisMode,
    lcaAnalyzing,
    lcaAnalysisError,
    lcaAnalysisMode,
    lcaOutputQuality,
    lcaPurpose,
    lcaSelectedLayerIds,
    layers,
    runLcaDraftAnalysis,
    setLcaAnalysisMode,
    setLcaOutputQuality,
    setLcaPurpose,
    terrainGenerated,
    toggleLcaInputLayer,
    workflowMode
  } = useEditorStore();

  if (workflowMode !== "lca-analysis") {
    return null;
  }

  const inputLayers = layers.filter(
    (layer) => layer.kind === "foundational-map" && layer.id !== "project-boundary"
  );

  return (
    <section className="lca-analysis-panel" aria-label="Landscape Character Assessment">
      <header className="lca-analysis-header">
        <div className="lca-analysis-title">
          <Sparkles size={16} strokeWidth={1.75} />
          <strong>LCA Analysis</strong>
        </div>
        <button
          aria-label="Exit LCA analysis mode"
          className="lca-analysis-close"
          onClick={() => exitLcaAnalysisMode()}
          type="button"
        >
          <X size={14} />
        </button>
      </header>

      <p className="lca-analysis-intro">
        Desk-study workflow for draft landscape character areas. Review all generated
        polygons before planning use.
      </p>

      <label className="lca-analysis-field">
        <span>Assessment purpose</span>
        <textarea
          onChange={(event) => setLcaPurpose(event.target.value)}
          rows={3}
          value={lcaPurpose}
        />
      </label>

      <label className="lca-analysis-field">
        <span>Analysis mode</span>
        <select
          onChange={(event) =>
            setLcaAnalysisMode(
              event.target.value as "desk-study" | "field-validation" | "classification"
            )
          }
          value={lcaAnalysisMode}
        >
          <option value="desk-study">Desk study</option>
          <option value="field-validation">Field validation</option>
          <option value="classification">Classification and mapping</option>
        </select>
      </label>

      <label className="lca-analysis-field">
        <span>Output quality</span>
        <select
          onChange={(event) =>
            setLcaOutputQuality(
              event.target.value as "conceptual" | "professional" | "report-ready"
            )
          }
          value={lcaOutputQuality}
        >
          <option value="conceptual">Conceptual</option>
          <option value="professional">Professional baseline</option>
          <option value="report-ready">Report-ready</option>
        </select>
      </label>

      <fieldset className="lca-analysis-field">
        <legend>Input layers</legend>
        {inputLayers.length ? (
          <ul className="lca-layer-list">
            {inputLayers.map((layer) => {
              const checked =
                lcaSelectedLayerIds.length > 0
                  ? lcaSelectedLayerIds.includes(layer.id)
                  : layer.visible;

              return (
                <li key={layer.id}>
                  <label className="lca-layer-option">
                    <input
                      checked={checked}
                      onChange={() => toggleLcaInputLayer(layer.id)}
                      type="checkbox"
                    />
                    <span>{layer.name}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="lca-analysis-hint">Import foundational map layers before running LCA.</p>
        )}
      </fieldset>

      <button
        className="lca-analysis-run"
        disabled={!terrainGenerated || !inputLayers.length || lcaAnalyzing}
        onClick={() => {
          void runLcaDraftAnalysis();
        }}
        type="button"
      >
        {lcaAnalyzing ? "Analyzing..." : "Run draft LCA analysis"}
      </button>

      {lcaAnalysisError ? <p className="lca-analysis-message">{lcaAnalysisError}</p> : null}
    </section>
  );
}
