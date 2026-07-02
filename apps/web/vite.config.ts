/*
 * type: config
 * description: Vite configuration for the Landschaft web editor.
 * last-updated: 2026-07-02
 * last-model: codex-gpt-5
 * last-change: add GitHub Pages base path for project-site deployments
 */
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  base: process.env.GITHUB_PAGES === "true" ? "/Landschaft/" : "/",
  build: {
    chunkSizeWarningLimit: 1500,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) {
            return undefined;
          }

          if (
            id.includes("/react/") ||
            id.includes("/react-dom/") ||
            id.includes("/scheduler/")
          ) {
            return "react-vendor";
          }

          if (
            id.includes("/@react-three/fiber/") ||
            id.includes("/@react-three/drei/")
          ) {
            return "react-three";
          }

          if (id.includes("/three/")) {
            return "three-core";
          }

          if (
            id.includes("/three-stdlib/") ||
            id.includes("/maath/") ||
            id.includes("/troika-") ||
            id.includes("/camera-controls/") ||
            id.includes("/meshline/")
          ) {
            return "three-helpers";
          }

          if (
            id.includes("/@turf/") ||
            id.includes("/proj4/") ||
            id.includes("/zod/")
          ) {
            return "geospatial";
          }

          return "vendor";
        }
      }
    }
  },
  plugins: [react()],
  server: {
    port: 5173
  }
});
