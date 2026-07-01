/*
 * ---metadata---
 * type: app-source
 * description: Collapsible Photoshop-style layer list for the Landschaft sidebar.
 * last-updated: 2026-07-01
 * last-model: codex-gpt-5
 * last-change: show feature counts for vector provider layers
 * ---end-metadata---
 */
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Grip,
  Layers,
  Trash2
} from "lucide-react";
import { useEffect, useState } from "react";
import { canDeleteLayer, useEditorStore } from "../state/editorStore";

export function LayersPanel() {
  const {
    deleteLayer,
    layers,
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
  const selectedLayer = layers.find((layer) => layer.id === selectedLayerId);

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
            <div className="layer-control">
              <span className="layer-control-label">Blend</span>
              <button className="layer-control-dropdown" type="button">
                Normal
                <ChevronDown size={13} strokeWidth={1.75} />
              </button>
            </div>
            <div className="layer-control">
              <span className="layer-control-label">Opacity</span>
              {selectedLayer ? (
                <LayerOpacityInput
                  layerId={selectedLayer.id}
                  onChange={setLayerOpacity}
                  opacity={selectedLayer.opacity}
                />
              ) : (
                <input
                  aria-label="Layer opacity"
                  className="layer-control-opacity-input"
                  disabled
                  placeholder="—"
                  type="text"
                />
              )}
            </div>
          </div>
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


function LayerOpacityInput({
  layerId,
  onChange,
  opacity
}: {
  layerId: string;
  onChange: (layerId: string, opacity: number) => void;
  opacity: number;
}) {
  const [draft, setDraft] = useState(() => String(Math.round(opacity * 100)));

  useEffect(() => {
    setDraft(String(Math.round(opacity * 100)));
  }, [layerId, opacity]);

  const commit = (raw: string) => {
    const parsed = Number(raw);
    const value = Number.isFinite(parsed)
      ? Math.min(100, Math.max(0, Math.round(parsed)))
      : 0;

    setDraft(String(value));
    onChange(layerId, value / 100);
  };

  return (
    <div className="layer-control-opacity-wrap">
      <input
        aria-label="Layer opacity"
        className="layer-control-opacity-input"
        inputMode="numeric"
        max={100}
        min={0}
        onBlur={() => commit(draft)}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter") {
            commit(draft);
            event.currentTarget.blur();
          }
        }}
        step={1}
        type="number"
        value={draft}
      />
      <span className="layer-control-opacity-suffix">%</span>
    </div>
  );
}

function getLayerTypeLabel(layer: {
  features?: unknown[];
  kind: string;
  category?: string;
  geometryType?: string;
}) {
  if (layer.kind === "orthophoto") {
    return "Image";
  }

  if (layer.kind === "terrain") {
    return "Mesh";
  }

  if (layer.kind === "foundational-map") {
    const baseLabel = `${formatLabel(layer.category ?? "foundational")} / ${
      layer.geometryType ?? "mixed"
    }`;
    if (!layer.features || layer.geometryType === "raster") {
      return baseLabel;
    }

    return `${baseLabel} / ${layer.features.length} features`;
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
