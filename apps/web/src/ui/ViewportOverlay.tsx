/*
 * ---metadata---
 * type: app-source
 * description: Top-right viewport overlay with live FPS and view scale control.
 * last-updated: 2026-06-28
 * last-model: codex-gpt-5
 * last-change: show hovered vector feature inspection summary
 * ---end-metadata---
 */
import { useEffect, useRef, useState } from "react";
import { useEditorStore } from "../state/editorStore";

function useFps() {
  const [fps, setFps] = useState(0);

  useEffect(() => {
    let frameId = 0;
    let frames = 0;
    let last = performance.now();

    const tick = () => {
      frames += 1;
      const now = performance.now();
      if (now - last >= 500) {
        setFps(Math.round((frames * 1000) / (now - last)));
        frames = 0;
        last = now;
      }
      frameId = requestAnimationFrame(tick);
    };

    frameId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frameId);
  }, []);

  return fps;
}

export function ViewportOverlay() {
  const fps = useFps();
  const hoveredFeatureId = useEditorStore((state) => state.hoveredFeatureId);
  const hoveredLayerId = useEditorStore((state) => state.hoveredLayerId);
  const layers = useEditorStore((state) => state.layers);
  const viewScaleMode = useEditorStore((state) => state.viewScaleMode);
  const setViewScaleMode = useEditorStore((state) => state.setViewScaleMode);
  const fpsRef = useRef(fps);
  fpsRef.current = fps;
  const hoveredLayer = layers.find((layer) => layer.id === hoveredLayerId);
  const hoveredFeature = hoveredLayer?.features?.find(
    (feature) => feature.id === hoveredFeatureId
  );

  return (
    <div className="viewport-overlay">
      {hoveredFeature ? (
        <div className="viewport-feature">
          <span className="viewport-stat-label">Feature</span>
          <strong>{hoveredFeature.label}</strong>
          <small>{hoveredFeature.geometryType}</small>
        </div>
      ) : null}
      <div className="viewport-stat">
        <span className="viewport-stat-label">FPS</span>
        <span className="viewport-stat-value">{fps}</span>
      </div>
      <div className="viewport-scale" role="group" aria-label="View scale">
        <span className="viewport-stat-label">Scale</span>
        <button
          aria-pressed={viewScaleMode === "fit"}
          className={viewScaleMode === "fit" ? "active" : ""}
          onClick={() => setViewScaleMode("fit")}
          type="button"
        >
          Fit
        </button>
        <button
          aria-pressed={viewScaleMode === "1:1"}
          className={viewScaleMode === "1:1" ? "active" : ""}
          onClick={() => setViewScaleMode("1:1")}
          type="button"
        >
          1:1
        </button>
      </div>
    </div>
  );
}
