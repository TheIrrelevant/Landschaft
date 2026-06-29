/*
 * type: app-source
 * description: React entrypoint for the Landschaft web editor.
 * last-updated: 2026-06-29
 * last-model: codex-gpt-5
 * last-change: remove unused sidebar LCA styles import
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
