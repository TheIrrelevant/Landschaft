/*
 * ---metadata---
 * type: app-source
 * description: Collapsible Photoshop-style layer list for the Landschaft sidebar.
 * last-updated: 2026-06-28
 * last-model: codex-gpt-5
 * last-change: show orthophoto image content in its layer thumbnail
 * ---end-metadata---
 */
import {
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  Grip,
  Layers
} from "lucide-react";
import { useState } from "react";
import { useEditorStore } from "../state/editorStore";

const OPACITY_OPTIONS = [100, 75, 50, 25, 10] as const;

export function LayersPanel() {
  const {
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
                  <span>{getLayerTypeLabel(layer.kind)}</span>
                </div>
              </article>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getLayerTypeLabel(kind: string) {
  if (kind === "orthophoto") {
    return "Image";
  }

  if (kind === "terrain") {
    return "Mesh";
  }

  return "Vector";
}

function getThumbnailClass(kind: string) {
  if (kind === "orthophoto") {
    return "kind-orthophoto";
  }

  if (kind === "terrain") {
    return "kind-terrain";
  }

  return "kind-vector";
}
