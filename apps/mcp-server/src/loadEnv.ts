/*
 * ---metadata---
 * type: app-source
 * description: Load local .env files for the Landschaft MCP server without committing secrets.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add minimal env file loader for Ollama API key
 * ---end-metadata---
 */
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

function applyEnvFile(filePath: string) {
  if (!existsSync(filePath)) {
    return;
  }

  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    const value = rawValue.replace(/^['"]|['"]$/g, "");

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

export function loadLocalEnvFiles() {
  const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
  const mcpRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

  applyEnvFile(resolve(repoRoot, ".env"));
  applyEnvFile(resolve(repoRoot, ".env.local"));
  applyEnvFile(resolve(mcpRoot, ".env"));
  applyEnvFile(resolve(mcpRoot, ".env.local"));
}
