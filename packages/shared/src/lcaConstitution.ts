/*
 * ---metadata---
 * type: package-source
 * description: Helpers for loading and preparing Landschaft LCA constitution markdown for LLM prompts.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: add constitution frontmatter stripping for DeepSeek LCA prompts
 * ---end-metadata---
 */

/** Relative path from the Landschaft repository root to the active LCA constitution. */
export const LCA_SWANWICK_CONSTITUTION_RELATIVE_PATH =
  "Constitution/lca-swanwick.md";

const FRONTMATTER_PATTERN = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

export function stripMarkdownFrontmatter(markdown: string): string {
  return markdown.replace(FRONTMATTER_PATTERN, "").trim();
}

export function prepareLcaConstitutionForPrompt(markdown: string): string {
  return stripMarkdownFrontmatter(markdown).trim();
}
