/*
 * ---metadata---
 * type: app-source
 * description: MCP handlers for Ollama-backed Landschaft LCA analysis.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: cap LCA prompt evidence for reliable Ollama Cloud calls
 * ---end-metadata---
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDeepSeekLcaPrompt,
  buildMapEvidence,
  capMapEvidenceForLca,
  createCodedLandscapeUnitLayerFromEvidence,
  createLcaLayerFromDraft,
  LCA_DEFAULT_OLLAMA_MODEL,
  LCA_SWANWICK_CONSTITUTION_RELATIVE_PATH,
  parseDeepSeekLcaDraftResponse,
  ProjectSnapshotSchema,
  type KnowledgeBankEntry,
  type MapReadRequest,
  type ProjectSnapshot
} from "@landschaft/shared";
import { listOllamaCloudModels, requestOllamaCloudLca } from "./ollamaLca.js";


export interface LcaAnalyzeRequest extends MapReadRequest {
  requestId?: string;
  purpose: string;
  analysisMode?: "desk-study" | "field-validation" | "classification";
  outputQuality?: "conceptual" | "professional" | "report-ready";
  model?: string;
  provider?: "ollama-cloud";
  dryRun?: boolean;
  knowledgeBankEntries?: KnowledgeBankEntry[];
}

export async function handleLcaListModels() {
  const models = await listOllamaCloudModels();
  return {
    status: "models-ready",
    provider: "ollama-cloud",
    models,
    featuredModelIds: ["deepseek-v4-flash", "deepseek-v4-pro"]
  };
}

export async function handleLcaAnalyze(
  request: LcaAnalyzeRequest,
  projectSnapshot?: unknown
) {
  const requestId = request.requestId ?? createLcaRequestId();
  const startedAt = performance.now();
  const log = (message: string, detail?: string) => {
    const elapsedMs = Math.round(performance.now() - startedAt);
    console.info(
      `[lca:${requestId}] +${elapsedMs}ms ${message}${detail ? ` ${detail}` : ""}`
    );
  };

  log("request received");
  const snapshot = parseProjectSnapshot(projectSnapshot);
  if (!snapshot) {
    throw new Error(
      "lca_analyze requires a valid projectSnapshot payload until the project database is available."
    );
  }
  log(
    "project snapshot validated",
    `${snapshot.layers.length} layers, ${snapshot.layers.reduce(
      (total, layer) => total + (layer.features?.length ?? 0),
      0
    )} features`
  );

  const model = request.model ?? LCA_DEFAULT_OLLAMA_MODEL;
  log("building full source evidence for coded units");
  const fullEvidence = buildMapEvidence(
    { project: snapshot.project, layers: snapshot.layers },
    {
      ...request,
      geometryDetail: "full"
    }
  );
  log("building map evidence");
  const evidence = capMapEvidenceForLca(
    fullEvidence,
    {
      maxFeaturesPerLayer: 4,
      maxTotalFeatures: 24,
      maxSpatialRelationships: 12
    }
  );
  log(
    "map evidence capped",
    `${evidence.features.length} features, ${evidence.featureGroups.length} groups, ${evidence.spatialRelationships.length} relationships`
  );
  log("loading LCA constitution");
  const constitution = loadLcaSwanwickConstitution();
  log("building DeepSeek prompt");
  const prompt = buildDeepSeekLcaPrompt({
    purpose: request.purpose,
    evidence,
    constitution,
    analysisMode: request.analysisMode,
    outputQuality: request.outputQuality,
    model,
    provider: "ollama-cloud",
    knowledgeBankEntries: request.knowledgeBankEntries
  });
  const promptSizeKb = Math.round(
    (prompt.system.length + prompt.constitution.length + prompt.user.length) / 1024
  );
  console.info(
    `[lca:${requestId}] Prompt ~${promptSizeKb}KB with ${evidence.features.length} capped features and ${evidence.featureGroups.length} groups for ${model}`
  );

  if (request.dryRun) {
    log("dry run complete");
    return {
      status: "prompt-ready",
      provider: "ollama-cloud",
      model,
      prompt,
      evidence
    };
  }

  log("sending request to Ollama Cloud", model);
  const rawResponse = await requestOllamaCloudLca(prompt, model, { requestId });
  log("Ollama Cloud response received");
  log("parsing LCA draft response");
  const analysis = parseDeepSeekLcaDraftResponse(rawResponse, {
    purpose: request.purpose,
    evidence,
    constitution,
    analysisMode: request.analysisMode,
    outputQuality: request.outputQuality,
    model,
    provider: "ollama-cloud",
    knowledgeBankEntries: request.knowledgeBankEntries
  });
  log("creating coded landscape unit layer", `${analysis.areas.length} LLM areas`);
  const layer = createCodedLandscapeUnitLayerFromEvidence(
    snapshot.project,
    fullEvidence,
    {
      ...analysis,
      model: `${analysis.model}@ollama`,
      knowledgeBankEntries: request.knowledgeBankEntries
    }
  ) ?? createLcaLayerFromDraft(snapshot.project, analysis.areas, {
    ...analysis,
    model: `${analysis.model}@ollama`
  });
  log("analysis complete", layer.id);

  return {
    status: "analysis-ready",
    provider: "ollama-cloud",
    model,
    analysis,
    layer,
    evidence
  };
}

function createLcaRequestId() {
  return `lca-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function parseProjectSnapshot(projectSnapshot?: unknown): ProjectSnapshot | null {
  if (!projectSnapshot) {
    return null;
  }

  let parsed: unknown;
  try {
    parsed =
      typeof projectSnapshot === "string"
        ? JSON.parse(projectSnapshot)
        : projectSnapshot;
  } catch {
    throw new Error("lca_analyze projectSnapshot must be valid JSON.");
  }

  const result = ProjectSnapshotSchema.safeParse(parsed);
  if (!result.success) {
    const issues = result.error.issues
      .slice(0, 6)
      .map((issue) => `${issue.path.join(".") || "projectSnapshot"}: ${issue.message}`)
      .join("; ");
    throw new Error(`lca_analyze projectSnapshot failed validation. ${issues}`);
  }

  return result.data;
}

function loadLcaSwanwickConstitution(): string {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const constitutionPath = resolve(repoRoot, LCA_SWANWICK_CONSTITUTION_RELATIVE_PATH);

  try {
    return readFileSync(constitutionPath, "utf8");
  } catch {
    throw new Error(
      `LCA constitution not found at ${constitutionPath}. Ensure Constitution/lca-swanwick.md exists in the Landschaft repository.`
    );
  }
}
