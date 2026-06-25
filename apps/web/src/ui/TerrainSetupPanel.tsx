/*
 * ---metadata---
 * type: app-source
 * description: Upload-first orthophoto setup with sequential corner coordinate prompts.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: replaced coordinate table with sequential upload-driven prompts
 * ---end-metadata---
 */
import { ImageUp, Mountain, RefreshCw } from "lucide-react";
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
  const activeCorner =
    coordinateStep !== null && coordinateStep < project.corners.length
      ? project.corners[coordinateStep]
      : null;
  const activeStep = coordinateStep ?? 0;

  return (
    <section className="terrain-setup">
      <h2>
        <Mountain size={16} />
        Orthophoto
      </h2>

      <label className="file-control">
        <ImageUp size={15} />
        <span>{project.sourceImageName ?? "Upload orthophoto"}</span>
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

      {activeCorner ? (
        <div className="coordinate-step">
          <div className="step-header">
            <span>
              {activeStep + 1}/{project.corners.length}
            </span>
            <strong>{getCornerName(activeCorner.label)}</strong>
          </div>
          <div className="coordinate-fields">
            <label>
              Latitude
              <input
                onChange={(event) =>
                  setCornerCoordinate(
                    activeCorner.label,
                    "latitude",
                    Number(event.target.value)
                  )
                }
                step="0.000001"
                type="number"
                value={activeCorner.latitude}
              />
            </label>
            <label>
              Longitude
              <input
                onChange={(event) =>
                  setCornerCoordinate(
                    activeCorner.label,
                    "longitude",
                    Number(event.target.value)
                  )
                }
                step="0.000001"
                type="number"
                value={activeCorner.longitude}
              />
            </label>
          </div>
          <button
            className="secondary-action"
            onClick={
              activeStep === project.corners.length - 1
                ? generateTerrain
                : advanceCoordinateStep
            }
            type="button"
          >
            <RefreshCw size={13} />
            {activeStep === project.corners.length - 1
              ? "Generate terrain"
              : "Next coordinate"}
          </button>
        </div>
      ) : (
        <p className="upload-note">
          After upload, coordinates are requested from top-left clockwise.
        </p>
      )}

      {coordinateStep === project.corners.length ? (
        <div className="terrain-summary">
          <span>{project.realWorldExtentMeters.width}m</span>
          <span>{project.realWorldExtentMeters.depth}m</span>
          <span>external-dem</span>
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
