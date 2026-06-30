---
type: bug-tracker
description: Known visual and functional bugs deferred for later fixes in Landschaft.
last-updated: 2026-06-30
last-model: amelia(composer)
last-change: close BUG-001 and BUG-002 after user verification
---

# Bug List

## Open

_None._

## Fixed

### BUG-001 — Upper layers do not mask lower layers (stack compositing)

- **Status:** Fixed (verified 2026-06-30)
- **Area:** `apps/web/src/scene/TerrainScene.tsx` — `LayeredSceneContent`, `DrapedRasterMesh`, overlay materials
- **Symptom:** Layers listed above in the panel still showed content from layers below; toggling visibility left grey ground holes.
- **Fix:** Panel-order stack compositing, draped raster texture cache, terrain hide only when overlay texture is ready, depth-test-free draped compositing, and working 0–100 per-layer opacity (`8d96fc0`).
- **Reported:** 2026-06-30

### BUG-002 — 3DEP DEM used to render as floating flat sheet above terrain

- **Status:** Fixed (verified 2026-06-30)
- **Area:** `apps/web/src/scene/TerrainScene.tsx` — provider DEM raster rendering
- **Symptom:** 3DEP DEM appeared as a semi-transparent tan plane hovering above the terrain mesh instead of following surface relief.
- **Fix:** DEM draped on terrain with elevation colormap; stack compositing and opacity fixes from BUG-001 resolved remaining overlap artifacts.
- **Reported:** 2026-06-30
