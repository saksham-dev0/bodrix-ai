import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all spreadsheets for a project
 */
export const getProjectSpreadsheets = query({
  args: {
    projectId: v.id("projects"),
  },
  returns: v.array(
    v.object({
      _id: v.id("spreadsheets"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      name: v.string(),
      ownerId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      data: v.optional(v.string()),
      activeSheetIndex: v.optional(v.number()),
      workbookData: v.optional(v.string()),
      xSpreadsheetData: v.optional(v.string()),
    }),
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

    const spreadsheets = await ctx.db
      .query("spreadsheets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("desc")
      .collect();

    return spreadsheets;
  },
});

/**
 * Create a new spreadsheet
 */
export const createSpreadsheet = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.string(),
  },
  returns: v.id("spreadsheets"),
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

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Not authorized to create spreadsheet in this project");
    }

    // Default x-spreadsheet data
    const defaultData = JSON.stringify([
      {
        name: "Sheet1",
        freeze: "A1",
        styles: [],
        merges: [],
        cols: { len: 26 },
        rows: { len: 100 },
        cells: {},
      },
    ]);

    const now = Date.now();
    return await ctx.db.insert("spreadsheets", {
      projectId: args.projectId,
      name: args.name,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
      data: defaultData,
    });
  },
});

/**
 * Get spreadsheet data
 */
export const getSpreadsheetData = query({
  args: {
    spreadsheetId: v.id("spreadsheets"),
  },
  returns: v.union(
    v.object({
      _id: v.id("spreadsheets"),
      _creationTime: v.number(),
      projectId: v.id("projects"),
      name: v.string(),
      ownerId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
      data: v.optional(v.string()),
      activeSheetIndex: v.optional(v.number()),
      workbookData: v.optional(v.string()),
      xSpreadsheetData: v.optional(v.string()),
    }),
    v.null(),
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
      return null;
    }

    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to view this spreadsheet");
    }

    return spreadsheet;
  },
});

/**
 * Update spreadsheet data
 */
export const updateSpreadsheetData = mutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    data: v.string(),
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

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to edit this spreadsheet");
    }

    const now = Date.now();
    await ctx.db.patch(args.spreadsheetId, {
      data: args.data,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Update spreadsheet name
 */
export const updateSpreadsheetName = mutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    name: v.string(),
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

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to edit this spreadsheet");
    }

    const now = Date.now();
    await ctx.db.patch(args.spreadsheetId, {
      name: args.name,
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Export spreadsheet data as CSV
 */
export const exportSpreadsheetAsCSV = query({
  args: {
    spreadsheetId: v.id("spreadsheets"),
  },
  returns: v.string(),
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
      throw new Error("Not authorized to export this spreadsheet");
    }

    try {
      // Handle both old and new data formats
      let dataString = spreadsheet.data;

      // If data field doesn't exist, try to use xSpreadsheetData or workbookData
      if (!dataString && spreadsheet.xSpreadsheetData) {
        dataString = spreadsheet.xSpreadsheetData;
      } else if (!dataString && spreadsheet.workbookData) {
        dataString = spreadsheet.workbookData;
      }

      if (!dataString) {
        return "";
      }

      const data = JSON.parse(dataString);
      const sheet = data[0]; // Get first sheet

      if (!sheet || !sheet.cells) {
        return "";
      }

      // Find the bounds of the data
      let maxRow = 0;
      let maxCol = 0;

      Object.keys(sheet.cells).forEach((key) => {
        const [r, c] = key.split("_").map(Number);
        maxRow = Math.max(maxRow, r);
        maxCol = Math.max(maxCol, c);
      });

      // Create a 2D array to hold the data
      const csvData: string[][] = [];
      for (let row = 0; row <= maxRow; row++) {
        csvData[row] = [];
        for (let col = 0; col <= maxCol; col++) {
          csvData[row][col] = "";
        }
      }

      // Fill in the actual data
      Object.keys(sheet.cells).forEach((key) => {
        const [r, c] = key.split("_").map(Number);
        const cell = sheet.cells[key];
        const value = cell.text || "";

        // Escape CSV values (add quotes if contains comma, newline, or quote)
        if (
          value.includes(",") ||
          value.includes("\n") ||
          value.includes('"')
        ) {
          csvData[r][c] = `"${value.replace(/"/g, '""')}"`;
        } else {
          csvData[r][c] = value;
        }
      });

      // Convert to CSV string
      const csvRows = csvData.map((row) => row.join(","));
      return csvRows.join("\n");
    } catch (error) {
      console.error("Error parsing spreadsheet data:", error);
      return "";
    }
  },
});

/**
 * Import CSV data into spreadsheet
 */
export const importCSVToSpreadsheet = mutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    csvData: v.string(),
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

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to import data into this spreadsheet");
    }

    try {
      // Parse CSV data
      const lines = args.csvData.split("\n");
      const csvRows: string[][] = [];

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line) {
          const row = parseCSVLine(line);
          csvRows.push(row);
        }
      }

      // Convert to x-spreadsheet format
      const sheet: any = {
        name: "Sheet1",
        freeze: "A1",
        styles: [],
        merges: [],
        cols: { len: Math.max(26, csvRows[0]?.length || 26) },
        rows: { len: Math.max(100, csvRows.length) },
        cells: {},
      };

      // Add cells
      csvRows.forEach((row, rowIndex) => {
        row.forEach((value, colIndex) => {
          if (value.trim()) {
            sheet.cells[`${rowIndex}_${colIndex}`] = {
              text: value.trim(),
              style: 0,
            };
          }
        });
      });

      const newData = JSON.stringify([sheet]);

      const now = Date.now();
      await ctx.db.patch(args.spreadsheetId, {
        data: newData,
        updatedAt: now,
      });

      return null;
    } catch (error) {
      console.error("Error importing CSV:", error);
      throw new Error("Failed to import CSV data");
    }
  },
});

/**
 * Helper function to parse a CSV line
 */
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++; // Skip next quote
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      // Field separator
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}
