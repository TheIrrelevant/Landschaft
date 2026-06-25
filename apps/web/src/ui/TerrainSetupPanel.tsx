/*
 * ---metadata---
 * type: app-source
 * description: Checkpoint 1 terrain setup controls for orthophoto and corner coordinates.
 * last-updated: 2026-06-25
 * last-model: codex-gpt-5
 * last-change: redesigned terrain setup as a compact import module
 * ---end-metadata---
 */
import { ImageUp, Mountain, RefreshCw } from "lucide-react";
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
      <div className="panel-heading">
        <h2>
          <Mountain size={18} />
          Terrain Import
        </h2>
        <span>Checkpoint 1</span>
      </div>

      <label className="file-control">
        <ImageUp size={16} />
        <span>{project.sourceImageName ?? "Select orthophoto"}</span>
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

      <div className="coordinate-table">
        <div className="coordinate-row coordinate-head">
          <span>Corner</span>
          <span>Latitude</span>
          <span>Longitude</span>
        </div>
        {project.corners.map((corner) => (
          <div className="coordinate-row" key={corner.label}>
            <strong>{corner.label}</strong>
            <label>
              <span>Latitude</span>
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
              <span>Longitude</span>
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
          </div>
        ))}
      </div>

      <button className="secondary-action" onClick={generateTerrain} type="button">
        <RefreshCw size={15} />
        Generate Terrain
      </button>

      <dl className="status-list">
        <div>
          <dt>Map extent</dt>
          <dd>
            {project.realWorldExtentMeters.width}m x{" "}
            {project.realWorldExtentMeters.depth}m
          </dd>
        </div>
        <div>
          <dt>Accuracy status</dt>
          <dd>{terrain.accuracyStatus}</dd>
        </div>
        <div>
          <dt>Elevation range</dt>
          <dd>
            {terrain.minElevation.toFixed(1)}m -{" "}
            {terrain.maxElevation.toFixed(1)}m
          </dd>
        </div>
      </dl>
    </section>
  );
}
