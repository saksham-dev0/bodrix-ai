"use client";

import React, { useMemo, useRef } from "react";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler,
} from "chart.js";
import { Line, Bar, Pie } from "react-chartjs-2";
import { extractRange2D } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Download, Eye } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ArcElement,
  Filler
);

type ChartType = "line" | "bar" | "pie" | "area";

interface Props {
  sheetData: any[]; // x-spreadsheet data for all sheets
  range: string; // A1 range like "A1:C10"
  type: ChartType;
  title?: string;
  showSheetName?: boolean; // Whether to show sheet name in chart header
  sheetName?: string; // Name of the sheet to use for chart data
  showViewDownload?: boolean; // Whether to show view/download buttons
}

// Default colors for charts
const COLORS = [
  "#FF6384", // Red
  "#36A2EB", // Blue
  "#FFCE56", // Yellow
  "#4BC0C0", // Teal
  "#9966FF", // Purple
  "#FF9F40", // Orange
  "#FF6384", // Pink
  "#C9CBCF", // Gray
];

function parseSpreadsheetData(matrix: Array<Array<string | number>>) {
  if (matrix.length === 0) return { labels: [], datasets: [] };

  console.log("parseSpreadsheetData - matrix:", matrix);

  // Check if first row looks like headers (has any non-numeric string)
  const firstRow = matrix[0];
  const firstRowHasNonNumericString = firstRow.some(cell => {
    if (typeof cell === "string") {
      const trimmed = cell.trim();
      return trimmed !== "" && isNaN(Number(trimmed));
    }
    return false;
  });

  // Check if first column looks like labels (has any non-numeric string)
  const firstColHasNonNumericString = matrix.some(row => {
    const cell = row[0];
    if (typeof cell === "string") {
      const trimmed = cell.trim();
      return trimmed !== "" && isNaN(Number(trimmed));
    }
    return false;
  });

  console.log("Data structure analysis:", {
    firstRowHasNonNumericString,
    firstColHasNonNumericString,
    dimensions: `${matrix.length} rows x ${matrix[0]?.length || 0} cols`
  });

  // Case 1: First row is header, first column is labels
  if (firstRowHasNonNumericString && firstColHasNonNumericString) {
    const seriesLabels = firstRow.slice(1).map(cell => String(cell || ""));
    const dataRows = matrix.slice(1);
    const categoryLabels = dataRows.map(row => String(row[0] || ""));
    
    const datasets = [];
    const seriesCount = Math.max(...dataRows.map(row => row.length - 1), 0);

    for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
      const seriesData = dataRows.map(row => {
        const value = row[seriesIndex + 1];
        return typeof value === "number" ? value : Number(value) || 0;
      });

      datasets.push({
        label: seriesLabels[seriesIndex] || `Series ${seriesIndex + 1}`,
        data: seriesData,
        backgroundColor: COLORS[seriesIndex % COLORS.length],
        borderColor: COLORS[seriesIndex % COLORS.length],
        borderWidth: 2,
      });
    }

    console.log("Case 1: Header row + label column:", { categoryLabels, seriesLabels, datasets });

    return {
      labels: categoryLabels,
      datasets,
    };
  }

  // Case 2: First column has labels, no header row
  if (firstColHasNonNumericString && !firstRowHasNonNumericString) {
    const categoryLabels = matrix.map(row => String(row[0] || ""));
    const seriesCount = Math.max(...matrix.map(row => row.length - 1), 0);
    
    const datasets = [];
    for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
      const seriesData = matrix.map(row => {
        const value = row[seriesIndex + 1];
        return typeof value === "number" ? value : Number(value) || 0;
      });

      datasets.push({
        label: `Values ${seriesIndex + 1}`,
        data: seriesData,
        backgroundColor: COLORS[seriesIndex % COLORS.length],
        borderColor: COLORS[seriesIndex % COLORS.length],
        borderWidth: 2,
      });
    }

    console.log("Case 2: Label column only:", { categoryLabels, datasets });

    return {
      labels: categoryLabels,
      datasets,
    };
  }

  // Case 3: First row is header, no label column (all numeric data)
  if (firstRowHasNonNumericString && !firstColHasNonNumericString) {
    const seriesLabels = firstRow.map(cell => String(cell || ""));
    const dataRows = matrix.slice(1);
    const categoryLabels = dataRows.map((_, idx) => `Row ${idx + 1}`);
    
    const datasets = [];
    const seriesCount = firstRow.length;

    for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
      const seriesData = dataRows.map(row => {
        const value = row[seriesIndex];
        return typeof value === "number" ? value : Number(value) || 0;
      });

      datasets.push({
        label: seriesLabels[seriesIndex] || `Series ${seriesIndex + 1}`,
        data: seriesData,
        backgroundColor: COLORS[seriesIndex % COLORS.length],
        borderColor: COLORS[seriesIndex % COLORS.length],
        borderWidth: 2,
      });
    }

    console.log("Case 3: Header row only:", { categoryLabels, seriesLabels, datasets });

    return {
      labels: categoryLabels,
      datasets,
    };
  }

  // Case 4: All numeric data, no headers or labels
  const categoryLabels = matrix.map((_, idx) => `Row ${idx + 1}`);
  const seriesCount = Math.max(...matrix.map(row => row.length), 0);
  
  const datasets = [];
  for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
    const seriesData = matrix.map(row => {
      const value = row[seriesIndex];
      return typeof value === "number" ? value : Number(value) || 0;
    });

    datasets.push({
      label: `Series ${seriesIndex + 1}`,
      data: seriesData,
      backgroundColor: COLORS[seriesIndex % COLORS.length],
      borderColor: COLORS[seriesIndex % COLORS.length],
      borderWidth: 2,
    });
  }

  console.log("Case 4: All numeric:", { categoryLabels, datasets });

  return {
    labels: categoryLabels,
    datasets,
  };
}

function parsePieChartData(matrix: Array<Array<string | number>>) {
  if (matrix.length === 0) return { labels: [], datasets: [] };

  console.log("parsePieChartData - matrix:", matrix);

  // For pie charts, we expect: labels in first column, values in second column
  const labels: string[] = [];
  const data: number[] = [];
  const backgroundColor: string[] = [];

  matrix.forEach((row, index) => {
    if (row.length >= 2) {
      labels.push(String(row[0] || `Item ${index + 1}`));
      const value = typeof row[1] === "number" ? row[1] : Number(row[1]) || 0;
      data.push(value);
      backgroundColor.push(COLORS[index % COLORS.length]);
    }
  });

  console.log("Pie chart data:", { labels, data, backgroundColor });

  return {
    labels,
    datasets: [
      {
        data,
        backgroundColor,
        borderColor: backgroundColor.map(color => color),
        borderWidth: 1,
      },
    ],
  };
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "top" as const,
      labels: {
        boxWidth: 12,
        padding: 8,
        font: {
          size: 11,
        },
      },
    },
    title: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
      ticks: {
        font: {
          size: 10,
        },
      },
    },
    x: {
      ticks: {
        font: {
          size: 10,
        },
        maxRotation: 45,
        minRotation: 0,
      },
    },
  },
};

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "right" as const,
      labels: {
        boxWidth: 12,
        padding: 8,
        font: {
          size: 10,
        },
      },
    },
    title: {
      display: false,
    },
  },
};

export default function ChartJSFromRange({ sheetData, range, type, title, showSheetName = true, sheetName, showViewDownload = true }: Props) {
  const chartRef = useRef<any>(null);
  // Find the sheet by name, fallback to first sheet if not found
  const sheet = useMemo(() => {
    if (sheetName) {
      const foundSheet = sheetData?.find(s => s.name === sheetName);
      if (foundSheet) return foundSheet;
    }
    // For existing charts without sheetName, use first sheet
    return sheetData?.[0];
  }, [sheetData, sheetName]);
  
  const matrix = useMemo(() => {
    const result = extractRange2D(sheet, range);
    console.log("extractRange2D result:", { range, result, sheet: sheet?.name });
    return result;
  }, [sheet, range]);
  
  // Get sheet name for display
  const displaySheetName = sheet?.name || sheetName || "Sheet1";
  
  // Debug logging
  console.log("ChartJSFromRange:", { 
    sheetName, 
    displaySheetName,
    totalSheets: sheetData?.length,
    sheetData: sheetData?.map(s => s.name),
    foundSheet: !!sheet,
    range,
    matrixLength: matrix.length
  });

  // Download chart as PNG
  const downloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement('a');
      link.download = `${title || 'chart'}-${displaySheetName}.png`;
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  const chartData = useMemo(() => {
    if (type === "pie") {
      return parsePieChartData(matrix);
    }
    return parseSpreadsheetData(matrix);
  }, [matrix, type]);

  if (!matrix.length || !chartData.labels.length) {
    console.warn("No data for chart:", { 
      matrix, 
      chartData, 
      range, 
      sheetName: displaySheetName,
      hasSheet: !!sheet 
    });
    
    return (
      <div className="w-full h-full flex items-center justify-center border rounded bg-gray-50">
        <div className="text-center px-4">
          <div className="text-gray-500 text-sm font-medium mb-1">No data available for chart</div>
          <div className="text-gray-400 text-xs mb-1">Range: {range}</div>
          <div className="text-gray-400 text-xs">Sheet: {displaySheetName}</div>
          {!sheet && (
            <div className="text-red-400 text-xs mt-2">Sheet not found!</div>
          )}
        </div>
      </div>
    );
  }

  const ChartComponent = () => {
    switch (type) {
      case "line":
        return <Line ref={chartRef} data={chartData} options={chartOptions} />;
      case "bar":
        return <Bar ref={chartRef} data={chartData} options={chartOptions} />;
      case "area":
        return (
          <Line 
            ref={chartRef}
            data={{
              ...chartData,
              datasets: chartData.datasets.map(dataset => ({
                ...dataset,
                fill: true,
                tension: 0.4,
              }))
            }} 
            options={chartOptions} 
          />
        );
      case "pie":
        return <Pie ref={chartRef} data={chartData} options={pieChartOptions} />;
      default:
        return <Line ref={chartRef} data={chartData} options={chartOptions} />;
    }
  };

  return (
    <div className="w-full h-full flex flex-col">
      {showSheetName && (
        <div className="text-xs font-medium mb-1 px-2 text-gray-500 bg-gray-50 py-1 rounded-t flex-shrink-0">
          {displaySheetName}
        </div>
      )}
      {(title || showViewDownload) && (
        <div className="flex items-center justify-between px-2 py-1 flex-shrink-0">
          {title && (
            <div className="text-sm font-medium text-gray-700">
              {title}
            </div>
          )}
          {showViewDownload && (
            <div className="flex gap-1">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <Eye className="w-3 h-3" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
                  <DialogHeader>
                    <DialogTitle className="flex items-center justify-between">
                      <span>{title || 'Chart'} - {displaySheetName}</span>
                      <Button onClick={downloadChart} size="sm" className="h-8">
                        <Download className="w-3 h-3 mr-1" />
                        Download
                      </Button>
                    </DialogTitle>
                  </DialogHeader>
                  <div className="w-full h-96">
                    <ChartComponent />
                  </div>
                </DialogContent>
              </Dialog>
              <Button 
                variant="ghost" 
                size="sm" 
                className="h-6 w-6 p-0"
                onClick={downloadChart}
                title="Download chart"
              >
                <Download className="w-3 h-3" />
              </Button>
            </div>
          )}
        </div>
      )}
      <div className="flex-1 w-full min-h-0">
        <ChartComponent />
      </div>
    </div>
  );
}
