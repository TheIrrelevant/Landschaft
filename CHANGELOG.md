---
type: changelog
description: Release history for the Landschaft landscape planning editor.
last-updated: 2026-07-01
last-model: codex-gpt-5
last-change: log clearer safe dataset import completion summary
---

# Changelog

## Unreleased

- Changed safe dataset completion status to report provider layers, vector features, and raster assets instead of only raster asset count.
- Replaced raw provider `fetch failed` messages with source-specific network failure guidance.
- Added layer-list feature counts for vector provider layers and FEMA zone notes so empty or boundary-only flood layers are easier to interpret.
- Draped NLCD land-cover rasters onto terrain with categorical land-cover colors and lifted polygon overlays so soil boundaries render above raster layers.
- Kept safe dataset imports running when TNMAccess product metadata times out, while still surfacing provider metadata status in the manifest.
- Added USDA soils, NLCD land cover, and FEMA flood hazard options to the safe dataset import flow.
- Paginated USGS National Map transportation import so local roads and trails are no longer capped at preview limits (Boulder AOI now imports the full road network).
- Increased MCP provider JSON and raster download timeouts and surfaced clearer timeout errors instead of generic aborted fetch messages.
- Strengthened Open-Meteo elevation retry/backoff during safe dataset terrain generation.
- Prefer USGS contour terrain during safe dataset import when the contours dataset is selected.
- Show safe dataset import failures once in the setup panel instead of duplicating the same error message.
- Closed BUG-001 and BUG-002 in `bug_list.md` after user verification.
- Made the safe dataset HTTP bridge URL configurable through `VITE_LANDSCHAFT_MCP_HTTP_URL`.
- Kept the MCP stdio server alive when the optional local HTTP bridge port is already in use.
- Georeferenced MCP-imported provider rasters from ImageServer export extents instead of blindly fitting them to the full project.
- Added MCP safe dataset search, manifest, and import tools backed by USGS TNMAccess, NAIP and 3DEP ImageServer clipped TIFF exports, and contour services.
- Persisted MCP-imported NAIP and 3DEP clipped TIFF exports into web-served provider assets.
- Connected the web safe-location import flow to the MCP HTTP bridge and render provider GeoTIFF raster layers in the scene.
- Replaced the sidebar orthophoto coordinate setup with USA safe-location search, provider dataset checkboxes, and a start-import flow.
- Added a basic Fethiye-Oludeniz KML/KMZ test fixture for deterministic vector import checks.
- Removed the invalid Fethiye-Oludeniz data pipeline experiment and downloaded geospatial dataset outputs.
- Moved vector import, raster import, vector drawing, and draft LCA actions out of the sidebar into a bottom-center canvas tool dock.
- Removed the sidebar LCA Analysis panel and its dedicated styles.
- Exposed layer deletion on every layer row instead of limiting deletion to removable foundational and LCA layers.
- Changed default terrain generation to the global Open-Meteo DEM source and fall back to it automatically when USGS contour coverage is unavailable.
- Normalized sea-connected low coastal DEM cells to sea level so Open-Meteo terrain does not raise water areas as terrain mass.
- Added GeoTIFF raster import support by converting `.tif` / `.tiff` files into canvas previews and reading their map bounds for layer placement.
- Started Checkpoint 3 with map evidence serialization, draft LCA analysis in the sidebar, editable `lca` vector layers, review controls, and shared MCP `map_read` / `map_write_draft` handlers.
- Completed Checkpoint 2 with project-extent clipping, georeferenced raster world-file import, vertex editing with split/merge/snap, GeoJSON export, and normalized project-metre geometry storage.
- Added layer deletion for removable foundational and LCA layers from the sidebar layer list.
- Added inspector operations for duplicating and deleting selected editable/imported vector features while respecting locked layers.
- Added hover inspection for vector map features with a viewport summary and pointer cursor feedback.
- Added direct canvas picking for vector map features so clicking imported or designer-created features selects the matching layer and feature in the inspector.
- Added KML vector import for placemark point, line, polygon, and multigeometry data, normalized into project metre coordinates through the shared vector layer flow.
- Added designer-created vector feature creation for point, line, and polygon features, persisted selected-feature state, and selectable feature attribute inspection in the inspector.
- Added real GeoJSON vector import, raster image overlay import, first-class project boundary layers, persisted raster overlay data, and terrain-regeneration preservation for imported foundational layers.
- Started Checkpoint 2 with foundational map layer metadata, sample vector/raster imports, layer category labels, legends, attribute inspection, and semi-transparent overlays aligned to the project terrain scene.
- Fixed the sidebar layer stack so generated mesh layers are inserted above existing orthophoto layers, top layers render visually on top, and orthophoto image data persists with its layer thumbnail.
- Removed debug terrain/contour summary cards from the orthophoto setup panel and kept the layers panel reachable in the sidebar scroll flow.
- Replaced independent contour-ring extrusion with continuous heightfield terrain rendering, keeping contour lines as overlays and smoothing USGS contour-derived heightmaps after ring constraints.
- Changed contour terrace stacking to use zero datum as the physical base and keep the lowest contour as the first raised layer.
- Remount 3D cameras and orbit controls when view scale or terrain camera target changes, and re-enabled 3D panning so camera controls do not lock after terrain regeneration.
- Optimized USGS contour terrain generation by replacing per-sample full segment sorting with bounded nearest-segment selection and reducing contour fallback grid density now that polygon terraces drive the mesh.
- Centered 3D camera framing and orbit controls on absolute-elevation terrain bounds so zoom/orbit remains usable after contour terrace extrusion.
- Excluded the base elevation contour from generated terrace polygons so the terrain base is not redrawn as a duplicate slab.
- Added contour terrace polygons to USGS terrain models and render them as direct polygon extrusions instead of relying only on raster heightfield interpolation.
- Render terrain elevations from their absolute source metre values instead of normalizing every terrain to a zero-based local minimum.
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
