import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// A1 notation helpers for x-spreadsheet data
export function a1ToRowCol(a1: string): { row: number; col: number } {
  const match = a1.match(/([A-Za-z]+)(\d+)/);
  if (!match) return { row: 0, col: 0 };
  const [, colLetters, rowStr] = match;
  let col = 0;
  for (let i = 0; i < colLetters.length; i++) {
    col = col * 26 + (colLetters.charCodeAt(i) - 64);
  }
  return { row: parseInt(rowStr, 10) - 1, col: col - 1 };
}

// Convert zero-based column index to A1 letters (0 -> A)
export function colToA1Letters(colIndex: number): string {
  let n = colIndex + 1;
  let s = "";
  while (n > 0) {
    const rem = (n - 1) % 26;
    s = String.fromCharCode(65 + rem) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// Convert zero-based row/col to A1 cell string (e.g., 0,0 -> A1)
export function rowColToA1(row: number, col: number): string {
  return `${colToA1Letters(col)}${row + 1}`;
}

export function parseA1Range(range: string): {
  r1: number;
  c1: number;
  r2: number;
  c2: number;
} {
  const [start, end] = range.split(":");
  const s = a1ToRowCol(start);
  const e = end ? a1ToRowCol(end) : s;
  const r1 = Math.min(s.row, e.row);
  const c1 = Math.min(s.col, e.col);
  const r2 = Math.max(s.row, e.row);
  const c2 = Math.max(s.col, e.col);
  return { r1, c1, r2, c2 };
}

// Build A1 range string from zero-based coordinates
export function buildA1Range(r1: number, c1: number, r2: number, c2: number): string {
  const start = rowColToA1(r1, c1);
  const end = rowColToA1(r2, c2);
  if (start === end) return start;
  return `${start}:${end}`;
}

// Convert x-spreadsheet sheet.cells to 2D array over range
export function extractRange2D(sheet: any, range: string): Array<Array<string | number>> {
  const { r1, c1, r2, c2 } = parseA1Range(range);
  const rows: Array<Array<string | number>> = [];
  const useCellsFlat = !!sheet?.cells;
  
  for (let r = r1; r <= r2; r++) {
    const row: Array<string | number> = [];
    for (let c = c1; c <= c2; c++) {
      let cellValue: any = "";
      let cellText: any = "";
      
      if (useCellsFlat) {
        const cell = sheet?.cells?.[`${r}_${c}`];
        cellValue = cell?.value ?? cell?.text ?? "";
        cellText = cell?.text ?? "";
      } else {
        // rows based structure: sheet.rows[r]?.cells[c]?.text
        const rObj = sheet?.rows?.[r] || sheet?.rows?.[String(r)];
        const cObj = rObj?.cells?.[c] || rObj?.cells?.[String(c)];
        cellValue = cObj?.value ?? cObj?.text ?? "";
        cellText = cObj?.text ?? "";
      }
      
      // Try to get the evaluated value first, fallback to text
      let finalValue = cellValue;
      
      // If it's a formula (starts with =), try to evaluate it
      if (typeof cellText === "string" && cellText.startsWith("=")) {
        // For SUM formulas, calculate manually
        if (cellText.includes("SUM(")) {
          const sumMatch = cellText.match(/SUM\(([^)]+)\)/);
          if (sumMatch) {
            const rangeStr = sumMatch[1];
            const [start, end] = rangeStr.split(":");
            if (start && end) {
              const startPos = a1ToRowCol(start);
              const endPos = a1ToRowCol(end);
              let sum = 0;
              
              for (let sr = startPos.row; sr <= endPos.row; sr++) {
                for (let sc = startPos.col; sc <= endPos.col; sc++) {
                  let cellVal: any = "";
                  if (useCellsFlat) {
                    const cell = sheet?.cells?.[`${sr}_${sc}`];
                    cellVal = cell?.value ?? cell?.text ?? "";
                  } else {
                    const rObj = sheet?.rows?.[sr] || sheet?.rows?.[String(sr)];
                    const cObj = rObj?.cells?.[sc] || rObj?.cells?.[String(sc)];
                    cellVal = cObj?.value ?? cObj?.text ?? "";
                  }
                  const num = Number(cellVal);
                  if (!isNaN(num)) {
                    sum += num;
                  }
                }
              }
              finalValue = sum;
            }
          }
        }
      }
      
      // Convert to number if possible
      const num = Number(finalValue);
      row.push(!isNaN(num) && finalValue !== "" ? num : finalValue);
    }
    rows.push(row);
  }
  return rows;
}
