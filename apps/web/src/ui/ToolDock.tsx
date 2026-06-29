/*
 * ---metadata---
 * type: app-source
 * description: Bottom-center canvas tool dock for map imports, vector drawing, and draft LCA actions.
 * last-updated: 2026-06-29
 * last-model: codex-gpt-5
 * last-change: add bottom tool dock for data and analysis actions
 * ---end-metadata---
 */
import { Map, MapPin, Pentagon, Route, Shapes, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { useEditorStore } from "../state/editorStore";

export function ToolDock() {
  const {
    addDrawingFeature,
    importGeoJsonLayer,
    importKmlLayer,
    importRasterOverlay,
    layers,
    lcaAnalyzing,
    runLcaDraftAnalysis,
    terrainGenerated
  } = useEditorStore();
  const [toolError, setToolError] = useState<string | null>(null);
  const vectorInputRef = useRef<HTMLInputElement | null>(null);
  const rasterInputRef = useRef<HTMLInputElement | null>(null);
  const hasLcaInputs = layers.some(
    (layer) => layer.kind === "foundational-map" && layer.id !== "project-boundary"
  );

  return (
    <div className="tool-dock" aria-label="Map tools">
      <div className="tool-dock-group">
        <button
          aria-label="Import vector layer"
          className="tool-dock-button"
          onClick={() => vectorInputRef.current?.click()}
          title="Import GeoJSON or KML"
          type="button"
        >
          <Shapes size={18} strokeWidth={1.75} />
        </button>
        <button
          aria-label="Import raster overlay"
          className="tool-dock-button"
          onClick={() => rasterInputRef.current?.click()}
          title="Import raster overlay"
          type="button"
        >
          <Map size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="tool-dock-separator" />

      <div className="tool-dock-group">
        <button
          aria-label="Create point feature"
          className="tool-dock-button"
          onClick={() => addDrawingFeature("point")}
          title="Create point"
          type="button"
        >
          <MapPin size={18} strokeWidth={1.75} />
        </button>
        <button
          aria-label="Create line feature"
          className="tool-dock-button"
          onClick={() => addDrawingFeature("line")}
          title="Create line"
          type="button"
        >
          <Route size={18} strokeWidth={1.75} />
        </button>
        <button
          aria-label="Create polygon feature"
          className="tool-dock-button"
          onClick={() => addDrawingFeature("polygon")}
          title="Create polygon"
          type="button"
        >
          <Pentagon size={18} strokeWidth={1.75} />
        </button>
      </div>

      <div className="tool-dock-separator" />

      <button
        aria-label="Run draft LCA analysis"
        className="tool-dock-button"
        disabled={!terrainGenerated || !hasLcaInputs || lcaAnalyzing}
        onClick={() => {
          runLcaDraftAnalysis().catch((error: unknown) => {
            setToolError(
              error instanceof Error ? error.message : "LCA analysis failed."
            );
          });
        }}
        title="Run draft LCA analysis"
        type="button"
      >
        <Sparkles size={18} strokeWidth={1.75} />
      </button>

      {toolError ? <p className="tool-dock-error">{toolError}</p> : null}

      <input
        accept=".geojson,.json,.kml,application/geo+json,application/json,application/vnd.google-earth.kml+xml"
        className="tool-file-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) {
            return;
          }

          readFileAsText(file)
            .then((fileText) => {
              if (file.name.toLowerCase().endsWith(".kml")) {
                importKmlLayer(file.name, fileText);
              } else {
                importGeoJsonLayer(file.name, fileText);
              }
              setToolError(null);
            })
            .catch((error: unknown) => {
              setToolError(
                error instanceof Error ? error.message : "Vector import failed."
              );
            });
          event.target.value = "";
        }}
        ref={vectorInputRef}
        type="file"
      />
      <input
        accept="image/*,.pgw,.jgw,.tfw,.wld"
        className="tool-file-input"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          const imageFile = files.find((file) => file.type.startsWith("image/"));
          const worldFile = files.find((file) => /\.(pgw|jgw|tfw|wld)$/i.test(file.name));

          if (!imageFile) {
            setToolError("Select an image file for raster import.");
            event.target.value = "";
            return;
          }

          Promise.all([
            readFileAsDataUrl(imageFile),
            readImageDimensions(imageFile),
            worldFile ? readFileAsText(worldFile) : Promise.resolve(undefined)
          ])
            .then(([previewUrl, dimensions, worldFileText]) => {
              importRasterOverlay(imageFile.name, previewUrl, {
                worldFileText,
                imageWidthPixels: dimensions.width,
                imageHeightPixels: dimensions.height
              });
              setToolError(null);
            })
            .catch((error: unknown) => {
              setToolError(
                error instanceof Error ? error.message : "Raster import failed."
              );
            });
          event.target.value = "";
        }}
        ref={rasterInputRef}
        type="file"
      />
    </div>
  );
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("File could not be read."));
      }
    });
    reader.addEventListener("error", () => {
      reject(new Error("File could not be read."));
    });
    reader.readAsText(file);
  });
}

function readImageDimensions(file: File) {
  return new Promise<{ width: number; height: number }>((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.addEventListener("load", () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
      URL.revokeObjectURL(objectUrl);
    });
    image.addEventListener("error", () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Raster dimensions could not be read."));
    });
    image.src = objectUrl;
  });
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("Raster preview could not be read."));
      }
    });
    reader.addEventListener("error", () => {
      reject(new Error("Raster preview could not be read."));
    });
    reader.readAsDataURL(file);
  });
}
