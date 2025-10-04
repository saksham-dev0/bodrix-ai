// components/SheetXSpreadsheetIframe.tsx
"use client";

import React, {
  forwardRef,
  useEffect,
  useRef,
  useImperativeHandle,
} from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { buildA1Range } from "@/lib/utils";

interface Props {
  spreadsheetId: Id<"spreadsheets">;
  onDataChange?: (data: any[], isSave?: boolean) => void;
  refreshTrigger?: number;
  onSelectionChange?: (rangeA1: string) => void;
  onActiveSheetChange?: (sheetName: string, sheetIndex: number) => void;
}

export interface SheetRef {
  saveChanges: () => Promise<void>;
  exportToExcel: () => void;
  importFromExcel: (file: File) => Promise<void>;
  getData: () => any[];
  getActiveSheetIndex: () => number;
  getActiveSheet: () => any;
}

const CDN_CSS = "https://unpkg.com/x-data-spreadsheet/dist/xspreadsheet.css";
const CDN_JS = "https://unpkg.com/x-data-spreadsheet/dist/xspreadsheet.js";

export const SheetXSpreadsheetIframe = forwardRef<SheetRef, Props>(
  (
    {
      spreadsheetId,
      onDataChange,
      refreshTrigger,
      onSelectionChange,
      onActiveSheetChange,
    },
    ref,
  ) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const initDoneRef = useRef(false);
    const updateSpreadsheetData = useMutation(
      api.spreadsheets.updateSpreadsheetData,
    );
    const spreadsheetData = useQuery(api.spreadsheets.getSpreadsheetData, {
      spreadsheetId,
    });

    // create iframe document and load CSS+JS
    useEffect(() => {
      const iframe = iframeRef.current;
      if (!iframe || initDoneRef.current) return;

      const idoc = iframe.contentDocument!;
      idoc.open();
      // create a root container with full-size styles
      idoc.write(`<!doctype html><html><head><meta charset="utf-8"></head>
        <body style="margin:0">
          <div id="sheetRoot" style="width:100%;height:100%;"></div>
        </body></html>`);
      idoc.close();

      // inject css
      const link = idoc.createElement("link");
      link.rel = "stylesheet";
      link.href = CDN_CSS;
      idoc.head.appendChild(link);

      // small helper to init grid once library loads
      const onLibLoad = () => {
        try {
          const win = iframe.contentWindow as any;
          const doc = iframe.contentDocument!;
          const root = doc.getElementById("sheetRoot")!;
          // set explicit numeric attributes (docs example uses height/width attrs)
          root.setAttribute(
            "width",
            String(root.clientWidth || iframe.clientWidth || 800),
          );
          root.setAttribute(
            "height",
            String(root.clientHeight || iframe.clientHeight || 600),
          );

          // initialize via the documented one-liner
          const x_spreadsheet = win.x_spreadsheet;
          if (!x_spreadsheet) {
            console.error("x_spreadsheet not found in iframe window");
            return;
          }

          const initialData = [
            {
              name: "Sheet1",
              freeze: "A1",
              styles: [],
              merges: [],
              cols: { len: 26 },
              rows: { len: 100 },
              cells: {},
            },
          ];

          const grid = x_spreadsheet(root); // documented init
          win.__grid = grid;
          grid.loadData(initialData);

          // resize once after init so toolbar/grid layout is calculated
          setTimeout(() => {
            try {
              grid.resize(root.clientWidth, root.clientHeight);
            } catch (e) {}
          }, 80);

          // push changes to parent
          const pushChangeToParent = () => {
            try {
              const d = grid.getData();
              if (onDataChange) onDataChange(d, false);
            } catch (e) {}
          };

          // Handle deletions specifically
          const handleDeletion = () => {
            try {
              const d = grid.getData();
              if (onDataChange) onDataChange(d, false);
              console.log("Deletion detected, data updated");
            } catch (e) {
              console.error("Error handling deletion:", e);
            }
          };

          // Handle sheet-specific deletions
          const handleSheetDeletion = () => {
            try {
              const d = grid.getData();
              if (onDataChange) onDataChange(d, false);
              console.log("Sheet deletion detected, data updated");
            } catch (e) {
              console.error("Error handling sheet deletion:", e);
            }
          };

          // Comprehensive data change handler
          const handleAnyDataChange = () => {
            try {
              const d = grid.getData();
              if (onDataChange) onDataChange(d, false);
              console.log("Data change detected, triggering save");
            } catch (e) {
              console.error("Error handling data change:", e);
            }
          };

          // Store previous data for comparison
          let previousData: any = null;
          const checkForDataChanges = () => {
            try {
              const currentData = grid.getData();
              const currentDataString = JSON.stringify(currentData);
              const previousDataString = JSON.stringify(previousData);

              if (previousDataString !== currentDataString) {
                console.log("Data change detected via periodic check");
                if (onDataChange) onDataChange(currentData, false);
                previousData = currentData;
              }
            } catch (e) {
              console.error("Error in periodic data check:", e);
            }
          };

          // Set up periodic check for data changes (every 2 seconds)
          const intervalId = setInterval(checkForDataChanges, 2000);

          // Initialize previous data
          previousData = grid.getData();

          // Store interval ID for cleanup
          (grid as any).__intervalId = intervalId;
          // Add comprehensive event listeners
          grid.on && grid.on("cell-edited", handleAnyDataChange);
          grid.on && grid.on("cell-changed", handleAnyDataChange);
          grid.on && grid.on("sheet-changed", handleAnyDataChange);
          grid.on && grid.on("finished-editing", handleAnyDataChange);
          grid.on && grid.on("cell-deleted", handleAnyDataChange);
          grid.on && grid.on("range-deleted", handleAnyDataChange);
          grid.on && grid.on("row-deleted", handleAnyDataChange);
          grid.on && grid.on("col-deleted", handleAnyDataChange);
          grid.on && grid.on("delete", handleAnyDataChange);
          grid.on && grid.on("clear", handleAnyDataChange);
          grid.on && grid.on("sheet-deleted", handleAnyDataChange);
          grid.on && grid.on("sheet-removed", handleAnyDataChange);
          grid.on && grid.on("sheet-added", handleAnyDataChange);
          grid.on && grid.on("sheet-renamed", handleAnyDataChange);
          grid.on && grid.on("sheet-switched", handleAnyDataChange);
          grid.on && grid.on("data-changed", handleAnyDataChange);
          grid.on && grid.on("content-changed", handleAnyDataChange);

          // selection change -> notify parent with A1 range
          const notifySelection = (...args: any[]) => {
            try {
              if (!onSelectionChange) return;
              // x-spreadsheet emits either (cell, ri, ci) for single or (cell, selection) for range
              // selection can be { sri, sci, eri, eci }
              let sri: number, sci: number, eri: number, eci: number;
              if (
                args.length >= 3 &&
                typeof args[1] === "number" &&
                typeof args[2] === "number"
              ) {
                sri = args[1];
                sci = args[2];
                eri = sri;
                eci = sci;
              } else if (
                args.length >= 2 &&
                args[1] &&
                typeof args[1] === "object"
              ) {
                const sel = args[1];
                sri = sel.sri ?? sel.ri ?? 0;
                sci = sel.sci ?? sel.ci ?? 0;
                eri = sel.eri ?? sel.ri2 ?? sri;
                eci = sel.eci ?? sel.ci2 ?? sci;
              } else {
                return;
              }
              const r1 = Math.min(sri, eri);
              const c1 = Math.min(sci, eci);
              const r2 = Math.max(sri, eri);
              const c2 = Math.max(sci, eci);
              const a1 = buildA1Range(r1, c1, r2, c2);
              onSelectionChange(a1);
            } catch (e) {}
          };
          grid.on && grid.on("cell-selected", notifySelection);
          grid.on && grid.on("cells-selected", notifySelection);

          // track active sheet changes
          const notifyActiveSheetChange = () => {
            try {
              if (!onActiveSheetChange) return;
              const data = grid.getData();
              // Try different methods to get active sheet index
              let activeSheetIndex = 0;
              if (grid.getActiveSheetIndex) {
                activeSheetIndex = grid.getActiveSheetIndex();
              } else if (grid.getCurrentSheetIndex) {
                activeSheetIndex = grid.getCurrentSheetIndex();
              } else if (grid.getActiveSheet) {
                const activeSheet = grid.getActiveSheet();
                activeSheetIndex = data.findIndex(
                  (sheet: any) => sheet.name === activeSheet.name,
                );
              } else {
                // Fallback: try to get from internal state
                activeSheetIndex = (grid as any).currentSheetIndex || 0;
              }

              const activeSheet = data[activeSheetIndex];
              if (activeSheet) {
                onActiveSheetChange(
                  activeSheet.name || `Sheet${activeSheetIndex + 1}`,
                  activeSheetIndex,
                );
              }
            } catch (e) {
              console.warn("Error tracking active sheet:", e);
            }
          };

          // Listen for sheet changes - try multiple event names
          grid.on && grid.on("sheet-changed", notifyActiveSheetChange);
          grid.on && grid.on("sheet-activated", notifyActiveSheetChange);
          grid.on && grid.on("sheet-switch", notifyActiveSheetChange);
          grid.on && grid.on("sheet-select", notifyActiveSheetChange);

          // Also listen for tab clicks
          const iframeDoc = iframe.contentDocument!;
          const tabContainer = iframeDoc.querySelector(".x-spreadsheet-tab");
          if (tabContainer) {
            tabContainer.addEventListener("click", notifyActiveSheetChange);
          }

          // Initial active sheet notification
          setTimeout(notifyActiveSheetChange, 100);
          setTimeout(notifyActiveSheetChange, 500); // Second attempt after full load

          // observe iframe size and keep grid attributes + resize in-sync
          const ro = new ResizeObserver(() => {
            try {
              // update root attrs & call resize (x-spreadsheet reads attrs or uses resize)
              root.setAttribute(
                "width",
                String(root.clientWidth || iframe.clientWidth),
              );
              root.setAttribute(
                "height",
                String(root.clientHeight || iframe.clientHeight),
              );
              grid.resize(root.clientWidth, root.clientHeight);
            } catch (e) {}
          });
          ro.observe(iframe);

          // cleanup on unmount
          (iframe as any).__sheet_ro = ro;
          initDoneRef.current = true;
        } catch (err) {
          console.error("Error initializing spreadsheet in iframe:", err);
        }
      };

      // inject script and call onLibLoad when ready
      const script = idoc.createElement("script");
      script.src = CDN_JS;
      script.onload = onLibLoad;
      script.onerror = () =>
        console.error("Failed to load x-spreadsheet inside iframe");
      idoc.head.appendChild(script);

      return () => {
        try {
          const win = iframe.contentWindow as any;
          win?.__grid?.destroy?.();
          const ro = (iframe as any).__sheet_ro;
          ro && ro.disconnect();
        } catch (e) {}
      };
    }, [iframeRef.current]);

    // load saved data into iframe grid once ready
    useEffect(() => {
      if (!initDoneRef.current) return;
      const win = iframeRef.current?.contentWindow as any;
      if (!win || !win.__grid) return;
      try {
        let dataString = (spreadsheetData as any)?.data;
        if (!dataString && (spreadsheetData as any)?.xSpreadsheetData) {
          dataString = (spreadsheetData as any).xSpreadsheetData;
        } else if (!dataString && (spreadsheetData as any)?.workbookData) {
          dataString = (spreadsheetData as any).workbookData;
        }
        if (dataString && dataString !== "undefined") {
          const parsed = JSON.parse(dataString);
          win.__grid.loadData(parsed);
          // ensure correct layout after loading
          setTimeout(() => {
            try {
              const root =
                iframeRef.current!.contentDocument!.getElementById(
                  "sheetRoot",
                )!;
              win.__grid.resize(root.clientWidth, root.clientHeight);
            } catch (e) {}
          }, 80);
        }
      } catch (e) {
        console.warn("Failed to parse/load spreadsheet data into iframe", e);
      }
    }, [spreadsheetData, refreshTrigger, initDoneRef.current]);

    // Cleanup interval on unmount
    useEffect(() => {
      return () => {
        const win = iframeRef.current?.contentWindow as any;
        if (win && win.__grid && (win.__grid as any).__intervalId) {
          clearInterval((win.__grid as any).__intervalId);
        }
      };
    }, []);

    // expose methods
    useImperativeHandle(
      ref,
      () => ({
        saveChanges: async () => {
          const win = iframeRef.current?.contentWindow as any;
          if (!win || !win.__grid) return;
          const data = win.__grid.getData();
          const dataString = JSON.stringify(data);
          await updateSpreadsheetData({ spreadsheetId, data: dataString });
          if (onDataChange) onDataChange(data, true);
        },
        exportToExcel: () => {
          const win = iframeRef.current?.contentWindow as any;
          if (!win || !win.__grid) return;
          const data = win.__grid.getData();
          const blob = new Blob([JSON.stringify(data)], {
            type: "application/json",
          });
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = "spreadsheet.json";
          a.click();
          URL.revokeObjectURL(url);
        },
        importFromExcel: async (file: File) => {
          const text = await file.text();
          const lines = text.split("\n").map((l) => l.split(","));
          const sheet = {
            name: "Imported",
            freeze: "A1",
            styles: [],
            merges: [],
            cols: { len: Math.max(26, lines[0]?.length || 26) },
            rows: { len: Math.max(100, lines.length) },
            cells: {},
          } as any;
          lines.forEach((row, r) =>
            row.forEach((cell, c) => {
              if (cell?.trim())
                sheet.cells[`${r}_${c}`] = { text: cell.trim(), style: 0 };
            }),
          );
          const win = iframeRef.current?.contentWindow as any;
          if (win && win.__grid) {
            win.__grid.loadData([sheet]);
            if (onDataChange) onDataChange([sheet], false);
          }
        },
        getData: () => {
          const win = iframeRef.current?.contentWindow as any;
          return (win && win.__grid && win.__grid.getData()) || [];
        },
        getActiveSheetIndex: () => {
          const win = iframeRef.current?.contentWindow as any;
          if (win && win.__grid) {
            const grid = win.__grid;
            // Try different methods to get active sheet index
            if (grid.getActiveSheetIndex) {
              return grid.getActiveSheetIndex();
            } else if (grid.getCurrentSheetIndex) {
              return grid.getCurrentSheetIndex();
            } else if (grid.getActiveSheet) {
              const data = grid.getData();
              const activeSheet = grid.getActiveSheet();
              return data.findIndex(
                (sheet: any) => sheet.name === activeSheet.name,
              );
            } else {
              return (grid as any).currentSheetIndex || 0;
            }
          }
          return 0;
        },
        getActiveSheet: () => {
          const win = iframeRef.current?.contentWindow as any;
          if (win && win.__grid) {
            const grid = win.__grid;
            const data = grid.getData();
            let activeIndex = 0;

            // Try different methods to get active sheet index
            if (grid.getActiveSheetIndex) {
              activeIndex = grid.getActiveSheetIndex();
            } else if (grid.getCurrentSheetIndex) {
              activeIndex = grid.getCurrentSheetIndex();
            } else if (grid.getActiveSheet) {
              const activeSheet = grid.getActiveSheet();
              activeIndex = data.findIndex(
                (sheet: any) => sheet.name === activeSheet.name,
              );
            } else {
              activeIndex = (grid as any).currentSheetIndex || 0;
            }

            return data[activeIndex] || null;
          }
          return null;
        },
      }),
      [updateSpreadsheetData, spreadsheetId],
    );

    return (
      <div
        style={{
          width: "100%",
          height: "calc(100vh - 120px)",
          position: "relative",
        }}
      >
        <iframe
          ref={iframeRef}
          title="x-spreadsheet-iframe"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </div>
    );
  },
);

SheetXSpreadsheetIframe.displayName = "SheetXSpreadsheetIframe";
export default SheetXSpreadsheetIframe;
