/*
 * ---metadata---
 * type: app-source
 * description: Top-right viewport overlay with live FPS and view scale control.
 * last-updated: 2026-06-26
 * last-model: amelia(claude-opus-4-8)
 * last-change: added FPS counter and fit / 1:1 view scale toggle
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
  const viewScaleMode = useEditorStore((state) => state.viewScaleMode);
  const setViewScaleMode = useEditorStore((state) => state.setViewScaleMode);
  const fpsRef = useRef(fps);
  fpsRef.current = fps;

  return (
    <div className="viewport-overlay">
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
