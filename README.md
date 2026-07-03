---
name: landschaft
description: >
  Vector-first landscape planning editor for terrain generation, safe public
  dataset import, 2D and 3D site review, and structured landscape evidence
  workflows through a React, Three.js, geospatial, and MCP-based architecture.
license: Proprietary - All Rights Reserved
metadata:
  author: Kraftreich
  version: "0.1.0"
  stack: React 19, TypeScript 5.9, Vite 7, Three.js 0.184, Zustand, Turf, Proj4, MCP
  status: active-demo
  last-updated: 2026-07-03
compatibility: Requires Node.js 22+ and npm 10+. Hosted provider imports require a Landschaft MCP HTTP backend.
---

# Landschaft

**Vector-first landscape planning and terrain evidence workspace by Kraftreich.**

Landschaft turns georeferenced site data into a working planning canvas. It combines terrain generation, public dataset layers, raster overlays, vector evidence, and draft planning workflows inside a dense GIS-style editor designed for landscape architecture and site analysis.

> Select a safe location. Load terrain and public map evidence. Review the site in 2D and 3D.

---

## Live Demo

The public demo is published from the `demo` branch through GitHub Pages:

https://theirrelevant.github.io/Landschaft/

The demo runs without a hosted backend. It loads a bundled Boulder Flatirons static dataset from:

```text
apps/web/public/test-data/boulder-flatirons/import.json
```

The static demo includes every available safe dataset option from the Location Data panel:

| Dataset | Demo Content |
| --- | --- |
| **NAIP orthophoto** | Clipped provider GeoTIFF raster |
| **3DEP DEM** | Clipped provider GeoTIFF raster |
| **USGS contours** | Contour vector features and contour-derived terrain |
| **Hydrography** | Waterbody and flowline vector features |
| **Transportation** | Road, trail, and transportation line features |
| **USDA soils** | Soil map unit polygon features |
| **NLCD land cover** | Clipped provider GeoTIFF raster |
| **Structures** | Public facilities and civic point features |
| **Boundaries** | Administrative and public-land boundary polygons |
| **Woodland** | NLCD-derived forest and shrub/scrub mask |
| **Buildings** | OSM building footprint polygons where available |

Raster demo assets are served from:

```text
apps/web/public/provider-assets/boulder-flatirons-co/
```

---

## What Landschaft Builds

Landschaft is organized around three production surfaces:

| Surface | Output |
| --- | --- |
| **Terrain Workspace** | Project extent, generated terrain model, terrain mesh, orthographic 2D plan view, and 3D review mode |
| **Safe Dataset Import** | Provider-backed layers for raster, contour, hydrography, transportation, soil, land cover, structures, boundaries, OSM buildings, and NLCD-derived woodland evidence |
| **Planning Evidence Loop** | Structured map evidence, draft LCA layers, review status, and MCP read/write tools for controlled agent workflows |

The editor treats vector data as the planning source of truth. Raster layers provide visual context, while editable features, evidence records, review status, and project-metre coordinates remain structured and auditable.

---

## Core Workflow

### 1. Safe Location Setup

The first workflow starts from a curated safe location.

- Search supported test locations.
- Select provider datasets.
- Load a project extent, terrain, provider rasters, structures, boundaries, OSM building footprints, NLCD-derived woodland masks, and vector evidence.
- Preserve provider source metadata and accuracy notes on each layer.

The public Pages demo uses static Boulder Flatirons data. Development and hosted deployments can call the MCP HTTP bridge for live provider imports.

### 2. Terrain And View Modes

Landschaft generates and renders terrain as a first-class project layer.

- Stores terrain dimensions, heightmap, provider, accuracy status, and generated timestamp.
- Supports contour-derived terrain from USGS National Map contours.
- Provides a 3D terrain view and a locked orthographic top-view.
- Keeps project coordinates in real metre-based space.

### 3. Layer Review

The layer stack is the operational center of the editor.

- Toggle visibility and opacity for map layers.
- Inspect feature counts, source metadata, category, review status, and accuracy.
- Render raster layers, vector lines, polygons, contours, and terrain together.
- Delete removable layers while keeping locked provider layers protected.

### 4. Vector Tools And Evidence

The canvas tool dock supports direct map authoring and import.

- Import GeoJSON and KML vector layers.
- Import raster overlays and GeoTIFF previews.
- Create point, line, and polygon features.
- Export selected vector layers as GeoJSON.
- Serialize selected layers into structured map evidence.

### 5. Draft Planning Workflow

The initial planning workflow proves a controlled evidence loop.

- Read selected map layers as structured project evidence.
- Generate draft Landscape Character Assessment areas.
- Store draft features in an editable `lca` layer.
- Keep review status and confidence metadata visible for human validation.

---

## Static Demo Architecture

The demo branch avoids a hosted backend by baking the safe dataset import result into the Pages artifact.

| Piece | Role |
| --- | --- |
| `VITE_LANDSCHAFT_STATIC_SAFE_DATA_URL` | Points the web app at bundled static import JSON |
| `apps/web/public/test-data/` | Stores static import payloads |
| `apps/web/public/provider-assets/` | Stores static raster assets for the demo |
| `.github/workflows/deploy-pages.yml` | Builds and deploys the demo branch to GitHub Pages |

When `VITE_LANDSCHAFT_STATIC_SAFE_DATA_URL` is set, the web editor loads static data first and does not call the MCP HTTP backend.

---

## Hosted MCP Backend

Live provider-backed imports still require the Landschaft MCP HTTP backend. GitHub Pages cannot run the Node server; it can only serve the frontend and static assets.

The MCP backend exposes:

| Endpoint | Purpose |
| --- | --- |
| `GET /health` | Health check for hosted deployments |
| `GET /safe-dataset/search` | Search curated safe dataset locations |
| `POST /safe-dataset/manifest` | Fetch provider manifest metadata |
| `POST /safe-dataset/import` | Import provider-backed terrain, rasters, and vectors |
| `GET /provider-assets/...` | Serve persisted raster assets |

Production environment:

```bash
PORT=8787
LANDSCHAFT_MCP_HTTP_HOST=0.0.0.0
LANDSCHAFT_MCP_STDIO=false
LANDSCHAFT_MCP_CORS_ORIGIN=https://theirrelevant.github.io
LANDSCHAFT_PROVIDER_ASSET_ROOT=/tmp/landschaft-provider-assets
```

Optional asset URL override:

```bash
LANDSCHAFT_PROVIDER_ASSET_PUBLIC_URL=https://your-backend.example.com/provider-assets
```

The repository also includes a Dockerfile for hosted backend deployment:

```bash
docker build -f apps/mcp-server/Dockerfile -t landschaft-mcp .
docker run --rm -p 8787:8787 \
  -e PORT=8787 \
  -e LANDSCHAFT_MCP_CORS_ORIGIN=https://theirrelevant.github.io \
  landschaft-mcp
```

---

## Branch Model

| Branch | Purpose |
| --- | --- |
| `demo` | Public GitHub Pages demo with bundled Boulder Flatirons data |
| `developing` | Active development branch reset to the pre-Pages commit |
| `main` | Preserved remote history from the Pages/backend preparation line |

Current public work should continue from `developing` unless the target is the static demo.

---

## Engine Map

```text
apps/
|-- web/
|   |-- src/
|   |   |-- geo/                  # Import parsing, clipping, raster and vector geometry helpers
|   |   |-- scene/                # Three.js terrain and map rendering
|   |   |-- state/                # Zustand editor state and project persistence
|   |   |-- styles/               # Editor shell, panels, canvas, layers, inspector
|   |   `-- ui/                   # App shell, panels, tool dock, overlays
|   |-- public/
|   |   |-- test-data/            # Static safe dataset demo payloads
|   |   `-- provider-assets/      # Static raster assets for the demo branch
|   `-- vite.config.ts
|-- mcp-server/
|   |-- src/
|   |   |-- server.ts             # MCP tools and optional HTTP bridge
|   |   |-- safeDatasetTools.ts   # Provider search, manifest, import, asset persistence
|   |   `-- mapTools.ts           # Structured map read/write handlers
|   `-- Dockerfile
packages/
`-- shared/
    `-- src/
        |-- geometry.ts           # Shared geometry helpers
        |-- mapEvidence.ts        # Map evidence serialization
        |-- lca.ts                # Draft LCA generation contracts
        `-- index.ts              # Terrain, layer, project, and provider contracts
```

---

## Data Model

Landschaft stores project data as structured contracts:

| Model | Purpose |
| --- | --- |
| **Project metadata** | Project id, name, CRS, source name, corners, and real-world extent |
| **Terrain model** | Heightmap, grid size, dimensions, elevation source, accuracy, and diagnostics |
| **Planning layer** | Layer kind, category, visibility, opacity, source, style, legend, and review status |
| **Vector feature** | Point, line, or polygon coordinates with attributes and planning impact |
| **Raster georeference** | Project-space raster bounds, pixel size, and parse source |
| **Map evidence** | Machine-readable selected-layer summaries and spatial relationships |

The design principle is strict: coordinates, feature IDs, vector geometry, attributes, evidence links, and review status are authoritative. Raster images and generated prose are contextual until validated.

---

## Quick Start

```bash
npm install
npm run dev
```

Open the web editor at:

```text
http://localhost:5173/
```

For local live safe dataset imports, start the MCP server in a second terminal:

```bash
npm run dev:mcp
```

The local web app calls:

```text
http://127.0.0.1:8787
```

Use a different backend URL when needed:

```bash
VITE_LANDSCHAFT_MCP_HTTP_URL=http://127.0.0.1:8788 npm run dev
LANDSCHAFT_MCP_HTTP_PORT=8788 npm run dev:mcp
```

### Prerequisites

- Node.js 22+
- npm 10+
- Modern browser with WebGL/WebGPU-capable graphics stack

### Commands

| Command | Action |
| --- | --- |
| `npm run dev` | Start the web editor |
| `npm run dev:web` | Start only the web editor |
| `npm run dev:mcp` | Start the MCP stdio server and local HTTP bridge |
| `npm run start:mcp` | Start the built MCP server |
| `npm run typecheck` | Run TypeScript checks across workspaces |
| `npm run lint` | Run ESLint across workspaces |
| `npm run build` | Build shared contracts, MCP server, and web app |

---

## Tech Stack

| Layer | Technology |
| --- | --- |
| Web framework | React 19 |
| Language | TypeScript 5.9 |
| Bundler | Vite 7 |
| 3D rendering | Three.js 0.184, React Three Fiber, Drei |
| State | Zustand |
| Geospatial | Turf, Proj4, GeoTIFF |
| Backend bridge | Model Context Protocol SDK, Node HTTP server |
| Validation | Zod |
| Icons | Lucide React |

---

## Notes For Contributors

Read [AGENTS.md](./AGENTS.md) before editing code. The repository is split into strict package boundaries:

- `apps/web`: browser editor, UI, interaction state, and Three.js rendering.
- `apps/mcp-server`: MCP tools, provider imports, and HTTP bridge.
- `packages/shared`: shared contracts, schemas, geometry, terrain, evidence, and LCA logic.

Do not move MCP provider logic into the web app. Do not duplicate shared types across packages. Keep generated assets out of source unless they are intentionally part of the static demo branch.
