"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ChartJSFromRange from "@/components/ChartJSFromRange";
import ResizableAISidebar from "@/components/ResizableAISidebar";
import DashboardList from "@/components/DashboardList";
import {
  ArrowLeft,
  Save,
  Undo,
  Redo,
  Bold,
  Italic,
  Underline,
  Download,
  Upload,
  Trash2,
  Bot,
  LayoutDashboard,
  BarChart3,
} from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import SheetXSpreadsheetIframe, {
  SheetRef,
} from "@/components/sheetjs-xspreadsheet";
import { useUser } from "@clerk/nextjs";

interface SpreadsheetPageProps {
  params: Promise<{
    projectId: string;
  }>;
}

const SpreadsheetPage = ({ params }: SpreadsheetPageProps) => {
  const router = useRouter();
  const searchParams = useSearchParams();
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId as Id<"projects">;
  const { user, isSignedIn, isLoaded } = useUser();
  const spreadsheetIdFromQuery = searchParams.get("id") as Id<"spreadsheets"> | null;

  const [spreadsheetName, setSpreadsheetName] = useState(
    "Untitled Spreadsheet"
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<Id<"spreadsheets"> | null>(
    null
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);
  const [sheetDataCache, setSheetDataCache] = useState<any[] | null>(null);
  const [newChartRange, setNewChartRange] = useState("A1:B6");
  const [newChartType, setNewChartType] = useState<"line" | "bar" | "area" | "pie">("line");
  const [newChartTitle, setNewChartTitle] = useState("My Chart");
  const [selectedSheetName, setSelectedSheetName] = useState("Sheet1");
  const [activeSheetIndex, setActiveSheetIndex] = useState(0);
  const [activeSheetName, setActiveSheetName] = useState("Sheet1");
  const [selectedRange, setSelectedRange] = useState<string>("");
  const [isAISidebarOpen, setIsAISidebarOpen] = useState(false);
  const [bottomPanelTab, setBottomPanelTab] = useState<"charts" | "dashboards">("charts");

  const spreadsheetEngineRef = useRef<SheetRef>(null);

  // Check authentication
  useEffect(() => {
    if (isLoaded && !isSignedIn) {
      router.push("/sign-in");
    }
  }, [isLoaded, isSignedIn, router]);

  const createSpreadsheet = useMutation(api.spreadsheets.createSpreadsheet);
  const updateSpreadsheetName = useMutation(
    api.spreadsheets.updateSpreadsheetName
  );
  const exportCSV = useQuery(
    api.spreadsheets.exportSpreadsheetAsCSV,
    spreadsheetId ? { spreadsheetId } : "skip"
  );
  const importCSV = useMutation(api.spreadsheets.importCSVToSpreadsheet);

  // Get existing spreadsheets for this project
  const projectSpreadsheets = useQuery(
    api.spreadsheets.getProjectSpreadsheets,
    {
      projectId,
    }
  );

  // Charts
  const charts = useQuery(
    api.spreadsheets.listCharts,
    spreadsheetId ? { spreadsheetId } : "skip"
  );
  const createChart = useMutation(api.spreadsheets.createChart);
  const deleteChart = useMutation(api.spreadsheets.deleteChart);
  const spreadsheetDoc = useQuery(
    api.spreadsheets.getSpreadsheetData,
    spreadsheetId ? { spreadsheetId } : "skip"
  );

  // Create or load spreadsheet
  useEffect(() => {
    const initializeSpreadsheet = async () => {
      if (!projectSpreadsheets) return;

      console.log("Spreadsheet Page - Initializing...");
      console.log("Spreadsheet Page - Query param ID:", spreadsheetIdFromQuery);
      console.log("Spreadsheet Page - Available spreadsheets:", projectSpreadsheets);

      // If spreadsheet ID is provided in query parameter, load that specific spreadsheet
      if (spreadsheetIdFromQuery) {
        const targetSpreadsheet = projectSpreadsheets.find(
          (s) => s._id === spreadsheetIdFromQuery
        );
        if (targetSpreadsheet) {
          console.log("Spreadsheet Page - Loading target spreadsheet:", targetSpreadsheet);
          setSpreadsheetId(targetSpreadsheet._id);
          setSpreadsheetName(targetSpreadsheet.name);
          return;
        } else {
          console.log("Spreadsheet Page - Target spreadsheet not found in project");
        }
      }

      // Otherwise, load the first spreadsheet or create a new one
      if (projectSpreadsheets.length > 0) {
        const existingSpreadsheet = projectSpreadsheets[0];
        console.log("Spreadsheet Page - Loading first spreadsheet:", existingSpreadsheet);
        setSpreadsheetId(existingSpreadsheet._id);
        setSpreadsheetName(existingSpreadsheet.name);
      } else {
        try {
          console.log("Spreadsheet Page - Creating new spreadsheet");
          const newSpreadsheetId = await createSpreadsheet({
            projectId,
            name: spreadsheetName,
          });
          setSpreadsheetId(newSpreadsheetId);
          toast.success("Spreadsheet created successfully!");
        } catch (error) {
          console.error("Error creating spreadsheet:", error);
          toast.error("Failed to create spreadsheet");
        }
      }
    };

    initializeSpreadsheet();
  }, [projectSpreadsheets, projectId, createSpreadsheet, spreadsheetName, spreadsheetIdFromQuery]);

  const handleNameSave = async () => {
    if (spreadsheetId && spreadsheetName.trim()) {
      try {
        await updateSpreadsheetName({
          spreadsheetId,
          name: spreadsheetName.trim(),
        });
        setIsEditingName(false);
        toast.success("Spreadsheet name updated!");
      } catch (error) {
        console.error("Error updating spreadsheet name:", error);
        toast.error("Failed to update spreadsheet name");
      }
    } else {
      setIsEditingName(false);
    }
  };

  // Handlers for data changes
  const handleDataChange = useCallback((data: any[]) => {
    setSheetDataCache(data);
    setHasChanges(true);
  }, []);

  const handleActiveSheetChange = useCallback((sheetName: string, sheetIndex: number) => {
    console.log("Active sheet changed:", { sheetName, sheetIndex });
    setActiveSheetName(sheetName);
    setActiveSheetIndex(sheetIndex);
    // Update selected sheet name when active sheet changes
    setSelectedSheetName(sheetName);
  }, []);

  const handleSelectionChange = useCallback((rangeA1: string) => {
    setSelectedRange(rangeA1);
    setNewChartRange(rangeA1);
  }, []);

  const handleSave = useCallback(async () => {
    if (spreadsheetEngineRef.current) {
      try {
        await spreadsheetEngineRef.current.saveChanges();
        toast.success("Changes saved successfully!");
        setHasChanges(false);
        setRefreshTrigger((prev) => prev + 1);
      } catch (error) {
        toast.error("Failed to save changes");
        console.error("Save error:", error);
      }
    }
  }, []);

  const handleExportCSV = useCallback(() => {
    if (!exportCSV || !spreadsheetName) return;

    try {
      const blob = new Blob([exportCSV], { type: "text/csv;charset=utf-8;" });
      const link = document.createElement("a");
      const url = URL.createObjectURL(blob);
      link.setAttribute("href", url);
      link.setAttribute("download", `${spreadsheetName}.csv`);
      link.style.visibility = "hidden";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      toast.success("Spreadsheet exported successfully!");
    } catch (error) {
      console.error("Error exporting CSV:", error);
      toast.error("Failed to export spreadsheet");
    }
  }, [exportCSV, spreadsheetName]);

  const handleImportCSV = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      if (!file || !spreadsheetId) return;

      if (!file.name.toLowerCase().endsWith(".csv")) {
        toast.error("Please select a CSV file");
        return;
      }

      try {
        const text = await file.text();
        await importCSV({
          spreadsheetId,
          csvData: text,
        });
        toast.success("CSV imported successfully!");
        setRefreshTrigger((prev) => prev + 1);
        event.target.value = "";
      } catch (error) {
        console.error("Error importing CSV:", error);
        toast.error("Failed to import CSV file");
      }
    },
    [importCSV, spreadsheetId]
  );

  const handleDeleteChart = useCallback(async (chartId: Id<"charts">) => {
    try {
      await deleteChart({ chartId });
      toast.success("Chart deleted successfully!");
    } catch (error) {
      console.error("Error deleting chart:", error);
      toast.error("Failed to delete chart");
    }
  }, [deleteChart]);

  if (!isLoaded) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="text-muted-foreground mb-4">
            Please sign in to access the spreadsheet
          </div>
          <Button onClick={() => router.push("/sign-in")}>Sign In</Button>
        </div>
      </div>
    );
  }

  if (!spreadsheetId) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-muted-foreground">Loading spreadsheet...</div>
      </div>
    );
  }

  return (
    <div className="h-full w-full flex flex-col min-w-0 relative">
      {/* AI Sidebar */}
      <ResizableAISidebar
        spreadsheetId={spreadsheetId}
        sheetData={sheetDataCache || spreadsheetEngineRef.current?.getData() || []}
        selectedRange={selectedRange}
        activeSheetName={activeSheetName}
        isOpen={isAISidebarOpen}
        onToggle={() => setIsAISidebarOpen(!isAISidebarOpen)}
      />

      {/* Header */}
      <div className="border-b bg-white flex-shrink-0 w-full min-w-0">
        <div className="px-3 py-2 w-full min-w-0">
          <div className="flex items-center justify-between gap-1 w-full min-w-0">
            {/* Left side */}
            <div className="flex items-center gap-1 min-w-0 flex-1">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.back()}
                className="flex items-center gap-1 flex-shrink-0 px-1 h-7"
              >
                <ArrowLeft className="w-3 h-3" />
                <span className="hidden md:inline text-xs">Back</span>
              </Button>

              <div className="min-w-0 flex-1">
                {isEditingName ? (
                  <Input
                    value={spreadsheetName}
                    onChange={(e) => setSpreadsheetName(e.target.value)}
                    onBlur={handleNameSave}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleNameSave();
                      }
                    }}
                    className="text-xs font-semibold min-w-0 h-7"
                    autoFocus
                  />
                ) : (
                  <h1
                    className="text-xs font-semibold cursor-pointer hover:bg-gray-100 px-1 py-1 rounded truncate h-7 flex items-center"
                    onClick={() => setIsEditingName(true)}
                  >
                    {spreadsheetName}
                  </h1>
                )}
              </div>
            </div>

            {/* Toolbar */}
            <div className="flex items-center gap-0.5 flex-shrink-0">
              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                <Undo className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                <Redo className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                <Bold className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                <Italic className="w-3 h-3" />
              </Button>
              <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                <Underline className="w-3 h-3" />
              </Button>
              <div className="h-7 w-px bg-border mx-0.5" />
              <Button
                variant="outline"
                size="sm"
                className="h-7 w-7 p-0"
                onClick={handleExportCSV}
                disabled={!exportCSV}
                title="Export CSV"
              >
                <Download className="w-3 h-3" />
              </Button>
              <div className="relative">
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleImportCSV}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  title="Import CSV"
                />
                <Button variant="outline" size="sm" className="h-7 w-7 p-0">
                  <Upload className="w-3 h-3" />
                </Button>
              </div>
              <Button
                size="sm"
                className="h-7 px-1 text-xs"
                onClick={handleSave}
                disabled={!hasChanges}
                title={hasChanges ? "Save changes" : "No changes to save"}
              >
                <Save className="w-3 h-3 mr-0.5" />
                <span className="hidden lg:inline">Save</span>
              </Button>
              <div className="h-7 w-px bg-border mx-0.5" />
              <Button
                variant="outline"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => setIsAISidebarOpen(!isAISidebarOpen)}
                title="Open AI Assistant"
              >
                <Bot className="w-3 h-3 mr-1" />
                <span className="hidden lg:inline">AI</span>
              </Button>
              <div className="h-7 w-px bg-border mx-0.5" />
              <Select value={selectedSheetName} onValueChange={setSelectedSheetName}>
                <SelectTrigger className="h-7 w-20 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(sheetDataCache || 
                    spreadsheetEngineRef.current?.getData() || 
                    (spreadsheetDoc?.data ? JSON.parse(spreadsheetDoc.data) : [])
                  ).map((sheet: any, index: number) => (
                    <SelectItem key={index} value={sheet.name || `Sheet${index + 1}`}>
                      {sheet.name || `Sheet${index + 1}`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={newChartRange}
                onChange={(e) => setNewChartRange(e.target.value)}
                placeholder="Range e.g. A1:C10"
                className="h-7 w-28 text-xs"
              />
              <select
                value={newChartType}
                onChange={(e) => setNewChartType(e.target.value as any)}
                className="h-7 text-xs border rounded px-1"
              >
                <option value="line">Line</option>
                <option value="bar">Bar</option>
                <option value="area">Area</option>
                <option value="pie">Pie</option>
              </select>
              <Input
                value={newChartTitle}
                onChange={(e) => setNewChartTitle(e.target.value)}
                placeholder="Chart title"
                className="h-7 w-28 text-xs"
              />
              <Button
                size="sm"
                className="h-7 px-1 text-xs"
                onClick={async () => {
                  if (!spreadsheetId) return;
                  try {
                    await createChart({
                      spreadsheetId,
                      title: newChartTitle || "Chart",
                      type: newChartType,
                      range: newChartRange,
                      sheetName: selectedSheetName,
                    });
                    toast.success("Chart added");
                  } catch (e) {
                    toast.error("Failed to add chart");
                  }
                }}
              >
                Add chart
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Spreadsheet */}
      <div className="flex-1 overflow-hidden min-w-0">
        <SheetXSpreadsheetIframe
          ref={spreadsheetEngineRef}
          onDataChange={handleDataChange}
          spreadsheetId={spreadsheetId}
          refreshTrigger={refreshTrigger}
          onSelectionChange={handleSelectionChange}
          onActiveSheetChange={handleActiveSheetChange}
        />
      </div>

      {/* Charts & Dashboards Panel */}
      <div className="border-t bg-white flex-shrink-0 w-full">
        <div className="px-3 py-2 grid gap-2">
          {/* Tabs */}
          <div className="flex items-center gap-2 border-b">
            <Button
              variant={bottomPanelTab === "charts" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setBottomPanelTab("charts")}
            >
              <BarChart3 className="w-3 h-3 mr-1" />
              Charts
            </Button>
            <Button
              variant={bottomPanelTab === "dashboards" ? "default" : "ghost"}
              size="sm"
              className="h-8 px-3 text-xs"
              onClick={() => setBottomPanelTab("dashboards")}
            >
              <LayoutDashboard className="w-3 h-3 mr-1" />
              Dashboards
            </Button>
          </div>

          {/* Charts Tab Content */}
          {bottomPanelTab === "charts" && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-2">
              {charts?.map((c, idx) => (
                <div key={`${c._id}-${idx}`} className="border rounded p-2 relative group">
                  <div className="absolute top-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button
                      variant="destructive"
                      size="sm"
                      className="h-6 w-6 p-0"
                      onClick={() => handleDeleteChart(c._id)}
                      title="Delete chart"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                  <ChartJSFromRange
                    sheetData={
                      sheetDataCache ||
                      spreadsheetEngineRef.current?.getData() ||
                      (spreadsheetDoc?.data ? JSON.parse(spreadsheetDoc.data) : [])
                    }
                    range={c.range}
                    type={c.type as any}
                    title={c.title}
                    showSheetName={true}
                    sheetName={c.sheetName || "Sheet1"}
                  />
                </div>
              ))}
              {!charts?.length && (
                <div className="text-xs text-muted-foreground px-1">No charts yet.</div>
              )}
            </div>
          )}

          {/* Dashboards Tab Content */}
          {bottomPanelTab === "dashboards" && spreadsheetId && (
            <DashboardList spreadsheetId={spreadsheetId} />
          )}
        </div>
      </div>
    </div>
  );
};

export default SpreadsheetPage;
