/*
 * ---metadata---
 * type: app-source
 * description: Safe location search and dataset selection panel for provider-backed imports.
 * last-updated: 2026-06-30
 * last-model: codex-gpt-5
 * last-change: replace orthophoto coordinate setup with safe dataset location search
 * ---end-metadata---
 */
import {
  ChevronDown,
  ChevronUp,
  Database,
  MapPin,
  Play,
  Search
} from "lucide-react";
import { useMemo, useState } from "react";
import { useEditorStore } from "../state/editorStore";

const datasetLabels = {
  "naip-ortho": "NAIP orthophoto",
  "dem-3dep": "3DEP DEM",
  "usgs-contours": "USGS contours",
  hydrography: "Hydrography",
  transportation: "Transportation"
} as const;

export function TerrainSetupPanel() {
  const {
    safeDatasetImportMessage,
    safeDatasetImportStatus,
    safeDatasetLocationId,
    safeDatasetLocations,
    safeDatasetSearchQuery,
    safeDatasetSelectedIds,
    selectSafeDatasetLocation,
    setSafeDatasetSearchQuery,
    startSafeDatasetImport,
    terrainGenerating,
    terrainGenerationError,
    toggleSafeDataset
  } = useEditorStore();
  const [sectionOpen, setSectionOpen] = useState(true);
  const normalizedQuery = safeDatasetSearchQuery.trim().toLowerCase();
  const filteredLocations = useMemo(
    () =>
      safeDatasetLocations.filter((location) =>
        `${location.name} ${location.region} ${location.country}`
          .toLowerCase()
          .includes(normalizedQuery)
      ),
    [normalizedQuery, safeDatasetLocations]
  );
  const selectedLocation =
    safeDatasetLocations.find((location) => location.id === safeDatasetLocationId) ??
    safeDatasetLocations[0];
  const canStart = Boolean(selectedLocation && safeDatasetSelectedIds.length > 0);

  return (
    <section className="terrain-setup">
      <button
        aria-expanded={sectionOpen}
        className="section-title"
        onClick={() => setSectionOpen((open) => !open)}
        type="button"
      >
        <span className="section-title-leading">
          <Database size={16} strokeWidth={1.75} />
          <span>Location Data</span>
        </span>
        {sectionOpen ? (
          <ChevronUp size={15} strokeWidth={1.75} />
        ) : (
          <ChevronDown size={15} strokeWidth={1.75} />
        )}
      </button>

      {sectionOpen ? (
        <div className="terrain-setup-body">
          <label className="location-search">
            <Search size={15} strokeWidth={1.75} />
            <input
              onChange={(event) => setSafeDatasetSearchQuery(event.target.value)}
              placeholder="Search USA test location"
              type="search"
              value={safeDatasetSearchQuery}
            />
          </label>

          <div className="location-results">
            {filteredLocations.map((location) => {
              const isSelected = location.id === safeDatasetLocationId;

              return (
                <button
                  className={`location-result ${isSelected ? "active" : ""}`}
                  key={location.id}
                  onClick={() => selectSafeDatasetLocation(location.id)}
                  type="button"
                >
                  <span className="location-result-icon" aria-hidden="true">
                    <MapPin size={14} strokeWidth={1.75} />
                  </span>
                  <span className="location-result-copy">
                    <strong>{location.name}</strong>
                    <span>
                      {location.region}, {location.country}
                    </span>
                  </span>
                </button>
              );
            })}
          </div>

          {selectedLocation ? (
            <>
              <div className="safe-location-summary">
                <div>
                  <span>Source</span>
                  <strong>{selectedLocation.dataSource}</strong>
                </div>
                <div>
                  <span>Target CRS</span>
                  <strong>{selectedLocation.targetCrs}</strong>
                </div>
              </div>

              <fieldset className="dataset-checklist">
                <legend>Available data</legend>
                {selectedLocation.datasets.map((datasetId) => (
                  <label className="dataset-option" key={datasetId}>
                    <input
                      checked={safeDatasetSelectedIds.includes(datasetId)}
                      onChange={() => toggleSafeDataset(datasetId)}
                      type="checkbox"
                    />
                    <span>{datasetLabels[datasetId]}</span>
                  </label>
                ))}
              </fieldset>

              <button
                className="secondary-action location-import-action"
                disabled={!canStart || terrainGenerating}
                onClick={startSafeDatasetImport}
                type="button"
              >
                <Play size={14} strokeWidth={1.9} />
                {terrainGenerating ? "Importing" : "Start import"}
              </button>
            </>
          ) : null}

          {safeDatasetImportMessage ? (
            <p className={`upload-note import-status-${safeDatasetImportStatus}`}>
              {safeDatasetImportMessage}
            </p>
          ) : null}
          {terrainGenerationError ? (
            <p className="upload-note import-status-error">{terrainGenerationError}</p>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
