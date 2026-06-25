/*
 * ---metadata---
 * type: app-source
 * description: Checkpoint 1 terrain setup controls for orthophoto and corner coordinates.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: added orthophoto terrain setup panel
 * ---end-metadata---
 */
import { ImageUp, Mountain } from "lucide-react";
import { useEditorStore } from "../state/editorStore";

export function TerrainSetupPanel() {
  const {
    generateTerrain,
    project,
    setCornerCoordinate,
    setOrthophotoPreview,
    terrain
  } = useEditorStore();

  return (
    <section className="panel terrain-setup">
      <h2>
        <Mountain size={18} />
        Terrain Base
      </h2>

      <label className="file-control">
        <ImageUp size={16} />
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

      <div className="corner-grid">
        {project.corners.map((corner) => (
          <fieldset className="corner-card" key={corner.label}>
            <legend>{corner.label}</legend>
            <label>
              <span>Lat</span>
              <input
                onChange={(event) =>
                  setCornerCoordinate(
                    corner.label,
                    "latitude",
                    Number(event.target.value)
                  )
                }
                step="0.000001"
                type="number"
                value={corner.latitude}
              />
            </label>
            <label>
              <span>Lng</span>
              <input
                onChange={(event) =>
                  setCornerCoordinate(
                    corner.label,
                    "longitude",
                    Number(event.target.value)
                  )
                }
                step="0.000001"
                type="number"
                value={corner.longitude}
              />
            </label>
          </fieldset>
        ))}
      </div>

      <button className="secondary-action" onClick={generateTerrain} type="button">
        Generate Terrain
      </button>

      <dl className="status-list">
        <div>
          <dt>Extent</dt>
          <dd>
            {project.realWorldExtentMeters.width}m x{" "}
            {project.realWorldExtentMeters.depth}m
          </dd>
        </div>
        <div>
          <dt>Accuracy</dt>
          <dd>{terrain.accuracyStatus}</dd>
        </div>
        <div>
          <dt>Elevation</dt>
          <dd>
            {terrain.minElevation.toFixed(1)}m -{" "}
            {terrain.maxElevation.toFixed(1)}m
          </dd>
        </div>
      </dl>
    </section>
  );
}
