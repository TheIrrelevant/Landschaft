/*
 * type: app-source
 * description: React entrypoint for the Landschaft web editor.
 * last-updated: 2026-06-24
 * last-model: codex-gpt-5
 * last-change: added React root rendering
 */
import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./ui/App";
import "./styles.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
