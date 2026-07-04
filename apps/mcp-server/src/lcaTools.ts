/*
 * ---metadata---
 * type: app-source
 * description: MCP handlers for DeepSeek-backed Landschaft LCA analysis.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: pass explicit LCA analysis mode and output quality
 * ---end-metadata---
 */
import {
  buildDeepSeekLcaPrompt,
  buildMapEvidence,
  createLcaLayerFromDraft,
  parseDeepSeekLcaDraftResponse,
  ProjectSnapshotSchema,
  type MapReadRequest,
  type ProjectSnapshot
} from "@landschaft/shared";

export interface LcaAnalyzeRequest extends MapReadRequest {
  purpose: string;
  analysisMode?: "desk-study" | "field-validation" | "classification";
  outputQuality?: "conceptual" | "professional" | "report-ready";
  dryRun?: boolean;
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

  const evidence = buildMapEvidence(
    { project: snapshot.project, layers: snapshot.layers },
    request
  );
  const prompt = buildDeepSeekLcaPrompt({
    purpose: request.purpose,
    evidence,
    analysisMode: request.analysisMode,
    outputQuality: request.outputQuality
  });

  if (request.dryRun) {
    return {
      status: "prompt-ready",
      prompt,
      evidence
    };
  }

  const rawResponse = await requestDeepSeekLca(prompt);
  const analysis = parseDeepSeekLcaDraftResponse(rawResponse, {
    purpose: request.purpose,
    evidence,
    analysisMode: request.analysisMode,
    outputQuality: request.outputQuality
  });
  const layer = createLcaLayerFromDraft(snapshot.project, analysis.areas, analysis);

  return {
    status: "analysis-ready",
    analysis,
    layer,
    evidence
  };
}

async function requestDeepSeekLca(prompt: ReturnType<typeof buildDeepSeekLcaPrompt>) {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new Error(
      "DEEPSEEK_API_KEY is required for lca_analyze. Use dryRun to inspect the prompt without calling DeepSeek."
    );
  }

  const baseUrl = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
  const model = process.env.DEEPSEEK_MODEL ?? prompt.model;
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${apiKey}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: prompt.system },
        { role: "user", content: prompt.user }
      ],
      response_format: { type: prompt.responseFormat },
      temperature: prompt.temperature
    })
  });

  if (!response.ok) {
    throw new Error(`DeepSeek LCA request failed with HTTP ${response.status}.`);
  }

  return response.json() as Promise<unknown>;
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
