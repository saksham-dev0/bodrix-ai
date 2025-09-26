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

  // For simple two-column data (like A1:B5), treat first column as labels, second as values
  if (matrix.length > 0 && matrix[0].length === 2) {
    const labels = matrix.map(row => String(row[0] || ""));
    const data = matrix.map(row => {
      const value = row[1];
      return typeof value === "number" ? value : Number(value) || 0;
    });

    return {
      labels,
      datasets: [
        {
          label: "Values",
          data,
          backgroundColor: COLORS[0],
          borderColor: COLORS[0],
          borderWidth: 2,
        },
      ],
    };
  }

  // Check if first row contains headers (strings)
  const firstRow = matrix[0];
  const hasHeaders = firstRow.some(cell => typeof cell === "string" && cell.trim() !== "");

  let labels: string[] = [];
  let dataRows: Array<Array<string | number>> = [];

  if (hasHeaders) {
    // First row is headers, rest is data
    labels = firstRow.slice(1).map(cell => String(cell || ""));
    dataRows = matrix.slice(1);
  } else {
    // No headers, use row indices as labels
    labels = dataRows.map((_, index) => `Series ${index + 1}`);
    dataRows = matrix;
  }

  // For pie charts, we need a different data structure
  if (dataRows.length === 0) return { labels: [], datasets: [] };

  // Extract data for each series
  const datasets = [];
  const seriesCount = Math.max(...dataRows.map(row => row.length - 1));

  for (let seriesIndex = 0; seriesIndex < seriesCount; seriesIndex++) {
    const seriesData = dataRows.map(row => {
      const value = row[seriesIndex + 1];
      return typeof value === "number" ? value : Number(value) || 0;
    });

    datasets.push({
      label: labels[seriesIndex] || `Series ${seriesIndex + 1}`,
      data: seriesData,
      backgroundColor: COLORS[seriesIndex % COLORS.length],
      borderColor: COLORS[seriesIndex % COLORS.length],
      borderWidth: 2,
    });
  }

  return {
    labels: dataRows.map(row => String(row[0] || "")),
    datasets,
  };
}

function parsePieChartData(matrix: Array<Array<string | number>>) {
  if (matrix.length === 0) return { labels: [], datasets: [] };

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
    },
    title: {
      display: false,
    },
  },
  scales: {
    y: {
      beginAtZero: true,
    },
  },
};

const pieChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      position: "right" as const,
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
  
  const matrix = useMemo(() => extractRange2D(sheet, range), [sheet, range]);
  
  // Get sheet name for display
  const displaySheetName = sheet?.name || sheetName || "Sheet1";
  
  // Debug logging
  console.log("ChartJSFromRange:", { 
    sheetName, 
    displaySheetName,
    totalSheets: sheetData?.length,
    sheetData: sheetData?.map(s => s.name),
    foundSheet: !!sheet
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
    return (
      <div className="w-full h-64 flex items-center justify-center border rounded bg-gray-50">
        <div className="text-gray-500 text-sm">No data available for chart</div>
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
    <div className="w-full">
      {showSheetName && (
        <div className="text-xs font-medium mb-1 px-2 text-gray-500 bg-gray-50 py-1 rounded-t">
          {displaySheetName}
        </div>
      )}
      <div className="flex items-center justify-between px-2 py-1">
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
      <div className="h-64 w-full">
        <ChartComponent />
      </div>
    </div>
  );
}
