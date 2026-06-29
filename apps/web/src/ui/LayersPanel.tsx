/*
 * ---metadata---
 * type: app-source
 * description: Collapsible Photoshop-style layer list for the Landschaft sidebar.
 * last-updated: 2026-06-28
 * last-model: codex-gpt-5
 * last-change: add delete control for removable foundational layers
 * ---end-metadata---
 */
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Grip,
  Layers,
  Map,
  MapPin,
  Pentagon,
  Route,
  Shapes,
  Trash2
} from "lucide-react";
import { useRef, useState } from "react";
import { canDeleteLayer, useEditorStore } from "../state/editorStore";

const OPACITY_OPTIONS = [100, 75, 50, 25, 10] as const;

export function LayersPanel() {
  const {
    addDrawingFeature,
    deleteLayer,
    layers,
    importGeoJsonLayer,
    importKmlLayer,
    importRasterOverlay,
    reorderLayer,
    orthophotoPreviewUrl,
    selectedLayerId,
    selectLayer,
    setLayerOpacity,
    toggleLayer
  } = useEditorStore();
  const [sectionOpen, setSectionOpen] = useState(true);
  const [draggedLayerId, setDraggedLayerId] = useState<string | null>(null);
  const [dragTargetLayerId, setDragTargetLayerId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const geoJsonInputRef = useRef<HTMLInputElement | null>(null);
  const rasterInputRef = useRef<HTMLInputElement | null>(null);
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);
  const selectedOpacity = Math.round((selectedLayer?.opacity ?? 1) * 100);

  return (
    <section className="layers-panel">
      <button
        aria-expanded={sectionOpen}
        className="section-title layers-section-title"
        onClick={() => setSectionOpen((open) => !open)}
        type="button"
      >
        <span className="section-title-leading">
          <Layers size={16} strokeWidth={1.75} />
          <span>Layers</span>
        </span>
        {sectionOpen ? (
          <ChevronUp size={15} strokeWidth={1.75} />
        ) : (
          <ChevronDown size={15} strokeWidth={1.75} />
        )}
      </button>

      {sectionOpen && layers.length > 0 ? (
        <div className="layers-panel-body">
          <div className="layer-controls">
            <div className="layer-import-actions" aria-label="Layer imports">
              <button
                aria-label="Import vector layer"
                className="layer-action-button"
                onClick={() => geoJsonInputRef.current?.click()}
                title="Import GeoJSON or KML vector layer"
                type="button"
              >
                <Shapes size={14} strokeWidth={1.75} />
                <span>Vector</span>
              </button>
              <button
                aria-label="Import raster overlay"
                className="layer-action-button"
                onClick={() => rasterInputRef.current?.click()}
                title="Import raster overlay"
                type="button"
              >
                <Map size={14} strokeWidth={1.75} />
                <span>Raster</span>
              </button>
              <input
                accept=".geojson,.json,.kml,application/geo+json,application/json,application/vnd.google-earth.kml+xml"
                className="layer-file-input"
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
                      setImportError(null);
                    })
                    .catch((error: unknown) => {
                      setImportError(
                        error instanceof Error
                          ? error.message
                          : "Vector import failed."
                      );
                    });
                  event.target.value = "";
                }}
                ref={geoJsonInputRef}
                type="file"
              />
              <input
                accept="image/*,.pgw,.jgw,.tfw,.wld"
                className="layer-file-input"
                multiple
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? []);
                  const imageFile = files.find((file) => file.type.startsWith("image/"));
                  const worldFile = files.find((file) =>
                    /\.(pgw|jgw|tfw|wld)$/i.test(file.name)
                  );

                  if (!imageFile) {
                    setImportError("Select an image file for raster import.");
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
                      setImportError(null);
                    })
                    .catch((error: unknown) => {
                      setImportError(
                        error instanceof Error
                          ? error.message
                          : "Raster import failed."
                      );
                    });
                  event.target.value = "";
                }}
                ref={rasterInputRef}
                type="file"
              />
            </div>
            <div className="layer-import-actions" aria-label="Vector drawing">
              <button
                aria-label="Create point feature"
                className="layer-action-button icon-only"
                onClick={() => addDrawingFeature("point")}
                title="Create point feature"
                type="button"
              >
                <MapPin size={14} strokeWidth={1.75} />
              </button>
              <button
                aria-label="Create line feature"
                className="layer-action-button icon-only"
                onClick={() => addDrawingFeature("line")}
                title="Create line feature"
                type="button"
              >
                <Route size={14} strokeWidth={1.75} />
              </button>
              <button
                aria-label="Create polygon feature"
                className="layer-action-button icon-only"
                onClick={() => addDrawingFeature("polygon")}
                title="Create polygon feature"
                type="button"
              >
                <Pentagon size={14} strokeWidth={1.75} />
              </button>
            </div>
            <div className="layer-control">
              <span className="layer-control-label">Blend</span>
              <button className="layer-control-dropdown" type="button">
                Normal
                <ChevronDown size={13} strokeWidth={1.75} />
              </button>
            </div>
            <div className="layer-control">
              <span className="layer-control-label">Opacity</span>
              <div className="layer-control-dropdown-wrap">
                <select
                  aria-label="Layer opacity"
                  className="layer-control-dropdown layer-control-select"
                  onChange={(event) => {
                    if (selectedLayer) {
                      setLayerOpacity(selectedLayer.id, Number(event.target.value) / 100);
                    }
                  }}
                  value={selectedOpacity}
                >
                  {OPACITY_OPTIONS.map((value) => (
                    <option key={value} value={value}>
                      {value}%
                    </option>
                  ))}
                </select>
                <ChevronDown
                  aria-hidden="true"
                  className="layer-control-select-chevron"
                  size={13}
                  strokeWidth={1.75}
                />
              </div>
            </div>
          </div>

          {importError ? <p className="layer-import-error">{importError}</p> : null}

          <div className="layer-list">
            {layers.map((layer) => (
              <article
                className={`layer-row ${selectedLayerId === layer.id ? "active" : ""} ${
                  dragTargetLayerId === layer.id ? "drag-target" : ""
                }`}
                draggable
                key={layer.id}
                onClick={() => selectLayer(layer.id)}
                onDragEnd={() => {
                  setDraggedLayerId(null);
                  setDragTargetLayerId(null);
                }}
                onDragOver={(event) => {
                  event.preventDefault();
                  setDragTargetLayerId(layer.id);
                }}
                onDragStart={() => setDraggedLayerId(layer.id)}
                onDrop={(event) => {
                  event.preventDefault();

                  if (draggedLayerId) {
                    reorderLayer(draggedLayerId, layer.id);
                  }

                  setDraggedLayerId(null);
                  setDragTargetLayerId(null);
                }}
              >
                <Grip className="drag-handle" size={14} strokeWidth={1.75} />
                <button
                  aria-label={`${layer.visible ? "Hide" : "Show"} ${layer.name}`}
                  className="visibility-button"
                  onClick={(event) => {
                    event.stopPropagation();
                    toggleLayer(layer.id);
                  }}
                  type="button"
                >
                  {layer.visible ? (
                    <Eye size={15} strokeWidth={1.75} />
                  ) : (
                    <EyeOff size={15} strokeWidth={1.75} />
                  )}
                </button>
                <div
                  className={`layer-thumbnail ${getThumbnailClass(layer.kind)}`}
                  role="presentation"
                  style={
                    layer.kind === "orthophoto" && orthophotoPreviewUrl
                      ? { backgroundImage: `url(${orthophotoPreviewUrl})` }
                      : undefined
                  }
                />
                <div className="layer-meta">
                  <strong>{layer.name}</strong>
                  <span>{getLayerTypeLabel(layer)}</span>
                </div>
                {canDeleteLayer(layer) ? (
                  <button
                    aria-label={`Delete ${layer.name}`}
                    className="layer-delete-button"
                    onClick={(event) => {
                      event.stopPropagation();
                      deleteLayer(layer.id);
                    }}
                    type="button"
                  >
                    <Trash2 size={14} strokeWidth={1.75} />
                  </button>
                ) : (
                  <span aria-hidden="true" className="layer-delete-spacer" />
                )}
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function readFileAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => {
      if (typeof reader.result === "string") {
        resolve(reader.result);
      } else {
        reject(new Error("GeoJSON file could not be read."));
      }
    });
    reader.addEventListener("error", () => {
      reject(new Error("GeoJSON file could not be read."));
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

function getLayerTypeLabel(layer: { kind: string; category?: string; geometryType?: string }) {
  if (layer.kind === "orthophoto") {
    return "Image";
  }

  if (layer.kind === "terrain") {
    return "Mesh";
  }

  if (layer.kind === "foundational-map") {
    return `${formatLabel(layer.category ?? "foundational")} / ${
      layer.geometryType ?? "mixed"
    }`;
  }

  if (layer.kind === "lca") {
    return "LCA / character area";
  }

  return layer.geometryType ?? "Vector";
}

function getThumbnailClass(kind: string) {
  if (kind === "orthophoto") {
    return "kind-orthophoto";
  }

  if (kind === "terrain") {
    return "kind-terrain";
  }

  if (kind === "foundational-map") {
    return "kind-foundational";
  }

  if (kind === "lca") {
    return "kind-lca";
  }

  return "kind-vector";
}

function formatLabel(value: string) {
  return value
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
