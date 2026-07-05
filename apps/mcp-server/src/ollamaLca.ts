/*
 * ---metadata---
 * type: app-source
 * description: Ollama Cloud remote LLM requests and cloud model listing for Landschaft LCA.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add timeout guard for Ollama Cloud model listing
 * ---end-metadata---
 */
import {
  LCA_DEFAULT_OLLAMA_MODEL,
  OLLAMA_CLOUD_BASE_URL,
  type DeepSeekLcaPrompt
} from "@landschaft/shared";

export interface OllamaModelTag {
  name: string;
}

export interface OllamaTagsResponse {
  models?: OllamaModelTag[];
}

function getOllamaCloudApiKey(): string {
  const apiKey = process.env.OLLAMA_API_KEY;
  if (!apiKey) {
    throw new Error(
      "OLLAMA_API_KEY is required for Ollama Cloud LCA analysis. Add it to a local .env file (never commit secrets)."
    );
  }

  return apiKey;
}

export async function listOllamaCloudModels(): Promise<string[]> {
  const timeoutMs = Number(process.env.OLLAMA_MODEL_LIST_TIMEOUT_MS ?? 15_000);
  const response = await fetch(`${OLLAMA_CLOUD_BASE_URL}/api/tags`, {
    headers: {
      authorization: `Bearer ${getOllamaCloudApiKey()}`
    },
    signal: AbortSignal.timeout(timeoutMs)
  });

  if (!response.ok) {
    throw new Error(`Ollama Cloud model listing failed with HTTP ${response.status}.`);
  }

  const payload = (await response.json()) as OllamaTagsResponse;
  const models = (payload.models ?? [])
    .map((entry) => entry.name)
    .filter((name) => name.length > 0)
    .sort((left, right) => left.localeCompare(right));

  if (models.length === 0) {
    throw new Error("Ollama Cloud returned no models for this API key.");
  }

  return models;
}

export async function requestOllamaCloudLca(
  prompt: DeepSeekLcaPrompt,
  model = LCA_DEFAULT_OLLAMA_MODEL,
  options: { requestId?: string } = {}
) {
  const timeoutMs = Number(process.env.OLLAMA_LCA_TIMEOUT_MS ?? 180_000);
  const logPrefix = options.requestId ? `[lca:${options.requestId}]` : "[lca]";
  console.info(`${logPrefix} Calling Ollama Cloud model: ${model} (timeout ${timeoutMs}ms)`);
  const response = await fetch(`${OLLAMA_CLOUD_BASE_URL}/api/chat`, {
    method: "POST",
    headers: {
      authorization: `Bearer ${getOllamaCloudApiKey()}`,
      "content-type": "application/json"
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content: `${prompt.system}\n\n# Landschaft LCA Constitution\n\n${prompt.constitution}`
        },
        { role: "user", content: prompt.user }
      ],
      stream: false,
      format: "json"
    }),
    signal: AbortSignal.timeout(timeoutMs)
  });
  console.info(`${logPrefix} Ollama Cloud returned HTTP ${response.status}`);

  if (!response.ok) {
    const errorText = await response.text().catch(() => "");
    throw new Error(
      `Ollama Cloud LCA request failed ${response.status}.${errorText ? ` ${errorText}` : ""}`
    );
  }

  const payload = (await response.json()) as unknown;
  console.info(`${logPrefix} Ollama Cloud JSON payload parsed`);
  return payload;
}

/** @deprecated Use listOllamaCloudModels */
export const listOllamaModels = listOllamaCloudModels;

/** @deprecated Use requestOllamaCloudLca */
export const requestOllamaLca = requestOllamaCloudLca;
