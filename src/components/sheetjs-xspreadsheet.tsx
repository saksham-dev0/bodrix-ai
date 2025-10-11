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

    // Create paste handler function
    const handlePaste = async (event: ClipboardEvent) => {
      try {
        // Prevent default paste behavior and stop propagation immediately
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        const iframe = iframeRef.current;
        if (!iframe) return;
        
        const win = iframe.contentWindow as any;
        if (!win || !win.__grid) return;
        
        const grid = win.__grid;
        
        // Get current data and active sheet index
        const data = grid.getData();
        if (!Array.isArray(data)) {
          console.error('Invalid sheet data:', data);
          return;
        }

        // Get active sheet index
        let activeSheetIndex = 0;
        if (grid.sheet && typeof grid.sheet.index === 'number') {
          activeSheetIndex = grid.sheet.index;
        }

        // Get the active sheet
        const activeSheet = data[activeSheetIndex];
        if (!activeSheet) {
          console.error('Active sheet not found:', { activeSheetIndex, dataLength: data.length });
          return;
        }

        // Get clipboard data
        const clipboardData = event.clipboardData;
        if (!clipboardData) return;

        // Get text content and parse it
        const text = clipboardData.getData('text').trim();
        if (!text) return;

        // Parse the clipboard data into rows and columns
        const rows = text.split(/[\n\r]+/).map(row => 
          row.split('\t').map(cell => cell.trim())
        ).filter(row => row.some(cell => cell.length > 0));

        if (rows.length === 0) return;

        // Get current selection - try multiple ways to access the selector
        let startRow = 0;
        let startCol = 0;

        // Get selected cell position - x-spreadsheet stores this in different ways
        if (grid.selector) {
          // Method 1: Check for range object with sri/sci
          if (grid.selector.range) {
            startRow = grid.selector.range.sri ?? grid.selector.range.start_ri ?? 0;
            startCol = grid.selector.range.sci ?? grid.selector.range.start_ci ?? 0;
          } 
          // Method 2: Check for direct ri/ci properties on selector
          else if (grid.selector.ri !== undefined && grid.selector.ci !== undefined) {
            startRow = grid.selector.ri;
            startCol = grid.selector.ci;
          }
        }
        
        // Method 3: Try to get from sheet's cell property
        if (startRow === 0 && startCol === 0 && grid.sheet) {
          if (grid.sheet.selector) {
            if (grid.sheet.selector.range) {
              startRow = grid.sheet.selector.range.sri ?? grid.sheet.selector.range.start_ri ?? 0;
              startCol = grid.sheet.selector.range.sci ?? grid.sheet.selector.range.start_ci ?? 0;
            } else if (grid.sheet.selector.ri !== undefined && grid.sheet.selector.ci !== undefined) {
              startRow = grid.sheet.selector.ri;
              startCol = grid.sheet.selector.ci;
            }
          }
          // Method 4: Check for cell property on sheet
          if (startRow === 0 && startCol === 0 && grid.sheet.cell) {
            startRow = grid.sheet.cell.ri ?? 0;
            startCol = grid.sheet.cell.ci ?? 0;
          }
        }

        // Method 5: Try accessing internal state
        if (startRow === 0 && startCol === 0) {
          // Check if there's a selectRange or similar property
          const selectedCell = grid.selectedCell || grid.activeCell || grid.currentCell;
          if (selectedCell) {
            startRow = selectedCell.ri ?? selectedCell.row ?? 0;
            startCol = selectedCell.ci ?? selectedCell.col ?? 0;
          }
        }

        // Debug: Log the selector structure if we're still at 0,0 and it's not intentional
        if (startRow === 0 && startCol === 0) {
          console.log('Warning: Could not detect paste position, defaulting to A1');
          console.log('Grid selector structure:', {
            selector: grid.selector,
            sheet: grid.sheet ? {
              selector: grid.sheet.selector,
              cell: grid.sheet.cell
            } : null,
            selectedCell: grid.selectedCell,
            activeCell: grid.activeCell,
            currentCell: grid.currentCell
          });
        }

        console.log('Paste position detected:', { startRow, startCol, cell: `${String.fromCharCode(65 + startCol)}${startRow + 1}` });

        // Create a deep copy of the data
        const updatedData = JSON.parse(JSON.stringify(data));
        const updatedSheet = updatedData[activeSheetIndex];

        // Initialize rows object if needed
        if (!updatedSheet.rows) {
          updatedSheet.rows = { len: 100 };
        }

        // Update cells with pasted data
        rows.forEach((row, rowIndex) => {
          const ri = startRow + rowIndex;
          
          // Initialize row if needed
          if (!updatedSheet.rows[ri]) {
            updatedSheet.rows[ri] = { cells: {} };
          }
          
          row.forEach((cellValue, colIndex) => {
            const ci = startCol + colIndex;
            
            // Update cell value
            if (!updatedSheet.rows[ri].cells) {
              updatedSheet.rows[ri].cells = {};
            }
            
            if (cellValue.trim()) {
              updatedSheet.rows[ri].cells[ci] = { text: cellValue.trim() };
            }
          });
        });

        // Update sheet dimensions
        const lastRow = startRow + rows.length;
        const maxColLength = Math.max(...rows.map(r => r.length));
        const lastCol = startCol + maxColLength;

        updatedSheet.rows.len = Math.max(updatedSheet.rows.len || 100, lastRow + 1);
        updatedSheet.cols = updatedSheet.cols || { len: 26 };
        updatedSheet.cols.len = Math.max(updatedSheet.cols.len || 26, lastCol + 1);

        console.log('Pasting data:', {
          activeSheet: activeSheet.name,
          position: `${startRow},${startCol}`,
          dimensions: `${rows.length}x${maxColLength}`
        });

        // Update the grid with modified data
        grid.loadData(updatedData);

        // Ensure we stay on the correct sheet
        if (grid.sheet) {
          grid.sheet.index = activeSheetIndex;
        }

        // Trigger data change event
        if (onDataChange) {
          onDataChange(updatedData, false);
        }
      } catch (error) {
        console.error('Error handling paste:', error);
      }
    };

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

          // Add paste event listener to the iframe document with capture phase to intercept before x-spreadsheet
          // Use capture: true to ensure our handler runs before x-spreadsheet's handler
          idoc.addEventListener('paste', handlePaste, true);

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
          const idoc = iframe.contentDocument;
          
          // Remove paste event listener if document exists (with capture flag matching addEventListener)
          if (idoc && handlePaste) {
            idoc.removeEventListener('paste', handlePaste, true);
          }
          
          // Cleanup grid and resize observer
          win?.__grid?.destroy?.();
          const ro = (iframe as any).__sheet_ro;
          ro && ro.disconnect();
        } catch (e) {
          console.error('Error during cleanup:', e);
        }
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
        importFromExcel: async (files: FileList | File) => {
          const win = iframeRef.current?.contentWindow as any;
          if (!win || !win.__grid) return;

          // Get current data and ensure it's an array
          let currentData = win.__grid.getData();
          if (!Array.isArray(currentData)) {
            currentData = [];
          }

          // Convert FileList or single File to array
          const fileArray = files instanceof FileList ? Array.from(files) : [files];
          
          // Process each file
          for (const file of fileArray) {
            try {
              console.log('Processing file:', file.name);
              
              // Read and parse the file
              const text = await file.text();
              const lines = text.split(/[\n\r]+/).map(line => 
                line.split(/[,\t]/).map(cell => cell.trim().replace(/^["']|["']$/g, ''))
              ).filter(row => row.some(cell => cell.length > 0));

              if (lines.length === 0) {
                console.warn('No data found in file:', file.name);
                continue;
              }

              // Find next available sheet number
              let sheetNumber = 1;
              const existingSheetNumbers = currentData
                .map((sheet: { name: string }) => {
                  const match = sheet.name.match(/^Sheet(\d+)$/);
                  return match ? parseInt(match[1]) : 0;
                })
                .filter((num: number) => !isNaN(num));

              if (existingSheetNumbers.length > 0) {
                sheetNumber = Math.max(...existingSheetNumbers) + 1;
              }

              // Create new sheet name
              const sheetName = `Sheet${sheetNumber}`;

              // Create new sheet with exact structure
              const newSheet = {
                name: sheetName,
                freeze: "A1",
                styles: [],
                merges: [],
                rows: {},
                cols: { len: Math.max(26, lines[0]?.length || 26) },
                validations: [],
                autofilter: {}
              } as any;

              // Process each row with exact cell structure
              lines.forEach((row, rowIndex) => {
                // Initialize row if it doesn't exist
                if (!newSheet.rows[rowIndex]) {
                  newSheet.rows[rowIndex] = { cells: {} };
                }

                // Process each cell in the row
                row.forEach((cell, colIndex) => {
                  if (cell && cell.trim()) {
                    // Add cell with exact structure
                    newSheet.rows[rowIndex].cells[colIndex] = {
                      text: cell.trim()
                    };
                  }
                });
              });

              // Set the length after processing all rows
              newSheet.rows.len = Math.max(100, lines.length);

              // Create a new array with existing sheets plus new sheet
              const updatedData = [...currentData, newSheet];

              // Update the grid with all sheets
              win.__grid.loadData(updatedData);
              
              // Store the updated data
              currentData = updatedData;

              console.log('Added new sheet:', {
                name: sheetName,
                rows: lines.length,
                columns: lines[0]?.length || 0
              });

              // Switch to the new sheet
              if (win.__grid.sheet) {
                win.__grid.sheet.index = currentData.length - 1;
              }

              // Trigger data change event
              if (onDataChange) {
                onDataChange(currentData, false);
              }
            } catch (error) {
              console.error('Error processing file:', file.name, error);
            }
          }

          // Final update to ensure all sheets are saved
          win.__grid.loadData(currentData);
          
          // Ensure we're on the last added sheet
          setTimeout(() => {
            try {
              if (win.__grid.sheet) {
                win.__grid.sheet.index = currentData.length - 1;
              }
              
              // Final data change event
              if (onDataChange) {
                onDataChange(currentData, true);
              }
            } catch (error) {
              console.error('Error finalizing sheet update:', error);
            }
          }, 100);
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