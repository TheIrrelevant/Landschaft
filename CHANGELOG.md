---
type: changelog
description: Release history for the Landschaft landscape planning editor.
last-updated: 2026-06-25
last-model: codex-gpt-5
last-change: added initial project changelog
---

# Changelog

## 0.1.0 - 2026-06-25

- Added the initial Landschaft monorepo workspace.
- Added the React and Three.js web editor scaffold.
- Added the MCP server scaffold with map read, draft write, and planning workflow tools.
- Added shared geospatial and planning type contracts.
- Added the product roadmap and project documentation.
- Split the web editor production bundle into stable vendor chunks to remove the Vite large chunk warning.
- Started checkpoint 1 with orthophoto upload, corner-coordinate metadata, generated heightmap terrain, and terrain accuracy status in the editor.
- Redesigned the checkpoint 1 editor UI into a compact GIS workspace layout.
- Reworked the editor UI to use the requested C1C1C1 minimal direction, upload-first coordinate prompts, Photoshop-style layers, and click-open inspector drawer.
