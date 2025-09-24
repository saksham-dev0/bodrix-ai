"use client";

import React, { useMemo } from "react";
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
  sheetData: any[]; // x-spreadsheet data for all sheets, we use first sheet
  range: string; // A1 range like "A1:C10"
  type: ChartType;
  title?: string;
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

export default function ChartJSFromRange({ sheetData, range, type, title }: Props) {
  const sheet = sheetData?.[0];
  const matrix = useMemo(() => extractRange2D(sheet, range), [sheet, range]);

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

  return (
    <div className="w-full">
      {title && (
        <div className="text-sm font-medium mb-2 px-2 text-gray-700">
          {title}
        </div>
      )}
      <div className="h-64 w-full">
        {type === "line" && (
          <Line data={chartData} options={chartOptions} />
        )}
        {type === "bar" && (
          <Bar data={chartData} options={chartOptions} />
        )}
        {type === "area" && (
          <Line 
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
        )}
        {type === "pie" && (
          <Pie data={chartData} options={pieChartOptions} />
        )}
      </div>
    </div>
  );
}
