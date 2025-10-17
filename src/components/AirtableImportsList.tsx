"use client";

import { useState } from "react";
import { useQuery, useAction } from "convex/react";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Loader2,
  MoreHorizontal,
  RefreshCw,
  ExternalLink,
  Trash2,
  Calendar,
  Database,
} from "lucide-react";
import Link from "next/link";
import { Id } from "../../convex/_generated/dataModel";
import { api } from "../../convex/_generated/api";

export function AirtableImportsList() {
  const [syncingId, setSyncingId] = useState<Id<"airtableImports"> | null>(null);
  const [deleteId, setDeleteId] = useState<Id<"airtableImports"> | null>(null);
  const [error, setError] = useState<string | null>(null);

  const imports = useQuery(api.integrations.getAirtableImports);
  const syncData = useAction(api.integrations.syncAirtableData);

  const handleSync = async (importId: Id<"airtableImports">) => {
    setSyncingId(importId);
    setError(null);

    try {
      const result = await syncData({ importId });
      if (!result.success) {
        setError(result.message);
      }
    } catch (err) {
      setError(`Sync failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    } finally {
      setSyncingId(null);
    }
  };

  const formatDate = (timestamp?: number) => {
    if (!timestamp) return "Never";
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatRecordCount = (count?: number) => {
    if (!count) return "Unknown";
    return count.toLocaleString();
  };

  if (!imports) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin" />
        <span className="ml-2">Loading imports...</span>
      </div>
    );
  }

  if (imports.length === 0) {
    return (
      <div className="text-center py-8">
        <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
        <h3 className="text-lg font-medium mb-2">No Airtable Imports</h3>
        <p className="text-muted-foreground">
          Import your first Airtable table to get started
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <div className="rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Table Name</TableHead>
              <TableHead>Base</TableHead>
              <TableHead>Records</TableHead>
              <TableHead>Last Synced</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-[50px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {imports.map((importRecord: any) => (
              <TableRow key={importRecord._id}>
                <TableCell className="font-medium">
                  <div className="flex items-center gap-2">
                    <Database className="h-4 w-4 text-muted-foreground" />
                    {importRecord.tableName}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{importRecord.baseId}</Badge>
                </TableCell>
                <TableCell>
                  <span className="text-sm text-muted-foreground">
                    {formatRecordCount(importRecord.recordCount)}
                  </span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Calendar className="h-4 w-4" />
                    {formatDate(importRecord.lastSyncedAt)}
                  </div>
                </TableCell>
                <TableCell>
                  <Badge
                    variant={
                      importRecord.lastSyncedAt
                        ? "default"
                        : "secondary"
                    }
                  >
                    {importRecord.lastSyncedAt ? "Synced" : "Pending"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          href={`/dashboard/projects/${importRecord.spreadsheet.projectId}/spreadsheet?id=${importRecord.spreadsheetId}`}
                          className="flex items-center gap-2"
                        >
                          <ExternalLink className="h-4 w-4" />
                          Open Spreadsheet
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleSync(importRecord._id)}
                        disabled={syncingId === importRecord._id}
                      >
                        {syncingId === importRecord._id ? (
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        ) : (
                          <RefreshCw className="mr-2 h-4 w-4" />
                        )}
                        Sync Now
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => setDeleteId(importRecord._id)}
                        className="text-destructive"
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete Import
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Import</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this Airtable import? This will remove
              the import record but keep the spreadsheet data. You can always re-import
              the table later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                // TODO: Implement delete functionality
                setDeleteId(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
