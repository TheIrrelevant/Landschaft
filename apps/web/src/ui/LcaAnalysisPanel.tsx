/*
 * ---metadata---
 * type: app-source
 * description: Sidebar panel for running draft Landscape Character Assessment analysis.
 * last-updated: 2026-06-28
 * last-model: composer
 * last-change: add layer selection and draft LCA analysis trigger
 * ---end-metadata---
 */
import { ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useState } from "react";
import { useEditorStore } from "../state/editorStore";

export function LcaAnalysisPanel() {
  const {
    lcaAnalysisError,
    lcaAnalyzing,
    lcaPurpose,
    lcaSelectedLayerIds,
    layers,
    runLcaDraftAnalysis,
    setLcaPurpose,
    terrainGenerated,
    toggleLcaInputLayer
  } = useEditorStore();
  const [sectionOpen, setSectionOpen] = useState(true);
  const inputLayers = layers.filter(
    (layer) => layer.kind === "foundational-map" && layer.id !== "project-boundary"
  );

  return (
    <section className="lca-panel">
      <button
        aria-expanded={sectionOpen}
        className="section-title"
        onClick={() => setSectionOpen((open) => !open)}
        type="button"
      >
        <span className="section-title-leading">
          <Sparkles size={16} strokeWidth={1.75} />
          <span>LCA Analysis</span>
        </span>
        {sectionOpen ? (
          <ChevronUp size={15} strokeWidth={1.75} />
        ) : (
          <ChevronDown size={15} strokeWidth={1.75} />
        )}
      </button>

      {sectionOpen ? (
        <div className="lca-panel-body">
          <p className="panel-note">
            Build draft landscape character areas from selected map evidence. Output
            remains editable and requires review.
          </p>

          <label className="field-label" htmlFor="lca-purpose">
            Assessment purpose
          </label>
          <textarea
            className="lca-purpose-input"
            id="lca-purpose"
            onChange={(event) => setLcaPurpose(event.target.value)}
            placeholder="Baseline landscape character assessment for site planning."
            rows={3}
            value={lcaPurpose}
          />

          <div className="lca-layer-picker" aria-label="LCA input layers">
            <strong>Input layers</strong>
            {inputLayers.length === 0 ? (
              <p className="panel-note">Import foundational layers before running LCA.</p>
            ) : (
              inputLayers.map((layer) => (
                <label className="lca-layer-option" key={layer.id}>
                  <input
                    checked={lcaSelectedLayerIds.includes(layer.id)}
                    onChange={() => toggleLcaInputLayer(layer.id)}
                    type="checkbox"
                  />
                  <span>{layer.name}</span>
                </label>
              ))
            )}
          </div>

          <button
            className="primary-button"
            disabled={!terrainGenerated || lcaAnalyzing || inputLayers.length === 0}
            onClick={() => void runLcaDraftAnalysis()}
            type="button"
          >
            {lcaAnalyzing ? "Analyzing..." : "Run LCA Draft"}
          </button>

          {!terrainGenerated ? (
            <p className="panel-note">Generate terrain before running LCA analysis.</p>
          ) : null}
          {lcaAnalysisError ? <p className="panel-error">{lcaAnalysisError}</p> : null}
        </div>
      ) : null}
    </section>
  );
}
