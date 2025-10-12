import { query, mutation, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

/**
 * Get all dashboards for a spreadsheet
 */
export const getDashboards = query({
  args: {
    spreadsheetId: v.id("spreadsheets"),
  },
  returns: v.array(
    v.object({
      _id: v.id("dashboards"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      ownerId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      widgetsData: v.string(),
      layout: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      chartCount: v.number(),
      metricCount: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to view dashboards");
    }

    const dashboards = await ctx.db
      .query("dashboards")
      .withIndex("by_spreadsheet", (q) =>
        q.eq("spreadsheetId", args.spreadsheetId)
      )
      .order("desc")
      .collect();

    // Fetch widget counts for each dashboard
    const dashboardsWithCounts = await Promise.all(
      dashboards.map(async (dashboard) => {
        const widgets = await ctx.db
          .query("dashboardWidgets")
          .withIndex("by_dashboard", (q) => q.eq("dashboardId", dashboard._id))
          .collect();

        const chartCount = widgets.filter((w) => w.type === "chart").length;
        const metricCount = widgets.filter((w) => w.type === "metric").length;

        return {
          ...dashboard,
          chartCount,
          metricCount,
        };
      })
    );

    return dashboardsWithCounts;
  },
});

/**
 * Get a single dashboard by ID
 */
export const getDashboard = query({
  args: {
    dashboardId: v.id("dashboards"),
  },
  returns: v.union(
    v.object({
      _id: v.id("dashboards"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      ownerId: v.id("users"),
      name: v.string(),
      description: v.optional(v.string()),
      widgetsData: v.string(),
      layout: v.optional(v.string()),
      createdAt: v.number(),
      updatedAt: v.number(),
      widgets: v.array(
        v.object({
          _id: v.id("dashboardWidgets"),
          _creationTime: v.number(),
          dashboardId: v.id("dashboards"),
          ownerId: v.id("users"),
          type: v.union(
            v.literal("chart"),
            v.literal("metric"),
            v.literal("table"),
            v.literal("text")
          ),
          title: v.string(),
          chartType: v.optional(
            v.union(
              v.literal("line"),
              v.literal("bar"),
              v.literal("area"),
              v.literal("pie")
            )
          ),
          range: v.optional(v.string()),
          sheetName: v.optional(v.string()),
          metricValue: v.optional(v.string()),
          metricFormula: v.optional(v.string()),
          metricColumn: v.optional(v.string()),
          tableRange: v.optional(v.string()),
          tableSheetName: v.optional(v.string()),
          position: v.object({
            x: v.number(),
            y: v.number(),
            width: v.number(),
            height: v.number(),
          }),
          createdAt: v.number(),
          updatedAt: v.number(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      return null;
    }

    if (dashboard.ownerId !== user._id) {
      throw new Error("Not authorized to view this dashboard");
    }

    const widgets = await ctx.db
      .query("dashboardWidgets")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .order("asc")
      .collect();

    return {
      ...dashboard,
      widgets,
    };
  },
});

/**
 * Create a new dashboard
 */
export const createDashboard = mutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    name: v.string(),
    description: v.optional(v.string()),
    widgetsData: v.optional(v.string()),
  },
  returns: v.id("dashboards"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to create dashboard");
    }

    const now = Date.now();
    return await ctx.db.insert("dashboards", {
      spreadsheetId: args.spreadsheetId,
      ownerId: user._id,
      name: args.name,
      description: args.description,
      widgetsData: args.widgetsData || "[]",
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal mutation to create a dashboard (called by AI)
 */
export const internalCreateDashboard = internalMutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    widgetsData: v.string(),
  },
  returns: v.id("dashboards"),
  handler: async (ctx, args) => {
    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    const now = Date.now();
    return await ctx.db.insert("dashboards", {
      spreadsheetId: args.spreadsheetId,
      ownerId: args.ownerId,
      name: args.name,
      description: args.description,
      widgetsData: args.widgetsData,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Add a widget to a dashboard
 */
export const addWidget = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    type: v.union(
      v.literal("chart"),
      v.literal("metric"),
      v.literal("table"),
      v.literal("text")
    ),
    title: v.string(),
    chartType: v.optional(
      v.union(
        v.literal("line"),
        v.literal("bar"),
        v.literal("area"),
        v.literal("pie")
      )
    ),
    range: v.optional(v.string()),
    sheetName: v.optional(v.string()),
    metricValue: v.optional(v.string()),
    metricFormula: v.optional(v.string()),
    metricColumn: v.optional(v.string()),
    tableRange: v.optional(v.string()),
    tableSheetName: v.optional(v.string()),
    position: v.object({
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
    }),
  },
  returns: v.id("dashboardWidgets"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }

    if (dashboard.ownerId !== user._id) {
      throw new Error("Not authorized to add widgets to this dashboard");
    }

    const now = Date.now();
    const widgetId = await ctx.db.insert("dashboardWidgets", {
      dashboardId: args.dashboardId,
      ownerId: user._id,
      type: args.type,
      title: args.title,
      chartType: args.chartType,
      range: args.range,
      sheetName: args.sheetName,
      metricValue: args.metricValue,
      metricFormula: args.metricFormula,
      metricColumn: args.metricColumn,
      tableRange: args.tableRange,
      tableSheetName: args.tableSheetName,
      position: args.position,
      createdAt: now,
      updatedAt: now,
    });

    // Update dashboard timestamp
    await ctx.db.patch(args.dashboardId, {
      updatedAt: now,
    });

    return widgetId;
  },
});

/**
 * Internal mutation to add a widget (called by AI)
 */
export const internalAddWidget = internalMutation({
  args: {
    dashboardId: v.id("dashboards"),
    ownerId: v.id("users"),
    type: v.union(
      v.literal("chart"),
      v.literal("metric"),
      v.literal("table"),
      v.literal("text")
    ),
    title: v.string(),
    chartType: v.optional(
      v.union(
        v.literal("line"),
        v.literal("bar"),
        v.literal("area"),
        v.literal("pie")
      )
    ),
    range: v.optional(v.string()),
    sheetName: v.optional(v.string()),
    metricValue: v.optional(v.string()),
    metricFormula: v.optional(v.string()),
    metricColumn: v.optional(v.string()),
    tableRange: v.optional(v.string()),
    tableSheetName: v.optional(v.string()),
    position: v.object({
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
    }),
  },
  returns: v.id("dashboardWidgets"),
  handler: async (ctx, args) => {
    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }

    const now = Date.now();
    const widgetId = await ctx.db.insert("dashboardWidgets", {
      dashboardId: args.dashboardId,
      ownerId: args.ownerId,
      type: args.type,
      title: args.title,
      chartType: args.chartType,
      range: args.range,
      sheetName: args.sheetName,
      metricValue: args.metricValue,
      metricFormula: args.metricFormula,
      metricColumn: args.metricColumn,
      tableRange: args.tableRange,
      tableSheetName: args.tableSheetName,
      position: args.position,
      createdAt: now,
      updatedAt: now,
    });

    // Update dashboard timestamp
    await ctx.db.patch(args.dashboardId, {
      updatedAt: now,
    });

    return widgetId;
  },
});

/**
 * Update dashboard
 */
export const updateDashboard = mutation({
  args: {
    dashboardId: v.id("dashboards"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    widgetsData: v.optional(v.string()),
    layout: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      throw new Error("Dashboard not found");
    }

    if (dashboard.ownerId !== user._id) {
      throw new Error("Not authorized to update this dashboard");
    }

    const updates: Partial<{
      name: string;
      description: string;
      widgetsData: string;
      layout: string;
      updatedAt: number;
    }> = {};

    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;
    if (args.widgetsData !== undefined) updates.widgetsData = args.widgetsData;
    if (args.layout !== undefined) updates.layout = args.layout;
    updates.updatedAt = Date.now();

    await ctx.db.patch(args.dashboardId, updates as any);
    return null;
  },
});

/**
 * Delete dashboard
 */
export const deleteDashboard = mutation({
  args: {
    dashboardId: v.id("dashboards"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const dashboard = await ctx.db.get(args.dashboardId);
    if (!dashboard) {
      return null;
    }

    if (dashboard.ownerId !== user._id) {
      throw new Error("Not authorized to delete this dashboard");
    }

    // Delete all widgets first
    const widgets = await ctx.db
      .query("dashboardWidgets")
      .withIndex("by_dashboard", (q) => q.eq("dashboardId", args.dashboardId))
      .collect();

    for (const widget of widgets) {
      await ctx.db.delete(widget._id);
    }

    // Delete dashboard
    await ctx.db.delete(args.dashboardId);
    return null;
  },
});

/**
 * Delete a widget from a dashboard
 */
export const deleteWidget = mutation({
  args: {
    widgetId: v.id("dashboardWidgets"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    if (!user) {
      throw new Error("User not found");
    }

    const widget = await ctx.db.get(args.widgetId);
    if (!widget) {
      return null;
    }

    if (widget.ownerId !== user._id) {
      throw new Error("Not authorized to delete this widget");
    }

    // Update dashboard timestamp
    await ctx.db.patch(widget.dashboardId, {
      updatedAt: Date.now(),
    });

    await ctx.db.delete(args.widgetId);
    return null;
  },
});

