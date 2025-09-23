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

interface Props {
  spreadsheetId: Id<"spreadsheets">;
  onDataChange?: (data: any[], isSave?: boolean) => void;
  refreshTrigger?: number;
}

export interface SheetRef {
  saveChanges: () => Promise<void>;
  exportToExcel: () => void;
  importFromExcel: (file: File) => Promise<void>;
  getData: () => any[];
}

const CDN_CSS = "https://unpkg.com/x-data-spreadsheet/dist/xspreadsheet.css";
const CDN_JS = "https://unpkg.com/x-data-spreadsheet/dist/xspreadsheet.js";

export const SheetXSpreadsheetIframe = forwardRef<SheetRef, Props>(
  ({ spreadsheetId, onDataChange, refreshTrigger }, ref) => {
    const iframeRef = useRef<HTMLIFrameElement | null>(null);
    const initDoneRef = useRef(false);
    const updateSpreadsheetData = useMutation(api.spreadsheets.updateSpreadsheetData);
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
          root.setAttribute("width", String(root.clientWidth || iframe.clientWidth || 800));
          root.setAttribute("height", String(root.clientHeight || iframe.clientHeight || 600));

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
          grid.on && grid.on("cell-edited", pushChangeToParent);
          grid.on && grid.on("cell-changed", pushChangeToParent);
          grid.on && grid.on("sheet-changed", pushChangeToParent);

          // observe iframe size and keep grid attributes + resize in-sync
          const ro = new ResizeObserver(() => {
            try {
              // update root attrs & call resize (x-spreadsheet reads attrs or uses resize)
              root.setAttribute("width", String(root.clientWidth || iframe.clientWidth));
              root.setAttribute("height", String(root.clientHeight || iframe.clientHeight));
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
      script.onerror = () => console.error("Failed to load x-spreadsheet inside iframe");
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
              const root = iframeRef.current!.contentDocument!.getElementById("sheetRoot")!;
              win.__grid.resize(root.clientWidth, root.clientHeight);
            } catch (e) {}
          }, 80);
        }
      } catch (e) {
        console.warn("Failed to parse/load spreadsheet data into iframe", e);
      }
    }, [spreadsheetData, refreshTrigger, initDoneRef.current]);

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
          const blob = new Blob([JSON.stringify(data)], { type: "application/json" });
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
              if (cell?.trim()) sheet.cells[`${r}_${c}`] = { text: cell.trim(), style: 0 };
            })
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
      }),
      [updateSpreadsheetData, spreadsheetId]
    );

    return (
      <div style={{ width: "100%", height: "calc(100vh - 120px)", position: "relative" }}>
        <iframe
          ref={iframeRef}
          title="x-spreadsheet-iframe"
          style={{ width: "100%", height: "100%", border: 0 }}
        />
      </div>
    );
  }
);

SheetXSpreadsheetIframe.displayName = "SheetXSpreadsheetIframe";
export default SheetXSpreadsheetIframe;
