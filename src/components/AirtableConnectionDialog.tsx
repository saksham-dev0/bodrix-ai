"use client";

import { useState } from "react";
import { useMutation, useAction } from "convex/react";
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
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Loader2, ExternalLink, CheckCircle, XCircle } from "lucide-react";
import { api } from "../../convex/_generated/api";

interface AirtableConnectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConnected: () => void;
}

export function AirtableConnectionDialog({
  open,
  onOpenChange,
  onConnected,
}: AirtableConnectionDialogProps) {
  const [accessToken, setAccessToken] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const testConnection = useAction(api.integrations.testAirtableConnection);
  const connectAirtable = useMutation(api.integrations.connectAirtable);

  const handleTestConnection = async () => {
    if (!accessToken.trim()) {
      setTestResult({
        success: false,
        message: "Please enter your Personal Access Token",
      });
      return;
    }

    setIsTesting(true);
    setTestResult(null);

    try {
      const result = await testConnection({ accessToken: accessToken.trim() });
      setTestResult(result);
    } catch (error) {
      setTestResult({
        success: false,
        message: `Test failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleConnect = async () => {
    if (!accessToken.trim()) {
      setTestResult({
        success: false,
        message: "Please enter your Personal Access Token",
      });
      return;
    }

    setIsConnecting(true);

    try {
      const result = await connectAirtable({ accessToken: accessToken.trim() });
      
      if (result.success) {
        onConnected();
        onOpenChange(false);
        setAccessToken("");
        setTestResult(null);
      } else {
        setTestResult({
          success: false,
          message: result.message,
        });
      }
    } catch (error) {
      setTestResult({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    } finally {
      setIsConnecting(false);
    }
  };

  const handleClose = () => {
    onOpenChange(false);
    setAccessToken("");
    setTestResult(null);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Connect to Airtable</DialogTitle>
          <DialogDescription>
            Connect your Airtable account using a Personal Access Token to import
            your data into Bodrix spreadsheets.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="access-token">Personal Access Token</Label>
            <Input
              id="access-token"
              type="password"
              placeholder="patXXXXXXXXXXXXXX.XXXXXXXXXXXXXX"
              value={accessToken}
              onChange={(e) => setAccessToken(e.target.value)}
              disabled={isTesting || isConnecting}
            />
            <div className="text-sm text-muted-foreground">
              <p>
                Don't have a Personal Access Token?{" "}
                <a
                  href="https://airtable.com/create/tokens"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline inline-flex items-center gap-1"
                >
                  Create one here
                  <ExternalLink className="h-3 w-3" />
                </a>
              </p>
              <p className="mt-1 text-xs">
                <strong>Required scopes:</strong>
              </p>
              <ul className="mt-1 text-xs space-y-1 list-disc list-inside">
                <li><code className="bg-muted px-1 rounded">data.records:read</code></li>
                <li><code className="bg-muted px-1 rounded">schema.bases:read</code></li>
              </ul>
              <p className="mt-2 text-xs">
                <strong>Important:</strong> After creating your token, you must add at least one base to it from your Airtable workspace.
              </p>
            </div>
          </div>

          {testResult && (
            <Alert variant={testResult.success ? "default" : "destructive"}>
              <div className="flex items-center gap-2">
                {testResult.success ? (
                  <CheckCircle className="h-4 w-4" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                <AlertDescription>{testResult.message}</AlertDescription>
              </div>
            </Alert>
          )}
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={handleTestConnection}
            disabled={isTesting || isConnecting || !accessToken.trim()}
            className="w-full sm:w-auto"
          >
            {isTesting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Testing...
              </>
            ) : (
              "Test Connection"
            )}
          </Button>
          <Button
            onClick={handleConnect}
            disabled={isConnecting || !testResult?.success}
            className="w-full sm:w-auto"
          >
            {isConnecting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              "Connect"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
