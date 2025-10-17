import { query, mutation, action, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

// Encryption utilities using base64 (Convex-compatible)
function encrypt(text: string, key: string): string {
  // Simple XOR encryption for demo - in production use proper encryption
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  // Use btoa for base64 encoding (browser/Convex compatible)
  return btoa(result);
}

function decrypt(encryptedText: string, key: string): string {
  // Use atob for base64 decoding (browser/Convex compatible)
  const text = atob(encryptedText);
  let result = '';
  for (let i = 0; i < text.length; i++) {
    result += String.fromCharCode(text.charCodeAt(i) ^ key.charCodeAt(i % key.length));
  }
  return result;
}

/**
 * Connect to Airtable using Personal Access Token
 */
export const connectAirtable = mutation({
  args: {
    accessToken: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    integrationId: v.optional(v.id("integrations")),
  }),
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

    // Check if user already has an Airtable integration
    const existingIntegration = await ctx.db
      .query("integrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("provider"), "airtable"))
      .first();

    const encryptionKey = process.env.AIRTABLE_ENCRYPTION_KEY || "default-key-change-in-production";
    const encryptedToken = encrypt(args.accessToken, encryptionKey);

    const now = Date.now();

    if (existingIntegration) {
      // Update existing integration
      await ctx.db.patch(existingIntegration._id, {
        accessToken: encryptedToken,
        status: "active",
        updatedAt: now,
      });
      return {
        success: true,
        message: "Airtable connection updated successfully",
        integrationId: existingIntegration._id,
      };
    } else {
      // Create new integration
      const integrationId = await ctx.db.insert("integrations", {
        userId: user._id,
        provider: "airtable",
        accessToken: encryptedToken,
        status: "active",
        createdAt: now,
        updatedAt: now,
      });
      return {
        success: true,
        message: "Airtable connected successfully",
        integrationId,
      };
    }
  },
});

/**
 * Disconnect Airtable integration
 */
export const disconnectAirtable = mutation({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
  }),
  handler: async (ctx) => {
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

    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("provider"), "airtable"))
      .first();

    if (!integration) {
      return {
        success: false,
        message: "No Airtable integration found",
      };
    }

    await ctx.db.patch(integration._id, {
      status: "disconnected",
      updatedAt: Date.now(),
    });

    return {
      success: true,
      message: "Airtable disconnected successfully",
    };
  },
});

/**
 * Get user's integrations
 */
export const getUserIntegrations = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("integrations"),
      _creationTime: v.number(),
      provider: v.union(
        v.literal("airtable"),
        v.literal("notion"),
        v.literal("google_sheets")
      ),
      metadata: v.optional(v.object({
        accountName: v.optional(v.string()),
        accountEmail: v.optional(v.string()),
        baseNames: v.optional(v.array(v.string())),
        lastValidatedAt: v.optional(v.number()),
      })),
      status: v.union(
        v.literal("active"),
        v.literal("error"),
        v.literal("disconnected")
      ),
      lastSyncedAt: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx) => {
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

    const integrations = await ctx.db
      .query("integrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Remove accessToken from the response for security
    return integrations.map((integration) => ({
      _id: integration._id,
      _creationTime: integration._creationTime,
      provider: integration.provider,
      metadata: integration.metadata,
      status: integration.status,
      lastSyncedAt: integration.lastSyncedAt,
      createdAt: integration.createdAt,
      updatedAt: integration.updatedAt,
    }));
  },
});

/**
 * Test Airtable connection
 */
export const testAirtableConnection = action({
  args: {
    accessToken: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    accountInfo: v.optional(v.object({
      name: v.string(),
      email: v.string(),
    })),
  }),
  handler: async (ctx, args) => {
    try {
      const response = await fetch("https://api.airtable.com/v0/meta/bases", {
        headers: {
          Authorization: `Bearer ${args.accessToken}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401) {
          return {
            success: false,
            message: "Invalid Personal Access Token. Please check your token and try again.",
          };
        }
        return {
          success: false,
          message: `Airtable API error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        message: `Successfully connected to Airtable. Found ${data.bases?.length || 0} bases.`,
        accountInfo: {
          name: "Airtable User", // Airtable doesn't provide user info in this endpoint
          email: "Connected", // Placeholder since we can't get email from this endpoint
        },
      };
    } catch (error) {
      return {
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Internal query to get user's Airtable integration with token
 */
export const getAirtableIntegration = internalQuery({
  args: {
    clerkId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("integrations"),
      userId: v.id("users"),
      accessToken: v.string(),
      status: v.union(
        v.literal("active"),
        v.literal("error"),
        v.literal("disconnected")
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return null;
    }

    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("provider"), "airtable"))
      .first();

    if (!integration) {
      return null;
    }

    return {
      _id: integration._id,
      userId: integration.userId,
      accessToken: integration.accessToken,
      status: integration.status,
    };
  },
});

/**
 * List Airtable bases
 */
export const listAirtableBases = action({
  args: {},
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    bases: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      permissionLevel: v.string(),
    }))),
  }),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const integration = await ctx.runQuery(internal.integrations.getAirtableIntegration, {
      clerkId: identity.subject,
    });

    if (!integration || integration.status !== "active") {
      return {
        success: false,
        message: "No active Airtable integration found",
      };
    }

    try {
      const encryptionKey = process.env.AIRTABLE_ENCRYPTION_KEY || "default-key-change-in-production";
      const accessToken = decrypt(integration.accessToken, encryptionKey);

      const response = await fetch("https://api.airtable.com/v0/meta/bases", {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error("Airtable API error:", response.status, errorText);
        return {
          success: false,
          message: `Airtable API error: ${response.status} ${response.statusText}. Make sure your token has the required scopes (data.records:read, schema.bases:read).`,
        };
      }

      const data = await response.json();
      console.log("Airtable bases response:", data);
      
      // Handle case where bases might be in different structure
      const bases = data.bases || [];
      
      return {
        success: true,
        message: bases.length > 0 ? `Found ${bases.length} bases` : "No bases found. Make sure your Personal Access Token has access to at least one base.",
        bases: bases.map((base: any) => ({
          id: base.id,
          name: base.name,
          permissionLevel: base.permissionLevel || "read",
        })),
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to fetch bases: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * List tables in an Airtable base
 */
export const listAirtableTables = action({
  args: {
    baseId: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    tables: v.optional(v.array(v.object({
      id: v.string(),
      name: v.string(),
      description: v.optional(v.string()),
      primaryFieldId: v.string(),
      fields: v.array(v.object({
        id: v.string(),
        name: v.string(),
        type: v.string(),
      })),
    }))),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const integration = await ctx.runQuery(internal.integrations.getAirtableIntegration, {
      clerkId: identity.subject,
    });

    if (!integration || integration.status !== "active") {
      return {
        success: false,
        message: "No active Airtable integration found",
      };
    }

    try {
      const encryptionKey = process.env.AIRTABLE_ENCRYPTION_KEY || "default-key-change-in-production";
      const accessToken = decrypt(integration.accessToken, encryptionKey);

      const response = await fetch(`https://api.airtable.com/v0/meta/bases/${args.baseId}/tables`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Airtable API error: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      
      return {
        success: true,
        message: `Found ${data.tables?.length || 0} tables`,
        tables: data.tables?.map((table: any) => ({
          id: table.id,
          name: table.name,
          description: table.description,
          primaryFieldId: table.primaryFieldId,
          fields: table.fields.map((field: any) => ({
            id: field.id,
            name: field.name,
            type: field.type,
          })),
        })) || [],
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to fetch tables: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Fetch Airtable table data with pagination
 */
export const fetchAirtableTableData = action({
  args: {
    baseId: v.string(),
    tableId: v.string(),
    maxRecords: v.optional(v.number()),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    records: v.optional(v.array(v.object({
      id: v.string(),
      createdTime: v.string(),
      fields: v.any(),
    }))),
    totalRecords: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const integration = await ctx.runQuery(internal.integrations.getAirtableIntegration, {
      clerkId: identity.subject,
    });

    if (!integration || integration.status !== "active") {
      return {
        success: false,
        message: "No active Airtable integration found",
      };
    }

    try {
      const encryptionKey = process.env.AIRTABLE_ENCRYPTION_KEY || "default-key-change-in-production";
      const accessToken = decrypt(integration.accessToken, encryptionKey);

      const allRecords: any[] = [];
      let offset: string | undefined;
      const maxRecords = args.maxRecords || 1000; // Limit to prevent timeouts

      do {
        const url = new URL(`https://api.airtable.com/v0/${args.baseId}/${args.tableId}`);
        url.searchParams.set("pageSize", "100");
        if (offset) {
          url.searchParams.set("offset", offset);
        }

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        });

        if (!response.ok) {
          return {
            success: false,
            message: `Airtable API error: ${response.status} ${response.statusText}`,
          };
        }

        const data = await response.json();
        allRecords.push(...data.records);
        offset = data.offset;

        // Stop if we've reached the max records limit
        if (allRecords.length >= maxRecords) {
          break;
        }
      } while (offset);

      return {
        success: true,
        message: `Fetched ${allRecords.length} records`,
        records: allRecords.slice(0, maxRecords),
        totalRecords: allRecords.length,
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to fetch table data: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Internal mutation to create spreadsheet and import record
 */
export const createSpreadsheetWithImport = internalMutation({
  args: {
    clerkId: v.string(),
    baseId: v.string(),
    tableId: v.string(),
    tableName: v.string(),
    spreadsheetName: v.string(),
    records: v.array(v.object({
      id: v.string(),
      createdTime: v.string(),
      fields: v.any(),
    })),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    spreadsheetId: v.optional(v.id("spreadsheets")),
    importId: v.optional(v.id("airtableImports")),
    projectId: v.optional(v.id("projects")),
  }),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return {
        success: false,
        message: "User not found",
      };
    }

    const integration = await ctx.db
      .query("integrations")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .filter((q) => q.eq(q.field("provider"), "airtable"))
      .first();

    if (!integration) {
      return {
        success: false,
        message: "Integration not found",
      };
    }

    const records = args.records;

    if (records.length === 0) {
      return {
        success: false,
        message: "No records found in the selected table",
      };
    }

    const now = Date.now();
    
    // Create a new project for this Airtable import
    const projectId = await ctx.db.insert("projects", {
      name: `Airtable: ${args.tableName}`,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    });

    // Create spreadsheet in the new project
    const spreadsheetId = await ctx.db.insert("spreadsheets", {
      projectId,
      name: args.spreadsheetName,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
      data: JSON.stringify([]),
    });

    // Transform Airtable data to x-spreadsheet format
    const fieldNames = Object.keys(records[0].fields);
    
    // Build rows object with proper structure
    const rows: Record<string, any> = {
      len: records.length + 1,
    };

    // Add header row (row 0)
    const headerCells: Record<string, any> = {};
    fieldNames.forEach((fieldName, colIndex) => {
      headerCells[colIndex.toString()] = {
        text: fieldName,
      };
    });
    rows["0"] = { cells: headerCells };

    // Add data rows
    records.forEach((record: any, rowIndex: number) => {
      const cells: Record<string, any> = {};
      fieldNames.forEach((fieldName, colIndex) => {
        const value = record.fields[fieldName];
        let cellValue = "";
        
        if (value !== undefined && value !== null) {
          if (Array.isArray(value)) {
            cellValue = value.join(", ");
          } else if (typeof value === "object") {
            cellValue = JSON.stringify(value);
          } else {
            cellValue = String(value);
          }
        }

        cells[colIndex.toString()] = {
          text: cellValue,
        };
      });
      rows[(rowIndex + 1).toString()] = { cells };
    });

    const sheet = {
      name: args.tableName,
      freeze: "A1",
      styles: [],
      merges: [],
      rows,
      cols: { len: Math.max(26, fieldNames.length) },
    };

    // Update spreadsheet with data
    const sheetData = [sheet];
    console.log("Storing spreadsheet data:", JSON.stringify(sheetData).substring(0, 500));
    await ctx.db.patch(spreadsheetId, {
      data: JSON.stringify(sheetData),
      updatedAt: now,
    });

    // Create import record
    const importId = await ctx.db.insert("airtableImports", {
      userId: user._id,
      spreadsheetId,
      integrationId: integration._id,
      baseId: args.baseId,
      tableName: args.tableName,
      tableId: args.tableId,
      lastSyncedAt: now,
      recordCount: records.length,
      createdAt: now,
      updatedAt: now,
    });

    return {
      success: true,
      message: `Successfully imported ${records.length} records from ${args.tableName}`,
      spreadsheetId,
      importId,
      projectId,
    };
  },
});

/**
 * Import Airtable table data into a new spreadsheet (action wrapper)
 */
export const importAirtableTable = action({
  args: {
    baseId: v.string(),
    tableId: v.string(),
    tableName: v.string(),
    spreadsheetName: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    spreadsheetId: v.optional(v.id("spreadsheets")),
    importId: v.optional(v.id("airtableImports")),
    projectId: v.optional(v.id("projects")),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const integration = await ctx.runQuery(internal.integrations.getAirtableIntegration, {
      clerkId: identity.subject,
    });

    if (!integration || integration.status !== "active") {
      return {
        success: false,
        message: "No active Airtable integration found",
      };
    }

    try {
      // Fetch table data from Airtable
      const encryptionKey = process.env.AIRTABLE_ENCRYPTION_KEY || "default-key-change-in-production";
      const accessToken = decrypt(integration.accessToken, encryptionKey);

      const response = await fetch(`https://api.airtable.com/v0/${args.baseId}/${args.tableId}?pageSize=100`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Failed to fetch Airtable data: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      const records = data.records || [];

      if (records.length === 0) {
        return {
          success: false,
          message: "No records found in the selected table",
        };
      }

      // Call internal mutation to save data
      return await ctx.runMutation(internal.integrations.createSpreadsheetWithImport, {
        clerkId: identity.subject,
        baseId: args.baseId,
        tableId: args.tableId,
        tableName: args.tableName,
        spreadsheetName: args.spreadsheetName,
        records,
      });
    } catch (error) {
      return {
        success: false,
        message: `Import failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});

/**
 * Get Airtable imports for a user
 */
export const getAirtableImports = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("airtableImports"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      integrationId: v.id("integrations"),
      baseId: v.string(),
      tableName: v.string(),
      tableId: v.string(),
      lastSyncedAt: v.optional(v.number()),
      recordCount: v.optional(v.number()),
      createdAt: v.number(),
      updatedAt: v.number(),
      spreadsheet: v.object({
        _id: v.id("spreadsheets"),
        name: v.string(),
        projectId: v.id("projects"),
      }),
    })
  ),
  handler: async (ctx) => {
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

    const imports = await ctx.db
      .query("airtableImports")
      .withIndex("by_user", (q) => q.eq("userId", user._id))
      .collect();

    // Fetch spreadsheet info for each import
    const importsWithSpreadsheets = await Promise.all(
      imports.map(async (importRecord) => {
        const spreadsheet = await ctx.db.get(importRecord.spreadsheetId);
        
        // Skip imports where spreadsheet was deleted
        if (!spreadsheet) {
          return null;
        }
        
        return {
          _id: importRecord._id,
          _creationTime: importRecord._creationTime,
          spreadsheetId: importRecord.spreadsheetId,
          integrationId: importRecord.integrationId,
          baseId: importRecord.baseId,
          tableName: importRecord.tableName,
          tableId: importRecord.tableId,
          lastSyncedAt: importRecord.lastSyncedAt,
          recordCount: importRecord.recordCount,
          createdAt: importRecord.createdAt,
          updatedAt: importRecord.updatedAt,
          spreadsheet: {
            _id: spreadsheet._id,
            name: spreadsheet.name,
            projectId: spreadsheet.projectId,
          },
        };
      })
    );

    // Filter out null entries (deleted spreadsheets)
    return importsWithSpreadsheets.filter((imp) => imp !== null);
  },
});

/**
 * Internal query to get import record
 */
export const getImportRecord = internalQuery({
  args: {
    importId: v.id("airtableImports"),
    clerkId: v.string(),
  },
  returns: v.union(
    v.object({
      _id: v.id("airtableImports"),
      userId: v.id("users"),
      spreadsheetId: v.id("spreadsheets"),
      integrationId: v.id("integrations"),
      baseId: v.string(),
      tableName: v.string(),
      tableId: v.string(),
      accessToken: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", args.clerkId))
      .unique();

    if (!user) {
      return null;
    }

    const importRecord = await ctx.db.get(args.importId);
    if (!importRecord || importRecord.userId !== user._id) {
      return null;
    }

    const integration = await ctx.db.get(importRecord.integrationId);
    if (!integration || integration.status !== "active") {
      return null;
    }

    return {
      _id: importRecord._id,
      userId: importRecord.userId,
      spreadsheetId: importRecord.spreadsheetId,
      integrationId: importRecord.integrationId,
      baseId: importRecord.baseId,
      tableName: importRecord.tableName,
      tableId: importRecord.tableId,
      accessToken: integration.accessToken,
    };
  },
});

/**
 * Sync Airtable data for an existing import
 */
export const syncAirtableData = action({
  args: {
    importId: v.id("airtableImports"),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    recordCount: v.optional(v.number()),
  }),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const importData = await ctx.runQuery(internal.integrations.getImportRecord, {
      importId: args.importId,
      clerkId: identity.subject,
    });

    if (!importData) {
      return {
        success: false,
        message: "Import record not found or access denied",
      };
    }

    try {
      const encryptionKey = process.env.AIRTABLE_ENCRYPTION_KEY || "default-key-change-in-production";
      const accessToken = decrypt(importData.accessToken, encryptionKey);

      const response = await fetch(`https://api.airtable.com/v0/${importData.baseId}/${importData.tableId}?pageSize=100`, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `Failed to fetch Airtable data: ${response.status} ${response.statusText}`,
        };
      }

      const data = await response.json();
      const records = data.records || [];

      // Update spreadsheet data
      const spreadsheet = await ctx.db.get(importData.spreadsheetId);
      if (!spreadsheet) {
        return {
          success: false,
          message: "Spreadsheet not found",
        };
      }

      // Transform data (same logic as import)
      const fieldNames = records.length > 0 ? Object.keys(records[0].fields) : [];
      
      // Build rows object with proper structure
      const rows: Record<string, any> = {
        len: records.length + 1,
      };

      // Add header row (row 0)
      const headerCells: Record<string, any> = {};
      fieldNames.forEach((fieldName, colIndex) => {
        headerCells[colIndex.toString()] = {
          text: fieldName,
          style: 0,
        };
      });
      rows["0"] = { cells: headerCells };

      // Add data rows
      records.forEach((record: any, rowIndex: number) => {
        const cells: Record<string, any> = {};
        fieldNames.forEach((fieldName, colIndex) => {
          const value = record.fields[fieldName];
          let cellValue = "";
          
          if (value !== undefined && value !== null) {
            if (Array.isArray(value)) {
              cellValue = value.join(", ");
            } else if (typeof value === "object") {
              cellValue = JSON.stringify(value);
            } else {
              cellValue = String(value);
            }
          }

          cells[colIndex.toString()] = {
            text: cellValue,
            style: 0,
          };
        });
        rows[(rowIndex + 1).toString()] = { cells };
      });

      const sheet = {
        name: importData.tableName,
        freeze: "A1",
        styles: [],
        merges: [],
        rows,
        cols: { len: Math.max(26, fieldNames.length) },
      };

      const now = Date.now();
      
      // Update spreadsheet
      await ctx.db.patch(importData.spreadsheetId, {
        data: JSON.stringify([sheet]),
        updatedAt: now,
      });

      // Update import record
      await ctx.db.patch(args.importId, {
        lastSyncedAt: now,
        recordCount: records.length,
        updatedAt: now,
      });

      return {
        success: true,
        message: `Successfully synced ${records.length} records`,
        recordCount: records.length,
      };
    } catch (error) {
      return {
        success: false,
        message: `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  },
});
