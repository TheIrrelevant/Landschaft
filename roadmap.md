---
type: roadmap
description: Product roadmap for the Landschaft web-based landscape planning editor.
last-updated: 2026-07-04
last-model: codex-gpt-5
last-change: add LCA code anatomy and citation inspection
---

# Landschaft Roadmap

## 1. Orthophoto Import And Terrain Generation

### Goal

Build the first core workflow for turning a georeferenced orthophoto into a usable terrain base for a web-based landscape planning editor.

The editor must support professional survey data when available, but it must also provide a fallback workflow when the user only has an orthophoto with known coordinates.

### Product Concept

The user starts a project by importing an orthophoto, orthomosaic, or aerial survey image. This image becomes the visual ground reference for the landscape plan.

If the uploaded data includes elevation information prepared by a surveyor or mapping engineer, the application uses that source as the authoritative terrain model. If no elevation source is available, the application uses the orthophoto's geographic coordinates to query external elevation data providers and generate an approximate terrain model.

The result is a 3D terrain scene where the orthophoto is mapped as the surface texture and elevation data drives the terrain mesh.

### Supported Input Priority

#### Priority 1: Professional Survey Package

This is the most accurate workflow and should be treated as the preferred import path.

Expected inputs may include:

- Orthophoto or orthomosaic.
- DEM: Digital Elevation Model.
- DTM: Digital Terrain Model.
- DSM: Digital Surface Model.
- LAS or LAZ point cloud.
- GeoTIFF raster data.
- DXF, SHP, KML, or KMZ vector boundaries.
- World files such as TFW, JGW, or PGW.
- Known coordinate reference system metadata.

Behavior:

- Read georeferencing metadata when available.
- Use supplied DEM, DTM, DSM, or point cloud data as the elevation authority.
- Avoid external elevation APIs unless user explicitly requests comparison or gap filling.
- Preserve real-world scale.
- Preserve coordinate alignment between raster, vector, and elevation layers.

#### Priority 2: Orthophoto With Known Corner Coordinates

This is the practical fallback workflow for users who have a prepared map sheet but no explicit terrain file.

Expected inputs:

- Orthophoto image.
- Four corner coordinates of the rectangular map sheet.
- Optional coordinate reference system.
- Optional real-world scale metadata.

Behavior:

- Georeference the image from the four corner coordinates.
- Generate a sampling grid across the map extent.
- Convert each grid point to geographic coordinates.
- Query elevation from configured external providers.
- Build a heightmap from sampled elevation values.
- Generate a Three.js terrain mesh from the heightmap.
- Apply the orthophoto as the terrain texture.
- Label the output as approximate terrain unless validated survey data is provided.

Potential elevation providers:

- Mapbox Terrain-DEM or Terrain-RGB.
- Google Maps Elevation API.
- Cesium World Terrain.
- Open DEM datasets.
- Custom organization-hosted terrain services.

#### Priority 3: Image Only

This is the least reliable workflow and should be positioned as concept-only.

Expected inputs:

- Orthophoto or aerial image without coordinates.

Behavior:

- Allow manual scale calibration.
- Allow manual boundary placement.
- Open the project as a flat 2D planning surface by default.
- Optionally provide an approximate concept terrain mode.
- Clearly communicate that the result is not suitable for precise grading, construction, or engineering decisions.

### Import Wizard

The first version should include a guided import flow.

Steps:

1. Upload orthophoto.
2. Detect file type and metadata.
3. Detect whether the image is georeferenced.
4. Ask for corner coordinates if no georeferencing exists.
5. Ask for optional elevation data files.
6. Ask for optional vector boundary files.
7. Select terrain generation quality.
8. Generate preview.
9. Confirm and create project.

Terrain generation quality options:

- Fast preview: low grid density for quick validation.
- Balanced: medium grid density for normal editing.
- Detailed: high grid density for presentation and closer inspection.

### Technical Architecture

#### Geospatial Import Layer

Responsibilities:

- Parse GeoTIFF metadata.
- Parse world files.
- Parse four-corner coordinate input.
- Handle coordinate reference systems.
- Transform image space to world space.
- Transform world space to local Three.js scene coordinates.
- Split large rasters into tiles when needed.
- Preserve source metadata for later export.

Key technical concerns:

- CRS conversion must be explicit.
- Large orthophotos cannot be treated as single browser textures.
- Import must support progressive preview for large files.
- All generated assets should keep a link back to the source coordinate system.

#### Terrain Generation Layer

Responsibilities:

- Use supplied DEM, DTM, DSM, or point cloud data when available.
- Sample external elevation sources when no elevation file is provided.
- Normalize elevation values into local scene units.
- Generate heightmaps.
- Generate terrain mesh tiles.
- Apply orthophoto textures.
- Cache elevation samples and generated terrain artifacts.

Key technical concerns:

- Terrain should be tiled for large sites.
- Mesh density must be adjustable.
- Elevation source and resolution must be stored in project metadata.
- Terrain accuracy status must be visible to the user.
- External API cost and quota must be controlled through backend caching.

#### Three.js Scene Layer

Responsibilities:

- Render terrain mesh.
- Render orthophoto texture.
- Support orbit, pan, zoom, and top-down plan views.
- Support future editor overlays such as paths, planting zones, irrigation, lighting, and measurements.
- Keep real-world scale consistent with design tools.

Key technical concerns:

- Use texture tiling for large orthophotos.
- Use level-of-detail or chunked terrain for performance.
- Use instancing later for repeated landscape objects such as trees, shrubs, lights, and furniture.
- Keep 2D plan editing and 3D preview aligned to the same project coordinate model.

### Accuracy Model

Every generated terrain should carry an accuracy status.

Statuses:

- Survey-grade: terrain comes from user-provided survey or mapping engineer data.
- External DEM: terrain comes from external elevation sources.
- Conceptual: terrain is inferred or manually approximated.
- Flat: no elevation data is available.

The UI should not present approximate terrain as construction-grade data.

### MVP Scope

The first implementation target should prove the core terrain workflow.

MVP features:

- Create empty project.
- Upload orthophoto.
- Enter four corner coordinates.
- Query elevation from one external provider.
- Generate heightmap.
- Generate Three.js terrain mesh.
- Apply orthophoto texture.
- Show terrain in 3D.
- Show top-down plan view.
- Store project metadata.
- Display terrain accuracy status.

Out of scope for the first checkpoint:

- Full LAS or LAZ processing.
- Advanced CRS management UI.
- Multi-provider elevation comparison.
- Engineering-grade grading calculations.
- Plant library.
- Irrigation design.
- Construction documentation export.

### Open Decisions

- Primary external elevation provider for MVP.
- Supported coordinate reference systems for the first release.
- Maximum orthophoto size for browser-side processing.
- Whether terrain generation runs fully in browser, backend, or hybrid.
- Project file format and storage model.
- Whether the editor should start in 2D plan mode or 3D terrain mode.

### Checkpoint 1 Acceptance Criteria

- A user can describe or provide an orthophoto with known coordinates.
- The system can determine the real-world map extent.
- The system can create or request a height source.
- The system can generate a textured terrain mesh.
- The system can distinguish survey-grade terrain from approximate terrain.
- The generated terrain becomes the base layer for future landscape planning tools.

### Checkpoint 1 Completion Status

Status: Complete for the MVP terrain workflow.

Implemented decisions:

- Primary MVP elevation provider: Open-Meteo Elevation API using Copernicus DEM GLO-90.
- First-release CRS: EPSG:4326 corner coordinates transformed into local metre-based scene space.
- First browser processing model: upload preview plus generated project snapshot persisted in local browser storage.
- First terrain generation model: client/MCP shared terrain generation contract with provider-backed async elevation sampling.
- First startup mode: clean empty project until an orthophoto and corner coordinates generate the base terrain.

Completion notes:

- Orthophoto upload, four-corner coordinate entry, real-world extent calculation, external DEM sampling, heightmap generation, textured Three.js terrain, 3D view, locked top-view, project metadata persistence, and terrain accuracy/source display are implemented.
- Generated projects create the `Orthophoto Base` and `Terrain Mesh` layers as the base layer stack for Checkpoint 2.
- Accuracy is explicitly represented as `survey-grade`, `external-dem`, `conceptual`, or `flat`; the current MVP external provider is labelled approximate and must not be treated as construction-grade survey data.

## 2. Foundational Map And Environmental Data Layers

### Goal

Build the second core workflow for collecting, organizing, and visualizing the essential map layers that inform landscape planning decisions.

The editor should not only display an orthophoto and terrain. It must also understand the site's geological, hydrological, ecological, climatic, infrastructural, and settlement context. These layers should be imported, queried, classified, and shown as separate overlays so the designer can make decisions with site intelligence instead of only visual reference.

### Product Concept

After the terrain base is created, the project enters a data collection phase. The application gathers available spatial information for the project boundary and organizes it as independent map layers.

Each layer must have:

- Source metadata.
- Date or version when available.
- Coordinate reference system.
- Accuracy or confidence status.
- Geometry type.
- Visibility controls.
- Styling rules.
- Legend.
- Queryable attributes.
- Impact notes for landscape planning.

The goal is to create a structured site intelligence stack from underground conditions to above-ground systems.

### Layer Ordering Model

The application should organize data from below ground to above ground.

Suggested ordering:

1. Tectonic and seismic context.
2. Geological structure.
3. Soil and subsurface conditions.
4. Geomorphology and landform.
5. Hydrology and water systems.
6. Climate and meteorology.
7. Ecology and vegetation.
8. Land use and settlement.
9. Infrastructure and utilities.
10. Legal, administrative, and planning constraints.
11. Risk, protection, and suitability overlays.

This order helps the user understand cause and dependency. For example, geology affects soil, soil affects vegetation, geomorphology affects drainage, hydrology affects planting and erosion, and settlement affects access, utilities, and legal constraints.

### Core Data Layer Groups

#### 2.1 Fault And Seismic Maps

Purpose:

- Identify active fault lines.
- Understand seismic risk.
- Inform structural, grading, retaining wall, and safety decisions.

Possible data:

- Active fault lines.
- Earthquake hazard zones.
- Seismic acceleration zones.
- Liquefaction risk.
- Landslide-triggering seismic risk.

Planning impact:

- Avoid critical structures in high-risk corridors.
- Identify areas requiring engineering review.
- Flag retaining walls, heavy structures, water bodies, and terraces that need seismic consideration.

#### 2.2 Geological Maps

Purpose:

- Understand bedrock, lithology, geological formations, and material behavior.

Possible data:

- Rock type.
- Formation boundaries.
- Bedrock depth.
- Fracture zones.
- Karstic formations.
- Fill areas.
- Geological age and unit descriptions.

Planning impact:

- Assess excavation difficulty.
- Understand drainage and infiltration behavior.
- Identify unstable or unsuitable ground.
- Support decisions for foundations, retaining systems, and major earthworks.

#### 2.3 Soil Maps

Purpose:

- Understand planting suitability, drainage, erosion potential, and soil management needs.

Possible data:

- Soil type.
- Soil depth.
- Texture.
- Organic matter.
- pH.
- Salinity.
- Drainage class.
- Permeability.
- Erosion sensitivity.
- Agricultural capability class.

Planning impact:

- Select suitable plant species.
- Determine soil improvement needs.
- Identify areas suitable for lawns, meadows, orchards, or native planting.
- Detect poor-drainage areas before design.
- Support erosion control and slope stabilization decisions.

#### 2.4 Geomorphological Maps

Purpose:

- Understand landforms, slope behavior, erosion patterns, and natural terrain processes.

Possible data:

- Slope classes.
- Aspect.
- Ridge lines.
- Valley lines.
- Drainage paths.
- Terraces.
- Alluvial fans.
- Erosion channels.
- Landslide-prone forms.

Planning impact:

- Place circulation according to natural landform.
- Avoid unstable slopes.
- Use natural drainage paths instead of fighting them.
- Identify areas suitable for viewpoints, terraces, water retention, and planting zones.

#### 2.5 Hydrology And Water Resource Maps

Purpose:

- Understand surface water, groundwater, drainage, flood risk, and water availability.

Possible data:

- Streams.
- Seasonal water channels.
- Springs.
- Wells.
- Ponds.
- Wetlands.
- Watershed boundaries.
- Flow accumulation.
- Flood zones.
- Groundwater depth.
- Drainage infrastructure.

Planning impact:

- Protect natural water systems.
- Design swales, retention ponds, rain gardens, and drainage corridors.
- Avoid construction in flood-prone zones.
- Support irrigation planning.
- Identify water-sensitive planting areas.

#### 2.6 Meteorology And Climate Maps

Purpose:

- Understand climate conditions that affect planting, comfort, water demand, and outdoor use.

Possible data:

- Temperature ranges.
- Precipitation.
- Wind direction and intensity.
- Sun exposure.
- Frost risk.
- Drought risk.
- Humidity.
- Evapotranspiration.
- Microclimate zones.

Planning impact:

- Select climate-appropriate plant species.
- Locate shade, windbreaks, seating, and outdoor rooms.
- Estimate irrigation demand.
- Identify exposed, shaded, dry, humid, or frost-prone areas.

#### 2.7 Vegetation And Habitat Maps

Purpose:

- Understand existing plant cover, ecological value, habitat structure, and conservation priorities.

Possible data:

- Existing tree canopy.
- Native vegetation zones.
- Forest boundaries.
- Shrubland.
- Grassland.
- Agricultural vegetation.
- Protected habitats.
- Invasive species.
- Biodiversity corridors.

Planning impact:

- Preserve valuable vegetation.
- Identify restoration zones.
- Place new planting according to existing ecology.
- Avoid damaging sensitive habitats.
- Build planting strategy around native and adaptive species.

#### 2.8 Land Use And Settlement Maps

Purpose:

- Understand human use, buildings, roads, parcel context, and surrounding development.

Possible data:

- Buildings.
- Roads.
- Parcels.
- Land use classes.
- Urban settlement boundaries.
- Agricultural areas.
- Industrial areas.
- Public spaces.
- Access points.
- Existing walls, fences, and hardscape.

Planning impact:

- Understand access and circulation.
- Identify privacy, noise, and visual exposure issues.
- Coordinate design with surrounding settlement.
- Support zoning and user-flow decisions.

#### 2.9 Infrastructure And Utility Maps

Purpose:

- Understand technical networks that constrain excavation, planting, irrigation, lighting, and construction.

Possible data:

- Electricity lines.
- Water supply lines.
- Wastewater lines.
- Stormwater lines.
- Gas lines.
- Telecommunication lines.
- Irrigation lines.
- Manholes.
- Poles.
- Existing lighting.

Planning impact:

- Avoid unsafe digging and tree placement.
- Coordinate irrigation, lighting, and drainage.
- Prevent conflicts between planting roots and utility corridors.
- Identify service connection opportunities.

#### 2.10 Legal, Administrative, And Planning Maps

Purpose:

- Understand regulatory limits and protected conditions.

Possible data:

- Parcel boundaries.
- Zoning plans.
- Conservation areas.
- Protected natural sites.
- Archaeological protection zones.
- Coastal, forest, watershed, and agricultural protection boundaries.
- Building setback lines.
- Easements.
- Ownership boundaries.

Planning impact:

- Prevent design decisions that conflict with regulation.
- Mark restricted zones.
- Support permit-ready documentation later.
- Separate conceptual design areas from legally buildable areas.

#### 2.11 Risk And Suitability Maps

Purpose:

- Combine multiple source layers into design decision overlays.

Possible derived layers:

- Build suitability.
- Planting suitability.
- Erosion risk.
- Flood risk.
- Fire risk.
- Landslide risk.
- Irrigation demand.
- Shade need.
- Conservation priority.
- Access suitability.

Planning impact:

- Turn raw maps into actionable planning guidance.
- Help designers compare zones.
- Support early design strategy before detailed object placement.

### Data Source Strategy

The application should support multiple source types instead of depending on one provider.

Source categories:

- User-uploaded professional files.
- Public government open data.
- Municipal GIS data.
- National mapping agency data.
- Geological and seismic institutions.
- Meteorological services.
- Satellite and remote sensing sources.
- External map APIs.
- Manually created project layers.

Supported formats should eventually include:

- GeoJSON.
- Shapefile.
- KML and KMZ.
- DXF.
- GeoTIFF.
- CSV with coordinates.
- Raster tiles.
- Vector tiles.
- WMS.
- WMTS.
- WFS.
- LAS and LAZ for advanced workflows.

### Layer Import Workflow

The second checkpoint should introduce a layer import and catalog flow.

Steps:

1. Define project boundary from the orthophoto or parcel.
2. Search available data sources by project location.
3. Let the user upload professional map files.
4. Clip or filter layers to the project boundary.
5. Normalize all layers into the project coordinate model.
6. Store layer metadata.
7. Generate default styling and legends.
8. Display layers in a map stack.
9. Allow each layer to be toggled, reordered, inspected, and exported later.

### Layered Map Viewer

Imported maps must be shown as a visible, controllable layer stack on top of the project base map.

The base map can be:

- Orthophoto.
- Generated terrain texture.
- Flat plan canvas.
- External map tile background.
- Project boundary view.

Layer viewer requirements:

- Show every imported map as a separate layer.
- Group layers by category from underground to above-ground systems.
- Let the user turn each layer on or off.
- Let the user reorder layers.
- Let the user change opacity.
- Let the user lock layers to prevent accidental edits.
- Let the user isolate one layer for focused review.
- Let the user compare two layers side by side or by swipe comparison.
- Show a legend for each visible layer.
- Show source, date, and accuracy status for each layer.
- Support click or tap inspection for feature attributes.
- Support hover inspection on desktop.
- Support search and filter inside the layer list.

Default layer stack:

1. Project boundary.
2. Orthophoto base.
3. Terrain and slope visualization.
4. Underground and geological layers.
5. Soil layers.
6. Hydrology layers.
7. Climate and exposure layers.
8. Vegetation and habitat layers.
9. Settlement and land use layers.
10. Infrastructure and utility layers.
11. Legal and planning constraints.
12. Risk and suitability overlays.
13. Designer-created landscape layers.

Visual behavior:

- Raster layers should render as image overlays or tiled rasters.
- Vector layers should render as editable or inspectable geometries.
- Point layers should use scalable symbols.
- Line layers should use styled strokes.
- Polygon layers should use transparent fills and clear boundaries.
- High-priority risk layers should have stronger visual contrast.
- Technical utility layers should remain readable over orthophotos.

2D and 3D behavior:

- The primary review mode should be a 2D map view for precision.
- Selected layers can be projected onto the 3D terrain for spatial understanding.
- Raster overlays can be draped onto the terrain surface.
- Vector layers can be drawn slightly above the terrain to avoid z-fighting.
- Underground layers should be available as 2D overlays first, with future support for depth-aware 3D visualization.

Interaction model:

- Clicking a feature opens an attribute panel.
- Selecting a layer opens its metadata and styling controls.
- Turning on many layers should not make the map unreadable; the UI should encourage isolation, opacity control, and category filtering.
- The application should remember each project's layer visibility state.

Layer blending model:

- The map viewer should support Photoshop-like and ArcGIS-like layer stacking.
- Every visual layer should have an opacity value from 0% to 100%.
- Multiple maps should be visible at the same time through transparent blending.
- Users should be able to lower the opacity of technical maps and still see the orthophoto or terrain underneath.
- Users should be able to stack geological, soil, hydrology, vegetation, settlement, infrastructure, and risk maps over the same terrain.
- Blend order should follow the visible layer stack.
- Important alert layers can optionally use stronger blend modes or highlighted outlines.
- The first version should support normal alpha blending.
- Advanced blend modes can be added later if needed.

Terrain overlay modes:

- In 3D terrain mode, selected raster and vector maps should be projected onto the terrain surface.
- Raster maps should be draped over the terrain with adjustable opacity.
- Vector lines and polygons should render slightly above terrain to stay readable.
- Multiple semi-transparent maps should be visible over the 3D terrain at the same time.
- The user should be able to rotate the 3D terrain while keeping overlays aligned.
- The user should be able to temporarily flatten the vertical exaggeration to read technical maps more clearly.
- The user should be able to switch terrain overlays on and off without losing layer settings.

Top-view analysis mode:

- The editor should provide a top-view mode for reading maps like a GIS or drawing application.
- Top-view should support both 2D flat map review and orthographic camera review over the 3D terrain.
- Users should be able to view one map at a time for clean analysis.
- Users should be able to view many maps together with opacity controls.
- Users should be able to compare the same project area across different map categories.
- Top-view should preserve scale and north orientation unless the user explicitly rotates the view.
- Top-view should be the preferred mode for precise tracing, measurement, and layer inspection.

Vector-first coordinate model:

- The system should treat all planning information as coordinate-based vector data.
- Raster maps can be used as visual references, but editable project data should be vector features.
- Imported vector maps should preserve their source coordinates and attributes.
- Generated analysis features should be stored as vector geometries whenever possible.
- Designer-created drawings should be stored as editable vector geometries.
- The 3D terrain should be aligned to the same coordinate model as the vector data.
- Every drawn point, line, polygon, path, planting area, structure, utility, and annotation should have real project coordinates.
- The editor should behave like a GIS/CAD hybrid, not like a simple image drawing tool.

Coordinate data behavior:

- The project must define a project coordinate reference system.
- All imported layers must be transformed into the project coordinate system.
- All user drawings must store coordinates in the project coordinate system.
- The local Three.js scene coordinate system should be derived from the project coordinate system.
- Coordinate transforms must be reversible enough to support export.
- The same feature should appear in the correct place in 2D top-view and 3D terrain view.
- Snapping, measurement, selection, and editing must operate on vector geometry, not screen pixels.

Editable vector feature model:

- Points should represent trees, poles, wells, fixtures, valves, lights, and markers.
- Lines should represent paths, walls, fences, utilities, contours, water channels, and edges.
- Polygons should represent planting beds, lawn areas, hardscape areas, soil zones, habitat zones, risk zones, and parcels.
- Multi-part geometries should be supported for complex GIS imports.
- Features should support attributes such as name, category, source, material, species, area, length, elevation, status, and notes.
- Features should support styling separate from geometry.
- Features should support edit history later.

Drawing and editing requirements:

- Draw point.
- Draw polyline.
- Draw polygon.
- Edit vertices.
- Move feature.
- Split feature.
- Merge features.
- Delete feature.
- Duplicate feature.
- Snap to vertex.
- Snap to edge.
- Snap to grid or measured interval.
- Trace over raster or vector references.
- Measure length, area, slope, and elevation difference.

Terrain-vector relationship:

- The terrain mesh is a visual and analytical surface derived from elevation data.
- Vector features remain the authoritative editable planning data.
- Vector features can be projected onto terrain for 3D visualization.
- A vector feature should be able to sample terrain elevation at its vertices.
- A path or polygon should be able to report slope and elevation range based on the terrain.
- Future grading tools should edit terrain through controlled vector operations such as contours, breaklines, pads, and drainage lines.

Export implications:

- Because data is vector-first, the project can later export to GIS and CAD formats.
- Target exports should include GeoJSON, DXF, SHP, KML, and project-native JSON.
- Exported features should preserve coordinates, attributes, and layer categories.
- Raster screenshots should be treated as presentation outputs, not as source-of-truth project data.

Performance requirements:

- Large raster maps should be tiled.
- Large vector datasets should support simplification and viewport-based rendering.
- Layer visibility changes should feel immediate.
- Attribute inspection should not require loading the full dataset into the main render loop.

### Layer Intelligence Model

Every layer should be more than a visual overlay.

Each imported layer should support:

- Feature selection.
- Attribute inspection.
- Legend display.
- Source citation.
- Confidence status.
- Planning impact notes.
- Conflict detection with future design objects.

Example:

- A proposed tree inside an underground utility corridor should produce a warning.
- A seating area inside a flood-risk zone should produce a warning.
- A planting zone on shallow rocky soil should suggest soil improvement or species filtering.
- A path on a steep slope should suggest switchback or grading review.

### MVP Scope

The first implementation of this checkpoint should focus on creating the data layer foundation.

MVP features:

- Project boundary model.
- Layer manager panel.
- Import GeoJSON.
- Import KML.
- Import raster overlay.
- Store layer metadata.
- Toggle layer visibility.
- Reorder layers.
- Change layer opacity.
- Inspect feature attributes.
- Display basic legends.
- Clip layers visually to project extent.
- Define layer category from the below-ground to above-ground ordering model.
- Display imported layers over the orthophoto base map.
- Support at least one raster overlay and one vector overlay in the map viewer.
- Display multiple semi-transparent layers at the same time.
- Project selected layers onto the 3D terrain.
- Provide a top-view mode for reading individual maps and combined map stacks.
- Store imported vector layers as coordinate-based geometries.
- Store user-created drawings as editable vector features.
- Keep vector features aligned between top-view and 3D terrain view.

Out of scope for the first version:

- Automatic discovery from every public data source.
- Advanced hydrological simulation.
- Full regulatory validation.
- Automated plant species recommendation.
- Engineering-grade geotechnical analysis.
- Real-time WMS, WMTS, or WFS integration.
- Full LAS or LAZ point cloud processing.

### Open Decisions

- Which national and local data providers are required for the first target market.
- Whether the first release focuses on Turkey-specific public datasets or provider-agnostic imports.
- How much source citation is required in exported reports.
- Which layer formats must be supported before planting tools begin.
- Whether derived suitability overlays are generated automatically or manually.
- Whether the data layer stack should be shown in 2D only or also projected onto the 3D terrain.

### Checkpoint 2 Acceptance Criteria

- The project can store multiple geospatial data layers.
- Layers are categorized from underground systems to above-ground systems.
- Users can import at least one vector layer and one raster layer.
- Users can toggle, reorder, change opacity, and inspect layers.
- Users can view imported maps as stacked overlays above the orthophoto or base map.
- Users can blend multiple maps over each other with adjustable opacity.
- Users can view selected maps over the 3D terrain.
- Users can switch to top-view to inspect maps separately or combined.
- Imported and drawn features are stored as coordinate-based vector data.
- Users can create and edit vector points, lines, and polygons.
- Vector features remain aligned with the 3D terrain and orthophoto.
- Each layer stores source, accuracy, date, and category metadata.
- The data stack becomes the decision foundation for future landscape editing tools.

### Checkpoint 2 Progress Status

Status: Complete for the MVP foundational layer workflow.

Implemented so far:

- Shared layer contracts now include foundational layer category, source metadata, accuracy status, geometry type, style, legend, vector features, planning impact notes, and lock state.
- The web editor can import GeoJSON vector files and image raster overlays from the layer panel.
- The web editor can import KML placemark point, line, polygon, and multigeometry files from the same vector import flow.
- Uploaded GeoJSON point, line, polygon, and multipolygon features are normalized into project metre coordinates from the EPSG:4326 project extent.
- Uploaded KML coordinates are normalized into the same project metre coordinate model.
- Uploaded raster overlays are stored with layer data and rendered as semi-transparent map overlays.
- The project boundary is now a first-class locked foundational layer derived from orthophoto corner extent.
- Designer-created point, line, and polygon features can be added to a coordinate-based vector drawing layer.
- Selected vector feature state is persisted and the inspector can switch between features to show geometry, vertex count, attributes, and planning impact.
- Vector features rendered in the scene can be clicked directly to select the matching layer and feature in the inspector.
- Vector feature hover state displays a temporary viewport summary with feature name and geometry type.
- Selected vector features can be duplicated or deleted from the inspector, with locked layers protected from edits.
- Selected vector features can be moved from the inspector with metre-based project-coordinate offsets.
- Imported foundational layers persist in the project snapshot with visibility, order, opacity, metadata, legend, and attributes.
- Imported foundational layers are preserved when the terrain mesh is regenerated.
- The layer panel shows foundational categories and raster/vector geometry type labels.
- The inspector shows source, CRS, accuracy/confidence, legend entries, feature attributes, and planning impact notes.
- The Three.js scene renders semi-transparent raster overlays and coordinate-based vector boundaries above the orthophoto or generated terrain.
- Imported and edited vector geometry is clipped to the project extent and stored as normalized project-metre coordinates.
- Foundational map layers are visually clipped to the project extent in the Three.js viewport.
- Raster imports accept optional world-file sidecars (`.pgw`, `.jgw`, `.tfw`, `.wld`) and store georeference metadata for scene placement.
- Selected vector vertices can be edited, split on lines, merged with the next feature, and snapped to grid or nearby vertices.
- Vector layers can be exported as GeoJSON with project metadata and WGS84 geometry.

Next remaining work:

- Checkpoint 3: LLM-assisted Landscape Character Assessment workflow.

## 3. LLM-Assisted Landscape Character Assessment

### Goal

Use the collected geospatial layers, terrain model, orthophoto, and project boundary to generate a Landscape Character Assessment output based on the Carys Swanwick Landscape Character Assessment method.

The system should analyze the site through natural, cultural, social, perceptual, and aesthetic dimensions, then produce a new editable Landscape Character Assessment map with mapped character types, character areas, key characteristics, evidence, and design implications.

### Method Reference

This checkpoint follows the Landscape Character Assessment approach established in:

- Landscape Character Assessment: Guidance for England and Scotland, 2002, prepared for the Countryside Agency and Scottish Natural Heritage by Carys Swanwick, Department of Landscape, University of Sheffield, and Land Use Consultants.
- Natural England, An Approach to Landscape Character Assessment, 2014, which follows the same established four-step LCA process and updates the guidance context.

The product should treat the method as an auditable planning framework, not as a black-box AI result.

### Core Principle

The LLM should not invent the landscape character map from language alone.

The LLM should analyze structured vector evidence derived from:

- Orthophoto.
- 3D terrain.
- Slope, aspect, and landform data.
- Geology.
- Soil.
- Hydrology.
- Climate and meteorology.
- Vegetation and habitat.
- Land use.
- Settlement.
- Infrastructure.
- Legal and planning constraints.
- Risk and suitability overlays.
- User-uploaded reports.
- Field observations.
- Stakeholder notes.
- Designer annotations.

Every generated conclusion should be traceable back to source layers, map features, or user-provided observations.

The model must understand the maps as coordinate-based vector features and attributes, not only as images. Raster sources can support visual interpretation, but the analysis pipeline should convert relevant information into structured vector summaries before LLM reasoning.

Required LLM input structure:

- Project boundary geometry.
- Layer category.
- Feature geometry type.
- Feature coordinates or simplified geometry.
- Feature attributes.
- Feature source.
- Feature confidence.
- Spatial relationships between features.
- Derived measurements such as area, length, slope, elevation range, distance, adjacency, overlap, and containment.

Vector geometry representation:

- Geometry should be described through coordinate lists and the relationships between those coordinates.
- Points should be represented as coordinate pairs or coordinate triples when elevation is known.
- Lines should be represented as ordered coordinate sequences.
- Polygons should be represented as closed coordinate rings.
- Multi-polygons should be represented as multiple closed rings with explicit exterior and interior ring roles.
- The system should be able to describe edges between vertices so the LLM understands shape structure, not only isolated points.
- The system should simplify complex geometries before LLM input while preserving important boundaries and topology.
- The full-resolution geometry should remain stored in the project database.
- The LLM should work with simplified geometry summaries when needed, then the application should map proposed edits back to project geometry.

Example geometry structure:

- Feature ID.
- Geometry type.
- Vertex list.
- Edge list.
- Ring order.
- Coordinate reference system.
- Bounding box.
- Area or length.
- Source layer.
- Attributes.
- Neighboring or overlapping features.

Structured geometry-to-knowledge representation:

- The application should be able to express map features in a compact structured form that the LLM can reason over.
- A feature should have an area or feature identifier.
- The identifier should connect geometry to knowledge bank meanings.
- The geometry should define the coordinate boundary.
- The knowledge bank should define what the coded value means.
- The LLM should be able to read that a given coordinate-defined area has a soil code, geology code, vegetation code, or land use code, then translate that code into meaning through the knowledge bank.

Natural-language evidence translation:

- The application should translate technical GIS features into natural-language descriptions before LLM analysis whenever possible.
- The LLM should receive both structured data and readable descriptions.
- This reduces dependence on a specially trained GIS-specific language model.
- The knowledge bank should act as the translation layer between raw codes and readable landscape meaning.
- The LLM should reason over sentences such as "Area 23 is a red soil polygon on a gentle south-facing slope near a seasonal water channel" while still preserving the source geometry and attributes.
- The system should keep the machine-readable geometry attached to each natural-language statement.
- Natural-language summaries should never replace source data; they are an interpretation layer for analysis.
- The same source feature should be traceable from raw geometry to code, from code to meaning, and from meaning to LLM reasoning.

Bidirectional translation layer:

- The system should include a translation layer between the map database, the knowledge bank, and the LLM.
- The translation layer should work in both read and write directions.
- DeepSeek should be used as the primary reasoning LLM for LCA analysis.
- Raw top-view map images can be used as supporting visual context, but they should not be the only analysis input.
- The primary LLM input should be translated evidence: vector geometry, attributes, knowledge bank meanings, spatial relationships, and readable natural-language summaries.
- The primary LLM output should be translated back into validated map operations: create layer, create feature, edit geometry, set attributes, add evidence, and set review status.

Read-side translation:

- Read vector maps, raster-derived classifications, terrain measurements, and feature attributes.
- Resolve layer codes through the knowledge bank.
- Convert raw codes into readable meanings.
- Convert coordinates and spatial relationships into compact geometry descriptions.
- Generate natural-language evidence summaries while preserving machine-readable references.
- Package the result for DeepSeek as structured JSON plus readable analysis text.

Write-side translation:

- Receive DeepSeek's proposed LCA interpretation.
- Parse proposed character areas, codes, names, attributes, and reasoning.
- Convert proposed boundaries into coordinate-based vector geometries or geometry edit instructions.
- Resolve proposed classification codes against the knowledge bank.
- Create pending knowledge bank entries when the model proposes an unmapped classification.
- Validate geometry and attributes before writing to the map.
- Store all LLM-generated map changes as draft edits until reviewed by a human.

Translation layer responsibilities:

- Prevent the LLM from directly mutating authoritative GIS data.
- Keep source-of-truth data in vector geometry and attributes.
- Keep knowledge meanings versioned and traceable.
- Keep LLM reasoning explainable through evidence references.
- Convert technical map data into language the LLM can reason about.
- Convert LLM language back into strict map operations the application can validate.

Recommended LLM context mix:

- Structured vector evidence as the primary input.
- Knowledge bank meanings as the semantic layer.
- Natural-language summaries as the reasoning layer.
- Top-view screenshots as optional visual confirmation.
- Raw raster map images only as secondary context, never as the source of truth.

Conceptual example:

```text
area(id: 23) {
  ring: [(34,24), (24,25), (20,19), (24,35), (34,24)]
  layer: soil
  code: 23
}

knowledge.soil[23] = "Red soil"
```

Interpretation:

- The coordinates define the polygon.
- `area(id: 23)` identifies the feature.
- `layer: soil` tells the system which knowledge category to use.
- `code: 23` points to the knowledge bank.
- The LLM can then reason that this coordinate-defined area represents red soil.

This same pattern should work for other layers:

- Geology area code to geology meaning.
- Vegetation area code to vegetation meaning.
- Hydrology feature code to water system meaning.
- Land use area code to cultural or settlement meaning.
- Risk area code to risk meaning.

Required LLM output structure:

- New vector layer definition.
- New feature geometries.
- Character area polygons.
- Character type classifications.
- Feature attributes.
- Source evidence links.
- Reasoning summary.
- Confidence score.
- Review status.

The LLM should be able to reason over existing vector maps and then produce a new mapped interpretation as editable vector geometry.

LLM-generated geometry should be constrained. The model can propose vertex sequences, boundary edits, split lines, merge instructions, or references to existing boundaries, but the application must validate and construct the final geometry.

### LLM Map Read And Write Tools

The LCA system should expose explicit map read and map write operations for the LLM pipeline.

The read tool gives the LLM structured knowledge of the current map. The write tool applies validated LLM output back into the project map.

This should work like a controlled GIS editing API, not like free-form drawing.

#### Map Read Tool

Purpose:

- Convert the current project map into structured, coordinate-based evidence that the LLM can analyze.

Read tool inputs:

- Project ID.
- Project boundary.
- Selected layer IDs.
- Target analysis extent.
- Geometry detail level.
- Attribute fields to include.
- Required derived measurements.
- Coordinate reference system.

Read tool outputs:

- Project coordinate system.
- Layer metadata.
- Feature tables.
- Feature geometries.
- Vertex lists.
- Edge lists.
- Polygon rings.
- Bounding boxes.
- Spatial relationships.
- Derived measurements.
- Source and confidence metadata.
- Simplified geometry summaries when full geometry is too large.

Read behavior:

- Preserve coordinate meaning.
- Simplify geometry only when needed.
- Keep topology relevant to the analysis.
- Include feature IDs so generated outputs can reference source evidence.
- Include derived spatial relationships such as overlap, adjacency, containment, distance, slope class, and elevation range.
- Return machine-readable JSON suitable for LLM analysis.

#### Map Write Tool

Purpose:

- Convert LLM analysis output into project map changes.

Write tool inputs:

- Target project ID.
- Target layer ID or new layer definition.
- Proposed feature geometries.
- Proposed feature attributes.
- Source evidence links.
- Reasoning summary.
- Confidence score.
- Review status.
- Geometry operation type.

Supported write operations:

- Create layer.
- Create feature.
- Update feature attributes.
- Update feature geometry.
- Split feature.
- Merge features.
- Delete draft feature.
- Add evidence link.
- Add review status.

Write behavior:

- Validate all geometries before saving.
- Reject invalid polygons, open rings, self-intersections, impossible coordinates, and CRS mismatches.
- Snap proposed geometries to valid source boundaries when instructed.
- Preserve source evidence links.
- Store all LLM-written features as drafts until reviewed by a human.
- Record model version, prompt version, input layer IDs, and timestamp.
- Create an undoable edit transaction.

The write tool should be the reverse of the read tool. If the read tool describes map geometry as coordinate, vertex, edge, and ring structures, the write tool should accept the same structures to create or modify map features.

Example read-to-write loop:

1. Read selected geology, soil, hydrology, vegetation, slope, settlement, and infrastructure layers.
2. Convert them into feature tables, geometry summaries, and spatial relationship summaries.
3. Send that structured evidence to the LLM.
4. LLM proposes Landscape Character Area polygons and attributes.
5. Write tool validates the proposed geometries.
6. Application creates a new editable LCA vector layer.
7. User reviews and edits the generated map.

### LCA Workflow

The application should support the LCA workflow as an explicit analysis mode.

#### Step 1: Define Purpose And Scope

Inputs:

- Project boundary.
- Assessment scale.
- Intended use.
- Required output type.
- Stakeholder context.
- Available data sources.
- Known constraints.

Examples of intended use:

- Early landscape strategy.
- Site planning.
- Planting strategy.
- Development suitability review.
- Conservation and restoration planning.
- Design concept generation.
- Planning report support.

System behavior:

- Ask the user to define the LCA purpose.
- Record the assessment scale.
- Record whether the output is conceptual, professional baseline, or report-ready.
- Define which layers will be included in the analysis.
- Identify missing critical data.

#### Step 2: Desk Study And Data Review

Inputs:

- All imported map layers.
- Derived terrain layers.
- Existing reports.
- Orthophoto interpretation.
- Historic and cultural data when available.

System behavior:

- Summarize each layer's contribution to landscape character.
- Identify spatial patterns.
- Detect recurring combinations of landform, land cover, settlement, hydrology, and vegetation.
- Identify anomalies and conflicts.
- Generate preliminary character type candidates.
- Highlight data gaps and uncertainty.

LLM role:

- Convert structured GIS evidence into a clear narrative.
- Compare layer patterns.
- Propose draft character types and areas.
- Explain why each draft unit exists.
- Attach source references to each claim.
- Use vector feature relationships such as overlap, adjacency, containment, slope class, landform boundary, vegetation transition, watercourse proximity, settlement edge, and infrastructure corridor.
- Produce structured draft outputs that can be converted into vector polygons and attributes.

#### Step 3: Field Study And Human Validation

Inputs:

- Site photos.
- Field notes.
- Drone images.
- Designer observations.
- Stakeholder comments.
- Sensory and perceptual observations.

Observation categories:

- Scale.
- Openness or enclosure.
- Texture.
- Color.
- Pattern.
- Form.
- Movement.
- Noise.
- Smell.
- Views.
- Landmarks.
- Sense of place.
- Cultural associations.
- Condition.
- Tranquility or disturbance.

System behavior:

- Let users attach field observations to map locations.
- Let users upload photos and notes.
- Let users validate or reject draft character boundaries.
- Let users mark perceptual qualities that are not visible in GIS data.
- Keep field evidence separate from automated inference.

LLM role:

- Synthesize field notes with map evidence.
- Identify where field observations confirm or contradict desk study outputs.
- Suggest boundary refinements.
- Draft character descriptions with cited evidence.

#### Step 4: Classification, Mapping, And Description

Outputs:

- Landscape Character Types.
- Landscape Character Areas.
- Character area boundaries.
- Key characteristics.
- Condition summary.
- Sensitivity notes.
- Management considerations.
- Design opportunities.
- Evidence list.
- Confidence rating.

System behavior:

- Generate a new vector layer for Landscape Character Areas.
- Generate optional broader Landscape Character Type categories.
- Store each character area as an editable polygon.
- Store character descriptions as feature attributes.
- Let users edit boundaries and text.
- Let users approve or reject each generated area.
- Preserve a full audit trail of evidence and LLM reasoning.
- Convert LLM-proposed character areas into editable coordinate-based vector geometries.
- Validate generated polygons for topology issues such as overlaps, gaps, invalid rings, and boundary conflicts.

### LCA Map Output

The generated Landscape Character Assessment map should be a vector layer.

Each character area should include:

- Unique coded ID.
- Name.
- Landscape Character Type.
- Boundary polygon.
- Key characteristics.
- Natural factors.
- Cultural and social factors.
- Perceptual and aesthetic factors.
- Dominant landform.
- Dominant land cover.
- Hydrological character.
- Settlement pattern.
- Vegetation character.
- Condition.
- Sensitivity.
- Opportunities.
- Pressures or risks.
- Source evidence.
- Confidence score.
- Review status.

LCA identification model:

- Every generated landscape character unit should receive a unique coded identifier.
- The coded identifier should be separate from the human-readable character area name.
- Example coded identifier format: `a21kd49pe2`.
- The code should be stable after creation so evidence, edits, review notes, exports, and reports can reference the same unit.
- Renaming a character area should not change its coded identifier.
- If an area is split, the new child areas should receive new coded identifiers and preserve a parent reference.
- If areas are merged, the merged area should receive a new coded identifier and preserve source references.
- The code should be stored as a required feature attribute on the generated LCA vector map.
- The display label can combine code and name, such as `a21kd49pe2 - Dry Exposed Slope Character`.

LCA knowledge bank:

- The system should maintain a background knowledge bank from the maps and attributes imported during checkpoint 2.
- The knowledge bank should translate raw layer values into controlled landscape classification codes.
- The generated LCA coded identifier should be assembled from these controlled classification codes.
- The code should not be random. It should encode the layered landscape evidence used to define the character unit.
- Each code segment should have a source layer, source attribute, readable meaning, confidence value, and mapping rule.
- The knowledge bank should be editable by advanced users so local classification systems can be adapted.
- The knowledge bank should preserve both the short code and the full explanation.
- The LLM should use the knowledge bank to interpret map values consistently.
- The write tool should store the expanded code anatomy as feature attributes and evidence metadata.
- The knowledge bank should update as new maps and new attribute values are imported.
- Existing code mappings should be reused when the same landscape value appears in later projects or later layers.
- New code mappings should be created when a newly imported map contains a previously unknown value.
- The system should preserve accumulated classification knowledge across projects when the user or organization allows it.
- The knowledge bank should be versioned so older LCA outputs remain explainable even after classification rules evolve.

Example code anatomy:

- `a2`: elevation or topography class, such as low hills between 200 and 500 meters.
- `1`: slope group, such as flat or gently sloping land between 0% and 5%.
- `kd`: geology or parent material, such as limestone, karstic dolomite, or Cretaceous formation.
- `49`: major soil group, such as brown forest soil or alluvial soil classification.
- `pe`: land cover or vegetation, such as Pinus brutia forest or permanent crops.
- `2`: land use pattern or cultural factor, such as rural settlement or dry farming area.

Example assembled identifier:

- `a21kd49pe2`

This identifier can be read as a compact summary of the dominant elevation, slope, geology, soil, vegetation, and land use pattern for a landscape character unit.

Knowledge bank data model:

- Code segment.
- Segment position.
- Theme category.
- Source layer ID.
- Source attribute field.
- Source value or value range.
- Human-readable meaning.
- Classification rule.
- Confidence.
- Version.
- Author or source authority.
- Created date.
- Last used date.
- Usage count.
- Project scope or organization scope.
- Deprecated or active status.

Possible code themes:

- Elevation and topography.
- Slope.
- Aspect.
- Geology and parent material.
- Soil group.
- Geomorphology.
- Hydrology.
- Vegetation and land cover.
- Land use.
- Settlement pattern.
- Infrastructure influence.
- Cultural or perceptual qualifier.

Code generation behavior:

- Intersect the draft character area polygon with all selected source layers.
- Calculate dominant or significant values for each theme.
- Convert source values into controlled code segments through the knowledge bank.
- Assemble the identifier in a stable order.
- Store the full expanded explanation with the feature.
- Flag mixed or uncertain areas when no single dominant value is strong enough.
- Allow human review and correction of each code segment.

Knowledge bank update behavior:

- When a new map is imported, scan selected attribute fields for values relevant to classification.
- Match discovered values against existing knowledge bank entries.
- Reuse existing codes for known values.
- Create pending entries for unknown values.
- Suggest new code segments for unknown values.
- Require human confirmation for new authoritative code mappings.
- Allow temporary draft codes when the workflow needs to continue before review.
- Record which project, layer, and feature introduced each new value.
- Keep old mappings stable unless explicitly deprecated.
- Support organization-level reuse so accumulated knowledge becomes stronger over time.

Knowledge bank import behavior:

- The system should allow users to seed the knowledge bank before map analysis begins.
- Users should be able to import existing classification knowledge from external files.
- Supported early import formats should include Excel, CSV, and manually prepared tables.
- Word documents can be supported when they contain structured classification tables.
- Imported knowledge should be reviewed before becoming active.
- Import should detect duplicate codes, duplicate meanings, missing fields, and conflicting mappings.
- Users should be able to map source columns to knowledge bank fields during import.
- Imported entries should record source filename, import date, author or organization, and version.
- Imported entries should support draft, active, deprecated, and rejected statuses.

Manual knowledge bank management:

- Users should be able to manually create a code mapping.
- Users should be able to edit code meaning, theme category, source value, and classification rule.
- Users should be able to merge duplicate entries.
- Users should be able to deprecate old entries without deleting historical references.
- Users should be able to search and filter by code, theme, source value, meaning, status, and version.
- Users should be able to export the knowledge bank for reuse or audit.
- Manual edits should be versioned and attributed to the editing user.

Example update behavior:

- Existing soil knowledge contains Mediterranean soil and red soil, each with assigned codes.
- A newly imported soil map contains limestone-derived soil.
- The system detects that this soil value is not yet mapped.
- The knowledge bank creates a pending classification entry.
- The system suggests a new soil code segment.
- A human reviewer confirms or edits the code.
- Future projects can reuse that limestone soil mapping automatically.

Review statuses:

- Draft by system.
- Needs human review.
- Reviewed by designer.
- Approved.
- Rejected.

### LLM Analysis Requirements

The LLM pipeline should be evidence-first.

Requirements:

- Use structured layer summaries instead of raw unbounded prompts.
- Use vector feature tables, spatial indexes, and derived spatial relationships as the primary input.
- Represent shapes through coordinate sequences, vertex relationships, edge relationships, and polygon rings.
- Use a controlled map read tool to prepare LLM input.
- Use a controlled map write tool to apply LLM-generated map output.
- Include source IDs for map layers and features.
- Include uncertainty when evidence is incomplete.
- Separate observed facts from interpretation.
- Separate LCA baseline description from later design judgement.
- Generate editable outputs, not final locked conclusions.
- Keep all LLM-generated boundaries and descriptions reviewable by humans.
- Store prompt version, model version, source inputs, and generated output metadata.
- Return machine-readable geometry and attribute proposals that the application can turn into a new vector map.

Vector reasoning examples:

- If geology, soil, slope, and vegetation boundaries repeatedly align, the model may propose a character boundary.
- If a valley floor includes watercourses, alluvial soil, riparian vegetation, and lower slope values, the model may propose a valley landscape character area.
- If settlement edges, road corridors, and fragmented vegetation overlap, the model may identify a peri-urban transition character.
- If rocky shallow soils, steep slopes, and sparse vegetation coincide, the model may identify a dry exposed slope character.
- If productive soils, gentle slopes, irrigation access, and agricultural land use coincide, the model may identify an agricultural landscape character.

The system should avoid:

- Inventing unsupported cultural meaning.
- Treating low-resolution data as high-accuracy evidence.
- Presenting approximate terrain as survey-grade evidence.
- Collapsing distinct landscape areas only because they are visually similar in the orthophoto.
- Producing final planning conclusions without user validation.

### Character Boundary Generation

The application should generate draft LCA boundaries through a hybrid process.

Boundary evidence may include:

- Slope breaks.
- Ridge lines.
- Valley lines.
- Watercourses.
- Soil boundaries.
- Geological boundaries.
- Vegetation transitions.
- Land use changes.
- Settlement edges.
- Infrastructure corridors.
- Visual enclosure changes.
- Existing administrative or parcel boundaries.

Processing model:

- GIS preprocessing detects candidate zones.
- The application converts relevant features into simplified coordinate, vertex, edge, and ring descriptions.
- LLM reviews structured zone summaries.
- LLM proposes character logic and naming.
- The LLM returns proposed character geometries or geometry-edit instructions.
- The application creates editable vector polygons from those proposals.
- Human user validates and refines the boundaries.

Generated vector map requirements:

- The LCA result must be stored as a new map layer.
- The new map layer must use the project coordinate system.
- All generated polygons must be editable.
- All generated polygons must preserve links to source evidence.
- The generated map must be visible in the layer stack like any other map.
- The generated map must support opacity, styling, legend, inspection, and export.
- The generated map must be usable as an input layer for later design decisions.

### Human Review Model

The LCA output must be reviewable and editable.

Review tools:

- Accept character area.
- Reject character area.
- Rename character area.
- Edit boundary vertices.
- Merge areas.
- Split area.
- Rewrite description.
- Add field evidence.
- Add source citation.
- Mark confidence.
- Export reviewed LCA map.

The product should make clear that LCA is a professional judgement process supported by data and AI, not fully automated truth.

### Integration With Future Design Tools

The LCA map becomes a decision layer for later landscape design.

Future uses:

- Filter plant palettes by character area.
- Generate design principles for each character area.
- Suggest conservation zones.
- Suggest restoration zones.
- Identify areas suitable for intervention.
- Guide circulation, viewpoints, water management, and planting structure.
- Create report-ready character area sheets.
- Compare proposed design changes against existing landscape character.

### MVP Scope

The first implementation of this checkpoint should prove the LCA analysis loop.

MVP features:

- Select project boundary.
- Select data layers for LCA.
- Read selected map layers into structured coordinate-based LLM input.
- Generate layer summaries.
- Create preliminary Landscape Character Type candidates.
- Create draft Landscape Character Area polygons.
- Generate key characteristic descriptions.
- Attach source evidence to each area.
- Store the LCA result as an editable vector layer.
- Write generated LCA geometries back into the map through a validated write operation.
- Allow user approval, rejection, and manual boundary editing.
- Display LCA areas over the orthophoto, map stack, and 3D terrain.
- Feed the LLM vector feature summaries and spatial relationships, not only raster screenshots.
- Convert LLM analysis into a new coordinate-based vector map.

Out of scope for the first version:

- Fully automated regulatory reporting.
- Fully automated professional sign-off.
- Advanced stakeholder consultation workflow.
- Automated historic landscape character assessment.
- Automated visual impact assessment.
- Automatic plant palette generation.
- Automatic design proposal generation.

### Open Decisions

- Which LCA scale should be supported first.
- Whether the first output should be Landscape Character Types, Landscape Character Areas, or both.
- How field survey evidence should be captured in the first release.
- Whether LCA prompts are fixed templates or configurable per project.
- Which LLM model and context architecture should be used.
- Whether LCA boundaries are generated through GIS clustering, LLM interpretation, or manual drafting first.
- How confidence scoring should be calculated.

### Checkpoint 3 Acceptance Criteria

- The system can summarize selected map layers for LCA analysis.
- The system can provide selected map data to the LLM as vector features, attributes, and spatial relationships.
- The system can read map data into a machine-readable coordinate structure for LLM analysis.
- The system can generate draft Landscape Character Type or Area candidates.
- The system can create an editable vector LCA map layer.
- The system can write validated LLM-generated geometries back into the project map.
- The system can convert LLM analysis results into new coordinate-based map features.
- Each generated character area includes key characteristics and evidence references.
- Users can review, edit, approve, or reject generated character areas.
- The output separates factual baseline description from design judgement.
- The LCA layer can be viewed in top-view and over the 3D terrain.

### Checkpoint 3 Progress Status

Status: In progress.

Implemented so far:

- Shared map evidence serialization builds layer summaries, simplified vector features, and spatial relationships from selected project layers.
- Draft LCA analysis runs in the web editor from selected foundational input layers and assessment purpose.
- Mock LCA draft generation creates coded character areas from polygon evidence or project-extent fallback zones.
- Draft LCA output is stored as an editable `lca` vector layer with coded IDs, confidence, model metadata, and review status.
- Users can review, approve, reject, and edit generated character areas through the existing inspector and vector editing tools.
- LCA layers render in top-view and over the 3D terrain with project-extent clipping.
- MCP `map_read` and `map_write_draft` now use the shared evidence and draft-write contracts with optional `projectSnapshot` input.
- Shared LCA analysis now has a versioned DeepSeek prompt contract, JSON response parser, parser tests, MCP `lca_analyze` tool, and HTTP `/lca/analyze` endpoint with dry-run prompt inspection.
- The web editor draft LCA action now calls the MCP `/lca/analyze` endpoint with the current project snapshot and selected evidence layers, then falls back to the local mock draft generator when the backend is unavailable.
- Generated LCA features now store draft knowledge-bank code anatomy and evidence citation metadata, and the inspector displays both as dedicated review sections instead of raw JSON attributes.

Next remaining work:

- Replace draft code-anatomy heuristics with true area/source-layer intersection and reusable knowledge-bank entries.
- Add explicit LCA analysis mode and richer spatial relationship inference.

## 4. Forces For Change And Sensitivity Capacity Assessment

### Goal

Use the completed Landscape Character Assessment layer as the baseline for evaluating the pressures, risks, change dynamics, sensitivity, and capacity of each identified landscape character unit.

The system should use the LLM to analyze every coded LCA area individually. The output should explain what is affecting each area, what risks exist, what forms of change may be acceptable, what forms of change may damage the character, and how much change the area can tolerate.

### Product Concept

After the LCA map is generated, every landscape character area has a coded identifier such as `a21kd49pe2`.

The LLM should use these identifiers as the primary unit of analysis.

For each coded area, the system should produce:

- Forces for change.
- Current pressures.
- Future pressures.
- Risk factors.
- Sensitivity assessment.
- Capacity assessment.
- Vulnerability summary.
- Recommended planning response.
- Time-based resilience or endurance estimate.
- Evidence references.
- Confidence score.
- Human review status.

Example output concept:

```text
Area: a21kd49pe2
Recommendation: conserve and limit structural intervention.
Main risks: erosion, fire risk, water stress, settlement edge pressure.
Change dynamics: increasing dry-season stress and gradual vegetation fragmentation.
Sensitivity: high.
Capacity: low.
Estimated resilience under current pressure: 3-6 months before visible degradation risk increases without management action.
Evidence: slope layer, soil layer, vegetation layer, hydrology layer, meteorology layer.
```

The exact time estimate should be treated as a planning judgement, not as engineering certainty. It must include evidence and confidence.

### Inputs

Primary inputs:

- Approved or draft LCA vector layer.
- LCA coded identifiers.
- LCA knowledge bank.
- Foundational map layers from checkpoint 2.
- Terrain, slope, aspect, and elevation data.
- Climate and meteorology data.
- Hydrology and water stress data.
- Vegetation and habitat data.
- Soil and geology data.
- Settlement and infrastructure data.
- Legal and planning constraint layers.
- Risk and suitability overlays.
- Field observations and user annotations.

Optional inputs:

- Historic change data.
- Satellite time-series data.
- Fire history.
- Flood history.
- Erosion records.
- Tourism or visitor pressure data.
- Agricultural change data.
- Development applications or planned infrastructure data.

### Forces For Change Categories

The assessment should evaluate multiple change drivers for each coded LCA area.

Core categories:

- Development and settlement pressure.
- Infrastructure pressure.
- Agricultural change.
- Forestry and vegetation change.
- Tourism and recreation pressure.
- Water stress.
- Flood risk.
- Erosion risk.
- Fire risk.
- Landslide or geotechnical instability.
- Climate change exposure.
- Ecological degradation.
- Habitat fragmentation.
- Visual sensitivity.
- Cultural landscape pressure.
- Management neglect.
- Invasive species.

Each force for change should include:

- Direction of change.
- Intensity.
- Spatial extent.
- Evidence.
- Time horizon.
- Confidence.
- Planning implication.

### Sensitivity And Capacity Model

Sensitivity answers:

- How vulnerable is this landscape character area to a specific type of change?
- Which character-defining features would be damaged by change?
- How visible or perceptible would that change be?

Capacity answers:

- How much change can this area accept while retaining its character?
- Which interventions are compatible with the character?
- Which interventions exceed the area's tolerance?

The system should assess both general capacity and change-specific capacity.

Example change-specific capacity types:

- Built development capacity.
- Tourism capacity.
- Recreation capacity.
- Agricultural intensification capacity.
- Forestry change capacity.
- Water infrastructure capacity.
- Path and access capacity.
- Planting intervention capacity.
- Restoration capacity.

### Time-Based Resilience Estimate

For each coded area, the LLM may estimate a time-based resilience or endurance window when enough evidence exists.

Examples:

- `0-3 months`: urgent management required.
- `3-6 months`: near-term degradation risk if pressure continues.
- `6-12 months`: moderate short-term resilience.
- `1-3 years`: medium-term capacity with monitoring.
- `3-5 years`: stable under current pressure.
- `5+ years`: resilient under current known pressure.

Rules:

- The estimate must be tied to a specific pressure or risk.
- The estimate must include evidence references.
- The estimate must include confidence.
- The estimate must be reviewable by humans.
- The estimate must not be presented as exact prediction.

### LLM Analysis Workflow

For each coded LCA area:

1. Read the area geometry, code anatomy, and character description.
2. Read all overlapping and adjacent map evidence.
3. Translate source codes through the knowledge bank.
4. Summarize pressures and risks in natural language.
5. Identify current forces for change.
6. Identify likely future change dynamics.
7. Score sensitivity.
8. Score capacity.
9. Estimate resilience or endurance window where possible.
10. Recommend planning response.
11. Return structured output tied to the area ID.
12. Write results as draft attributes or a new assessment layer.

The LLM should produce a list of analyses keyed by LCA coded area ID.

### Output Data Model

The output should be stored as a reviewable assessment dataset.

Each record should include:

- LCA coded area ID.
- Area name.
- Area geometry reference.
- Forces for change list.
- Risk list.
- Pressure summary.
- Change dynamics summary.
- Sensitivity score.
- Sensitivity class.
- Capacity score.
- Capacity class.
- Acceptable change types.
- Unacceptable change types.
- Time-based resilience estimate.
- Recommended planning response.
- Evidence references.
- Confidence score.
- LLM reasoning summary.
- Review status.

Review statuses:

- Draft by system.
- Needs expert review.
- Reviewed.
- Approved.
- Rejected.

### Map Output

The checkpoint should generate or enrich map data in two ways.

1. Add summary attributes to the existing LCA layer.
2. Create a separate `Sensitivity And Capacity Assessment` vector layer for planning review.

The separate assessment layer should recolor the LCA coded areas categorically according to capacity and resilience recommendation.

Example interpretation:

- `a21kd49pe2`: low capacity, does not tolerate the assessed change.
- `a42ew42pe3`: higher capacity, can tolerate the assessed change under stated conditions.

Color model:

- Red: does not tolerate change.
- Orange: very limited tolerance.
- Yellow: conditional or moderate tolerance.
- Light green: tolerates limited change.
- Green: tolerates the assessed change well.
- Gray: insufficient evidence.

The color should represent the planning recommendation, not only a raw score. The user should be able to switch between sensitivity color mode, capacity color mode, risk color mode, and final recommendation color mode.

The separate layer should support:

- The same coded area IDs.
- Sensitivity styling.
- Capacity styling.
- Risk overlay styling.
- Opacity control.
- Legend.
- Feature inspection.
- Top-view display.
- 3D terrain overlay.
- Export.

### Area Information Panel

When the user clicks a coded area in the sensitivity and capacity map, an information panel should open.

The panel should show:

- LCA coded area ID.
- Area name.
- Final recommendation class.
- Recommendation color.
- Forces for change.
- Risks.
- Pressures.
- Change dynamics.
- Sensitivity.
- Capacity.
- Acceptable change types.
- Unacceptable change types.
- Recommended planning response.
- Time-based resilience estimate.
- Evidence references.
- Confidence.
- Review status.
- Explanation text.

The explanation text should clearly state why the system recommended that the area can or cannot tolerate change.

Example:

```text
Area a21kd49pe2 is marked red because it combines high erosion sensitivity, water stress, fragmented vegetation, and settlement-edge pressure. The area has low capacity for additional structural intervention. Recommended response: conserve, restore vegetation cover, and avoid new built development.
```

The panel should separate:

- Evidence from source layers.
- LLM interpretation.
- Planning recommendation.
- Human review notes.

The original LCA baseline should remain intact. Planning judgement should be stored separately so character description and planning response do not become confused.

### Human Review Model

The output must be reviewed before it becomes authoritative.

Review tools:

- Accept assessment for an area.
- Reject assessment for an area.
- Edit sensitivity score.
- Edit capacity score.
- Edit time-based estimate.
- Add missing evidence.
- Remove unsupported claims.
- Add expert notes.
- Lock approved records.

### MVP Scope

The first implementation of this checkpoint should prove ID-based per-area analysis.

MVP features:

- Select LCA areas for analysis.
- Run LLM assessment per coded area ID.
- Generate forces for change list.
- Generate risk and pressure summary.
- Generate sensitivity class.
- Generate capacity class.
- Generate recommended planning response.
- Generate time-based resilience estimate when evidence supports it.
- Store results as reviewable records.
- Display assessment by area ID in the map inspector.
- Create a draft sensitivity and capacity layer.
- Recolor coded LCA areas from red to green according to final capacity and resilience recommendation.
- Open an information panel when a coded area is selected.
- Show the full reason why the area is marked as tolerating or not tolerating change.

Out of scope for the first version:

- Exact predictive environmental modeling.
- Automated final professional sign-off.
- Full climate projection modeling.
- Full economic or demographic forecasting.
- Fully automated legal planning decision.

### Open Decisions

- Which sensitivity scoring scale should be used first.
- Whether capacity should be numeric, categorical, or both.
- Which time windows should be supported.
- Which pressures require mandatory evidence before the LLM can comment.
- Whether all LCA areas are analyzed automatically or only selected areas.
- How expert review should override LLM judgement.

### Checkpoint 4 Acceptance Criteria

- The system can analyze each LCA coded area ID separately.
- The system can list forces for change for each coded area.
- The system can list risks, pressures, and change dynamics for each coded area.
- The system can assess sensitivity and capacity for each coded area.
- The system can produce a recommended planning response for each coded area.
- The system can produce a time-based resilience estimate when evidence supports it.
- The system can recolor coded areas from red to green according to capacity and resilience recommendation.
- The system can show a detailed information panel for each coded area.
- The information panel explains why the area is marked as tolerating or not tolerating change.
- The system stores all outputs with evidence references, confidence, and review status.
- The system keeps the original LCA baseline separate from planning judgement outputs.

## 5. Landscape Strategy And Management Objectives

### Goal

Use the LCA baseline and the sensitivity capacity assessment to define a clear planning strategy for every coded landscape character area.

This checkpoint turns analysis into planning intent. For each area, the system should decide whether the landscape should be conserved, restored, enhanced, newly created, carefully accommodated, or transformed.

### Product Concept

Each coded area receives a strategy recommendation.

Core strategy classes:

- `conserve`: protect the existing character and prevent damaging change.
- `restore`: repair degraded character, ecological function, or landscape structure.
- `enhance`: strengthen existing positive character and improve quality.
- `create`: establish a new landscape character where the existing character is weak, absent, or unsuitable.
- `accommodate`: allow controlled intervention while protecting key character-defining features.
- `transform`: manage a deliberate change of character where existing conditions cannot or should not be preserved.

The LLM should analyze each coded area separately and generate a strategy record linked to the area ID.

Example output concept:

```text
Area: a21kd49pe2
Strategy: conserve
Management objective: protect existing dry slope character, prevent new structural development, reduce erosion risk, and maintain native vegetation cover.
Reason: high sensitivity, low capacity, erosion pressure, fragmented vegetation, and limited water resilience.
Priority: high
```

### Inputs

Primary inputs:

- LCA coded area layer.
- LCA character descriptions.
- LCA code anatomy.
- Forces for change assessment.
- Sensitivity and capacity assessment.
- Risk and pressure summaries.
- Existing planning constraints.
- User-defined planning goal.
- Stakeholder or client priorities.
- Field notes and expert review comments.

Optional inputs:

- Budget or implementation priority.
- Conservation policy.
- Restoration targets.
- Biodiversity objectives.
- Water management objectives.
- Tourism or access goals.
- Development pressure scenarios.

### Strategy Selection Logic

The strategy should be evidence-based and explainable.

Indicative logic:

- Use `conserve` when character is strong, valuable, sensitive, and vulnerable to damaging change.
- Use `restore` when important character exists but is degraded or fragmented.
- Use `enhance` when character is present and stable but can be strengthened.
- Use `create` when an area lacks coherent character or requires a new landscape function.
- Use `accommodate` when some change is acceptable if controlled by design rules.
- Use `transform` when current character is unsustainable, severely degraded, or intentionally changing due to planning direction.

The system should avoid treating these as fixed rules. The LLM should propose a strategy, but the recommendation must include evidence, confidence, and human review.

### Per-Area Strategy Output

For each coded area, the LLM should produce:

- LCA coded area ID.
- Area name.
- Recommended strategy class.
- Management objective.
- Planning rationale.
- Key character features to protect.
- Key issues to address.
- Required interventions.
- Prohibited or discouraged interventions.
- Compatible land uses.
- Incompatible land uses.
- Implementation priority.
- Time horizon.
- Monitoring indicators.
- Evidence references.
- Confidence score.
- Review status.

### Management Objectives

Each strategy should be translated into clear management objectives.

Objective examples:

- Protect ridge-line visibility and prevent skyline development.
- Restore riparian vegetation along seasonal watercourses.
- Enhance native woodland continuity.
- Create a new wetland retention landscape in low-lying drainage areas.
- Accommodate low-impact recreation with controlled paths and viewpoints.
- Transform degraded industrial edge into ecological buffer and public open space.

Each objective should include:

- Action verb.
- Target landscape feature.
- Reason.
- Spatial reference.
- Priority.
- Evidence.

### Strategy Map Output

The checkpoint should create a new `Landscape Strategy And Management Objectives` vector layer.

The layer should:

- Use the same coded area IDs as the LCA layer.
- Store strategy and objective attributes.
- Recolor areas by strategy class.
- Support opacity and legend.
- Support top-view display.
- Support 3D terrain overlay.
- Support feature inspection.
- Support export.

Suggested colors:

- Conserve: dark green.
- Restore: blue-green.
- Enhance: light green.
- Create: purple.
- Accommodate: yellow.
- Transform: red-brown.
- Unknown or insufficient evidence: gray.

The original LCA and sensitivity layers should remain separate. The strategy layer is a planning-intent layer.

### Area Information Panel

When the user clicks a coded area in the strategy map, an information panel should show:

- LCA coded area ID.
- Area name.
- Strategy class.
- Management objective.
- Rationale.
- Key features to protect.
- Issues to address.
- Required interventions.
- Discouraged interventions.
- Compatible and incompatible land uses.
- Priority.
- Time horizon.
- Monitoring indicators.
- Evidence references.
- Confidence.
- Review status.
- Human notes.

The panel should clearly explain why the area received its strategy class.

### Human Review Model

Strategy is a planning judgement, so it must be reviewable.

Review tools:

- Accept strategy.
- Reject strategy.
- Change strategy class.
- Edit management objective.
- Edit priority.
- Add expert note.
- Add missing evidence.
- Mark for stakeholder review.
- Lock approved strategy.

### LLM Workflow

For each coded area:

1. Read LCA character description.
2. Read code anatomy and knowledge bank meanings.
3. Read forces for change, sensitivity, capacity, and resilience assessment.
4. Read legal, ecological, cultural, and planning constraints.
5. Read user-defined planning goal.
6. Propose a strategy class.
7. Draft management objectives.
8. Explain evidence and reasoning.
9. Return structured output keyed by coded area ID.
10. Write draft strategy attributes and map layer styling.

### MVP Scope

The first implementation should prove per-area strategy assignment.

MVP features:

- Select coded LCA areas.
- Run LLM strategy generation per area ID.
- Generate one strategy class per coded area.
- Generate one or more management objectives per coded area.
- Generate planning rationale.
- Store strategy output as reviewable records.
- Create a strategy map layer.
- Recolor areas by strategy class.
- Show strategy details in an area information panel.
- Allow human review and manual strategy edits.

Out of scope for the first version:

- Full policy compliance automation.
- Cost estimation.
- Implementation scheduling.
- Construction documentation.
- Automated stakeholder approval.
- Full monitoring system.

### Open Decisions

- Whether each area can have one primary strategy or multiple ranked strategies.
- Whether strategy class should be selected by LLM, user, or hybrid voting.
- Which color palette should be final.
- Whether strategy priority should be numeric, categorical, or both.
- How user-defined planning goals should override or guide LLM recommendations.
- Whether strategy classes should be globally fixed or configurable per organization.

### Checkpoint 5 Acceptance Criteria

- The system can assign a strategy class to each coded LCA area.
- The system can generate management objectives for each coded area.
- The system can explain why each strategy was recommended.
- The system can create a new strategy vector layer.
- The system can recolor areas by strategy class.
- The system can show strategy details in an area information panel.
- Users can review, edit, approve, or reject strategy recommendations.
- The strategy layer remains separate from the LCA baseline and sensitivity assessment layers.

## 6. Suitability Opportunity And Constraint Mapping

### Goal

Generate detailed planning maps from the LCA baseline, sensitivity and capacity assessment, and landscape strategy layer.

This checkpoint translates character analysis and strategy into spatial planning guidance. It should show where protection, restoration, intervention, access, water management, recreation, ecological corridors, agriculture, forestry, or development avoidance should occur.

### Product Concept

The system should create multiple planning map layers, each answering a specific planning question.

Core questions:

- Which areas should be protected?
- Which areas should be restored?
- Which areas should avoid built development?
- Which areas have recreation potential?
- Which areas are suitable for agriculture, forestry, or ecological corridors?
- Which areas are suitable for water management?
- Which areas are suitable for walking routes, access, and viewpoints?
- Which areas have strong constraints?
- Which areas have strong opportunities?

The LLM should use the previous checkpoints as evidence, but the output should be stored as coordinate-based vector planning layers.

The workflow should also support area-focused planning. The user can zoom into or isolate a single coded LCA area, such as `a21kd49pe2`, and ask the system to generate detailed planning maps only inside that area.

In this mode, the selected coded area becomes the working extent. Other layers remain available as context, but generated planning features should be clipped or constrained to the selected area unless the user explicitly includes adjacent areas.

### Workflow Trigger

This checkpoint should be triggered from a selected coded area, not only from a global batch command.

Trigger flow:

1. User reviews the previous checkpoint map, such as the strategy map or sensitivity capacity map.
2. User right-clicks a coded LCA area, such as `a21kd49pe2`.
3. Context menu opens.
4. User selects `Planning Workflow`.
5. The application opens the area-focused planning workspace for that coded area.
6. The selected area becomes the active planning extent.
7. The system loads all relevant local evidence.
8. The LLM generates planning maps, sub-zones, and recommendations for that selected area.

Context menu actions may include:

- Open planning workflow.
- View area assessment.
- View strategy objective.
- Generate local suitability maps.
- Edit area boundary.
- Export area report.

The user should also be able to run the workflow for multiple selected areas later, but the first version should prioritize one selected area at a time.

### Inputs

Primary inputs:

- LCA coded area layer.
- Sensitivity and capacity assessment layer.
- Strategy and management objectives layer.
- Foundational map layers.
- Terrain, slope, aspect, and elevation.
- Hydrology and flood data.
- Soil and geology.
- Vegetation and habitat.
- Settlement and infrastructure.
- Legal and planning constraints.
- Risk overlays.
- User planning goals.

Optional inputs:

- Stakeholder priorities.
- Budget or implementation priority.
- Land ownership.
- Existing access routes.
- Tourism demand.
- Agricultural productivity.
- Conservation targets.
- Restoration targets.

### Map Layer Outputs

The checkpoint should generate separate vector map layers for different planning questions.

#### Protection Map

Purpose:

- Identify areas that should be protected from damaging change.

Possible outputs:

- High conservation priority.
- Sensitive character areas.
- Protected vegetation or habitat.
- Water protection zones.
- Visual protection zones.
- Cultural landscape protection zones.

#### Restoration Map

Purpose:

- Identify areas where degraded landscape character, ecology, soil, water systems, or vegetation should be restored.

Possible outputs:

- Vegetation restoration areas.
- Soil repair areas.
- Erosion control areas.
- Riparian restoration corridors.
- Habitat reconnection areas.
- Degraded edge repair zones.

#### Development Constraint Map

Purpose:

- Identify areas unsuitable or highly constrained for built development.

Possible outputs:

- No-build zones.
- High-sensitivity zones.
- Flood-prone zones.
- Erosion-prone zones.
- Steep slope exclusion zones.
- Legal restriction zones.
- Utility conflict zones.

#### Recreation Potential Map

Purpose:

- Identify areas suitable for low-impact or controlled recreation.

Possible outputs:

- Viewpoints.
- Picnic or rest zones.
- Nature observation areas.
- Low-impact recreation corridors.
- Areas suitable for small facilities.
- Areas where recreation should be restricted.

#### Agriculture Forestry And Ecological Corridor Potential Map

Purpose:

- Identify areas suitable for production, woodland, rewilding, habitat corridors, or ecological buffers.

Possible outputs:

- Agricultural suitability zones.
- Forestry suitability zones.
- Native planting corridors.
- Habitat stepping stones.
- Ecological buffer zones.
- Biodiversity enhancement zones.

#### Water Management Map

Purpose:

- Identify areas suitable for water retention, drainage, infiltration, swales, wetlands, and flood mitigation.

Possible outputs:

- Retention basin potential.
- Rain garden zones.
- Swale corridors.
- Wetland creation zones.
- Flood storage areas.
- Drainage conflict areas.
- Irrigation support zones.

#### Access Route And Movement Potential Map

Purpose:

- Identify potential paths, walking routes, service access routes, and movement corridors.

Possible outputs:

- Walking route potential.
- Accessible slope routes.
- Service access corridors.
- View route opportunities.
- Avoidance zones.
- Connection points.

### Suitability Scoring Model

Each generated planning layer should include suitability or constraint scores.

Suggested classes:

- Very suitable.
- Suitable.
- Conditional.
- Limited suitability.
- Unsuitable.
- Insufficient evidence.

Each score should include:

- Reason.
- Evidence references.
- Confidence.
- Related LCA area ID.
- Related strategy class.
- Related sensitivity and capacity assessment.

The scoring should be explainable and editable.

### LLM Workflow

For each planning map type:

1. Read LCA coded areas.
2. Read sensitivity, capacity, and resilience results.
3. Read strategy and management objectives.
4. Read relevant foundational layers.
5. Translate map evidence through the knowledge bank.
6. Identify opportunities and constraints.
7. Generate suitability classes and rationales.
8. Propose new vector planning areas.
9. Write draft layers through the map write tool.
10. Require human review.

The LLM should return structured results keyed by both planning layer type and coded area ID.

### Area-Focused Planning Workflow

The system should allow the user to enter a detailed planning mode for one coded area.

Example:

- User selects `a21kd49pe2`.
- User zooms into the area.
- User right-clicks and selects `Planning Workflow`.
- The interface isolates the selected area from the larger project.
- The system loads all relevant evidence intersecting that area.
- The LLM generates detailed planning maps and recommendations inside that area.

Area-focused inputs:

- Selected LCA coded area ID.
- Selected area polygon.
- Local slope, aspect, elevation, soil, geology, hydrology, vegetation, land use, risk, and infrastructure evidence.
- Sensitivity and capacity assessment for the selected area.
- Strategy and management objective for the selected area.
- Adjacent area context when needed.
- User planning goal for the selected area.

Area-focused outputs:

- Local protection sub-zones.
- Local restoration sub-zones.
- Local constraint sub-zones.
- Local recreation opportunity sub-zones.
- Local water management sub-zones.
- Local access and movement suggestions.
- Local ecological corridor suggestions.
- Local planning rationale.
- Local strategy refinements.

The generated sub-zones should be stored as editable vector features linked back to the parent coded area ID.

Parent-child relationship:

- Parent area: `a21kd49pe2`.
- Child planning features: protection, restoration, water management, access, recreation, constraint, or corridor features generated inside that parent area.
- Each child feature should store the parent LCA coded area ID.
- Child features should have their own feature IDs and review status.

The LLM should explain its recommendations at the local scale. For example, it should distinguish between protecting one part of `a21kd49pe2`, restoring another part, and allowing controlled access along a specific corridor.

### Map Output Behavior

Each generated planning map should:

- Be a separate vector layer.
- Preserve links to source LCA coded area IDs.
- Store evidence references.
- Store suitability or constraint class.
- Store rationale.
- Store confidence.
- Support legend.
- Support opacity.
- Support top-view analysis.
- Support 3D terrain overlay.
- Support feature inspection.
- Support export.

The user should be able to turn each planning map on or off independently.

### Area Information Panel

When the user selects a planning area, the panel should show:

- Planning layer type.
- Related LCA coded area ID.
- Suitability or constraint class.
- Opportunity or constraint explanation.
- Strategy relationship.
- Sensitivity and capacity relationship.
- Evidence references.
- Confidence.
- Review status.
- Human notes.

### Human Review Model

Review tools:

- Accept generated planning area.
- Reject generated planning area.
- Edit boundary.
- Change suitability class.
- Edit rationale.
- Add missing evidence.
- Add expert note.
- Merge planning areas.
- Split planning area.
- Lock approved planning areas.

### MVP Scope

The first implementation should prove generation of multiple planning guidance layers.

MVP features:

- Generate protection map.
- Generate restoration map.
- Generate development constraint map.
- Generate recreation potential map.
- Generate water management map.
- Generate access route potential map.
- Store all outputs as editable vector layers.
- Recolor each map by suitability or constraint class.
- Show details in information panel.
- Allow human review and edits.
- Right-click one coded LCA area and start `Planning Workflow`.
- Select one coded LCA area as the active planning extent.
- Generate local sub-zone planning maps inside the selected area.
- Store local sub-zone features with parent coded area references.

Out of scope for the first version:

- Automated final zoning approval.
- Detailed engineering drainage design.
- Detailed construction drawings.
- Automated legal compliance sign-off.
- Cost-benefit optimization.
- Full route engineering.

### Open Decisions

- Which planning map should be generated first.
- Whether every map should be generated automatically or manually selected.
- Whether suitability scoring should be numeric, categorical, or both.
- Whether planning layers should inherit exact LCA boundaries or create new boundaries.
- How conflicts between opportunity and constraint layers should be resolved.
- Whether the system should generate a combined synthesis map in this checkpoint or the next one.

### Checkpoint 6 Acceptance Criteria

- The system can generate separate vector planning maps from LCA, sensitivity, and strategy outputs.
- The system can generate protection, restoration, constraint, recreation, water management, and access potential maps.
- The system can trigger planning workflow from a right-click context menu on a coded LCA area.
- The system can isolate the clicked coded LCA area and generate local planning sub-zones inside it.
- Each planning map stores suitability or constraint classes.
- Each local sub-zone stores its parent coded LCA area ID.
- Each planning map stores evidence, rationale, confidence, and review status.
- Users can inspect, recolor, toggle, edit, approve, or reject generated planning areas.
- Generated planning maps remain separate from the LCA, sensitivity, and strategy baseline layers.

## 7. Holistic Strategy Review And Revision

### Goal

Review all coded area-level strategy and planning outputs together before generating the Landscape Planning Framework.

This checkpoint acts as a gate between local planning work and whole-site framework generation.

### Product Concept

After every coded area has been analyzed in detail, the system should step back and evaluate the whole site.

The LLM should review all area-level outputs and identify:

- Conflicts between neighboring area strategies.
- Gaps in protection, restoration, access, or water management.
- Inconsistent strategy assignments.
- Overlapping or contradictory suitability maps.
- Missing ecological, circulation, or water connections.
- Areas where local recommendations need revision for whole-site coherence.

The output of this checkpoint is not the planning framework yet. It is a reviewed and revised set of area-level decisions that is ready to feed the framework.

### Inputs

Primary inputs:

- LCA coded area layer.
- Sensitivity and capacity assessment layer.
- Strategy and management objectives layer.
- Area-focused suitability, opportunity, and constraint maps.
- Protection, restoration, recreation, water management, access, and ecological corridor maps.
- Foundational map layers.
- Terrain and hydrology.
- User planning goals.
- Human review decisions.

### Holistic Review Questions

The system should evaluate:

- Do all coded areas have approved or draft strategy records?
- Do all selected areas have local suitability, opportunity, and constraint outputs?
- Do adjacent strategies conflict?
- Are protection zones continuous where needed?
- Are restoration priorities connected or isolated?
- Are access routes coherent across area boundaries?
- Are water management zones connected to terrain and hydrology logic?
- Are ecological corridors continuous?
- Are some areas over-programmed or under-defined?
- Do high-sensitivity areas have appropriate intervention limits?

### Conflict And Revision Model

The system should identify issues such as:

- A proposed recreation route crossing a high-protection area.
- A restoration zone disconnected from habitat corridors.
- A water management zone that ignores actual drainage direction.
- Adjacent areas with incompatible intervention intensities.
- A protected area isolated by planned access corridors.
- Overlapping use zones with contradictory objectives.

For each conflict or gap, the system should provide:

- Conflict type.
- Affected coded area IDs.
- Evidence.
- Suggested revision.
- Confidence.
- Human review status.

### Revision Workflow

Workflow:

1. Read all area-level strategy records.
2. Read all local planning sub-zone outputs.
3. Detect conflicts, gaps, and inconsistencies.
4. Generate a revision list.
5. Let the user inspect each issue.
6. Let the user accept, reject, or edit proposed revisions.
7. Apply approved revisions to draft strategy or planning layers.
8. Mark the project as ready for Landscape Planning Framework generation.

### Outputs

This checkpoint should produce:

- Holistic review report.
- Conflict and gap list.
- Revision recommendations.
- Approved revision records.
- Updated strategy and planning layer attributes where accepted.
- Readiness status for the next checkpoint.

### MVP Scope

MVP features:

- Run whole-site review after area-level planning outputs exist.
- Detect basic conflicts between local planning layers.
- Generate revision suggestions.
- Show conflicts by affected coded area IDs.
- Allow human accept, reject, or edit decisions.
- Mark framework readiness when required issues are resolved.

### Checkpoint 7 Acceptance Criteria

- The system can review all area-level strategy and planning outputs together.
- The system can detect conflicts or gaps between local area recommendations.
- The system can propose revisions before framework generation.
- Users can accept, reject, or edit revision suggestions.
- The system can mark the project as ready or not ready for Landscape Planning Framework generation.

## 8. Landscape Planning Framework

### Goal

Synthesize all area-level strategies, suitability maps, opportunity maps, and constraint maps into a coherent landscape planning framework.

This checkpoint is not detailed design. It creates the planning structure that guides later concept and masterplan decisions.

### Product Concept

After the holistic review checkpoint is complete, the system should generate the planning framework from the reviewed and revised area-level outputs.

### Inputs

Primary inputs:

- LCA coded area layer.
- Sensitivity and capacity assessment layer.
- Strategy and management objectives layer.
- Area-focused suitability, opportunity, and constraint maps.
- Protection, restoration, recreation, water management, access, and ecological corridor maps.
- Foundational map layers.
- Terrain and hydrology.
- User planning goals.
- Human review decisions.
- Holistic review readiness status.
- Approved revision records from checkpoint 7.

### Framework Components

The Landscape Planning Framework should include the following spatial systems.

#### Zoning

Purpose:

- Define broad planning zones across the site.

Possible zones:

- Conservation zone.
- Restoration zone.
- Low-intervention zone.
- Controlled recreation zone.
- Productive landscape zone.
- Water management zone.
- Ecological corridor zone.
- Development avoidance zone.
- Managed transformation zone.

#### Protection And Use Balance

Purpose:

- Clarify where the site should be protected, used, restored, or transformed.

Outputs:

- Protection priority map.
- Use intensity map.
- Conflict areas.
- Buffer areas.
- Transition areas.

#### Open Space System

Purpose:

- Organize the site's open space structure.

Outputs:

- Primary open spaces.
- Secondary open spaces.
- Edges and buffers.
- View corridors.
- Gathering or low-impact use areas.

#### Green Infrastructure

Purpose:

- Define connected ecological and landscape infrastructure.

Outputs:

- Ecological corridors.
- Habitat patches.
- Native planting structure.
- Buffer planting zones.
- Biodiversity enhancement areas.

#### Water Management

Purpose:

- Organize water retention, drainage, infiltration, and flood mitigation.

Outputs:

- Swale corridors.
- Retention areas.
- Wetland creation areas.
- Drainage paths.
- Infiltration zones.
- Flood storage areas.

#### Access And Circulation

Purpose:

- Define the movement framework without moving into detailed path design.

Outputs:

- Primary circulation corridors.
- Secondary circulation corridors.
- Service access corridors.
- Viewpoint connections.
- Restricted access areas.
- Barrier or avoidance areas.

#### Habitat Network

Purpose:

- Connect habitats and support ecological continuity.

Outputs:

- Core habitat areas.
- Linkage corridors.
- Stepping-stone habitats.
- Restoration connections.
- Fragmentation repair zones.

#### Intervention Intensity

Purpose:

- Define how much physical design intervention each area should receive.

Classes:

- No intervention.
- Conservation management only.
- Light intervention.
- Moderate intervention.
- Intensive intervention.
- Transformative intervention.

### LLM Workflow

The LLM should synthesize approved and draft planning layers into a whole-site framework.

Workflow:

1. Confirm checkpoint 7 readiness status.
2. Read reviewed coded area strategies.
3. Read reviewed local planning sub-zone outputs.
4. Read approved revision records.
5. Generate framework components.
6. Create framework vector layers.
7. Explain how each framework decision follows from area-level evidence.
8. Store outputs as reviewable planning framework layers.

### Map Outputs

The checkpoint should create a `Landscape Planning Framework` map set.

Framework map layers:

- Zoning framework.
- Protection and use balance.
- Open space system.
- Green infrastructure framework.
- Water management framework.
- Access and circulation framework.
- Habitat network framework.
- Intervention intensity framework.

Each layer should:

- Be vector-based.
- Reference source coded area IDs.
- Reference source strategy and suitability layers.
- Store rationale.
- Store evidence references.
- Store review status.
- Support opacity, legend, top-view, 3D terrain overlay, feature inspection, and export.

### Area And Framework Information Panel

When the user selects a framework feature, the panel should show:

- Framework layer type.
- Related coded area IDs.
- Planning decision.
- Rationale.
- Source strategies.
- Related constraints and opportunities.
- Conflicts resolved.
- Evidence references.
- Confidence.
- Review status.
- Human notes.

### Human Review Model

Review tools:

- Accept framework feature.
- Reject framework feature.
- Edit boundary.
- Edit framework category.
- Edit rationale.
- Resolve conflict manually.
- Add expert note.
- Lock approved framework layer.

### MVP Scope

The first implementation should prove synthesis from reviewed area-level planning into a whole-site framework.

MVP features:

- Generate zoning framework.
- Generate protection and use balance layer.
- Generate green infrastructure framework.
- Generate water management framework.
- Generate access and circulation framework.
- Generate intervention intensity framework.
- Store all outputs as editable vector layers.
- Show framework feature details in an information panel.
- Allow human review and revision.

Out of scope for the first version:

- Detailed masterplan geometry.
- Detailed planting design.
- Detailed path alignment engineering.
- Construction details.
- Cost estimation.
- Full regulatory submission package.

### Open Decisions

- Which readiness conditions from checkpoint 7 should block framework generation.
- Whether framework maps are generated all at once or one by one.
- Whether the framework should include a single combined synthesis map.
- How human review should resolve conflicts between LLM suggestions and expert judgement.

### Checkpoint 8 Acceptance Criteria

- The system can only generate the framework after holistic review readiness is available or explicitly overridden.
- The system can generate vector framework layers for zoning, protection/use balance, green infrastructure, water management, access/circulation, habitat, and intervention intensity.
- Each framework feature stores source area IDs, evidence, rationale, confidence, and review status.
- Users can inspect, edit, approve, or reject framework features.
- The planning framework remains separate from detailed concept or masterplan design.

## 9. Concept And Masterplan

### Goal

Move from landscape planning framework into landscape design.

This checkpoint translates approved planning framework layers into concept design and masterplan decisions, including planting strategy, circulation, hardscape, program distribution, and detailed area decisions.

### Product Concept

The Landscape Planning Framework defines where and how change should happen. The Concept and Masterplan checkpoint defines what the designed landscape becomes.

This is the first checkpoint where the system moves from planning intelligence into spatial design proposal.

The output should remain editable, evidence-linked, and reviewable. The system should not discard the earlier planning chain. Every design decision should trace back to framework layers, strategy objectives, sensitivity/capacity findings, and LCA character areas.

### Inputs

Primary inputs:

- Approved or draft Landscape Planning Framework layers.
- Zoning framework.
- Protection and use balance layer.
- Open space system.
- Green infrastructure framework.
- Water management framework.
- Access and circulation framework.
- Habitat network framework.
- Intervention intensity framework.
- Strategy and management objectives.
- LCA coded area layer.
- User design brief.
- Program requirements.
- Client priorities.
- Site constraints.

Optional inputs:

- Plant palette.
- Material palette.
- Budget level.
- Maintenance capacity.
- Accessibility requirements.
- Local climate adaptation goals.
- Phasing requirements.
- User groups.

### Design Systems To Generate

#### Planting Strategy

Purpose:

- Translate character, ecology, climate, soil, water, and management objectives into planting structure.

Outputs:

- Native planting zones.
- Restoration planting zones.
- Woodland or forest edge zones.
- Meadow or grassland zones.
- Riparian planting zones.
- Buffer planting zones.
- Ornamental or high-visibility planting zones.
- Low-maintenance planting zones.
- Planting character descriptions.

Each planting zone should reference:

- Soil and water conditions.
- LCA area ID.
- Strategy class.
- Habitat objective.
- Maintenance level.
- Suggested plant palette later.

#### Circulation

Purpose:

- Define primary and secondary movement based on access framework, slope, views, constraints, and program.

Outputs:

- Primary pedestrian routes.
- Secondary paths.
- Service routes.
- Accessible routes.
- Viewpoint connections.
- Restricted access edges.
- Entry points.
- Node connections.

Each route should reference:

- Slope suitability.
- Access potential layer.
- Protection conflicts.
- User group.
- Movement hierarchy.

#### Hardscape

Purpose:

- Place built landscape elements in a way that respects capacity, strategy, and intervention intensity.

Outputs:

- Paved areas.
- Decks or platforms.
- Terraces.
- Seating areas.
- Gathering spaces.
- Walls or retaining edges.
- Steps and ramps.
- Small structures.

Each hardscape feature should reference:

- Intervention intensity.
- Development constraint map.
- Drainage logic.
- Accessibility.
- Material direction.
- Maintenance implications.

#### Program Distribution

Purpose:

- Allocate uses and activities across the site without breaking landscape character or capacity.

Possible programs:

- Conservation.
- Restoration.
- Passive recreation.
- Active recreation.
- Education.
- Viewpoints.
- Agriculture.
- Forestry.
- Water management.
- Community use.
- Service and maintenance.

Each program area should reference:

- Framework zone.
- Strategy class.
- Capacity.
- Suitability.
- Conflicts.
- Priority.

#### Detailed Area Decisions

Purpose:

- Make local design decisions inside selected framework zones or coded areas.

Outputs:

- Area concept description.
- Spatial structure.
- Key design moves.
- Planting approach.
- Movement approach.
- Water approach.
- Material approach.
- Program approach.
- Constraints to respect.
- Next design tasks.

### Masterplan Map Outputs

The checkpoint should create a `Concept And Masterplan` map set.

Core layers:

- Concept zones.
- Planting strategy.
- Circulation hierarchy.
- Hardscape areas.
- Program distribution.
- Water design intent.
- Key nodes and viewpoints.
- Detailed area decision polygons.

Each layer should:

- Be vector-based.
- Reference source framework features.
- Reference source LCA coded area IDs.
- Store design rationale.
- Store evidence references.
- Store review status.
- Support opacity, legend, top-view, 3D terrain overlay, feature inspection, and export.

### LLM Workflow

The LLM should act as a design reasoning assistant, not as an uncontrolled designer.

Workflow:

1. Read approved framework layers.
2. Read user design brief and program requirements.
3. Read strategy, sensitivity, and LCA evidence.
4. Identify design opportunities and limits.
5. Generate concept alternatives where useful.
6. Propose planting strategy.
7. Propose circulation hierarchy.
8. Propose hardscape zones.
9. Propose program distribution.
10. Generate detailed area decisions.
11. Explain every proposal through evidence and framework references.
12. Write draft vector design layers.
13. Require human review.

### Concept Alternatives

The system should support multiple concept directions before committing to one masterplan.

Examples:

- Conservation-led concept.
- Recreation-led concept.
- Water-led concept.
- Habitat restoration concept.
- Productive landscape concept.
- Low-intervention concept.

Each alternative should include:

- Concept name.
- Design intent.
- Key moves.
- Tradeoffs.
- Risk notes.
- Framework compatibility.
- Required revisions.

### Area Information Panel

When the user selects a concept or masterplan feature, the panel should show:

- Feature type.
- Related framework feature.
- Related coded LCA area ID.
- Design decision.
- Rationale.
- Source strategy.
- Source suitability or constraint.
- Program.
- Planting, circulation, hardscape, or water intent.
- Confidence.
- Review status.
- Human notes.

### Human Review Model

Review tools:

- Accept design feature.
- Reject design feature.
- Edit geometry.
- Edit design intent.
- Change program.
- Change route hierarchy.
- Change planting strategy.
- Add expert note.
- Lock approved concept layer.

### MVP Scope

The first implementation should prove framework-to-concept translation.

MVP features:

- Select approved framework layers.
- Generate concept zones.
- Generate planting strategy layer.
- Generate circulation hierarchy layer.
- Generate hardscape area layer.
- Generate program distribution layer.
- Generate water design intent layer.
- Store all outputs as editable vector layers.
- Show details in information panel.
- Allow human review and edits.

Out of scope for the first version:

- Detailed planting schedules.
- Construction drawings.
- Quantity takeoff.
- Cost estimation.
- Irrigation engineering.
- Lighting design.
- Full documentation set.
- Rendering automation.

### Open Decisions

- Whether the system should generate one concept or multiple alternatives by default.
- Whether planting strategy should be species-level or typology-level in the first release.
- Whether hardscape should include materials in the first release.
- Whether circulation should support accessibility checking in the first release.
- How design brief input should be structured.
- Whether masterplan outputs should be exported to CAD/GIS formats immediately.

### Checkpoint 9 Acceptance Criteria

- The system can generate concept and masterplan layers from approved framework layers.
- The system can generate planting strategy, circulation, hardscape, program distribution, water intent, and detailed area decision layers.
- Each design feature references source framework features and coded LCA area IDs.
- Each design feature stores rationale, evidence, confidence, and review status.
- Users can inspect, edit, approve, or reject generated concept and masterplan features.
- The concept and masterplan outputs remain traceable to the full analysis and planning chain.

## 10. Hosted Deployment And Public Preview

### Goal

Publish Landschaft as a browser-accessible preview so the editor can be tested without running the local development server.

### Deployment Model

Use GitHub Pages for the static Vite frontend and deploy the MCP HTTP bridge separately, because GitHub Pages cannot run server-side MCP code.

Required pieces:

- GitHub Pages workflow for `apps/web/dist`.
- Vite project-site base path for `/Landschaft/`.
- Hosted MCP HTTP bridge on a server platform such as Render, Fly, Railway, or a VPS.
- Production `VITE_LANDSCHAFT_MCP_HTTP_URL` pointing the frontend to the hosted MCP bridge.
- CORS configuration on the MCP HTTP bridge for the GitHub Pages origin.
- Clear fallback messaging when the backend is unavailable.

### Open Decisions

- Whether the repository remains private or becomes public for GitHub Pages eligibility.
- Which platform hosts the MCP HTTP bridge.
- Whether provider raster assets should be cached in the hosted backend, object storage, or regenerated per import.
- Whether the public preview is open to everyone or protected behind access control.

### Acceptance Criteria

- The frontend is published from GitHub Pages.
- The published frontend loads static assets correctly under the `/Landschaft/` base path.
- Safe dataset import works against a hosted MCP HTTP bridge.
- The deployed app can import provider layers without requiring `localhost`.
- Deployment steps are documented and repeatable through GitHub Actions.
