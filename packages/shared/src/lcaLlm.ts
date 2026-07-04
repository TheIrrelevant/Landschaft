/*
 * ---metadata---
 * type: package-source
 * description: LCA LLM provider and featured Ollama model presets for Landschaft.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: clarify Landschaft uses Ollama Cloud models only, not local Ollama
 * ---end-metadata---
 */

/** Landschaft LCA uses Ollama Cloud remote models only — not a local Ollama daemon. */
export const LCA_LLM_PROVIDER = "ollama-cloud" as const;

export type LcaLlmProvider = typeof LCA_LLM_PROVIDER;

export const LCA_LLM_PROVIDER_LABEL = "Ollama Cloud";

export interface LcaFeaturedModel {
  id: string;
  label: string;
}

export const LCA_FEATURED_OLLAMA_MODELS: readonly LcaFeaturedModel[] = [
  { id: "deepseek-v4-flash", label: "DeepSeek V4 Flash" },
  { id: "deepseek-v4-pro", label: "DeepSeek V4 Pro" }
] as const;

export const LCA_DEFAULT_OLLAMA_MODEL = "deepseek-v4-flash";

export const OLLAMA_CLOUD_BASE_URL = "https://ollama.com";

/** Set to true when Ollama Cloud LCA inference is ready for production use. */
export const LCA_OLLAMA_ANALYSIS_ENABLED = false;

export const LCA_OLLAMA_ANALYSIS_PAUSED_MESSAGE =
  "Ollama Cloud LCA analysis is temporarily paused. Configuration and constitution remain available; automated inference will return in a later release.";
