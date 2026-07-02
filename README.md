---
type: readme
description: Technical entrypoint for the Landschaft web editor and MCP server.
last-updated: 2026-07-02
last-model: codex-gpt-5
last-change: document hosted MCP backend deployment
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

## GitHub Pages

The web editor is deployed as a GitHub project Pages site from `apps/web/dist`.
The deployment workflow builds the Vite app with `GITHUB_PAGES=true`, which sets
the asset base path to `/Landschaft/`.

Enable Pages in the GitHub repository settings with `GitHub Actions` as the
source. The workflow runs on pushes to `main` and can also be started manually
from the Actions tab.

Safe dataset imports require a hosted MCP HTTP bridge. Set the GitHub repository
variable `LANDSCHAFT_MCP_HTTP_URL` to the deployed backend origin before running
the Pages workflow:

```bash
gh variable set LANDSCHAFT_MCP_HTTP_URL --body https://your-backend.example.com
```

## Hosted MCP Backend

The MCP server can run as a public HTTP bridge for the Pages deployment.

Required production environment:

```bash
PORT=8787
LANDSCHAFT_MCP_HTTP_HOST=0.0.0.0
LANDSCHAFT_MCP_STDIO=false
LANDSCHAFT_MCP_CORS_ORIGIN=https://theirrelevant.github.io
LANDSCHAFT_PROVIDER_ASSET_ROOT=/tmp/landschaft-provider-assets
```

Optional production environment:

```bash
LANDSCHAFT_PROVIDER_ASSET_PUBLIC_URL=https://your-backend.example.com/provider-assets
```

The backend exposes:

- `GET /health`
- `GET /safe-dataset/search`
- `POST /safe-dataset/manifest`
- `POST /safe-dataset/import`
- `GET /provider-assets/...`

Build and start without Docker:

```bash
npm ci
npm run build
LANDSCHAFT_MCP_HTTP_HOST=0.0.0.0 LANDSCHAFT_MCP_STDIO=false npm run start:mcp
```

Build with Docker:

```bash
docker build -f apps/mcp-server/Dockerfile -t landschaft-mcp .
docker run --rm -p 8787:8787 \
  -e PORT=8787 \
  -e LANDSCHAFT_MCP_CORS_ORIGIN=https://theirrelevant.github.io \
  landschaft-mcp
```

The web editor calls the local MCP HTTP bridge at `http://127.0.0.1:8787` by default for safe dataset imports. Override it for alternate dev ports or remote bridge hosts:

```bash
VITE_LANDSCHAFT_MCP_HTTP_URL=http://127.0.0.1:8788 npm run dev
LANDSCHAFT_MCP_HTTP_PORT=8788 npm run dev:mcp
```

## MCP Tools

The initial MCP server exposes:

- `safe_dataset_search`: searches curated provider-backed safe locations.
- `safe_dataset_manifest`: fetches live provider manifests for selected datasets.
- `safe_dataset_import`: imports safe location terrain, provider layers, and optional raster assets.
- `map_read`: returns structured vector evidence for LLM analysis.
- `map_write_draft`: writes draft planning features back into the project model.
- `start_planning_workflow`: starts an area-focused planning workflow for a coded LCA area.

The MCP server also starts an optional local HTTP bridge for the web editor. If that port is already in use, stdio MCP tools continue to run and the bridge logs a warning instead of terminating the server.
