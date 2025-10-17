"use client";

import { useState, useEffect } from "react";
import { useMutation, useQuery, useAction } from "convex/react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Loader2,
  CheckCircle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Database,
  Table as TableIcon,
} from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface AirtableImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: () => void;
}

type ImportStep = "base" | "table" | "preview" | "confirm";

interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

interface AirtableTable {
  id: string;
  name: string;
  description?: string;
  primaryFieldId: string;
  fields: Array<{
    id: string;
    name: string;
    type: string;
  }>;
}

interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, any>;
}

export function AirtableImportDialog({
  open,
  onOpenChange,
  onImported,
}: AirtableImportDialogProps) {
  const [currentStep, setCurrentStep] = useState<ImportStep>("base");
  const [selectedBase, setSelectedBase] = useState<AirtableBase | null>(null);
  const [selectedTable, setSelectedTable] = useState<AirtableTable | null>(null);
  const [previewRecords, setPreviewRecords] = useState<AirtableRecord[]>([]);
  const [spreadsheetName, setSpreadsheetName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [availableBases, setAvailableBases] = useState<AirtableBase[]>([]);
  const [availableTables, setAvailableTables] = useState<AirtableTable[]>([]);

  const listBases = useAction(api.integrations.listAirtableBases);
  const listTables = useAction(api.integrations.listAirtableTables);
  const fetchTableData = useAction(api.integrations.fetchAirtableTableData);
  const importTable = useAction(api.integrations.importAirtableTable);

  // Reset state when dialog opens
  useEffect(() => {
    if (open) {
      setCurrentStep("base");
      setSelectedBase(null);
      setSelectedTable(null);
      setPreviewRecords([]);
      setSpreadsheetName("");
      setError(null);
      setAvailableBases([]);
      setAvailableTables([]);
      // Load bases immediately when dialog opens
      loadBases();
    }
  }, [open]);
  
  const loadBases = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await listBases();
      if (result.success && result.bases) {
        setAvailableBases(result.bases);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(`Failed to load bases: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleNext = async () => {
    setError(null);
    setIsLoading(true);

    try {
      if (currentStep === "base") {
        if (!selectedBase) {
          setError("Please select a base");
          setIsLoading(false);
          return;
        }
        // Load tables for the selected base
        const result = await listTables({ baseId: selectedBase.id });
        if (!result.success || !result.tables) {
          setError(result.message);
          setIsLoading(false);
          return;
        }
        setAvailableTables(result.tables);
        setCurrentStep("table");
      } else if (currentStep === "table") {
        if (!selectedTable) {
          setError("Please select a table");
          setIsLoading(false);
          return;
        }
        setCurrentStep("preview");
      } else if (currentStep === "preview") {
        if (!selectedTable) {
          setError("Please select a table");
          setIsLoading(false);
          return;
        }
        // Load preview data
        const result = await fetchTableData({
          baseId: selectedBase!.id,
          tableId: selectedTable.id,
          maxRecords: 5,
        });
        if (!result.success) {
          setError(result.message);
          setIsLoading(false);
          return;
        }
        setPreviewRecords(result.records || []);
        setSpreadsheetName(`${selectedTable.name} - Import`);
        setCurrentStep("confirm");
      }
    } catch (err) {
      setError(`Error: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleBack = () => {
    setError(null);
    if (currentStep === "table") {
      setCurrentStep("base");
    } else if (currentStep === "preview") {
      setCurrentStep("table");
    } else if (currentStep === "confirm") {
      setCurrentStep("preview");
    }
  };

  const handleImport = async () => {
    if (!selectedBase || !selectedTable) {
      setError("Missing required information");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const result = await importTable({
        baseId: selectedBase.id,
        tableId: selectedTable.id,
        tableName: selectedTable.name,
        spreadsheetName: spreadsheetName.trim(),
      });

      if (result.success) {
        onImported();
        onOpenChange(false);
      } else {
        setError(result.message);
      }
    } catch (err) {
      setError(`Import failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
  };

  const getStepProgress = () => {
    const steps = ["base", "table", "preview", "confirm"];
    const currentIndex = steps.indexOf(currentStep);
    return ((currentIndex + 1) / steps.length) * 100;
  };

  const renderStepContent = () => {
    switch (currentStep) {
      case "base":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select Airtable Base</h3>
              <p className="text-sm text-muted-foreground">
                Choose which Airtable base you want to import from
              </p>
            </div>
            <div className="space-y-2">
              <Label>Available Bases</Label>
              <Select 
                value={selectedBase?.id} 
                onValueChange={(value) => {
                  const base = availableBases.find(b => b.id === value);
                  if (base) setSelectedBase(base);
                }}
                disabled={isLoading || availableBases.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={isLoading ? "Loading bases..." : availableBases.length === 0 ? "No bases found" : "Select a base..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableBases.map((base) => (
                    <SelectItem key={base.id} value={base.id}>
                      {base.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "table":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <TableIcon className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium">Select Table</h3>
              <p className="text-sm text-muted-foreground">
                Choose which table from {selectedBase?.name} to import
              </p>
            </div>
            <div className="space-y-2">
              <Label>Available Tables</Label>
              <Select 
                value={selectedTable?.id}
                onValueChange={(value) => {
                  const table = availableTables.find(t => t.id === value);
                  if (table) setSelectedTable(table);
                }}
                disabled={availableTables.length === 0}
              >
                <SelectTrigger>
                  <SelectValue placeholder={availableTables.length === 0 ? "No tables found" : "Select a table..."} />
                </SelectTrigger>
                <SelectContent>
                  {availableTables.map((table) => (
                    <SelectItem key={table.id} value={table.id}>
                      {table.name} ({table.fields.length} fields)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        );

      case "preview":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium">Ready to Import</h3>
              <p className="text-sm text-muted-foreground">
                Click "Next" to preview {selectedTable?.name} data
              </p>
            </div>
            <div className="p-4 bg-muted rounded-md">
              <p className="text-sm">
                <strong>Note:</strong> A new project will be automatically created for this Airtable import to keep your data organized.
              </p>
            </div>
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-4">
            <div className="text-center">
              <h3 className="text-lg font-medium">Confirm Import</h3>
              <p className="text-sm text-muted-foreground">
                Review your import settings
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <Label className="text-muted-foreground">Base</Label>
                  <p className="font-medium">{selectedBase?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Table</Label>
                  <p className="font-medium">{selectedTable?.name}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Fields</Label>
                  <p className="font-medium">{selectedTable?.fields.length}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">Records (Preview)</Label>
                  <p className="font-medium">{previewRecords.length}</p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="spreadsheet-name">Spreadsheet Name</Label>
                <Input
                  id="spreadsheet-name"
                  value={spreadsheetName}
                  onChange={(e) => setSpreadsheetName(e.target.value)}
                  placeholder="Enter spreadsheet name..."
                />
              </div>

              {previewRecords.length > 0 && (
                <div className="space-y-2">
                  <Label>Data Preview (First 5 Records)</Label>
                  <div className="border rounded-md max-h-48 overflow-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          {Object.keys(previewRecords[0].fields).map((fieldName) => (
                            <TableHead key={fieldName} className="text-xs">
                              {fieldName}
                            </TableHead>
                          ))}
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {previewRecords.map((record) => (
                          <TableRow key={record.id}>
                            {Object.keys(previewRecords[0].fields).map((fieldName) => (
                              <TableCell key={fieldName} className="text-xs">
                                {record.fields[fieldName] !== undefined
                                  ? String(record.fields[fieldName])
                                  : ""}
                              </TableCell>
                            ))}
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </div>
              )}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Import from Airtable</DialogTitle>
          <DialogDescription>
            Import data from your Airtable tables into Bodrix spreadsheets
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Progress Bar */}
          <div className="space-y-2">
            <div className="flex justify-between text-sm text-muted-foreground">
              <span>Step {["base", "table", "preview", "confirm"].indexOf(currentStep) + 1} of 4</span>
              <span>{Math.round(getStepProgress())}%</span>
            </div>
            <Progress value={getStepProgress()} className="h-2" />
          </div>

          {/* Step Content */}
          {renderStepContent()}

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <XCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <div className="flex gap-2 w-full sm:w-auto">
            {currentStep !== "base" && (
              <Button
                variant="outline"
                onClick={handleBack}
                disabled={isLoading}
                className="flex-1 sm:flex-none"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back
              </Button>
            )}
            {currentStep !== "confirm" ? (
              <Button
                onClick={handleNext}
                disabled={isLoading || (currentStep === "base" && !selectedBase) || (currentStep === "table" && !selectedTable)}
                className="flex-1 sm:flex-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Loading...
                  </>
                ) : (
                  <>
                    Next
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </>
                )}
              </Button>
            ) : (
              <Button
                onClick={handleImport}
                disabled={isLoading || !spreadsheetName.trim()}
                className="flex-1 sm:flex-none"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Importing...
                  </>
                ) : (
                  <>
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Import Data
                  </>
                )}
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
