---
type: changelog
description: Release history for the Landschaft landscape planning editor.
last-updated: 2026-06-27
last-model: codex-gpt-5
last-change: logged Open-Meteo elevation provider integration
---

# Changelog

## Unreleased

- Integrated the Open-Meteo Elevation API as the first real external DEM source for terrain generation.
- Added validated project snapshot persistence for generated terrain metadata, terrain models, and layer state.
- Applied uploaded orthophoto previews as the terrain top-surface texture after terrain generation, with neutral felt fallback when no image is available.
- Connected the web terrain generation flow to the shared terrain generation contract so generated terrain now creates the base orthophoto and terrain layer stack.
- Added shared terrain generation contracts plus a deterministic sample external DEM provider for Checkpoint 1 backend work.
- Added an MCP `terrain_generate` tool that returns project metadata, a generated terrain model, and base orthophoto/terrain layers from corner coordinates.
- Locked the 2D canvas mode to a clean orthographic top view with rotation and pan disabled, while preserving the default 3D perspective/orbit mode.
- Reset the initial editor state to a clean empty canvas and empty layer stack so new projects no longer show demo terrain or demo layers.

## 0.2.0 - 2026-06-26

- Migrated the 3D viewer to WebGPU (`three/webgpu` `WebGPURenderer`) with ACES tone mapping; bumped `three` to 0.184.
- Replaced the flat terrain sheet with a solid carved block (top surface, side walls, base cap) plus a ground shadow catcher.
- Added true 3D isohypse (contour) lines extracted from the heightmap with marching squares so they sit on the surface.
- Adopted an AutoCAD-style coordinate space: data stays in real metres, a single uniform `displayScale` maps to scene units, scene origin is the terrain centre.
- Added a single neutral "sun" lighting model (one directional light + colourless grey sky fill) so the editor stays neutral and map layers own all colour.
- Gave the terrain two materials: a matte felt top surface and a neutral textured solid-terrain side that will recolour from data later.
- Added a fixed infinite ground reference plane with a metre-based crosshair grid.
- Added a top-right viewport overlay with live FPS and a Fit / 1:1 view-scale toggle; camera and zoom limits anchored to a fixed reference span.
- Split the editor shell into LandschaftLogo, LayersPanel, UserPanel, ViewportOverlay components and modular CSS.

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
- Applied the approved minimal UI direction with a blank default canvas, collapsible sidebar, reorderable layers, header-only opacity control, and saved UI concept references.
