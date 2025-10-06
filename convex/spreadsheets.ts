import { query, mutation, internalMutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";

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
      charts: v.optional(v.string()),
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
      charts: v.optional(v.string()),
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
 * CHARTS: CRUD linked to spreadsheet cell ranges
 */
export const listCharts = query({
  args: { spreadsheetId: v.id("spreadsheets") },
  returns: v.array(
    v.object({
      _id: v.id("charts"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      ownerId: v.id("users"),
      title: v.string(),
      type: v.union(
        v.literal("line"),
        v.literal("bar"),
        v.literal("area"),
        v.literal("pie"),
      ),
      range: v.string(),
      sheetName: v.optional(v.string()),
      options: v.optional(
        v.object({
          xIsFirstRowHeader: v.optional(v.boolean()),
          xIsFirstColumn: v.optional(v.boolean()),
        }),
      ),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) throw new Error("Spreadsheet not found");
    if (spreadsheet.ownerId !== user._id)
      throw new Error("Not authorized to view charts");

    return await ctx.db
      .query("charts")
      .withIndex("by_spreadsheet", (q) =>
        q.eq("spreadsheetId", args.spreadsheetId),
      )
      .order("asc")
      .collect();
  },
});

export const createChart = mutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    title: v.string(),
    type: v.union(
      v.literal("line"),
      v.literal("bar"),
      v.literal("area"),
      v.literal("pie"),
    ),
    range: v.string(),
    sheetName: v.optional(v.string()),
    options: v.optional(
      v.object({
        xIsFirstRowHeader: v.optional(v.boolean()),
        xIsFirstColumn: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.id("charts"),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) throw new Error("Spreadsheet not found");
    if (spreadsheet.ownerId !== user._id)
      throw new Error("Not authorized to create charts for this spreadsheet");

    const now = Date.now();
    return await ctx.db.insert("charts", {
      spreadsheetId: args.spreadsheetId,
      ownerId: user._id,
      title: args.title,
      type: args.type,
      range: args.range,
      sheetName: args.sheetName,
      options: args.options,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Internal mutation to create a chart (called by AI)
 */
export const internalCreateChart = internalMutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
    title: v.string(),
    type: v.union(
      v.literal("line"),
      v.literal("bar"),
      v.literal("area"),
      v.literal("pie"),
    ),
    range: v.string(),
    sheetName: v.optional(v.string()),
  },
  returns: v.id("charts"),
  handler: async (ctx, args) => {
    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) throw new Error("Spreadsheet not found");

    const now = Date.now();
    return await ctx.db.insert("charts", {
      spreadsheetId: args.spreadsheetId,
      ownerId: args.ownerId,
      title: args.title,
      type: args.type,
      range: args.range,
      sheetName: args.sheetName,
      createdAt: now,
      updatedAt: now,
    });
  },
});

export const updateChart = mutation({
  args: {
    chartId: v.id("charts"),
    title: v.optional(v.string()),
    type: v.optional(
      v.union(
        v.literal("line"),
        v.literal("bar"),
        v.literal("area"),
        v.literal("pie"),
      ),
    ),
    range: v.optional(v.string()),
    options: v.optional(
      v.object({
        xIsFirstRowHeader: v.optional(v.boolean()),
        xIsFirstColumn: v.optional(v.boolean()),
      }),
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const chart = await ctx.db.get(args.chartId);
    if (!chart) throw new Error("Chart not found");
    if (chart.ownerId !== user._id)
      throw new Error("Not authorized to edit this chart");

    const updates: Partial<{
      title: string;
      type: "line" | "bar" | "area" | "pie";
      range: string;
      options: { xIsFirstRowHeader?: boolean; xIsFirstColumn?: boolean };
      updatedAt: number;
    }> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.type !== undefined) updates.type = args.type as any;
    if (args.range !== undefined) updates.range = args.range;
    if (args.options !== undefined) updates.options = args.options as any;
    updates.updatedAt = Date.now();

    await ctx.db.patch(args.chartId, updates as any);
    return null;
  },
});

export const deleteChart = mutation({
  args: { chartId: v.id("charts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const chart = await ctx.db.get(args.chartId);
    if (!chart) return null;
    if (chart.ownerId !== user._id)
      throw new Error("Not authorized to delete this chart");

    await ctx.db.delete(args.chartId);
    return null;
  },
});

/**
 * Check if a row is truly empty (has no data or only empty cells)
 */
function isRowEmpty(row: any): boolean {
  if (!row || !row.cells) return true;
  
  for (const colKey in row.cells) {
    const cell = row.cells[colKey];
    // If cell has text that's not empty/whitespace, row is not empty
    if (cell && cell.text && cell.text.trim() !== "") {
      return false;
    }
  }
  
  return true;
}

/**
 * Find the next truly available row (skipping empty rows)
 */
function findNextAvailableRow(sheet: any, startFrom: number = 0): number {
  if (!sheet.rows) return startFrom;
  
  let maxUsedRow = startFrom - 1;
  
  // Find the last row that has actual content
  for (const rowKey in sheet.rows) {
    if (rowKey === "len") continue;
    
    const rowNum = parseInt(rowKey);
    if (!isRowEmpty(sheet.rows[rowKey])) {
      maxUsedRow = Math.max(maxUsedRow, rowNum);
    }
  }
  
  return maxUsedRow + 1;
}

/**
 * Generate sample data based on column header name
 */
function generateSampleData(headerName: string, rowNumber: number): string {
  const lower = headerName.toLowerCase();
  
  // Product related
  if (lower.includes("product") && (lower.includes("name") || lower.includes("title"))) {
    const products = ["Laptop", "Smartphone", "Headphones", "Tablet", "Monitor", "Keyboard", "Mouse", "Camera", "Printer", "Speaker"];
    return products[(rowNumber - 1) % products.length];
  }
  if (lower.includes("product") && lower.includes("id")) {
    return `P${String(rowNumber).padStart(3, '0')}`;
  }
  
  // Price related
  if (lower.includes("price") || lower.includes("cost") || lower.includes("amount")) {
    const prices = [29.99, 49.99, 99.99, 149.99, 199.99, 299.99, 399.99, 499.99];
    return prices[(rowNumber - 1) % prices.length].toString();
  }
  
  // Quantity/Stock related
  if (lower.includes("quantity") || lower.includes("stock") || lower.includes("qty")) {
    const quantities = [10, 25, 50, 75, 100, 150, 200, 300];
    return quantities[(rowNumber - 1) % quantities.length].toString();
  }
  
  // Category related
  if (lower.includes("category") || lower.includes("type")) {
    const categories = ["Electronics", "Accessories", "Software", "Hardware", "Gaming", "Audio", "Video", "Peripherals"];
    return categories[(rowNumber - 1) % categories.length];
  }
  
  // Name related (person names)
  if (lower === "name" || lower.includes("person") || lower.includes("employee") || lower.includes("customer")) {
    const names = ["John Smith", "Jane Doe", "Mike Johnson", "Sarah Williams", "David Brown", "Emily Davis", "Chris Wilson", "Lisa Anderson", "Tom Martin", "Anna Taylor"];
    return names[(rowNumber - 1) % names.length];
  }
  
  // Email related
  if (lower.includes("email") || lower.includes("mail")) {
    const names = ["john", "jane", "mike", "sarah", "david", "emily", "chris", "lisa", "tom", "anna"];
    return `${names[(rowNumber - 1) % names.length]}@example.com`;
  }
  
  // Phone related
  if (lower.includes("phone") || lower.includes("mobile") || lower.includes("contact")) {
    return `+1 (555) ${String(100 + rowNumber).slice(-3)}-${String(1000 + rowNumber).slice(-4)}`;
  }
  
  // Date related
  if (lower.includes("date") || lower.includes("time")) {
    const date = new Date(2024, 0, rowNumber);
    return date.toISOString().split('T')[0];
  }
  
  // Address related
  if (lower.includes("address") || lower.includes("street")) {
    return `${100 + rowNumber * 10} Main Street`;
  }
  
  // City related
  if (lower.includes("city")) {
    const cities = ["New York", "Los Angeles", "Chicago", "Houston", "Phoenix", "Philadelphia", "San Antonio", "San Diego"];
    return cities[(rowNumber - 1) % cities.length];
  }
  
  // Status related
  if (lower.includes("status")) {
    const statuses = ["Active", "Pending", "Completed", "In Progress", "On Hold"];
    return statuses[(rowNumber - 1) % statuses.length];
  }
  
  // ID related
  if (lower.includes("id") || lower === "id") {
    return String(1000 + rowNumber);
  }
  
  // Age related
  if (lower.includes("age")) {
    return String(20 + (rowNumber % 40));
  }
  
  // Salary related
  if (lower.includes("salary") || lower.includes("income")) {
    const salaries = [45000, 55000, 65000, 75000, 85000, 95000, 105000, 125000];
    return salaries[(rowNumber - 1) % salaries.length].toString();
  }
  
  // Position/Role related
  if (lower.includes("position") || lower.includes("role") || lower.includes("title") || lower.includes("job")) {
    const positions = ["Manager", "Developer", "Designer", "Analyst", "Engineer", "Specialist", "Coordinator", "Director"];
    return positions[(rowNumber - 1) % positions.length];
  }
  
  // Department related
  if (lower.includes("department") || lower.includes("dept")) {
    const departments = ["Sales", "Marketing", "Engineering", "HR", "Finance", "Operations", "IT", "Support"];
    return departments[(rowNumber - 1) % departments.length];
  }
  
  // Company related
  if (lower.includes("company") || lower.includes("organization")) {
    const companies = ["Acme Corp", "TechStart Inc", "Global Solutions", "Innovation Labs", "Digital Works", "Smart Systems", "Future Tech", "Prime Industries"];
    return companies[(rowNumber - 1) % companies.length];
  }
  
  // Description related
  if (lower.includes("description") || lower.includes("desc") || lower.includes("notes")) {
    return `Sample description ${rowNumber}`;
  }
  
  // Default: generic values
  return `Value ${rowNumber}`;
}

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

/**
 * Internal query to get all sheet names from a spreadsheet
 */
export const internalGetSheetNames = internalQuery({
  args: {
    spreadsheetId: v.id("spreadsheets"),
  },
  returns: v.array(v.string()),
  handler: async (ctx, args) => {
    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      return [];
    }

    try {
      const data = JSON.parse(spreadsheet.data || "[]");
      if (!Array.isArray(data)) {
        return [];
      }

      return data.map((sheet: any) => sheet.name || "Unnamed");
    } catch (error) {
      console.error("Error getting sheet names:", error);
      return [];
    }
  },
});

/**
 * Internal mutation to insert test data
 */
export const internalInsertTestData = internalMutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== args.ownerId) {
      throw new Error("Not authorized to edit this spreadsheet");
    }

    try {
      const data = JSON.parse(spreadsheet.data || "[]");
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Invalid spreadsheet data");
      }

      const sheet = data[0];
      
      // Initialize rows if not present
      if (!sheet.rows) {
        sheet.rows = { len: 100 };
      }
      
      // Find the next truly available row (skipping empty rows)
      const nextRow = findNextAvailableRow(sheet, 0);

      // Insert "test" in the first column of the next available row
      if (!sheet.rows[nextRow]) {
        sheet.rows[nextRow] = { cells: {} };
      }
      if (!sheet.rows[nextRow].cells) {
        sheet.rows[nextRow].cells = {};
      }
      sheet.rows[nextRow].cells["0"] = { text: "test" };

      const newData = JSON.stringify(data);
      const now = Date.now();
      await ctx.db.patch(args.spreadsheetId, {
        data: newData,
        updatedAt: now,
      });

      return null;
    } catch (error) {
      console.error("Error inserting test data:", error);
      throw new Error("Failed to insert test data");
    }
  },
});

/**
 * Internal mutation to create a table with specified headers and rows
 */
export const internalCreateTableWithSpec = internalMutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
    headers: v.array(v.string()),
    numRows: v.number(),
    sheetName: v.optional(v.string()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    sheetName: v.string(),
  }),
  handler: async (ctx, args) => {
    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== args.ownerId) {
      throw new Error("Not authorized to edit this spreadsheet");
    }

    try {
      const data = JSON.parse(spreadsheet.data || "[]");
      if (!Array.isArray(data)) {
        throw new Error("Invalid spreadsheet data");
      }

      let targetSheet;
      let targetSheetName = args.sheetName || "Sheet1";
      let isNewSheet = false;

      // Find or create the target sheet
      if (args.sheetName) {
        targetSheet = data.find(s => s.name === args.sheetName);
        
        // If sheet doesn't exist, create it
        if (!targetSheet) {
          targetSheet = {
            name: args.sheetName,
            freeze: "A1",
            styles: [],
            merges: [],
            rows: { len: Math.max(100, args.numRows + 1) },
            cols: { len: Math.max(26, args.headers.length) },
            validations: [],
            autofilter: {},
          };
          data.push(targetSheet);
          isNewSheet = true;
        }
      } else {
        // Use first sheet if no sheet name specified
        if (data.length === 0) {
          targetSheet = {
            name: "Sheet1",
            freeze: "A1",
            styles: [],
            merges: [],
            rows: { len: Math.max(100, args.numRows + 1) },
            cols: { len: Math.max(26, args.headers.length) },
            validations: [],
            autofilter: {},
          };
          data.push(targetSheet);
          isNewSheet = true;
        } else {
          targetSheet = data[0];
        }
      }

      // Initialize rows if not present
      if (!targetSheet.rows) {
        targetSheet.rows = { len: Math.max(100, args.numRows + 1) };
      }

      // Find the next truly available row (skipping empty rows)
      const startRow = findNextAvailableRow(targetSheet, 0);

      // Create header row
      if (!targetSheet.rows[startRow]) {
        targetSheet.rows[startRow] = { cells: {} };
      }
      if (!targetSheet.rows[startRow].cells) {
        targetSheet.rows[startRow].cells = {};
      }

      args.headers.forEach((header, colIndex) => {
        targetSheet.rows[startRow].cells[colIndex.toString()] = { text: header };
      });

      // Create data rows with sample data
      for (let i = 1; i <= args.numRows; i++) {
        const rowIndex = startRow + i;
        if (!targetSheet.rows[rowIndex]) {
          targetSheet.rows[rowIndex] = { cells: {} };
        }
        if (!targetSheet.rows[rowIndex].cells) {
          targetSheet.rows[rowIndex].cells = {};
        }
        
        // Fill cells with sample data based on header names
        args.headers.forEach((header, colIndex) => {
          const sampleValue = generateSampleData(header.toLowerCase(), i);
          targetSheet.rows[rowIndex].cells[colIndex.toString()] = { text: sampleValue };
        });
      }

      // Update cols length if needed
      if (!targetSheet.cols) {
        targetSheet.cols = { len: Math.max(26, args.headers.length) };
      } else {
        targetSheet.cols.len = Math.max(targetSheet.cols.len || 26, args.headers.length);
      }

      // Update rows length if needed
      targetSheet.rows.len = Math.max(targetSheet.rows.len || 100, startRow + args.numRows + 1);

      const newData = JSON.stringify(data);
      const now = Date.now();
      await ctx.db.patch(args.spreadsheetId, {
        data: newData,
        updatedAt: now,
      });

      return {
        success: true,
        message: `✅ Successfully created a table with headers: ${args.headers.join(", ")} and ${args.numRows} data rows in ${isNewSheet ? "new sheet" : "sheet"} "${targetSheetName}". The table starts at row ${startRow + 1}.`,
        sheetName: targetSheetName,
      };
    } catch (error) {
      console.error("Error creating table:", error);
      throw new Error(`Failed to create table: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});

/**
 * Internal mutation to calculate column statistics
 */
export const internalCalculateColumnStats = internalMutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
    columnName: v.string(),
    operation: v.union(
      v.literal("sum"),
      v.literal("average"),
      v.literal("avg"),
      v.literal("count"),
      v.literal("min"),
      v.literal("max")
    ),
  },
  returns: v.object({
    success: v.boolean(),
    result: v.union(v.number(), v.string()),
    operation: v.string(),
    columnName: v.string(),
    rowCount: v.number(),
    sheetName: v.string(),
  }),
  handler: async (ctx, args) => {
    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== args.ownerId) {
      throw new Error("Not authorized to edit this spreadsheet");
    }

    try {
      const data = JSON.parse(spreadsheet.data || "[]");
      if (!Array.isArray(data) || data.length === 0) {
        throw new Error("Invalid spreadsheet data");
      }

      // Search for the column in ALL sheets, not just the first one
      let targetSheet: any = null;
      let columnIndex = -1;
      let headerRow = -1;
      let foundColumnName = "";
      let sheetName = "";
      
      for (const sheet of data) {
        if (!sheet.rows) continue;
        
        // Try to find the column in this sheet
        for (const rowKey in sheet.rows) {
          if (rowKey === "len") continue;
          
          const rowNum = parseInt(rowKey);
          const row = sheet.rows[rowKey];
          
          if (row.cells) {
            for (const colKey in row.cells) {
              const cell = row.cells[colKey];
              if (cell.text) {
                const cellLower = cell.text.toLowerCase();
                const searchLower = args.columnName.toLowerCase();
                
                // Try exact match first
                if (cellLower === searchLower) {
                  columnIndex = parseInt(colKey);
                  headerRow = rowNum;
                  foundColumnName = cell.text;
                  targetSheet = sheet;
                  sheetName = sheet.name || "Unnamed";
                  break;
                }
                // Then try partial match (column contains search term or vice versa)
                if (columnIndex === -1 && (cellLower.includes(searchLower) || searchLower.includes(cellLower))) {
                  columnIndex = parseInt(colKey);
                  headerRow = rowNum;
                  foundColumnName = cell.text;
                  targetSheet = sheet;
                  sheetName = sheet.name || "Unnamed";
                }
              }
            }
          }
          
          if (columnIndex !== -1 && targetSheet !== null) break;
        }
        
        // If we found the column in this sheet, stop searching other sheets
        if (columnIndex !== -1 && targetSheet !== null) break;
      }

      if (columnIndex === -1 || !targetSheet) {
        throw new Error(`Column "${args.columnName}" not found in any sheet`);
      }
      
      console.log(`Found column "${foundColumnName}" (index ${columnIndex}) in sheet "${sheetName}" for search term "${args.columnName}"`);

      // Collect values from the column (skip header row)
      const values: number[] = [];
      for (const rowKey in targetSheet.rows) {
        if (rowKey === "len") continue;
        
        const rowNum = parseInt(rowKey);
        if (rowNum <= headerRow) continue; // Skip header and rows above it
        
        const row = targetSheet.rows[rowKey];
        if (row.cells && row.cells[columnIndex.toString()]) {
          const cellText = row.cells[columnIndex.toString()].text;
          if (cellText && cellText.trim() !== "") {
            const num = parseFloat(cellText);
            if (!isNaN(num)) {
              values.push(num);
            }
          }
        }
      }

      if (values.length === 0) {
        throw new Error(`No numeric values found in column "${args.columnName}"`);
      }

      // Calculate the result based on operation
      let result: number;
      let operation = args.operation;
      
      if (operation === "avg") operation = "average";
      
      switch (operation) {
        case "sum":
          result = values.reduce((a, b) => a + b, 0);
          break;
        case "average":
          result = values.reduce((a, b) => a + b, 0) / values.length;
          break;
        case "count":
          result = values.length;
          break;
        case "min":
          result = Math.min(...values);
          break;
        case "max":
          result = Math.max(...values);
          break;
        default:
          throw new Error(`Unknown operation: ${operation}`);
      }

      // Add the result to the spreadsheet (find next truly available row)
      const nextRow = findNextAvailableRow(targetSheet, headerRow + 1);

      if (!targetSheet.rows[nextRow]) {
        targetSheet.rows[nextRow] = { cells: {} };
      }
      if (!targetSheet.rows[nextRow].cells) {
        targetSheet.rows[nextRow].cells = {};
      }

      // Add label in first column (use the actual column name found)
      targetSheet.rows[nextRow].cells["0"] = { text: `${operation.toUpperCase()} of ${foundColumnName}:` };
      // Add result in the column
      targetSheet.rows[nextRow].cells[columnIndex.toString()] = { text: result.toString() };

      const newData = JSON.stringify(data);
      const now = Date.now();
      await ctx.db.patch(args.spreadsheetId, {
        data: newData,
        updatedAt: now,
      });

      return {
        success: true,
        result: result,
        operation: operation,
        columnName: foundColumnName, // Return the actual column name that was found
        rowCount: values.length,
        sheetName: sheetName, // Return the sheet where the column was found
      };
    } catch (error) {
      console.error("Error calculating column stats:", error);
      throw new Error(`Failed to calculate: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});