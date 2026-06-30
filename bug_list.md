---
type: bug-tracker
description: Known visual and functional bugs deferred for later fixes in Landschaft.
last-updated: 2026-06-30
last-model: amelia(composer)
last-change: document layer toggle terrain hole fix
---

# Bug List

## Open

### BUG-001 — Upper layers do not mask lower layers (stack compositing)

- **Status:** Open (Adobe-style compositing applied — verify in browser)
- **Area:** `apps/web/src/scene/TerrainScene.tsx` — `LayeredSceneContent`, `DrapedRasterMesh`, overlay materials
- **Symptom:** Layers listed above in the panel still show content from layers below (terrain clay grain through NAIP, DEM through NAIP, etc.).
- **Root cause:** Overlay meshes used fixed per-dataset lift (`NAIP=0.04`, `DEM=0.055`) instead of panel stack order, and all overlays used `depthWrite={false}` so nothing occluded the depth buffer.
- **Fix direction (2026-06-30):** Photoshop Normal blend: composite bottom-to-top by panel index; 100% opaque full-coverage rasters suppress layers below; semi-transparent layers alpha-blend without double-sided depth bleed.
- **Layer toggle hole (2026-06-30):** `shouldHideTerrainSurface` hid terrain clay while suppressed rasters remounted and reloaded textures async, leaving a grey ground patch. Fix: always render terrain top; cache draped raster textures by URL.
- **Reported:** 2026-06-30

### BUG-002 — 3DEP DEM used to render as floating flat sheet above terrain

- **Status:** Open (partially addressed)
- **Area:** `apps/web/src/scene/TerrainScene.tsx` — provider DEM raster rendering
- **Symptom:** 3DEP DEM appeared as a semi-transparent tan plane hovering above the terrain mesh instead of following surface relief.
- **Fix applied:** Drape DEM raster on terrain with elevation colormap (2026-06-30).
- **Remaining risk:** Same material overlap artifacts as BUG-001 may still appear until terrain and draped raster share one surface path.
- **Reported:** 2026-06-30
