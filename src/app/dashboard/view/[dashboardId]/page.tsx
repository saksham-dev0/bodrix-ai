"use client";

import { use } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import KPIDashboard from "@/components/KPIDashboard";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface DashboardViewPageProps {
  params: Promise<{
    dashboardId: string;
  }>;
}

export default function DashboardViewPage({ params }: DashboardViewPageProps) {
  const router = useRouter();
  const resolvedParams = use(params);
  const dashboardId = resolvedParams.dashboardId as Id<"dashboards">;

  const dashboard = useQuery(api.dashboards.getDashboard, { dashboardId });
  
  // Get the spreadsheet to fetch sheet data
  const spreadsheet = useQuery(
    api.spreadsheets.getSpreadsheetData,
    dashboard?.spreadsheetId ? { spreadsheetId: dashboard.spreadsheetId } : "skip"
  );

  if (!dashboard) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 text-lg">Loading dashboard...</p>
        </div>
      </div>
    );
  }

  if (!spreadsheet) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mb-4"></div>
          <p className="text-gray-600 text-lg">Loading spreadsheet data...</p>
        </div>
      </div>
    );
  }

  // Parse the sheet data
  let sheetData: any[] = [];
  try {
    sheetData = JSON.parse(spreadsheet.data || "[]");
  } catch (e) {
    console.error("Error parsing sheet data:", e);
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-md border-b border-gray-200 shadow-sm">
        <div className="max-w-[1900px] mx-auto px-6 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.back()}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboards
            </Button>
          </div>
        </div>
      </div>

      {/* Dashboard Content */}
      <div className="px-6 py-8 bg-gradient-to-br from-slate-50 via-gray-50 to-blue-50 min-h-screen">
        <KPIDashboard dashboardId={dashboardId} sheetData={sheetData} />
      </div>
    </div>
  );
}

