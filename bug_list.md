---
type: bug-tracker
description: Known visual and functional bugs deferred for later fixes in Landschaft.
last-updated: 2026-06-30
last-model: amelia(composer)
last-change: log 3DEP DEM floating sheet issue and draped render fix
---

# Bug List

## Open

### BUG-001 — NAIP orthophoto draped mesh overlaps terrain surface (material conflict)

- **Status:** Open (deferred)
- **Area:** `apps/web/src/scene/TerrainScene.tsx` — `DrapedRasterMesh` + `TerrainMesh`
- **Symptom:** When NAIP orthophoto is draped on the 3D terrain, the orthophoto texture plane and the terrain mesh top surface occupy nearly the same depth. This causes material conflict / z-fighting and visible grainy or flickering artifacts on slopes and flat areas.
- **Current behavior:** NAIP imagery loads and aligns well overall; the overlap artifact is cosmetic for now and not blocking import.
- **Likely fix direction:** Raise draped orthophoto slightly above the terrain surface, disable terrain top shading under orthophoto, or project NAIP directly onto the terrain mesh material instead of rendering a second draped mesh.
- **Reported:** 2026-06-30

### BUG-002 — 3DEP DEM used to render as floating flat sheet above terrain

- **Status:** Open (partially addressed)
- **Area:** `apps/web/src/scene/TerrainScene.tsx` — provider DEM raster rendering
- **Symptom:** 3DEP DEM appeared as a semi-transparent tan plane hovering above the terrain mesh instead of following surface relief.
- **Fix applied:** Drape DEM raster on terrain with elevation colormap (2026-06-30).
- **Remaining risk:** Same material overlap artifacts as BUG-001 may still appear until terrain and draped raster share one surface path.
- **Reported:** 2026-06-30
