/*
 * type: config
 * description: Vite configuration for the Landschaft web editor.
 * last-updated: 2026-06-24
 * last-model: codex-gpt-5
 * last-change: added React Vite configuration
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173
  }
});
