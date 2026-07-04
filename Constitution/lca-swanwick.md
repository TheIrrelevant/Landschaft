---
type: constitution
description: Landscape Character Assessment constitution based on Carys Swanwick (2002) guidance and Natural England (2014) continuity.
last-updated: 2026-07-04
last-model: composer-2.5
last-change: document DeepSeek constitution prompt integration
---

# Landscape Character Assessment Constitution

**Authority:** Carys Swanwick, *Landscape Character Assessment: Guidance for England and Scotland* (Countryside Agency and Scottish Natural Heritage, 2002).

**Continuity:** Natural England, *An Approach to Landscape Character Assessment* (2014) — retains the same four-step iterative process and principles.

**Legal context:** Council of Europe *European Landscape Convention* (2000) — landscape character is a public interest resource requiring identification, description, and protection.

This document is the Landschaft constitution for LCA workflows. All LCA prompts, evidence models, UI copy, and review gates in Landschaft must align with this methodology unless the user explicitly overrides it.

---

## 1. What LCA is

Landscape Character Assessment (LCA) is a **framework for understanding and describing landscape character**. It is not a judgement about landscape quality, sensitivity, or capacity for change.

LCA provides:

- A **spatial framework** (map of character types and areas).
- **Written descriptions** of what makes each type and area distinctive.
- An **evidence base** for later planning, design, and management work.

LCA deliberately **separates description from judgement**. Forces for change, sensitivity, capacity, and strategy are subsequent exercises that build on — but do not replace — the LCA baseline.

---

## 2. Five key principles

Every Landschaft LCA operation must respect these principles from the 2002 guidance.

| # | Principle | Requirement |
| --- | --- | --- |
| 1 | **Landscape is everywhere** | Urban, suburban, rural, and coastal landscapes are all in scope. Do not treat LCA as countryside-only. |
| 2 | **All scales** | LCA can be carried out from national to site scale. The scale must match the stated purpose. |
| 3 | **Perceptual and experiential** | Character includes how landscape is experienced — scale, enclosure, tranquillity, wildness — not only mapable physical attributes. |
| 4 | **Evidence base** | Conclusions must be traceable to desk study, field survey, and/or stakeholder input. Professional judgement is required but must be transparent and auditable. |
| 5 | **Integrating framework** | LCA synthesises natural, cultural, and perceptual factors into a coherent character description. It is not a single-discipline inventory. |

---

## 3. The four-step iterative process

LCA is a **four-step iterative process**. Steps are not strictly linear: field findings may require revisiting desk study, and classification may expose gaps that send the analyst back to the field.

```
┌─────────────────────────────────────────────────────────────┐
│  Step 1: Define purpose and scope (Brief)                   │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 2: Desk study                                         │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 3: Field survey                                       │
└──────────────────────────┬──────────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────────┐
│  Step 4: Classification and description                     │
└──────────────────────────┬──────────────────────────────────┘
                           │
              ◄── iterate back to Steps 2–3 as needed ──►
```

---

## 4. Step 1 — Define purpose and scope (Brief)

### 4.1 Purpose

Before any data work begins, the analyst must define **why** the assessment is being carried out and **who** will use it.

Typical purposes include:

- Informing development plan policy.
- Supporting Environmental Impact Assessment.
- Guiding landscape design for forestry, housing, or infrastructure.
- Establishing a baseline for monitoring landscape change.
- Supporting community-led local landscape character work.

### 4.2 Scope decisions

The Brief must record:

| Decision | Options / notes |
| --- | --- |
| **Geographic extent** | Study area boundary; relationship to adjacent assessments. |
| **Scale of assessment** | Broad (national/regional), intermediate (county/district/park), or local/site. |
| **Level of detail** | Types only, types + areas, or areas only. |
| **Outputs required** | Map, written descriptions, photographs, GIS layers, stakeholder report. |
| **Resources and timetable** | Desk vs field balance; stakeholder involvement level. |
| **Relationship to existing LCAs** | Build on, refine, or reconcile with prior assessments. |

### 4.3 Landschaft checkpoint

In Landschaft, Step 1 corresponds to the **LCA analysis mode configuration**: project extent, stated purpose, analysis scale/quality, and selected input layers. No classification may be presented as final without an explicit Brief.

---

## 5. Step 2 — Desk study

The desk study assembles and analyses **existing information** to produce a **first-draft classification** and to plan field survey.

### 5.1 Information sources

Desk study draws on:

- Maps (topographic, geological, soils, land cover, historic, settlement).
- Aerial photography and satellite imagery.
- Historic maps and landscape history.
- Statutory and non-statutory designations.
- Previous landscape, ecological, and archaeological surveys.
- Planning policy and development frameworks.
- Published LCAs at broader or finer scales.
- Stakeholder and community knowledge (where available at desk stage).

### 5.2 Factor categories

Desk study examines the interaction of **natural**, **cultural**, and **perceptual** factors. The following attribute groups are used in the 2002 guidance.

#### Natural factors

| Factor group | Examples |
| --- | --- |
| Geology and geomorphology | Bedrock, superficial deposits, landform type, slope, elevation |
| Soils and drainage | Soil associations, hydrology, wetland patterns |
| Land cover and vegetation | Woodland, grassland, heath, arable, scrub |
| Water bodies | Rivers, lakes, coast, estuaries |

#### Cultural / historical factors

| Factor group | Examples |
| --- | --- |
| Historic land use | Enclosure patterns, field systems, common land |
| Settlement pattern | Dispersed, nucleated, linear, urban fringe |
| Built form | Vernacular architecture, farmsteads, industrial legacy |
| Boundaries and enclosures | Hedgerows, walls, fences, ditches |
| Trees and woodland | Ancient woodland, parkland, hedgerow trees |
| Transport and infrastructure | Roads, railways, canals, pylons |
| Designed landscapes | Parks, gardens, designed vistas |

#### Perceptual factors (limited at desk stage)

Desk study can infer some perceptual qualities from map patterns (e.g. openness from land cover and topography) but **cannot fully substitute for field survey**. Perceptual factors are developed primarily in Step 3.

### 5.3 Desk study outputs

1. **Compiled data layers** — collated map overlays and attribute tables.
2. **Draft landscape character types** — generic, relatively homogeneous character units.
3. **Draft landscape character areas** — geographically distinct instances of types.
4. **Draft boundary map** — zones of transition identified; boundaries are provisional.
5. **Field survey plan** — routes, survey points, gaps requiring ground verification.
6. **Annotated maps and notes** — questions for field resolution.

### 5.4 GIS role at desk study

GIS supports:

- Overlay and comparison of attribute layers.
- Pattern recognition for homogeneous areas.
- Draft boundary delineation.

**GIS output is not a substitute for professional judgement.** Automated classification may inform but must not replace analyst review and field verification.

### 5.5 Landschaft checkpoint

In Landschaft, Step 2 corresponds to **foundational layer import and map evidence assembly**: geology, soils, land cover, hydrography, contours/DEM, structures, transportation, and other SAFE dataset layers clipped to project extent. Evidence matching and dominant-theme scoring support desk-study synthesis; they do not constitute completed LCA without Steps 3–4.

---

## 6. Step 3 — Field survey

Field survey **verifies, refines, and enriches** desk study findings. It is essential for perceptual and experiential dimensions.

### 6.1 Objectives

- Observe how desk-study factors appear and interact on the ground.
- Confirm or revise draft boundaries.
- Record aesthetic and perceptual character systematically.
- Capture photographs and annotated sketches at numbered survey points.
- Assess intervisibility and relationship to surrounding landscapes.

### 6.2 Survey approach

| Rule | Detail |
| --- | --- |
| **Systematic coverage** | Whole study area covered; not only scenic viewpoints. |
| **Orientation survey first** | Rapid traverse of all draft types/areas before detailed recording. |
| **Survey points** | Minimum ~3 points per discrete draft area (more for large or complex areas). |
| **Accessibility** | Points must be publicly accessible and firmly within the character unit. |
| **Context** | Record views in and out; adjacent landscapes and setting matter. |
| **High viewpoints** | Useful for orientation and overview; not sufficient alone. |

### 6.3 Field survey records

Each survey point should produce:

- **Field Survey Sheet** — structured record of factors at that location.
- **Photographs** — numbered, located, referenced on maps; typical character, not only best views.
- **Annotated maps** — routes, points, boundary refinements, notable elements.
- **GPS / GIS layer** (optional) — with hard-copy backup.

### 6.4 Aesthetic factors (field)

Recorded through professionally informed judgement using descriptive scales:

| Factor | Example scale |
| --- | --- |
| Scale | Intimate → small → large → vast |
| Enclosure | Tight → enclosed → open → exposed |
| Diversity | Uniform → simple → diverse → complex |
| Texture | Smooth → textured → rough → very rough |
| Form | Vertical → sloping → rolling → horizontal |
| Line | Straight → angular → curved → sinuous |
| Colour | Monochrome → muted → colourful → garish |
| Balance | Harmonious → balanced → discordant → chaotic |
| Movement | Dead → still → calm → busy |
| Pattern | Random → organised → regular → formal |

Descriptions must state **which elements contribute** to each aesthetic quality (e.g. enclosure from woodland vs landform vs buildings).

### 6.5 Perceptual / experiential factors (field)

| Factor | Example scale |
| --- | --- |
| Security | Safe → unsettling → disturbing → threatening |
| Stimuli | Monotonous → interesting → challenging → inspiring |
| Tranquillity | Still → very busy |
| Movement | Tranquil → vibrant |
| Naturalness | Natural → tamed → managed → artificial |
| Noise | Quiet → distant → intermittent → loud |

These are partially subjective. Record with professional judgement; stakeholder input can supplement but not replace systematic survey.

### 6.6 Reviewing desk study in the field

Field work must explicitly:

1. Compare ground experience to desk-study maps and notes.
2. Adjust draft boundaries where transitions do not match map-derived zones.
3. Flag factors more or less important than desk study suggested.
4. Note where further desk study is required — **desk and field are iterative**.

### 6.7 Stakeholder involvement in field study

For professional assessments, stakeholder field involvement is limited by consistency requirements. Appropriate mechanisms:

- Joint orientation day with client and surveyors.
- Volunteer survey training for community-led assessments.
- Local photographers for feature documentation.
- Stakeholder review event after draft characterisation.

Local knowledge and sense-of-place associations must be **attributed** when incorporated.

### 6.8 Landschaft checkpoint

In Landschaft, Step 3 is **not yet fully automated**. Current draft analysis may synthesise map evidence and knowledge-bank entries as a **desk-plus-proxy** step. Any output without ground survey must be labelled **draft / needs field verification** and must not claim survey-grade LCA.

---

## 7. Step 4 — Classification and description

### 7.1 Core concepts: types vs areas

| Concept | Definition |
| --- | --- |
| **Landscape Character Type (LCT)** | A distinct, relatively homogeneous character class. Generic — may recur in multiple locations. Defined by recurring combinations of geology, landform, drainage, vegetation, historic land use, and settlement pattern. |
| **Landscape Character Area (LCA)** | A unique geographic instance where a type occurs. Shares generic type characteristics but has local distinctiveness and sense of place. |

**Usage rules:**

- Most assessments identify **both** types and areas: type description for generic character; area description for local distinctiveness.
- **Types only** — acceptable when resources are limited; limits local policy use.
- **Areas only** — when local distinctiveness dominates and types add little value.
- Terms must be used correctly; types and areas sit at different levels of a national-to-local hierarchy.

### 7.2 Classification at different scales

| Scale | Typical mapping scale | Characteristics |
| --- | --- | --- |
| **Broad** (national/regional) | 1:250,000 (sometimes 1:50,000) | Wide transition zones; strategic context; often desk-heavy |
| **Intermediate** (county/district/park/AONB) | 1:50,000 or 1:25,000 | Refines broad assessment; balances desk and field |
| **Local / site** | 1:10,000 or larger | Resource-intensive; design and EIA detail; community-led LLCA |

**Hierarchy rules:**

- Finer assessments should sit within broader context.
- Boundary differences between scales are expected (broad boundaries may be miles wide).
- Reasons for boundary differences must be documented when reconciling assessments.
- Amalgamation of finer types into broader units must be explicit and justified.

### 7.3 Classification process

1. **Review all evidence** — desk study, field sheets, photographs, stakeholder input.
2. **Identify consistent attribute patterns** — combinations that define homogeneous character.
3. **Define types** — group areas with similar character; name and map them.
4. **Define areas** — delineate unique geographic units; assign to types.
5. **Draw boundaries** — on the ground logic; zones of transition, not arbitrary GIS edges.
6. **Write descriptions** — factual, objective, integrating natural, cultural, and perceptual factors.

### 7.4 Description content

Each type and area description should cover:

- **Physical character** — landform, geology, soils, hydrology, land cover.
- **Cultural character** — settlement, enclosure, built form, historic features, trees.
- **Perceptual character** — scale, enclosure, tranquillity, naturalness, key views.
- **Local distinctiveness** (areas) — what makes this instance different from other areas of the same type.
- **Context** — relationship to surrounding landscapes.

Descriptions are **factual and objective**. They do not include recommendations, sensitivity ratings, or development judgements.

### 7.5 Quality requirements

Classification and description must be:

1. **Consistent** — same criteria applied across the study area.
2. **Rigorous** — evidence-led, not impressionistic alone.
3. **Transparent** — methods and sources available to users.
4. **Auditable** — traceable from description back to desk and field evidence.
5. **Professionally judged** — GIS and automation inform; analysts decide.

### 7.6 Landschaft checkpoint

In Landschaft, Step 4 corresponds to **generated LCA vector layers**: character areas as features with coded anatomy, confidence, evidence citations, and written descriptions. Draft outputs remain `needs-review` until a human analyst validates classification against this constitution.

---

## 8. Outputs and what LCA is not

### 8.1 LCA outputs

| Output | Description |
| --- | --- |
| LCA map | Types and/or areas with boundaries |
| Written descriptions | Per type and/or per area |
| Photographs and illustrations | Referenced to survey points |
| GIS layers | Spatial framework for downstream use |
| Method statement | Brief, sources, iteration log |

### 8.2 Explicitly outside LCA

The following are **separate exercises** that use LCA as input:

- Forces for change analysis.
- Landscape sensitivity assessment.
- Landscape capacity assessment.
- Landscape strategy and management objectives.
- Suitability, opportunity, and constraint mapping.
- Visual impact assessment (may draw on LCA but is not LCA).

Landschaft must not conflate these with LCA in a single undifferentiated "analysis result."

---

## 9. Factor checklist for Landschaft evidence model

When building or validating map evidence and knowledge-bank entries, ensure coverage across:

### Natural

- [ ] Geology / geomorphology
- [ ] Landform and topography
- [ ] Soils
- [ ] Hydrology / hydrography
- [ ] Land cover / vegetation

### Cultural / historical

- [ ] Historic land use and field patterns
- [ ] Settlement pattern
- [ ] Built form and structures
- [ ] Enclosure and boundaries
- [ ] Woodland and trees
- [ ] Transport and infrastructure

### Perceptual (field or proxy — always flagged)

- [ ] Scale and enclosure
- [ ] Diversity and pattern
- [ ] Tranquillity / noise / movement
- [ ] Naturalness
- [ ] Key views and intervisibility

---

## 10. References

| Source | URL / citation |
| --- | --- |
| Swanwick (2002) — *Landscape Character Assessment: Guidance for England and Scotland* | [Natural England publication](https://publications.naturalengland.org.uk/publication/640500) |
| Natural England (2014) — *An Approach to Landscape Character Assessment* | [NE574 guidance](https://publications.naturalengland.org.uk/publication/4864438404956160) |
| European Landscape Convention (2000) | [Council of Europe](https://www.coe.int/en/web/landscape) |

---

## 11. Implementation status in Landschaft

| Swanwick step | Landschaft status |
| --- | --- |
| Step 1 — Brief | Partial — LCA analysis mode captures purpose, quality, layers |
| Step 2 — Desk study | Partial — SAFE dataset import, map evidence, knowledge bank |
| Step 3 — Field survey | Not implemented — outputs must be marked draft |
| Step 4 — Classification | Partial — DeepSeek reads this constitution, analyzes evidence, writes a new LCA layer |

**Runtime integration:** MCP `lca_analyze` loads this file and sends it to DeepSeek in the system prompt before map evidence. Each successful analysis creates a new `kind: "lca"` layer with `needs-review` status.
