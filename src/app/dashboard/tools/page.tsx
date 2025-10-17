"use client";

import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Database,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  ExternalLink,
  Settings,
} from "lucide-react";
import { AirtableConnectionDialog } from "@/components/AirtableConnectionDialog";
import { AirtableImportDialog } from "@/components/AirtableImportDialog";
import { AirtableImportsList } from "@/components/AirtableImportsList";
import { api } from "../../../../convex/_generated/api";

const Page = () => {
  const [showConnectionDialog, setShowConnectionDialog] = useState(false);
  const [showImportDialog, setShowImportDialog] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const integrations = useQuery(api.integrations.getUserIntegrations);
  const disconnectAirtable = useMutation(api.integrations.disconnectAirtable);

  const airtableIntegration = integrations?.find(
    (integration: any) => integration.provider === "airtable"
  );

  const handleConnect = () => {
    setShowConnectionDialog(true);
    setError(null);
  };

  const handleDisconnect = async () => {
    try {
      const result = await disconnectAirtable();
      if (!result.success) {
        setError(result.message);
      }
    } catch (err) {
      setError(`Disconnect failed: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  };

  const handleConnected = () => {
    // Refresh integrations data
    setError(null);
  };

  const handleImported = () => {
    // Refresh imports data
    setError(null);
  };

  const getConnectionStatus = () => {
    if (!airtableIntegration) return { status: "disconnected", color: "secondary" };
    
    switch (airtableIntegration.status) {
      case "active":
        return { status: "Connected", color: "default" };
      case "error":
        return { status: "Error", color: "destructive" };
      case "disconnected":
        return { status: "Disconnected", color: "secondary" };
      default:
        return { status: "Unknown", color: "secondary" };
    }
  };

  const connectionStatus = getConnectionStatus();

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Tools & Agents</h1>
          <p className="text-muted-foreground">
            Manage your integrations and AI agents
          </p>
        </div>
      </div>

      {error && (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Integrations Section */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">Integrations</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Airtable Integration Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Database className="h-5 w-5 text-blue-600" />
                  <CardTitle className="text-lg">Airtable</CardTitle>
                </div>
                <Badge variant={connectionStatus.color as any}>
                  {connectionStatus.status}
                </Badge>
              </div>
              <CardDescription>
                Import data from your Airtable bases into Bodrix spreadsheets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {airtableIntegration ? (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Connected to Airtable
                  </div>
                  {airtableIntegration.metadata?.accountName && (
                    <div className="text-sm">
                      Account: {airtableIntegration.metadata.accountName}
                    </div>
                  )}
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      onClick={() => setShowImportDialog(true)}
                      disabled={airtableIntegration.status !== "active"}
                    >
                      <Plus className="h-4 w-4 mr-1" />
                      Import Data
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={handleDisconnect}
                    >
                      <Settings className="h-4 w-4 mr-1" />
                      Disconnect
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="text-sm text-muted-foreground">
                    Connect your Airtable account to start importing data
                  </div>
                  <Button size="sm" onClick={handleConnect}>
                    <Database className="h-4 w-4 mr-1" />
                    Connect Airtable
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Placeholder for future integrations */}
          <Card className="opacity-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded" />
                <CardTitle className="text-lg">Google Sheets</CardTitle>
              </div>
              <CardDescription>
                Coming soon: Import from Google Sheets
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>

          <Card className="opacity-50">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 bg-muted rounded" />
                <CardTitle className="text-lg">Notion</CardTitle>
              </div>
              <CardDescription>
                Coming soon: Import from Notion databases
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button size="sm" disabled>
                Coming Soon
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Airtable Imports Section */}
      {airtableIntegration && airtableIntegration.status === "active" && (
        <>
          <Separator />
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-semibold">Airtable Imports</h2>
              <Button onClick={() => setShowImportDialog(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Import New Table
              </Button>
            </div>
            <AirtableImportsList />
          </div>
        </>
      )}

      {/* AI Agents Section */}
      <Separator />
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-semibold">AI Agents</h2>
        </div>
        <Card>
          <CardHeader>
            <CardTitle>AI Agent Management</CardTitle>
            <CardDescription>
              Configure and manage your AI agents for data analysis and insights
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-center py-8">
              <div className="h-12 w-12 bg-muted rounded-lg mx-auto mb-4 flex items-center justify-center">
                <Settings className="h-6 w-6 text-muted-foreground" />
              </div>
              <h3 className="text-lg font-medium mb-2">AI Agent Settings</h3>
              <p className="text-muted-foreground mb-4">
                Manage your AI agents from within any spreadsheet
              </p>
              <Button variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                Open Spreadsheet to Configure Agents
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Dialogs */}
      <AirtableConnectionDialog
        open={showConnectionDialog}
        onOpenChange={setShowConnectionDialog}
        onConnected={handleConnected}
      />

      <AirtableImportDialog
        open={showImportDialog}
        onOpenChange={setShowImportDialog}
        onImported={handleImported}
      />
    </div>
  );
};

export default Page;
