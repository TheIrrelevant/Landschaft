/*
 * ---metadata---
 * type: app-source
 * description: Explicit LCA analysis mode panel for purpose, scope, provider, and model selection.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add Ollama provider and featured DeepSeek model picker
 * ---end-metadata---
 */
import { MoreHorizontal, Sparkles, X } from "lucide-react";
import { useMemo, useState } from "react";
import {
  LCA_FEATURED_OLLAMA_MODELS,
  LCA_LLM_PROVIDER_LABEL,
  LCA_OLLAMA_ANALYSIS_ENABLED,
  LCA_OLLAMA_ANALYSIS_PAUSED_MESSAGE
} from "@landschaft/shared";
import { useEditorStore } from "../state/editorStore";

export function LcaAnalysisPanel() {
  const {
    exitLcaAnalysisMode,
    lcaAnalyzing,
    lcaAnalysisError,
    lcaAnalysisMode,
    lcaAvailableModels,
    lcaModel,
    lcaModelsError,
    lcaModelsLoading,
    lcaOutputQuality,
    lcaPurpose,
    lcaRunLogs,
    lcaSelectedLayerIds,
    layers,
    runLcaDraftAnalysis,
    setLcaAnalysisMode,
    setLcaModel,
    setLcaOutputQuality,
    setLcaPurpose,
    terrainGenerated,
    toggleLcaInputLayer,
    workflowMode
  } = useEditorStore();

  const [showMoreModels, setShowMoreModels] = useState(false);

  const featuredModelIds = useMemo(
    () => new Set(LCA_FEATURED_OLLAMA_MODELS.map((entry) => entry.id)),
    []
  );

  const otherModels = useMemo(
    () => lcaAvailableModels.filter((modelId) => !featuredModelIds.has(modelId)),
    [featuredModelIds, lcaAvailableModels]
  );

  const usingFeaturedModel = featuredModelIds.has(lcaModel);

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

      {!LCA_OLLAMA_ANALYSIS_ENABLED ? (
        <p className="lca-analysis-message lca-analysis-warning">{LCA_OLLAMA_ANALYSIS_PAUSED_MESSAGE}</p>
      ) : null}

      <p className="lca-analysis-intro">
        Desk-study workflow for draft landscape character areas. Review all generated
        polygons before planning use.
      </p>

      <label className="lca-analysis-field">
        <span>LLM provider</span>
        <input readOnly type="text" value={LCA_LLM_PROVIDER_LABEL} />
      </label>

      <div className="lca-analysis-field">
        <span>Model</span>
        <div className="lca-model-picker">
          <div className="lca-model-primary">
            {LCA_FEATURED_OLLAMA_MODELS.map((entry) => (
              <button
                className={
                  lcaModel === entry.id
                    ? "lca-model-chip lca-model-chip-active"
                    : "lca-model-chip"
                }
                disabled={lcaAnalyzing}
                key={entry.id}
                onClick={() => {
                  setLcaModel(entry.id);
                  setShowMoreModels(false);
                }}
                type="button"
              >
                {entry.label}
              </button>
            ))}
            <button
              aria-expanded={showMoreModels}
              aria-label="Show more models"
              className={
                showMoreModels || !usingFeaturedModel
                  ? "lca-model-chip lca-model-chip-active"
                  : "lca-model-chip lca-model-chip-more"
              }
              disabled={lcaAnalyzing}
              onClick={() => setShowMoreModels((current) => !current)}
              type="button"
            >
              <MoreHorizontal size={14} />
            </button>
          </div>

          {showMoreModels || !usingFeaturedModel ? (
            <label className="lca-model-more">
              <span className="sr-only">More Ollama Cloud models</span>
              <select
                disabled={lcaAnalyzing || lcaModelsLoading || otherModels.length === 0}
                onChange={(event) => setLcaModel(event.target.value)}
                value={lcaModel}
              >
                {otherModels.length === 0 ? (
                  <option value={lcaModel}>{lcaModel}</option>
                ) : (
                  otherModels.map((modelId) => (
                    <option key={modelId} value={modelId}>
                      {modelId}
                    </option>
                  ))
                )}
              </select>
            </label>
          ) : null}
        </div>
        {lcaModelsLoading ? (
          <p className="lca-analysis-hint">Loading Ollama Cloud models...</p>
        ) : null}
        {lcaModelsError ? <p className="lca-analysis-message">{lcaModelsError}</p> : null}
      </div>

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

      {LCA_OLLAMA_ANALYSIS_ENABLED && lcaAnalyzing ? (
        <p className="lca-analysis-hint">Ollama Cloud analysis may take up to 3 minutes. Refresh the page to cancel a stuck request.</p>
      ) : null}

      {lcaRunLogs.length > 0 ? (
        <section className="lca-run-log" aria-label="LCA run log">
          <div className="lca-run-log-header">
            <span>Run log</span>
            <span>{lcaRunLogs.length} steps</span>
          </div>
          <ol>
            {lcaRunLogs.map((entry) => (
              <li className={`lca-run-log-row lca-run-log-${entry.level}`} key={entry.id}>
                <span className="lca-run-log-time">
                  +{(entry.elapsedMs / 1000).toFixed(1)}s
                </span>
                <span className="lca-run-log-message">
                  {entry.message}
                  {entry.detail ? (
                    <small>{entry.detail}</small>
                  ) : null}
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <button
        className="lca-analysis-run"
        disabled={!LCA_OLLAMA_ANALYSIS_ENABLED || !terrainGenerated || !inputLayers.length || lcaAnalyzing}
        onClick={() => {
          void runLcaDraftAnalysis();
        }}
        type="button"
      >
        {!LCA_OLLAMA_ANALYSIS_ENABLED
          ? "LCA analysis paused"
          : lcaAnalyzing
            ? `Calling Ollama Cloud (${lcaModel})...`
            : "Run draft LCA analysis"}
      </button>

      {lcaAnalysisError ? (
        <p
          className={
            lcaAnalysisError.includes("mock draft")
              ? "lca-analysis-message lca-analysis-warning"
              : "lca-analysis-message"
          }
        >
          {lcaAnalysisError}
        </p>
      ) : null}
    </section>
  );
}
