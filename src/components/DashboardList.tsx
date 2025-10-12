"use client";

import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
import { LayoutDashboard, Trash2, Eye, Calendar, TrendingUp, BarChart3, PieChart } from "lucide-react";
import { toast } from "sonner";

interface DashboardListProps {
  spreadsheetId: Id<"spreadsheets">;
}

export default function DashboardList({ spreadsheetId }: DashboardListProps) {
  const router = useRouter();
  const [dashboardToDelete, setDashboardToDelete] = useState<Id<"dashboards"> | null>(null);

  const dashboards = useQuery(api.dashboards.getDashboards, { spreadsheetId });
  const deleteDashboard = useMutation(api.dashboards.deleteDashboard);

  const handleDeleteDashboard = async () => {
    if (!dashboardToDelete) return;

    try {
      await deleteDashboard({ dashboardId: dashboardToDelete });
      toast.success("Dashboard deleted successfully");
      setDashboardToDelete(null);
    } catch (error) {
      console.error("Error deleting dashboard:", error);
      toast.error("Failed to delete dashboard");
    }
  };

  const handleViewDashboard = (dashboardId: Id<"dashboards">) => {
    router.push(`/dashboard/view/${dashboardId}`);
  };

  const formatDate = (timestamp: number) => {
    return new Date(timestamp).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  if (!dashboards) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="flex flex-col items-center gap-3">
          <div className="inline-block animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
          <p className="text-gray-600 font-medium">Loading dashboards...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="w-full">
        {dashboards.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-96 text-center bg-gradient-to-br from-slate-50 to-blue-50 rounded-2xl border-2 border-dashed border-gray-300 p-8">
            <div className="p-6 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full mb-6">
              <LayoutDashboard className="w-16 h-16 text-blue-600" />
            </div>
            <h3 className="text-2xl font-bold text-gray-900 mb-3">No dashboards yet</h3>
            <p className="text-base text-gray-600 max-w-lg leading-relaxed">
              Create stunning KPI dashboards by asking the AI assistant. Simply open the AI chat and say
              <span className="font-semibold text-blue-600"> &quot;Create a dashboard&quot;</span> or
              <span className="font-semibold text-blue-600"> &quot;Make a KPI dashboard&quot;</span> to get started.
            </p>
            <div className="mt-6 flex items-center gap-4">
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <TrendingUp className="w-4 h-4 text-green-600" />
                <span>Track metrics</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                <span>Visualize data</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-500">
                <PieChart className="w-4 h-4 text-orange-600" />
                <span>Make decisions</span>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold text-gray-900">Your Dashboards</h2>
                <p className="text-sm text-gray-600 mt-1">
                  {dashboards.length} {dashboards.length === 1 ? "dashboard" : "dashboards"} available
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {dashboards.map((dashboard) => {
                return (
                  <Card
                    key={dashboard._id}
                    className="group hover:shadow-2xl hover:scale-[1.02] transition-all duration-300 border-2 border-gray-200 hover:border-blue-400 bg-gradient-to-br from-white to-gray-50 overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-blue-500 via-purple-500 to-pink-500"></div>
                    
                    <CardHeader className="pb-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2">
                            <div className="p-2 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg shadow-md">
                              <LayoutDashboard className="w-5 h-5 text-white" />
                            </div>
                            <CardTitle className="text-lg font-bold text-gray-900 truncate">
                              {dashboard.name}
                            </CardTitle>
                          </div>
                          {dashboard.description && (
                            <CardDescription className="text-sm line-clamp-2 leading-relaxed">
                              {dashboard.description}
                            </CardDescription>
                          )}
                        </div>
                      </div>
                    </CardHeader>

                    <CardContent className="space-y-4">
                      {/* Stats */}
                      <div className="flex items-center gap-3 p-3 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg border border-blue-100">
                        <div className="flex items-center gap-2 flex-1">
                          <BarChart3 className="w-4 h-4 text-blue-600" />
                          <span className="text-sm font-semibold text-gray-700">
                            {dashboard.chartCount} {dashboard.chartCount === 1 ? "Chart" : "Charts"}
                          </span>
                        </div>
                        <div className="w-px h-5 bg-blue-200"></div>
                        <div className="flex items-center gap-2 flex-1">
                          <TrendingUp className="w-4 h-4 text-green-600" />
                          <span className="text-sm font-semibold text-gray-700">
                            {dashboard.metricCount} {dashboard.metricCount === 1 ? "Metric" : "Metrics"}
                          </span>
                        </div>
                      </div>

                      {/* Date */}
                      <div className="flex items-center text-sm text-gray-600 px-1">
                        <Calendar className="w-4 h-4 mr-2 text-gray-400" />
                        <span>Created {formatDate(dashboard.createdAt)}</span>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        <Button
                          variant="default"
                          size="sm"
                          className="flex-1 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all"
                          onClick={() => handleViewDashboard(dashboard._id)}
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Dashboard
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-2 border-red-300 text-red-600 hover:bg-red-50 hover:border-red-400"
                          onClick={() => setDashboardToDelete(dashboard._id)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={!!dashboardToDelete}
        onOpenChange={() => setDashboardToDelete(null)}
      >
        <AlertDialogContent className="border-2">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold">Delete Dashboard?</AlertDialogTitle>
            <AlertDialogDescription className="text-base">
              This will permanently delete the dashboard and all its widgets. This action cannot be
              undone. Are you sure you want to continue?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="font-medium">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteDashboard}
              className="bg-red-600 hover:bg-red-700 font-medium"
            >
              Delete Dashboard
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

