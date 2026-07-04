/*
 * ---metadata---
 * type: app-source
 * description: Bottom-center canvas tool dock for map imports, vector drawing, and draft LCA actions.
 * last-updated: 2026-07-04
 * last-model: codex-gpt-5
 * last-change: show LCA backend fallback status
 * ---end-metadata---
 */
import { Map, MapPin, Pentagon, Route, Shapes, Sparkles } from "lucide-react";
import { useRef, useState } from "react";
import { fromArrayBuffer } from "geotiff";
import { createRasterGeoreferenceFromMapBounds } from "../geo/projectGeometry";
import { useEditorStore } from "../state/editorStore";

export function ToolDock() {
  const {
    addDrawingFeature,
    importGeoJsonLayer,
    importKmlLayer,
    importRasterOverlay,
    layers,
    lcaAnalyzing,
    lcaAnalysisError,
    project,
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
          setToolError(null);
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

      {toolError || lcaAnalysisError ? (
        <p className="tool-dock-error">{toolError ?? lcaAnalysisError}</p>
      ) : null}

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
        accept="image/*,.tif,.tiff,.pgw,.jgw,.tfw,.wld"
        className="tool-file-input"
        multiple
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          const imageFile = files.find((file) => isRasterImageFile(file));
          const worldFile = files.find((file) => /\.(pgw|jgw|tfw|wld)$/i.test(file.name));

          if (!imageFile) {
            setToolError("Select an image file for raster import.");
            event.target.value = "";
            return;
          }

          readRasterImport(imageFile, project, worldFile)
            .then(({ dimensions, previewUrl, rasterGeoreference, worldFileText }) => {
              importRasterOverlay(imageFile.name, previewUrl, {
                rasterGeoreference,
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

function isRasterImageFile(file: File) {
  return file.type.startsWith("image/") || /\.(tif|tiff)$/i.test(file.name);
}

async function readRasterImport(
  imageFile: File,
  project: ReturnType<typeof useEditorStore.getState>["project"],
  worldFile?: File
) {
  if (/\.(tif|tiff)$/i.test(imageFile.name)) {
    return readGeoTiffAsRasterImport(imageFile, project);
  }

  const [previewUrl, dimensions, worldFileText] = await Promise.all([
    readFileAsDataUrl(imageFile),
    readImageDimensions(imageFile),
    worldFile ? readFileAsText(worldFile) : Promise.resolve(undefined)
  ]);

  return { dimensions, previewUrl, rasterGeoreference: undefined, worldFileText };
}

async function readGeoTiffAsRasterImport(
  file: File,
  project: ReturnType<typeof useEditorStore.getState>["project"]
) {
  const arrayBuffer = await file.arrayBuffer();
  const tiff = await fromArrayBuffer(arrayBuffer);
  const image = await tiff.getImage();
  const width = image.getWidth();
  const height = image.getHeight();
  const data = await image.readRasters({ interleave: true, samples: [0] });
  const { max, min } = getFiniteRasterRange(data as ArrayLike<number>);
  const range = Math.max(max - min, 1);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("GeoTIFF preview could not be created.");
  }

  const imageData = context.createImageData(width, height);
  for (let index = 0; index < width * height; index += 1) {
    const value = Number((data as ArrayLike<number>)[index] ?? min);
    const tone = Number.isFinite(value)
      ? Math.round(((value - min) / range) * 255)
      : 0;
    const offset = index * 4;
    imageData.data[offset] = tone;
    imageData.data[offset + 1] = tone;
    imageData.data[offset + 2] = tone;
    imageData.data[offset + 3] = 255;
  }
  context.putImageData(imageData, 0, 0);

  const bounds = image.getBoundingBox();
  const rasterGeoreference =
    bounds.length === 4 && bounds.every(Number.isFinite)
      ? createRasterGeoreferenceFromMapBounds(
          bounds as [number, number, number, number],
          width,
          height,
          project
        )
      : undefined;

  return {
    dimensions: { width, height },
    previewUrl: await canvasToPngObjectUrl(canvas),
    rasterGeoreference,
    worldFileText: undefined
  };
}

function canvasToPngObjectUrl(canvas: HTMLCanvasElement) {
  return new Promise<string>((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error("GeoTIFF preview could not be encoded."));
        return;
      }

      resolve(URL.createObjectURL(blob));
    }, "image/png");
  });
}

function getFiniteRasterRange(data: ArrayLike<number>) {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;

  for (let index = 0; index < data.length; index += 1) {
    const value = Number(data[index]);
    if (!Number.isFinite(value)) {
      continue;
    }

    min = Math.min(min, value);
    max = Math.max(max, value);
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }

  return { min, max };
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
