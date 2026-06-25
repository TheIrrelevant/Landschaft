---
type: agent-instructions
description: Agent operating rules for the Landschaft repository.
last-updated: 2026-06-24
last-model: codex-gpt-5
last-change: renamed repository rules as AGENTS entrypoint
---

# Repository Rules For Agents

These rules are mandatory for every AI agent or human contributor working in this repository.

Read this file before editing code. Follow it while planning, editing, reviewing, and summarizing work.

## 1. Operating Protocol

Before changing files:

1. Read the relevant part of [roadmap.md](./roadmap.md).
2. Read the files you will modify.
3. Identify the package boundary you are working in.
4. Make the smallest coherent change.
5. Run the required validation commands.
6. Report changed files and validation results.

Do not start broad refactors unless the task explicitly asks for them.

## 2. Package Boundaries

Respect these ownership boundaries:

- `apps/web`: browser editor, UI, interaction state, Three.js scene rendering.
- `apps/mcp-server`: MCP tools, external agent control, tool schemas, tool execution.
- `packages/shared`: shared types, schemas, domain contracts, validation models.

Rules:

- Do not put MCP tool logic in `apps/web`.
- Do not put React UI code in `apps/mcp-server`.
- Do not duplicate shared types across packages.
- If more than one package needs a type or schema, move it to `packages/shared`.
- Keep package imports directional: apps may depend on shared; shared must not depend on apps.

## 3. Clean Code Requirements

Write code that another agent can safely modify later.

Required:

- Use descriptive names.
- Keep functions focused on one responsibility.
- Keep files short and navigable.
- Prefer explicit data flow.
- Use typed contracts for cross-module data.
- Validate external or LLM-produced input.

Forbidden:

- Dead code.
- Debug logs left behind.
- Unused files.
- Hidden global state.
- Large mixed-responsibility files.
- Copy-pasted domain logic.
- Clever abstractions that hide behavior.

## 4. Agent-Friendly File Size

Agents must be able to inspect files without losing context.

Targets:

- Prefer files under 250 lines.
- Split files before they exceed 400 lines unless there is a strong reason.
- Keep components, stores, schemas, and services in separate files when responsibilities diverge.
- Keep generated or bulky data out of source files.

If a file grows too large, split by responsibility before adding more behavior.

## 5. Folder Structure Rules

Keep the repository predictable.

Allowed top-level structure:

```text
apps/
packages/
roadmap.md
README.md
REPO_RULES.md
package.json
tsconfig.base.json
eslint.config.js
```

Do not add new top-level folders unless the folder has a clear long-term ownership purpose.

Generated output rules:

- Build output belongs in `dist`.
- Cache output must not become source.
- Temporary experiments must not be committed.
- Do not commit `.DS_Store`, logs, or TypeScript build info files.

## 6. Architecture Principles

The application is a vector-first landscape planning engine.

Source of truth:

- Coordinates.
- Feature IDs.
- Vector geometry.
- Attributes.
- Evidence links.
- Review status.

Not source of truth:

- Raster screenshots.
- Raw LLM prose.
- Temporary visual overlays.
- Unvalidated draft geometry.

Rules:

- Raster imagery is visual context.
- Editable planning data must be vector-based.
- LLM output must be treated as draft until validated.
- Map read and write operations must be explicit and auditable.
- Human review is required for planning judgement outputs.

## 7. LLM And MCP Tool Rules

When implementing LLM or MCP behavior:

- Keep read tools separate from write tools.
- Read tools must return structured, machine-readable evidence.
- Write tools must validate input before changing project state.
- LLM-generated geometry must be stored as draft.
- Every LLM result must keep evidence references.
- Every LLM result must keep confidence and review status.
- Never allow an LLM to directly mutate authoritative map data without a validation layer.

Minimum MCP tool quality:

- Tool name is explicit.
- Tool description states purpose.
- Input schema is strict.
- Output is predictable JSON or structured text.
- Errors are actionable.

## 8. UI Rules

The web editor is an operational tool.

Required:

- Dense, clear, non-decorative UI.
- Stable layout.
- Layer visibility and opacity controls.
- Inspector panels for selected features.
- Top-view and 3D terrain modes.
- No hidden critical controls.

Avoid:

- Marketing-page UI patterns inside the editor.
- Decorative visuals that compete with map reading.
- Ambiguous icon-only controls without labels or tooltips.
- Layouts that clip panels or hide map controls.

## 9. Validation Commands

Run these before claiming work is complete:

```bash
npm run typecheck
npm run lint
```

Also run this when package boundaries, builds, Vite, Three.js, MCP server, or shared types change:

```bash
npm run build
```

For MCP changes, at minimum verify startup:

```bash
npm run dev:mcp
```

For UI changes, run the web editor:

```bash
npm run dev
```

Then smoke-test `http://localhost:5173/`.

## 10. Completion Report

Every agent response after code changes must include:

- Files changed.
- Validation commands run.
- Any validation failures or warnings.
- Any known limitations.

Do not say tests or validation passed unless the commands actually ran and passed.
