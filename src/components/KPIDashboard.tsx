"use client";

import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import ChartJSFromRange from "./ChartJSFromRange";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

interface KPIDashboardProps {
  dashboardId: Id<"dashboards">;
  sheetData: any[];
}

interface DashboardWidget {
  _id: Id<"dashboardWidgets">;
  _creationTime: number;
  dashboardId: Id<"dashboards">;
  ownerId: Id<"users">;
  type: "chart" | "metric" | "table" | "text";
  title: string;
  chartType?: "line" | "bar" | "area" | "pie";
  range?: string;
  sheetName?: string;
  metricValue?: string;
  metricFormula?: string;
  metricColumn?: string;
  tableRange?: string;
  tableSheetName?: string;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  createdAt: number;
  updatedAt: number;
}

export default function KPIDashboard({ dashboardId, sheetData }: KPIDashboardProps) {
  const dashboard = useQuery(api.dashboards.getDashboard, { dashboardId });

  if (!dashboard) {
    return (
      <div className="w-full h-full flex items-center justify-center">
        <div className="text-gray-500">Loading dashboard...</div>
      </div>
    );
  }

  const widgets = dashboard.widgets as DashboardWidget[];

  // Group widgets by row (based on y position)
  const rows: Record<number, DashboardWidget[]> = {};
  widgets.forEach((widget) => {
    const y = widget.position.y;
    if (!rows[y]) {
      rows[y] = [];
    }
    rows[y].push(widget);
  });

  // Sort rows by y position
  const sortedRows = Object.entries(rows)
    .sort(([a], [b]) => parseInt(a) - parseInt(b))
    .map(([_, widgets]) => 
      widgets.sort((a, b) => a.position.x - b.position.x)
    );

  const renderMetricWidget = (widget: DashboardWidget) => {
    const value = widget.metricValue || "N/A";
    const numericValue = parseFloat(value.replace(/[^0-9.-]/g, ""));
    const isPositive = numericValue > 0;
    const TrendIcon = isPositive ? TrendingUp : value.includes("-") ? TrendingDown : Minus;
    const trendColor = isPositive ? "text-green-600" : value.includes("-") ? "text-red-600" : "text-blue-600";
    const bgGradient = isPositive 
      ? "bg-gradient-to-br from-green-50 to-emerald-50" 
      : value.includes("-") 
      ? "bg-gradient-to-br from-red-50 to-orange-50" 
      : "bg-gradient-to-br from-blue-50 to-indigo-50";
    const borderColor = isPositive ? 'border-green-500' : value.includes("-") ? 'border-red-500' : 'border-blue-500';
    const iconBg = isPositive ? "bg-green-100" : value.includes("-") ? "bg-red-100" : "bg-blue-100";

    return (
      <Card key={widget._id} className={`h-full w-full border-l-4 ${borderColor} shadow-lg hover:shadow-xl transition-all duration-300 ${bgGradient} flex flex-col`}>
        <CardHeader className="pb-3 flex-shrink-0">
          <CardTitle className="text-xs font-semibold text-gray-500 uppercase tracking-wider line-clamp-2">
            {widget.title}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 flex-1 flex flex-col justify-between">
          <div className="flex items-center justify-between gap-3">
            <div className="text-3xl font-extrabold text-gray-900 tracking-tight flex-1 min-w-0 overflow-hidden break-all">{value}</div>
            <div className={`p-2.5 rounded-xl ${iconBg} ring-2 ring-white shadow-sm flex-shrink-0`}>
              <TrendIcon className={`w-5 h-5 ${trendColor}`} />
            </div>
          </div>
          <div className="space-y-2">
            {widget.metricFormula && widget.metricColumn && (
              <div className="pt-2 border-t border-gray-200">
                <div className="text-xs text-gray-600 flex items-center gap-1.5 flex-wrap">
                  <span className="font-bold text-gray-700 bg-white px-1.5 py-0.5 rounded">
                    {widget.metricFormula}
                  </span>
                  <span className="text-gray-400">of</span>
                  <span className="font-medium break-words">{widget.metricColumn}</span>
                </div>
              </div>
            )}
            {widget.sheetName && (
              <div className="text-xs text-gray-500 flex items-center gap-1.5 bg-white bg-opacity-60 px-2 py-0.5 rounded max-w-full">
                <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="font-medium truncate">{widget.sheetName}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderChartWidget = (widget: DashboardWidget) => {
    if (!widget.chartType || !widget.range || !widget.sheetName) {
      return null;
    }

    // Map chart types to colors and gradients
    const chartStyles: Record<string, { border: string; badge: string; bg: string }> = {
      line: { 
        border: "border-blue-500", 
        badge: "bg-blue-100 text-blue-700",
        bg: "bg-gradient-to-br from-blue-50/30 to-indigo-50/30"
      },
      bar: { 
        border: "border-purple-500", 
        badge: "bg-purple-100 text-purple-700",
        bg: "bg-gradient-to-br from-purple-50/30 to-pink-50/30"
      },
      pie: { 
        border: "border-orange-500", 
        badge: "bg-orange-100 text-orange-700",
        bg: "bg-gradient-to-br from-orange-50/30 to-amber-50/30"
      },
      area: { 
        border: "border-teal-500", 
        badge: "bg-teal-100 text-teal-700",
        bg: "bg-gradient-to-br from-teal-50/30 to-cyan-50/30"
      },
    };

    const style = chartStyles[widget.chartType] || { 
      border: "border-gray-500", 
      badge: "bg-gray-100 text-gray-700",
      bg: "bg-white"
    };

    return (
      <Card key={widget._id} className={`h-full w-full border-l-4 ${style.border} shadow-lg hover:shadow-xl transition-all duration-300 ${style.bg} flex flex-col`}>
        <CardHeader className="pb-3 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-base font-bold text-gray-900 mb-1.5 line-clamp-2 break-words">
                {widget.title}
              </CardTitle>
              {widget.sheetName && (
                <div className="text-xs text-gray-500 flex items-center gap-1.5 bg-white bg-opacity-80 px-2 py-0.5 rounded max-w-full">
                  <svg className="w-3 h-3 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="font-medium truncate">{widget.sheetName}</span>
                </div>
              )}
            </div>
            <span className={`text-xs font-bold px-2 py-1 rounded-full ${style.badge} uppercase tracking-wider whitespace-nowrap flex-shrink-0`}>
              {widget.chartType}
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-4 flex-1 min-h-0 flex flex-col">
          <div className="flex-1 bg-white rounded-lg p-3 shadow-inner min-h-[250px]">
            <ChartJSFromRange
              sheetData={sheetData}
              range={widget.range}
              type={widget.chartType}
              title=""
              sheetName={widget.sheetName}
              showSheetName={false}
              showViewDownload={false}
            />
          </div>
        </CardContent>
      </Card>
    );
  };

  const renderWidget = (widget: DashboardWidget) => {
    switch (widget.type) {
      case "metric":
        return renderMetricWidget(widget);
      case "chart":
        return renderChartWidget(widget);
      case "table":
        // TODO: Implement table widget
        return (
          <Card key={widget._id} className="h-full">
            <CardHeader>
              <CardTitle className="text-sm">{widget.title}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-gray-500">Table widget (coming soon)</div>
            </CardContent>
          </Card>
        );
      case "text":
        return (
          <Card key={widget._id} className="h-full">
            <CardContent className="pt-6">
              <div className="text-sm">{widget.title}</div>
            </CardContent>
          </Card>
        );
      default:
        return null;
    }
  };

  const getGridColumns = (width: number) => {
    switch (width) {
      case 12:
        return "col-span-12";
      case 6:
        return "col-span-6";
      case 4:
        return "col-span-4";
      case 3:
        return "col-span-3";
      case 2:
        return "col-span-2";
      case 1:
        return "col-span-1";
      default:
        return "col-span-4"; // Default to 4 columns for better width
    }
  };

  return (
    <div className="w-full h-full">
      <div className="max-w-[1800px] mx-auto">
        {/* Dashboard Header */}
        <div className="mb-8">
          <div className="flex items-start gap-4 mb-4">
            <div className="p-3 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-2xl shadow-lg flex-shrink-0">
              <svg className="w-8 h-8 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-3xl font-extrabold text-gray-900 mb-2 tracking-tight">
                {dashboard.name}
              </h1>
              {dashboard.description && (
                <p className="text-gray-600 text-sm">{dashboard.description}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm bg-white bg-opacity-80 px-4 py-2.5 rounded-xl shadow-sm border border-gray-100">
            <span className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4 text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span className="font-medium">Last updated:</span>
              <span className="text-gray-700">{new Date(dashboard.updatedAt).toLocaleString()}</span>
            </span>
            <span className="text-gray-300">•</span>
            <span className="flex items-center gap-2 text-gray-600">
              <svg className="w-4 h-4 text-purple-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5z" />
              </svg>
              <span className="font-bold text-gray-900">{widgets.length}</span>
              <span>widget{widgets.length !== 1 ? 's' : ''}</span>
            </span>
          </div>
        </div>

        {/* Dashboard Widgets */}
        <div className="space-y-6 w-full overflow-x-auto">
          {sortedRows.map((rowWidgets, rowIndex) => (
            <div key={rowIndex} className="grid grid-cols-12 gap-4 w-full min-w-max items-start">
              {rowWidgets.map((widget) => (
                <div
                  key={widget._id}
                  className={`${getGridColumns(widget.position.width)} flex`}
                  style={{
                    minHeight: widget.type === 'chart' 
                      ? `${Math.max(widget.position.height * 100, 350)}px` 
                      : `${Math.max(widget.position.height * 80, 220)}px`,
                    minWidth: widget.type === 'chart' ? '350px' : '250px',
                  }}
                >
                  {renderWidget(widget)}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Empty State */}
      {widgets.length === 0 && (
        <div className="flex items-center justify-center min-h-[500px]">
          <div className="text-center bg-white rounded-2xl p-12 shadow-xl border-2 border-gray-200">
            <div className="mx-auto w-24 h-24 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mb-6 shadow-inner">
              <svg className="w-12 h-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <p className="text-2xl font-bold text-gray-800 mb-3">No Widgets Yet</p>
            <p className="text-base text-gray-600 max-w-md mx-auto leading-relaxed">
              This dashboard doesn't have any widgets yet. Widgets will appear here once they're added through the AI assistant.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

