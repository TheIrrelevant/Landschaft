/*
 * type: config
 * description: ESLint flat configuration for the Landschaft workspace.
 * last-updated: 2026-06-24
 * last-model: codex-gpt-5
 * last-change: added workspace lint configuration
 */
import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    ignores: ["dist", "node_modules"]
  }
);
