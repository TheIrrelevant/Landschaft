/*
 * ---metadata---
 * type: app-source
 * description: MCP handlers for Ollama-backed Landschaft LCA analysis.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: switch LCA inference to Ollama Cloud with selectable models
 * ---end-metadata---
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
  buildDeepSeekLcaPrompt,
  buildMapEvidence,
  capMapEvidenceForLca,
  createLcaLayerFromDraft,
  LCA_DEFAULT_OLLAMA_MODEL,
  LCA_SWANWICK_CONSTITUTION_RELATIVE_PATH,
  parseDeepSeekLcaDraftResponse,
  ProjectSnapshotSchema,
  type MapReadRequest,
  type ProjectSnapshot
} from "@landschaft/shared";
import { listOllamaCloudModels, requestOllamaCloudLca } from "./ollamaLca.js";


export interface LcaAnalyzeRequest extends MapReadRequest {
  purpose: string;
  analysisMode?: "desk-study" | "field-validation" | "classification";
  outputQuality?: "conceptual" | "professional" | "report-ready";
  model?: string;
  provider?: "ollama-cloud";
  dryRun?: boolean;
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
  const snapshot = parseProjectSnapshot(projectSnapshot);
  if (!snapshot) {
    throw new Error(
      "lca_analyze requires a valid projectSnapshot payload until the project database is available."
    );
  }

  const model = request.model ?? LCA_DEFAULT_OLLAMA_MODEL;
  const evidence = capMapEvidenceForLca(
    buildMapEvidence(
      { project: snapshot.project, layers: snapshot.layers },
      {
        ...request,
        geometryDetail: request.geometryDetail ?? "summary"
      }
    )
  );
  const constitution = loadLcaSwanwickConstitution();
  const prompt = buildDeepSeekLcaPrompt({
    purpose: request.purpose,
    evidence,
    constitution,
    analysisMode: request.analysisMode,
    outputQuality: request.outputQuality,
    model,
    provider: "ollama-cloud"
  });
  const promptSizeKb = Math.round(
    (prompt.system.length + prompt.constitution.length + prompt.user.length) / 1024
  );
  console.info(
    `[lca] Prompt ~${promptSizeKb}KB with ${evidence.features.length} capped features for ${model}`
  );

  if (request.dryRun) {
    return {
      status: "prompt-ready",
      provider: "ollama-cloud",
      model,
      prompt,
      evidence
    };
  }

  const rawResponse = await requestOllamaCloudLca(prompt, model);
  const analysis = parseDeepSeekLcaDraftResponse(rawResponse, {
    purpose: request.purpose,
    evidence,
    constitution,
    analysisMode: request.analysisMode,
    outputQuality: request.outputQuality,
    model,
    provider: "ollama-cloud"
  });
  const layer = createLcaLayerFromDraft(snapshot.project, analysis.areas, {
    ...analysis,
    model: `${analysis.model}@ollama`
  });

  return {
    status: "analysis-ready",
    provider: "ollama-cloud",
    model,
    analysis,
    layer,
    evidence
  };
}

function parseProjectSnapshot(projectSnapshot?: unknown): ProjectSnapshot | null {
  if (!projectSnapshot) {
    return null;
  }

  const parsed =
    typeof projectSnapshot === "string"
      ? JSON.parse(projectSnapshot)
      : projectSnapshot;
  const result = ProjectSnapshotSchema.safeParse(parsed);
  return result.success ? result.data : null;
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
