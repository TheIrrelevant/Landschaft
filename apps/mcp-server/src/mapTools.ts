/*
 * ---metadata---
 * type: app-source
 * description: Shared MCP handlers for Landschaft map read and draft write tools.
 * last-updated: 2026-06-28
 * last-model: composer
 * last-change: wire map_read and map_write_draft to shared evidence and LCA writers
 * ---end-metadata---
 */
import {
  applyMapWriteDraft,
  buildMapEvidence,
  ProjectSnapshotSchema,
  type MapReadRequest,
  type MapWriteDraftRequest,
  type ProjectSnapshot
} from "@landschaft/shared";

export function handleMapRead(
  request: MapReadRequest,
  projectSnapshot?: unknown
) {
  const snapshot = parseProjectSnapshot(projectSnapshot);
  if (!snapshot) {
    throw new Error(
      "map_read requires a valid projectSnapshot payload until the project database is available."
    );
  }

  return buildMapEvidence(
    { project: snapshot.project, layers: snapshot.layers },
    request
  );
}

export function handleMapWriteDraft(
  request: MapWriteDraftRequest,
  projectSnapshot?: unknown
) {
  const snapshot = parseProjectSnapshot(projectSnapshot);
  if (!snapshot) {
    throw new Error(
      "map_write_draft requires a valid projectSnapshot payload until the project database is available."
    );
  }

  return applyMapWriteDraft(
    snapshot.project,
    request,
    snapshot.layers
  );
}

function parseProjectSnapshot(projectSnapshot?: unknown): ProjectSnapshot | null {
  if (!projectSnapshot) {
    return null;
  }

  const parsed =
    typeof projectSnapshot === "string"
      ? JSON.parse(projectSnapshot)
      : projectSnapshot;
  const result = ProjectSnapshotSchema.safeParse(parsed);
  return result.success ? result.data : null;
}
