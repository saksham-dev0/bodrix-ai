"use client";

import { useState, useEffect, useCallback, useRef, use } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { Id } from "../../../../../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
} from "lucide-react";
import { useRouter } from "next/navigation";
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
  const resolvedParams = use(params);
  const projectId = resolvedParams.projectId as Id<"projects">;
  const { user, isSignedIn, isLoaded } = useUser();

  const [spreadsheetName, setSpreadsheetName] = useState(
    "Untitled Spreadsheet"
  );
  const [isEditingName, setIsEditingName] = useState(false);
  const [spreadsheetId, setSpreadsheetId] = useState<Id<"spreadsheets"> | null>(
    null
  );
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [hasChanges, setHasChanges] = useState(false);

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

  // Create or load spreadsheet
  useEffect(() => {
    const initializeSpreadsheet = async () => {
      if (!projectSpreadsheets) return;

      if (projectSpreadsheets.length > 0) {
        const existingSpreadsheet = projectSpreadsheets[0];
        setSpreadsheetId(existingSpreadsheet._id);
        setSpreadsheetName(existingSpreadsheet.name);
      } else {
        try {
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
  }, [projectSpreadsheets, projectId, createSpreadsheet, spreadsheetName]);

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
    console.log("Data change logged:", data);
    setHasChanges(true);
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
    <div className="h-full w-full flex flex-col min-w-0">
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
        />
      </div>
    </div>
  );
};

export default SpreadsheetPage;
