/*
 * ---metadata---
 * type: app-source
 * description: Excel-like knowledge-base spreadsheet overlay with import and inline cell editing.
 * last-updated: 2026-07-04
 * last-model: composer-2.5
 * last-change: move material column left, add map sync and text summary from national-map layers
 * ---end-metadata---
 */
import { X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import { useEditorStore } from "../state/editorStore";
import { columnIndexToLabel } from "./knowledgeBankSheet";

type ActiveCell = {
  row: number;
  col: number;
};

export function KnowledgeBaseOverlay() {
  const {
    closeKnowledgeBase,
    importKnowledgeBankSheet,
    knowledgeBankColumnHeaders,
    knowledgeBankColumnWidths,
    knowledgeBankGrid,
    knowledgeBankImportMessage,
    knowledgeBankMaterialColors,
    knowledgeBankRowHeights,
    knowledgeBankTextSummary,
    knowledgeBaseOpen,
    setKnowledgeBankCell,
    setKnowledgeBankColumnWidth,
    setKnowledgeBankRowHeight,
    syncKnowledgeBankFromLayers
  } = useEditorStore();

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const panelRef = useRef<HTMLElement | null>(null);
  const [importing, setImporting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const [editingCell, setEditingCell] = useState<ActiveCell | null>(null);
  const [draftValue, setDraftValue] = useState("");
  const [panelSize, setPanelSize] = useState({ width: 1180, height: 680 });
  const [panelResize, setPanelResize] = useState<{
    startX: number;
    startY: number;
    startWidth: number;
    startHeight: number;
  } | null>(null);
  const [columnResize, setColumnResize] = useState<{
    col: number;
    startX: number;
    startWidth: number;
  } | null>(null);
  const [rowResize, setRowResize] = useState<{
    row: number;
    startY: number;
    startHeight: number;
  } | null>(null);

  const commitDraft = useCallback(() => {
    if (!editingCell) {
      return;
    }

    setKnowledgeBankCell(editingCell.row, editingCell.col, draftValue);
    setEditingCell(null);
  }, [draftValue, editingCell, setKnowledgeBankCell]);

  useEffect(() => {
    if (!columnResize && !rowResize && !panelResize) {
      return;
    }

    const handleMouseMove = (event: MouseEvent) => {
      if (columnResize) {
        const nextWidth = Math.max(48, columnResize.startWidth + (event.clientX - columnResize.startX));
        setKnowledgeBankColumnWidth(columnResize.col, nextWidth);
      }

      if (rowResize) {
        const nextHeight = Math.max(22, rowResize.startHeight + (event.clientY - rowResize.startY));
        setKnowledgeBankRowHeight(rowResize.row, nextHeight);
      }

      if (panelResize) {
        setPanelSize({
          width: Math.max(760, panelResize.startWidth + (event.clientX - panelResize.startX)),
          height: Math.max(440, panelResize.startHeight + (event.clientY - panelResize.startY))
        });
      }
    };

    const handleMouseUp = () => {
      setColumnResize(null);
      setRowResize(null);
      setPanelResize(null);
    };

    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [
    columnResize,
    panelResize,
    rowResize,
    setKnowledgeBankColumnWidth,
    setKnowledgeBankRowHeight
  ]);

  useEffect(() => {
    if (!knowledgeBaseOpen) {
      setActiveCell(null);
      setEditingCell(null);
    }
  }, [knowledgeBaseOpen]);

  if (!knowledgeBaseOpen) {
    return null;
  }

  const colCount = knowledgeBankColumnWidths.length;

  const getColumnLabel = (colIndex: number) =>
    knowledgeBankColumnHeaders[colIndex] ?? columnIndexToLabel(colIndex);

  const beginEdit = (row: number, col: number) => {
    setActiveCell({ row, col });
    setEditingCell({ row, col });
    setDraftValue(knowledgeBankGrid[row]?.[col] ?? "");
  };

  return (
    <div
      className="knowledge-base-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          commitDraft();
          closeKnowledgeBase();
        }
      }}
      role="presentation"
    >
      <section
        aria-label="Knowledge base spreadsheet"
        className="knowledge-base-panel knowledge-base-panel-sheet"
        onClick={(event) => event.stopPropagation()}
        ref={panelRef}
        role="dialog"
        style={{ width: panelSize.width, height: panelSize.height }}
      >
        <header className="knowledge-base-sheet-toolbar">
          <div className="knowledge-base-toolbar-left">
            <button
              className="knowledge-base-import"
              disabled={importing}
              onClick={() => fileInputRef.current?.click()}
              type="button"
            >
              Import Data
            </button>
            <button
              className="knowledge-base-sync"
              disabled={importing}
              onClick={() => {
                setImporting(true);
                void syncKnowledgeBankFromLayers().finally(() => setImporting(false));
              }}
              type="button"
            >
              Sync Map Data
            </button>
          </div>
          <div className="knowledge-base-sheet-title">Knowledge Base</div>
          <button
            aria-label="Close knowledge base"
            className="knowledge-base-close"
            onClick={() => {
              commitDraft();
              closeKnowledgeBase();
            }}
            type="button"
          >
            <X size={14} />
          </button>
        </header>

        {knowledgeBankImportMessage ? (
          <p className="knowledge-base-message">{knowledgeBankImportMessage}</p>
        ) : null}
        {localError ? (
          <p className="knowledge-base-message knowledge-base-message-warning">{localError}</p>
        ) : null}

        <label className="knowledge-base-text-panel">
          <span>Text library</span>
          <textarea
            className="knowledge-base-text-summary"
            readOnly
            value={knowledgeBankTextSummary}
          />
        </label>

        <div className="knowledge-base-sheet-wrap">
          <table className="knowledge-base-sheet">
            <thead>
              <tr>
                <th className="kb-material-header" scope="col">
                  Material
                </th>
                <th className="kb-corner" scope="col">
                  #
                </th>
                {Array.from({ length: colCount }, (_, colIndex) => (
                  <th
                    className="kb-col-header"
                    key={`col-${colIndex}`}
                    scope="col"
                    style={{ width: knowledgeBankColumnWidths[colIndex] }}
                    title={getColumnLabel(colIndex)}
                  >
                    <span>{getColumnLabel(colIndex)}</span>
                    <button
                      aria-label={`Resize column ${getColumnLabel(colIndex)}`}
                      className="kb-col-resizer"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setColumnResize({
                          col: colIndex,
                          startX: event.clientX,
                          startWidth: knowledgeBankColumnWidths[colIndex] ?? 128
                        });
                      }}
                      type="button"
                    />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {knowledgeBankGrid.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`} style={{ height: knowledgeBankRowHeights[rowIndex] }}>
                  <td className="kb-material-cell">
                    <span
                      aria-hidden
                      className="kb-material-swatch"
                      style={{
                        backgroundColor: knowledgeBankMaterialColors[rowIndex] ?? "#8a8a8a"
                      }}
                    />
                  </td>
                  <th className="kb-row-header" scope="row">
                    <span>{rowIndex + 1}</span>
                    <button
                      aria-label={`Resize row ${rowIndex + 1}`}
                      className="kb-row-resizer"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        setRowResize({
                          row: rowIndex,
                          startY: event.clientY,
                          startHeight: knowledgeBankRowHeights[rowIndex] ?? 28
                        });
                      }}
                      type="button"
                    />
                  </th>
                  {Array.from({ length: colCount }, (_, colIndex) => {
                    const isActive =
                      activeCell?.row === rowIndex && activeCell.col === colIndex;
                    const isEditing =
                      editingCell?.row === rowIndex && editingCell.col === colIndex;

                    return (
                      <td
                        className={
                          isActive
                            ? "kb-cell kb-cell-active"
                            : isEditing
                              ? "kb-cell kb-cell-editing"
                              : "kb-cell"
                        }
                        key={`cell-${rowIndex}-${colIndex}`}
                        onClick={(event) => {
                          event.stopPropagation();
                          commitDraft();
                          beginEdit(rowIndex, colIndex);
                        }}
                        style={{ width: knowledgeBankColumnWidths[colIndex] }}
                      >
                        {isEditing ? (
                          <input
                            autoFocus
                            className="kb-cell-input"
                            onChange={(event) => setDraftValue(event.target.value)}
                            onKeyDown={(event) => {
                              if (event.key === "Enter") {
                                event.preventDefault();
                                commitDraft();
                              }

                              if (event.key === "Escape") {
                                event.preventDefault();
                                setEditingCell(null);
                              }

                              if (event.key === "Tab") {
                                event.preventDefault();
                                commitDraft();
                                const nextCol = event.shiftKey
                                  ? Math.max(0, colIndex - 1)
                                  : Math.min(colCount - 1, colIndex + 1);
                                beginEdit(rowIndex, nextCol);
                              }
                            }}
                            value={draftValue}
                          />
                        ) : (
                          <span className="kb-cell-value">{row[colIndex] ?? ""}</span>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          aria-label="Resize knowledge base panel"
          className="knowledge-base-panel-resizer"
          onMouseDown={(event) => {
            event.preventDefault();
            setPanelResize({
              startX: event.clientX,
              startY: event.clientY,
              startWidth: panelSize.width,
              startHeight: panelSize.height
            });
          }}
          type="button"
        />

        <input
          accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
          className="knowledge-base-file-input"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (!file) {
              return;
            }

            setImporting(true);
            setLocalError(null);
            readSpreadsheetGrid(file)
              .then((grid) => {
                importKnowledgeBankSheet(file.name, grid);
                setActiveCell(null);
                setEditingCell(null);
              })
              .catch((error: unknown) => {
                setLocalError(
                  error instanceof Error ? error.message : "Spreadsheet import failed."
                );
              })
              .finally(() => {
                setImporting(false);
              });
          }}
          ref={fileInputRef}
          type="file"
        />
      </section>
    </div>
  );
}

async function readSpreadsheetGrid(file: File) {
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) {
    throw new Error("Spreadsheet does not contain any worksheets.");
  }

  const sheet = workbook.Sheets[sheetName];
  if (!sheet) {
    throw new Error("Spreadsheet worksheet could not be read.");
  }

  const rows = XLSX.utils.sheet_to_json<(string | number | boolean | null)[]>(sheet, {
    header: 1,
    defval: ""
  });

  return rows.map((row) => row.map((cell) => String(cell ?? "")));
}
