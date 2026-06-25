---
type: readme
description: Technical entrypoint for the Landschaft web editor and MCP server.
last-updated: 2026-06-24
last-model: codex-gpt-5
last-change: added initial project setup documentation
---

# Landschaft

Landschaft is a vector-first landscape planning editor.

Agents and contributors must read [AGENTS.md](./AGENTS.md) before changing files.

The first technical stack is:

- Vite, React, and TypeScript for the web editor.
- Three.js through React Three Fiber for terrain rendering.
- Zustand for editor state.
- Turf, Proj4, and Zod for geospatial and validation foundations.
- Model Context Protocol server for map read, map write, and planning workflow control.

## Workspace

```text
apps/web
apps/mcp-server
packages/shared
```

## Commands

```bash
npm install
npm run dev
npm run dev:mcp
npm run typecheck
npm run build
```

## MCP Tools

The initial MCP server exposes:

- `map_read`: returns structured vector evidence for LLM analysis.
- `map_write_draft`: writes draft planning features back into the project model.
- `start_planning_workflow`: starts an area-focused planning workflow for a coded LCA area.

The current MCP implementation is a scaffold. It returns deterministic sample data until the project database and editor state API are added.
