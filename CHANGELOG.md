---
type: changelog
description: Release history for the Landschaft landscape planning editor.
last-updated: 2026-06-27
last-model: codex-gpt-5
last-change: logged elevation-level contour diagnostics
---

# Changelog

## Unreleased

- Added elevation-level contour diagnostics that show ring and open-path counts per contour elevation.
- Made the sidebar content scrollable so expanded orthophoto diagnostics and layer controls remain reachable on shorter viewports.
- Added visible USGS contour diagnostics after terrain generation, including feature/path counts, open versus closed paths, ring count, segment count, and elevation attributes.
- Lift grid cells inside closed USGS contour rings to at least the ring elevation so higher contour interiors become raised terrain plates instead of staying on lower bands.
- Interpolate USGS contour terrain from full contour line segments and increase contour-source grid density so terraced breaks follow izohypse paths more closely.
- Added contour interval metadata from USGS contour features and render contour-sourced terrain as terraced layer-cake topography instead of a smooth DEM surface.
- Rebuilt terrain top geometry as an indexed shared-vertex surface, increased contour-source generation quality, and smoothed USGS contour-derived heightmaps so izohypse terrain no longer shades as disconnected grid patches.
- Stopped draping orthophoto imagery onto generated terrain meshes; orthophotos now stay as separate 2D reference layers while the 3D terrain renders with a neutral topo material.
- Reset the browser project snapshot key after the orthophoto-first workflow change so stale terrain canvases no longer reload into the editor.
- Reworked the terrain workflow so orthophoto upload creates a visible 2D base-map layer, mesh generation hides that flat layer and renders a separate neutral 3D mesh, layer visibility controls the scene, and USGS contour lines can be used as the preferred terrain source when available.
- Replaced low-resolution grid-surface rendering with a denser interpolated terrain surface so external DEM samples no longer read as blocky square height cells.
- Scaled 3D camera controls to the generated terrain footprint so 1:1 mode can zoom out to the full map, and added display-only vertical relief emphasis for subtle DEM terrain.
- Reduced default Open-Meteo terrain generation to fast-preview sampling and added retry/throttle handling for temporary elevation API rate limits.
- Aligned the Vite chunk warning limit with the known Three.js WebGPU vendor runtime so production builds complete without chunk-size warnings.
- Completed Checkpoint 1 MVP: orthophoto upload, corner-coordinate terrain generation, external DEM sampling, textured terrain rendering, 2D/3D views, persisted project metadata, and explicit accuracy/source display.
- Integrated the Open-Meteo Elevation API as the first real external DEM source for terrain generation.
- Added validated project snapshot persistence for generated terrain metadata, terrain models, and layer state.
- Applied uploaded orthophoto previews to the flat reference base-map layer, with neutral felt fallback when no image is available.
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
