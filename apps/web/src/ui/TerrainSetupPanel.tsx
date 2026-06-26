/*
 * ---metadata---
 * type: app-source
 * description: Upload-first orthophoto setup with sequential corner coordinate prompts.
 * last-updated: 2026-06-25
 * last-model: cursor-composer
 * last-change: v3 orthophoto section layout with collapsible header and coordinate card
 * ---end-metadata---
 */
import { ChevronDown, ChevronUp, CloudUpload, Image } from "lucide-react";
import { useState } from "react";
import { useEditorStore } from "../state/editorStore";

export function TerrainSetupPanel() {
  const {
    advanceCoordinateStep,
    coordinateStep,
    generateTerrain,
    project,
    setCornerCoordinate,
    setOrthophotoPreview
  } = useEditorStore();
  const [sectionOpen, setSectionOpen] = useState(true);
  const activeCorner =
    coordinateStep !== null && coordinateStep < project.corners.length
      ? project.corners[coordinateStep]
      : null;
  const activeStep = coordinateStep ?? 0;
  const isLastStep = activeStep === project.corners.length - 1;
  const coordinatesComplete = coordinateStep === project.corners.length;

  return (
    <section className="terrain-setup">
      <button
        aria-expanded={sectionOpen}
        className="section-title"
        onClick={() => setSectionOpen((open) => !open)}
        type="button"
      >
        <span className="section-title-leading">
          <Image size={16} strokeWidth={1.75} />
          <span>Orthophoto</span>
        </span>
        {sectionOpen ? (
          <ChevronUp size={15} strokeWidth={1.75} />
        ) : (
          <ChevronDown size={15} strokeWidth={1.75} />
        )}
      </button>

      {sectionOpen ? (
        <div className="terrain-setup-body">
          <label className="file-control">
            <CloudUpload size={26} strokeWidth={1.5} />
            <strong>{project.sourceImageName ?? "Upload orthophoto"}</strong>
            <span>Drag &amp; drop or click to browse</span>
            <input
              accept="image/*"
              onChange={(event) => {
                const file = event.target.files?.[0];

                if (file) {
                  setOrthophotoPreview(file.name, URL.createObjectURL(file));
                }
              }}
              type="file"
            />
          </label>

          <p className="upload-note">
            After upload, coordinates are requested from top-left clockwise.
          </p>

          <div className={`coordinate-step ${activeCorner ? "" : "disabled"}`}>
            <span className="step-badge">
              {activeCorner ? `${activeStep + 1} of ${project.corners.length}` : "1 of 4"}
            </span>
            <p className="step-label">
              {activeCorner ? getCornerName(activeCorner.label) : "Top-left coordinate"}
            </p>
            <div className="coordinate-fields">
              <input
                disabled={!activeCorner}
                onChange={(event) => {
                  if (!activeCorner) {
                    return;
                  }

                  setCornerCoordinate(
                    activeCorner.label,
                    "latitude",
                    Number(event.target.value)
                  );
                }}
                placeholder="Latitude"
                step="0.000001"
                type="number"
                value={activeCorner ? activeCorner.latitude || "" : ""}
              />
              <input
                disabled={!activeCorner}
                onChange={(event) => {
                  if (!activeCorner) {
                    return;
                  }

                  setCornerCoordinate(
                    activeCorner.label,
                    "longitude",
                    Number(event.target.value)
                  );
                }}
                placeholder="Longitude"
                step="0.000001"
                type="number"
                value={activeCorner ? activeCorner.longitude || "" : ""}
              />
            </div>
            <button
              className="secondary-action"
              disabled={!activeCorner}
              onClick={
                activeCorner
                  ? isLastStep
                    ? generateTerrain
                    : advanceCoordinateStep
                  : undefined
              }
              type="button"
            >
              {activeCorner && isLastStep ? "Generate terrain" : "Next"}
              <span aria-hidden="true">→</span>
            </button>
          </div>

          {coordinatesComplete ? (
            <div className="terrain-summary">
              <span>{project.realWorldExtentMeters.width}m</span>
              <span>{project.realWorldExtentMeters.depth}m</span>
              <span>external-dem</span>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function getCornerName(label: string) {
  switch (label) {
    case "NW":
      return "Top-left coordinate";
    case "NE":
      return "Top-right coordinate";
    case "SE":
      return "Bottom-right coordinate";
    case "SW":
      return "Bottom-left coordinate";
    default:
      return "Coordinate";
  }
}
