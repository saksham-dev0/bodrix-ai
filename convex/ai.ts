import { query, mutation, action, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal, api } from "./_generated/api";
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { mistral } from "@ai-sdk/mistral";
import { components } from "./_generated/api";

/**
 * Get all AI conversations for a spreadsheet
 */
export const getConversations = query({
  args: {
    spreadsheetId: v.id("spreadsheets"),
  },
  returns: v.array(
    v.object({
      _id: v.id("aiConversations"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      ownerId: v.id("users"),
      title: v.string(),
      createdAt: v.number(),
      updatedAt: v.number(),
    })
  ),
  handler: async (ctx, args) => {
    console.log("getConversations called with spreadsheetId:", args.spreadsheetId);
    
    const identity = await ctx.auth.getUserIdentity();
    console.log("User identity:", identity);
    
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();

    console.log("Found user:", user);

    if (!user) {
      throw new Error("User not found");
    }

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    console.log("Found spreadsheet:", spreadsheet);
    
    if (!spreadsheet) {
      throw new Error("Spreadsheet not found");
    }

    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to view conversations");
    }

    const conversations = await ctx.db
      .query("aiConversations")
      .withIndex("by_spreadsheet", (q) => q.eq("spreadsheetId", args.spreadsheetId))
      .order("desc")
      .collect();

    console.log("Found conversations:", conversations);
    return conversations;
  },
});

/**
 * Create a new AI conversation
 */
export const createConversation = mutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    title: v.string(),
  },
  returns: v.id("aiConversations"),
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
      throw new Error("Not authorized to create conversations");
    }

    const now = Date.now();
    return await ctx.db.insert("aiConversations", {
      spreadsheetId: args.spreadsheetId,
      ownerId: user._id,
      title: args.title,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Get messages for a conversation
 */
export const getMessages = query({
  args: {
    conversationId: v.id("aiConversations"),
  },
  returns: v.array(
    v.object({
      _id: v.id("aiMessages"),
      _creationTime: v.number(),
      conversationId: v.id("aiConversations"),
      ownerId: v.id("users"),
      role: v.union(v.literal("user"), v.literal("assistant")),
      content: v.string(),
      chartData: v.optional(
        v.object({
          type: v.union(
            v.literal("line"),
            v.literal("bar"),
            v.literal("area"),
            v.literal("pie")
          ),
          range: v.string(),
          sheetName: v.optional(v.string()),
          title: v.optional(v.string()),
        })
      ),
      // Agent and LLM information
      agentId: v.optional(v.string()),
      modelName: v.optional(v.string()),
      provider: v.optional(v.string()), // "openai", "anthropic", "google", "mistral"
      // Streaming support
      isStreaming: v.optional(v.boolean()),
      isComplete: v.optional(v.boolean()),
      createdAt: v.number(),
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

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.ownerId !== user._id) {
      throw new Error("Not authorized to view messages");
    }

    return await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();
  },
});

/**
 * Send a message to AI and get response
 */
export const sendMessage = mutation({
  args: {
    conversationId: v.id("aiConversations"),
    content: v.string(),
    selectedRange: v.optional(v.string()),
    activeSheetName: v.optional(v.string()),
    liveSpreadsheetData: v.optional(v.string()), // Add live data parameter
    agentId: v.optional(v.id("aiAgents")), // Optional agent selection
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

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    if (conversation.ownerId !== user._id) {
      throw new Error("Not authorized to send messages");
    }

    // Get or create default agent if none specified
    let agentId = args.agentId;
    if (!agentId) {
      // Get the first active agent for the user
      const agents = await ctx.db
        .query("aiAgents")
        .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
        .filter((q) => q.eq(q.field("isActive"), true))
        .first();
      
      if (!agents) {
        // Create default agents if none exist
        const defaultAgents = await ctx.runMutation(api.aiAgents.getDefaultAgents, {});
        const firstAgent = defaultAgents.find((agent: any) => agent.isActive);
        agentId = firstAgent?._id;
      } else {
        agentId = agents._id;
      }
    }

    if (!agentId) {
      throw new Error("No AI agent available");
    }

    const now = Date.now();

    // Save user message
    await ctx.db.insert("aiMessages", {
      conversationId: args.conversationId,
      ownerId: user._id,
      role: "user",
      content: args.content,
      createdAt: now,
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    // Schedule streaming AI response
    await ctx.scheduler.runAfter(0, internal.ai.generateStreamingAIResponse, {
      conversationId: args.conversationId,
      userMessage: args.content,
      selectedRange: args.selectedRange,
      activeSheetName: args.activeSheetName,
      liveSpreadsheetData: args.liveSpreadsheetData,
      agentId: agentId,
    });

    return null;
  },
});

/**
 * Generate AI response using OpenAI
 */
export const generateAIResponse = internalAction({
  args: {
    conversationId: v.id("aiConversations"),
    userMessage: v.string(),
    selectedRange: v.optional(v.string()),
    activeSheetName: v.optional(v.string()),
    liveSpreadsheetData: v.optional(v.string()), // Add live data parameter
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log("Starting AI response generation for conversation:", args.conversationId);
      
      // Get conversation data
      const conversation = await ctx.runQuery(internal.ai.getConversationData, {
        conversationId: args.conversationId,
      });

      console.log("Conversation data:", conversation);

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Use live data if available, otherwise fall back to database
      let spreadsheetData = null;
      if (args.liveSpreadsheetData) {
        console.log("Using live spreadsheet data");
        try {
          const liveData = JSON.parse(args.liveSpreadsheetData);
          console.log("Parsed live data:", liveData);
          console.log("Live data type:", typeof liveData);
          console.log("Live data length:", Array.isArray(liveData) ? liveData.length : "not array");
          
          spreadsheetData = {
            name: "Live Spreadsheet Data",
            data: args.liveSpreadsheetData
          };
        } catch (e) {
          console.error("Error parsing live data:", e);
        }
      }
      
      // Fallback to database data if live data not available
      if (!spreadsheetData) {
        console.log("Falling back to database data");
        spreadsheetData = await ctx.runQuery(internal.ai.getSpreadsheetData, {
          spreadsheetId: conversation.conversation.spreadsheetId,
        });
      }

      console.log("Spreadsheet data:", spreadsheetData);

      // Get uploaded documents for this spreadsheet
      let documents1: any[] = [];
      try {
        documents1 = await ctx.runQuery(internal.documents.getConversationDocuments as any, {
          spreadsheetId: conversation.conversation.spreadsheetId,
        });
      } catch (e) {
        console.log("Documents not available yet, run 'npx convex dev' to regenerate types");
      }

      // Build context for AI
      const context = buildAIContext(
        spreadsheetData,
        args.selectedRange,
        args.activeSheetName,
        conversation.messages,
        documents1
      );

      console.log("Built context:", context);

      // Call OpenAI API
      const response = await generateOpenAIResponse(context, args.userMessage);

      console.log("OpenAI response:", response);

      // Save AI response
      await ctx.runMutation(internal.ai.saveAIResponse, {
        conversationId: args.conversationId,
        content: response.content,
        chartData: response.chartData,
      });

      console.log("AI response saved successfully");
    } catch (error) {
      console.error("Error generating AI response:", error);
      
      // Save error message
      try {
        await ctx.runMutation(internal.ai.saveAIResponse, {
          conversationId: args.conversationId,
          content: `I apologize, but I encountered an error while processing your request: ${error instanceof Error ? error.message : String(error)}. Please try again.`,
          chartData: undefined,
        });
      } catch (saveError) {
        console.error("Error saving error message:", saveError);
      }
    }

    return null;
  },
});

/**
 * Internal query to get conversation data
 */
export const getConversationData = internalQuery({
  args: {
    conversationId: v.id("aiConversations"),
  },
  returns: v.union(
    v.object({
      conversation: v.object({
        _id: v.id("aiConversations"),
        _creationTime: v.number(),
        spreadsheetId: v.id("spreadsheets"),
        ownerId: v.id("users"),
        title: v.string(),
        createdAt: v.number(),
        updatedAt: v.number(),
      }),
      messages: v.array(
        v.object({
          role: v.union(v.literal("user"), v.literal("assistant")),
          content: v.string(),
        })
      ),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .order("asc")
      .collect();

    return {
      conversation: {
        _id: conversation._id,
        _creationTime: conversation._creationTime,
        spreadsheetId: conversation.spreadsheetId,
        ownerId: conversation.ownerId,
        title: conversation.title,
        createdAt: conversation.createdAt,
        updatedAt: conversation.updatedAt,
      },
      messages: messages.map(msg => ({
        role: msg.role,
        content: msg.content,
      })),
    };
  },
});

/**
 * Get spreadsheet data for AI analysis
 */
export const getSheetData = query({
  args: { spreadsheetId: v.id("spreadsheets") },
  returns: v.union(
    v.object({
      name: v.string(),
      data: v.string(),
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

    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      return null;
    }

    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to view spreadsheet");
    }

    // Try to get data from workbookData first, then fall back to data
    const sheetData = spreadsheet.workbookData || spreadsheet.data || "";
    
    return {
      name: spreadsheet.name,
      data: sheetData,
    };
  },
});

/**
 * Internal query to get spreadsheet data
 */
export const getSpreadsheetData = internalQuery({
  args: {
    spreadsheetId: v.id("spreadsheets"),
  },
  returns: v.union(
    v.object({
      name: v.string(),
      data: v.string(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const spreadsheet = await ctx.db.get(args.spreadsheetId);
    if (!spreadsheet) {
      return null;
    }

    // Try to get data from workbookData first, then fall back to data
    const sheetData = spreadsheet.workbookData || spreadsheet.data || "";
    
    return {
      name: spreadsheet.name,
      data: sheetData,
    };
  },
});

/**
 * Internal mutation to save AI response
 */
export const saveAIResponse = internalMutation({
  args: {
    conversationId: v.id("aiConversations"),
    content: v.string(),
    chartData: v.optional(
      v.object({
        type: v.union(
          v.literal("line"),
          v.literal("bar"),
          v.literal("area"),
          v.literal("pie")
        ),
        range: v.string(),
        sheetName: v.optional(v.string()),
        title: v.optional(v.string()),
      })
    ),
    agentId: v.optional(v.id("aiAgents")),
    modelName: v.optional(v.string()),
    provider: v.optional(v.string()),
    agentType: v.optional(v.union(
      v.literal("general"),
      v.literal("clean"),
      v.literal("summarize"),
      v.literal("trend")
    )),
    isStreaming: v.optional(v.boolean()),
    isComplete: v.optional(v.boolean()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();

    await ctx.db.insert("aiMessages", {
      conversationId: args.conversationId,
      ownerId: conversation.ownerId,
      role: "assistant",
      content: args.content,
      chartData: args.chartData,
      agentId: args.agentId,
      modelName: args.modelName,
      provider: args.provider,
      agentType: args.agentType,
      isStreaming: args.isStreaming || false,
      isComplete: args.isComplete || true,
      createdAt: now,
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    return null;
  },
});

/**
 * Internal mutation to create streaming message placeholder
 */
export const createStreamingMessage = internalMutation({
  args: {
    conversationId: v.id("aiConversations"),
    agentId: v.optional(v.id("aiAgents")),
    modelName: v.optional(v.string()),
    provider: v.optional(v.string()),
    agentType: v.optional(v.union(
      v.literal("general"),
      v.literal("clean"),
      v.literal("summarize"),
      v.literal("trend")
    )),
  },
  returns: v.id("aiMessages"),
  handler: async (ctx, args) => {
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    const now = Date.now();

    const messageId = await ctx.db.insert("aiMessages", {
      conversationId: args.conversationId,
      ownerId: conversation.ownerId,
      role: "assistant",
      content: "",
      agentId: args.agentId,
      modelName: args.modelName,
      provider: args.provider,
      agentType: args.agentType,
      isStreaming: true,
      isComplete: false,
      createdAt: now,
    });

    // Update conversation timestamp
    await ctx.db.patch(args.conversationId, {
      updatedAt: now,
    });

    return messageId;
  },
});

/**
 * Internal mutation to update streaming message content
 */
export const updateStreamingMessage = internalMutation({
  args: {
    messageId: v.id("aiMessages"),
    content: v.string(),
    isComplete: v.optional(v.boolean()),
    chartData: v.optional(
      v.object({
        type: v.union(
          v.literal("line"),
          v.literal("bar"),
          v.literal("area"),
          v.literal("pie")
        ),
        range: v.string(),
        sheetName: v.optional(v.string()),
        title: v.optional(v.string()),
      })
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const message = await ctx.db.get(args.messageId);
    if (!message) {
      throw new Error("Message not found");
    }

    const updateData: any = {
      content: args.content,
    };

    if (args.isComplete !== undefined) {
      updateData.isComplete = args.isComplete;
      updateData.isStreaming = !args.isComplete;
      console.log(`Updating message ${args.messageId}: isComplete=${args.isComplete}, isStreaming=${!args.isComplete}`);
    }

    if (args.chartData !== undefined) {
      updateData.chartData = args.chartData;
    }

    await ctx.db.patch(args.messageId, updateData);

    // Update conversation timestamp
    if (message.conversationId) {
      await ctx.db.patch(message.conversationId, {
        updatedAt: Date.now(),
      });
    }

    return null;
  },
});

/**
 * Internal mutator for AI agents to insert test data
 */
export const aiInsertTestData = internalMutation({
  args: {
    conversationId: v.id("aiConversations"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Get conversation to find spreadsheet
    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      throw new Error("Conversation not found");
    }

    // Call the internal spreadsheet insertTestData mutation
    await ctx.runMutation(internal.spreadsheets.internalInsertTestData, {
      spreadsheetId: conversation.spreadsheetId,
      ownerId: conversation.ownerId,
    });

    return null;
  },
});

/**
 * Delete a conversation
 */
export const deleteConversation = mutation({
  args: {
    conversationId: v.id("aiConversations"),
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

    const conversation = await ctx.db.get(args.conversationId);
    if (!conversation) {
      return null;
    }

    if (conversation.ownerId !== user._id) {
      throw new Error("Not authorized to delete conversation");
    }

    // Delete all messages in the conversation
    const messages = await ctx.db
      .query("aiMessages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .collect();

    for (const message of messages) {
      await ctx.db.delete(message._id);
    }

    // Delete the conversation
    await ctx.db.delete(args.conversationId);

    return null;
  },
});

/**
 * Helper function to convert sheet data to markdown table format
 */
function sheetToMarkdownTable(sheetJson: any): string {
  if (!sheetJson || !sheetJson.rows) {
    return "This sheet is empty.";
  }

  const rows = sheetJson.rows;
  const output: string[] = [];
  
  // Find the maximum row and column (x-spreadsheet uses 0-based indexing)
  let maxRow = -1;
  let maxCol = -1;
  
  for (const rowKey in rows) {
    if (rowKey === "len") continue; // Skip the len property
    
    const rowNum = parseInt(rowKey);
    maxRow = Math.max(maxRow, rowNum);
    
    if (rows[rowKey].cells) {
      for (const colKey in rows[rowKey].cells) {
        const colNum = parseInt(colKey);
        maxCol = Math.max(maxCol, colNum);
      }
    }
  }
  
  // Build the table (x-spreadsheet uses 0-based indexing)
  for (let r = 0; r <= maxRow; r++) {
    const rowData: string[] = [];
    for (let c = 0; c <= maxCol; c++) {
      const cellValue = rows[r]?.cells?.[c]?.text || "";
      rowData.push(cellValue);
    }
    
    // Only add rows that have at least one non-empty cell
    if (rowData.some(cell => cell !== "")) {
      output.push(`Row ${r + 1}: ${rowData.join(" | ")}`); // Display as 1-based for user
    }
  }
  
  return output.length > 0 ? output.join("\n") : "This sheet is empty.";
}

/**
 * Analyze sheets and create a KPI dashboard
 */
export const analyzeSheetsForDashboard = internalMutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
    userMessage: v.string(),
  },
  returns: v.object({
    success: v.boolean(),
    message: v.string(),
    dashboardId: v.optional(v.id("dashboards")),
  }),
  handler: async (ctx, args) => {
    try {
      const spreadsheet = await ctx.db.get(args.spreadsheetId);
      if (!spreadsheet) {
        throw new Error("Spreadsheet not found");
      }

      const data = JSON.parse(spreadsheet.data || "[]");
      if (!Array.isArray(data) || data.length === 0) {
        return {
          success: false,
          message: "No sheets found in the spreadsheet. Please add data to your sheets first.",
        };
      }

      console.log(`📊 Analyzing ${data.length} sheet(s) for dashboard creation...`);

      // Analyze each sheet to find numeric columns and potential KPIs
      const sheetAnalysis: Array<{
        sheetName: string;
        numericColumns: Array<{
          columnName: string;
          columnIndex: number;
          rowCount: number;
          hasHeader: boolean;
          dataType: "number" | "currency" | "percentage";
          values: number[];
        }>;
        categoricalColumns: Array<{
          columnName: string;
          columnIndex: number;
          uniqueValues: string[];
        }>;
        dateColumns: Array<{
          columnName: string;
          columnIndex: number;
        }>;
      }> = [];

      // Analyze each sheet
      for (const sheet of data) {
        const sheetName = sheet.name || "Unnamed";
        console.log(`  Analyzing sheet: ${sheetName}`);

        const numericColumns: any[] = [];
        const categoricalColumns: any[] = [];
        const dateColumns: any[] = [];

        // Find header row and columns
        let headerRow = -1;
        const columnHeaders: Record<number, string> = {};

        // Look for headers in first 5 rows
        for (let rowIdx = 0; rowIdx < 5 && headerRow === -1; rowIdx++) {
          const row = sheet.rows?.[rowIdx];
          if (!row?.cells) continue;

          const cells = Object.keys(row.cells).map((k) => ({
            index: parseInt(k),
            text: row.cells[k].text || "",
          }));

          // Check if this looks like a header row (mostly text)
          const nonEmptyCells = cells.filter((c) => c.text.trim());
          if (nonEmptyCells.length > 0) {
            headerRow = rowIdx;
            nonEmptyCells.forEach((cell) => {
              columnHeaders[cell.index] = cell.text;
            });
            break;
          }
        }

        if (headerRow === -1) {
          console.log(`    ⚠️ No header row found in ${sheetName}`);
          continue;
        }

        console.log(`    Found header row at index ${headerRow} with ${Object.keys(columnHeaders).length} columns`);

        // Analyze each column
        for (const [colIndexStr, headerName] of Object.entries(columnHeaders)) {
          const colIndex = parseInt(colIndexStr);
          const values: any[] = [];
          const numericValues: number[] = [];
          const lowerHeaderName = headerName.toLowerCase();

          // Skip ID columns and other non-meaningful numeric columns
          const shouldSkipColumn = 
            lowerHeaderName.includes("id") ||
            lowerHeaderName === "userid" ||
            lowerHeaderName === "user_id" ||
            lowerHeaderName === "transactionid" ||
            lowerHeaderName === "transaction_id" ||
            lowerHeaderName === "productid" ||
            lowerHeaderName === "product_id" ||
            lowerHeaderName === "orderid" ||
            lowerHeaderName === "order_id" ||
            lowerHeaderName.endsWith("id") ||
            lowerHeaderName.startsWith("id");

          if (shouldSkipColumn) {
            console.log(`    ⊘ Skipping ID column: ${headerName}`);
            continue;
          }

          // Collect values from this column (skip header)
          for (let rowIdx = headerRow + 1; rowIdx < (sheet.rows?.len || 100); rowIdx++) {
            const row = sheet.rows?.[rowIdx];
            if (!row?.cells) continue;

            const cell = row.cells[colIndex];
            if (!cell?.text) continue;

            const text = cell.text.trim();
            if (!text) continue;

            // Check if calculated row (skip)
            const lower = text.toLowerCase();
            if (
              lower.startsWith("sum") ||
              lower.startsWith("average") ||
              lower.startsWith("total") ||
              lower.startsWith("count") ||
              lower.includes("sum of") ||
              lower.includes("average of")
            ) {
              break; // Stop at calculated rows
            }

            values.push(text);

            // Try to parse as number (but be more careful)
            const cleaned = text.replace(/[$,]/g, ""); // Remove $ and commas
            const num = parseFloat(cleaned);
            if (!isNaN(num) && isFinite(num)) {
              numericValues.push(num);
            }
          }

          if (values.length === 0) continue;

          // Check if date column FIRST (before checking numeric)
          const datePattern = /\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4}|\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/;
          const hasDatePattern = values.some((v) => datePattern.test(v));
          const hasDateKeyword = lowerHeaderName.includes("date") || 
                                  lowerHeaderName.includes("time") ||
                                  lowerHeaderName.includes("day") ||
                                  lowerHeaderName.includes("month") ||
                                  lowerHeaderName.includes("year");

          if (hasDatePattern || hasDateKeyword) {
            dateColumns.push({
              columnName: headerName,
              columnIndex: colIndex,
            });
            console.log(`    ✓ Date column: ${headerName}`);
            continue; // Skip further analysis for this column
          }

          // Classify column type
          const numericRatio = numericValues.length / values.length;

          if (numericRatio > 0.8 && numericValues.length >= 3) {
            // Additional validation: skip if values look like IDs (sequential, large numbers)
            const avg = numericValues.reduce((a, b) => a + b, 0) / numericValues.length;
            const isLikelyId = avg > 1000 && numericValues.every(n => n > 0 && n < 100000);
            
            if (isLikelyId && !lowerHeaderName.includes("price") && !lowerHeaderName.includes("amount")) {
              console.log(`    ⊘ Skipping likely ID column: ${headerName}`);
              continue;
            }

            // Numeric column
            const dataType = lowerHeaderName.includes("price") ||
              lowerHeaderName.includes("cost") ||
              lowerHeaderName.includes("amount") ||
              lowerHeaderName.includes("revenue") ||
              lowerHeaderName.includes("salary") ||
              lowerHeaderName.includes("total") ||
              lowerHeaderName.includes("payment") ||
              lowerHeaderName.includes("fee")
              ? "currency"
              : lowerHeaderName.includes("percent") ||
                lowerHeaderName.includes("rate") ||
                lowerHeaderName.includes("%")
              ? "percentage"
              : "number";

            numericColumns.push({
              columnName: headerName,
              columnIndex: colIndex,
              rowCount: numericValues.length,
              hasHeader: true,
              dataType,
              values: numericValues,
            });

            console.log(`    ✓ Numeric column: ${headerName} (${numericValues.length} values, type: ${dataType})`);
          } else if (values.length >= 3) {
            // Categorical column
            const uniqueValues = [...new Set(values)];
            if (uniqueValues.length < values.length * 0.8 && uniqueValues.length >= 2) {
              // Has some repetition and at least 2 categories
              categoricalColumns.push({
                columnName: headerName,
                columnIndex: colIndex,
                uniqueValues: uniqueValues.slice(0, 20), // Limit to 20 unique values
              });
              console.log(`    ✓ Categorical column: ${headerName} (${uniqueValues.length} unique values)`);
            }
          }
        }

        sheetAnalysis.push({
          sheetName,
          numericColumns,
          categoricalColumns,
          dateColumns,
        });
      }

      // Check if we have enough data to create a dashboard
      const totalNumericColumns = sheetAnalysis.reduce(
        (sum, s) => sum + s.numericColumns.length,
        0
      );

      if (totalNumericColumns === 0) {
        let message = "❌ **Cannot create dashboard - no meaningful numeric data found**\n\n";
        message += "**What I found:**\n";
        
        sheetAnalysis.forEach(sheet => {
          message += `\n📋 **${sheet.sheetName}**:\n`;
          if (sheet.numericColumns.length === 0 && sheet.categoricalColumns.length === 0 && sheet.dateColumns.length === 0) {
            message += "  - No analyzable data found\n";
          } else {
            if (sheet.dateColumns.length > 0) {
              message += `  - ${sheet.dateColumns.length} date column(s): ${sheet.dateColumns.map(c => c.columnName).join(", ")}\n`;
            }
            if (sheet.categoricalColumns.length > 0) {
              message += `  - ${sheet.categoricalColumns.length} categorical column(s): ${sheet.categoricalColumns.map(c => c.columnName).join(", ")}\n`;
            }
            message += "  - ⚠️ No numeric columns for metrics\n";
          }
        });
        
        message += "\n**To create a dashboard, add numeric columns like:**\n";
        message += "- Sales amounts, revenue, prices\n";
        message += "- Quantities, counts, totals\n";
        message += "- Percentages, rates\n";
        message += "- Any measurable metrics\n\n";
        message += "💡 **Note:** ID columns and date columns are automatically excluded from metrics.";
        
        return {
          success: false,
          message,
        };
      }

      console.log(`📊 Found ${totalNumericColumns} numeric columns across ${sheetAnalysis.length} sheets`);

      // Create dashboard
      const dashboardName = args.userMessage.match(/(?:dashboard|kpi)(?:\s+for|\s+about|\s+of)?\s+(.+?)(?:\s*$|\s+with|\s+showing)/i)?.[1] ||
        "KPI Dashboard";

      const now = Date.now();
      const dashboardId = await ctx.db.insert("dashboards", {
        spreadsheetId: args.spreadsheetId,
        ownerId: args.ownerId,
        name: dashboardName,
        description: `Auto-generated dashboard based on data analysis`,
        widgetsData: "[]",
        createdAt: now,
        updatedAt: now,
      });

      console.log(`✅ Created dashboard: ${dashboardName}`);

      // Create widgets for each numeric column
      const widgets: Array<{ type: string; title: string }> = [];
      let positionY = 0;

      for (const sheetInfo of sheetAnalysis) {
        let positionX = 0;

        // Create metric widgets for key statistics
        for (const numCol of sheetInfo.numericColumns) {
          // Calculate sum, average, etc.
          const sum = numCol.values.reduce((a, b) => a + b, 0);
          const avg = sum / numCol.values.length;
          const min = Math.min(...numCol.values);
          const max = Math.max(...numCol.values);

          // Create a metric widget for the average or sum
          const metricType = numCol.dataType === "currency" ? "sum" : "average";
          const metricValue = metricType === "sum" ? sum : avg;
          const formattedValue =
            numCol.dataType === "currency"
              ? `$${metricValue.toFixed(2)}`
              : numCol.dataType === "percentage"
              ? `${metricValue.toFixed(1)}%`
              : metricValue.toFixed(2);

          await ctx.db.insert("dashboardWidgets", {
            dashboardId,
            ownerId: args.ownerId,
            type: "metric",
            title: `${metricType === "sum" ? "Total" : "Average"} ${numCol.columnName}`,
            metricValue: formattedValue,
            metricFormula: metricType.toUpperCase(),
            metricColumn: numCol.columnName,
            sheetName: sheetInfo.sheetName,
            position: {
              x: positionX,
              y: positionY,
              width: 3,
              height: 2,
            },
            createdAt: now,
            updatedAt: now,
          });

          widgets.push({
            type: "metric",
            title: `${metricType === "sum" ? "Total" : "Average"} ${numCol.columnName}`,
          });

          positionX += 3;
          if (positionX >= 12) {
            positionX = 0;
            positionY += 2;
          }
        }

        // Create chart widgets for numeric data with categories
        if (
          sheetInfo.categoricalColumns.length > 0 &&
          sheetInfo.numericColumns.length > 0
        ) {
          // Start new row for charts
          if (positionX > 0) {
            positionX = 0;
            positionY += 2;
          }

          // Create a bar chart combining first categorical and numeric column
          const catCol = sheetInfo.categoricalColumns[0];
          const numCol = sheetInfo.numericColumns[0];

          // Find the range that includes both columns
          const minCol = Math.min(catCol.columnIndex, numCol.columnIndex);
          const maxCol = Math.max(catCol.columnIndex, numCol.columnIndex);
          const maxRow = numCol.rowCount + 1; // +1 for header

          const colToLetter = (col: number) => {
            let letter = "";
            let c = col;
            while (c >= 0) {
              letter = String.fromCharCode((c % 26) + 65) + letter;
              c = Math.floor(c / 26) - 1;
            }
            return letter;
          };

          const range = `${colToLetter(minCol)}1:${colToLetter(maxCol)}${maxRow}`;

          await ctx.db.insert("dashboardWidgets", {
            dashboardId,
            ownerId: args.ownerId,
            type: "chart",
            title: `${numCol.columnName} by ${catCol.columnName}`,
            chartType: "bar",
            range: range,
            sheetName: sheetInfo.sheetName,
            position: {
              x: 0,
              y: positionY,
              width: 6,
              height: 4,
            },
            createdAt: now,
            updatedAt: now,
          });

          widgets.push({
            type: "chart",
            title: `${numCol.columnName} by ${catCol.columnName}`,
          });

          // Create a pie chart if we have good categorical data
          if (catCol.uniqueValues.length <= 10) {
            await ctx.db.insert("dashboardWidgets", {
              dashboardId,
              ownerId: args.ownerId,
              type: "chart",
              title: `${numCol.columnName} Distribution`,
              chartType: "pie",
              range: range,
              sheetName: sheetInfo.sheetName,
              position: {
                x: 6,
                y: positionY,
                width: 6,
                height: 4,
              },
              createdAt: now,
              updatedAt: now,
            });

            widgets.push({
              type: "chart",
              title: `${numCol.columnName} Distribution`,
            });
          }

          positionY += 4;
        }

        // Create line chart for time series if we have date column
        if (
          sheetInfo.dateColumns.length > 0 &&
          sheetInfo.numericColumns.length > 0
        ) {
          const dateCol = sheetInfo.dateColumns[0];
          const numCol = sheetInfo.numericColumns[0];

          const minCol = Math.min(dateCol.columnIndex, numCol.columnIndex);
          const maxCol = Math.max(dateCol.columnIndex, numCol.columnIndex);
          const maxRow = numCol.rowCount + 1;

          const colToLetter = (col: number) => {
            let letter = "";
            let c = col;
            while (c >= 0) {
              letter = String.fromCharCode((c % 26) + 65) + letter;
              c = Math.floor(c / 26) - 1;
            }
            return letter;
          };

          const range = `${colToLetter(minCol)}1:${colToLetter(maxCol)}${maxRow}`;

          await ctx.db.insert("dashboardWidgets", {
            dashboardId,
            ownerId: args.ownerId,
            type: "chart",
            title: `${numCol.columnName} Over Time`,
            chartType: "line",
            range: range,
            sheetName: sheetInfo.sheetName,
            position: {
              x: 0,
              y: positionY,
              width: 12,
              height: 4,
            },
            createdAt: now,
            updatedAt: now,
          });

          widgets.push({
            type: "chart",
            title: `${numCol.columnName} Over Time`,
          });

          positionY += 4;
        }
      }

      // Build success message
      let message = `✅ **Successfully created "${dashboardName}"**\n\n`;
      message += `📊 **Dashboard Contents:**\n`;
      message += `- **${widgets.filter((w) => w.type === "metric").length}** KPI Metrics\n`;
      message += `- **${widgets.filter((w) => w.type === "chart").length}** Visualizations\n`;
      message += `- **${sheetAnalysis.length}** Sheet(s) analyzed\n\n`;

      message += `**Widgets Created:**\n`;
      widgets.forEach((widget, idx) => {
        message += `${idx + 1}. ${widget.type === "metric" ? "📈" : "📊"} ${widget.title}\n`;
      });

      message += `\n💡 Your dashboard is ready! You can view it in the Dashboards section.`;

      return {
        success: true,
        message,
        dashboardId,
      };
    } catch (error) {
      console.error("Error analyzing sheets for dashboard:", error);
      return {
        success: false,
        message: `Failed to analyze sheets: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  },
});

/**
 * Helper function to build AI context with complete spreadsheet data and documents
 */
function buildAIContext(
  spreadsheetData: { name: string; data: string } | null,
  selectedRange?: string,
  activeSheetName?: string,
  messages: Array<{ role: "user" | "assistant"; content: string }> = [],
  documents: any[] = []
): string {
  let context = "You are an AI assistant with complete access to the user's spreadsheet data and uploaded documents. You can see and analyze ALL data in ALL sheets and document contents. When asked about any sheet, data, document, or analysis, provide specific insights based on the actual content shown below. ";
  
  if (spreadsheetData) {
    context += `\n\nSPREADSHEET: "${spreadsheetData.name}"\n`;
    
    try {
      const data = JSON.parse(spreadsheetData.data);
      
      if (Array.isArray(data) && data.length > 0) {
        context += `\nThis spreadsheet contains ${data.length} sheet(s): ${data.map(s => s.name).join(', ')}\n`;
        
        if (activeSheetName) {
          context += `Currently active sheet: "${activeSheetName}"\n`;
        }
        
        if (selectedRange) {
          context += `User selected range: "${selectedRange}"\n`;
        }
        
        context += "\n=== COMPLETE SPREADSHEET DATA ===\n";
        
        // Process ALL sheets, not just the active one
        data.forEach((sheet, sheetIndex) => {
          context += `\n--- SHEET: "${sheet.name}" ---\n`;
          
          // Convert sheet to markdown table format
          const markdownTable = sheetToMarkdownTable(sheet);
          context += markdownTable + "\n";
        });
        
        context += "\n=== END OF SPREADSHEET DATA ===\n";
      }
    } catch (error) {
      context += `\nError parsing spreadsheet data: ${error}\n`;
    }
  } else {
    context += "\nNo spreadsheet data available.\n";
  }
  
  // Add uploaded documents context
  if (documents && documents.length > 0) {
    context += "\n=== UPLOADED DOCUMENTS ===\n";
    documents.forEach((doc, idx) => {
      context += `\n--- DOCUMENT ${idx + 1}: "${doc.fileName}" (${doc.fileType.toUpperCase()}) ---\n`;
      if (doc.extractedText) {
        context += `Content:\n${doc.extractedText.substring(0, 5000)}${doc.extractedText.length > 5000 ? '...(truncated)' : ''}\n`;
      }
      if (doc.extractedTables) {
        try {
          const tables = JSON.parse(doc.extractedTables);
          if (tables.length > 0) {
            context += `\nTables found in document:\n`;
            tables.forEach((table: any, tableIdx: number) => {
              context += `\nTable ${tableIdx + 1} (Page ${table.page}):\n`;
              if (table.rows && table.rows.length > 0) {
                // Display table in markdown format
                table.rows.forEach((row: string[], rowIdx: number) => {
                  context += `  ${row.join(" | ")}\n`;
                });
              }
            });
          }
        } catch (e) {
          // Ignore parse error
        }
      }
      context += "\n";
    });
    context += "=== END OF UPLOADED DOCUMENTS ===\n";
  }
  
  // Add recent conversation context
  if (messages.length > 0) {
    context += "\n=== RECENT CONVERSATION ===\n";
    const recentMessages = messages.slice(-6); // Last 6 messages
    recentMessages.forEach(msg => {
      context += `${msg.role}: ${msg.content}\n`;
    });
    context += "=== END CONVERSATION ===\n";
  }
  
  context += "\nIMPORTANT INSTRUCTIONS: You have complete access to all the spreadsheet data and uploaded documents shown above.\n\n";
  context += "When the user asks to CREATE A TABLE FROM A DOCUMENT:\n";
  context += "- DO NOT make up random data or create example tables\n";
  context += "- The system will AUTOMATICALLY extract the exact table structure from the document\n";
  context += "- Simply acknowledge the request - the table will be created with the exact headers and data from the document\n";
  context += "- If there are multiple tables in the document, ALL of them will be created\n\n";
  context += "For other requests:\n";
  context += "- Reference specific content from the documents and spreadsheets shown above\n";
  context += "- Provide detailed analysis based on actual data\n";
  context += "- Be specific and accurate with column names, values, and sheet names";
  
  return context;
}

/**
 * Generate streaming AI response using OpenAI
 */
export const generateStreamingAIResponse = internalAction({
  args: {
    conversationId: v.id("aiConversations"),
    userMessage: v.string(),
    selectedRange: v.optional(v.string()),
    activeSheetName: v.optional(v.string()),
    liveSpreadsheetData: v.optional(v.string()),
    agentId: v.optional(v.id("aiAgents")),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log("Starting streaming AI response generation for conversation:", args.conversationId);
      
      // Get conversation data
      const conversation = await ctx.runQuery(internal.ai.getConversationData, {
        conversationId: args.conversationId,
      });

      if (!conversation) {
        throw new Error("Conversation not found");
      }

      // Get agent configuration if provided
      let agent = null;
      if (args.agentId) {
        agent = await ctx.runQuery(internal.aiAgents.getAgentData, {
          agentId: args.agentId,
        });
      }

      // Use live data if available, otherwise fall back to database
      let spreadsheetData = null;
      if (args.liveSpreadsheetData) {
        console.log("Using live spreadsheet data");
        try {
          const liveData = JSON.parse(args.liveSpreadsheetData);
          console.log("Parsed live data:", liveData);
          
          spreadsheetData = {
            name: "Live Spreadsheet Data",
            data: args.liveSpreadsheetData
          };
        } catch (e) {
          console.error("Error parsing live data:", e);
        }
      }
      
      // Fallback to database data if live data not available
      if (!spreadsheetData) {
        console.log("Falling back to database data");
        spreadsheetData = await ctx.runQuery(internal.ai.getSpreadsheetData, {
          spreadsheetId: conversation.conversation.spreadsheetId,
        });
      }

      // Get uploaded documents for this spreadsheet
      let documents: any[] = [];
      try {
        documents = await ctx.runQuery(internal.documents.getConversationDocuments as any, {
          spreadsheetId: conversation.conversation.spreadsheetId,
        });
      } catch (e) {
        console.log("Documents not available yet, run 'npx convex dev' to regenerate types");
      }

      // Build context for AI
      const context = buildAIContext(
        spreadsheetData,
        args.selectedRange,
        args.activeSheetName,
        conversation.messages,
        documents
      );

      // Check if user wants to add test data
      if (args.userMessage.toLowerCase().includes("add test") || 
          args.userMessage.toLowerCase().includes("insert test")) {
        // Call the test data insertion function
        await ctx.runMutation(internal.ai.aiInsertTestData, {
          conversationId: args.conversationId,
        });
        
        // Create streaming message placeholder
        const messageId = await ctx.runMutation(internal.ai.createStreamingMessage, {
          conversationId: args.conversationId,
          agentId: args.agentId,
          modelName: agent?.modelName,
          provider: agent?.provider,
        });

        // Update with immediate response
        await ctx.runMutation(internal.ai.updateStreamingMessage, {
          messageId,
          content: "I've added 'test' to the next available row in your spreadsheet. The action has been completed successfully!",
          isComplete: true,
        });

        return;
      }

      // IMPORTANT: Check for document table creation FIRST (before general table creation)
      // This prevents "create table from document" from being treated as a general table creation
      if (
        documents.length > 0 &&
        (args.userMessage.toLowerCase().includes("from") || 
         args.userMessage.toLowerCase().includes("from the") ||
         args.userMessage.toLowerCase().includes("in the")) &&
        (args.userMessage.toLowerCase().includes("document") || 
         args.userMessage.toLowerCase().includes("pdf") || 
         args.userMessage.toLowerCase().includes("docx") ||
         args.userMessage.toLowerCase().includes("file")) &&
        args.userMessage.toLowerCase().includes("table")
      ) {
        // This is a document table request - skip to document table handler below
        // Don't process as general table creation
      } else if (
        // General table creation patterns (only if NOT from document)
        args.userMessage.toLowerCase().includes("create table") ||
        args.userMessage.toLowerCase().includes("make a table") ||
        args.userMessage.toLowerCase().includes("insert table") ||
        args.userMessage.toLowerCase().includes("create a table") ||
        args.userMessage.toLowerCase().includes("add a table") ||
        args.userMessage.toLowerCase().includes("build a table") ||
        args.userMessage.toLowerCase().includes("add table") ||
        args.userMessage.toLowerCase().includes("make table") ||
        // Catch-all: any combination of create/add/make/build + table
        ((args.userMessage.toLowerCase().includes("create") || 
          args.userMessage.toLowerCase().includes("add") ||
          args.userMessage.toLowerCase().includes("make") ||
          args.userMessage.toLowerCase().includes("build")) && 
         args.userMessage.toLowerCase().includes("table"))
      ) {
        // Create streaming message placeholder
        const messageId = await ctx.runMutation(internal.ai.createStreamingMessage, {
          conversationId: args.conversationId,
          agentId: args.agentId,
          modelName: agent?.modelName,
          provider: agent?.provider,
        });

        // Parse table creation request more intelligently
        let headers: string[] = [];
        let numRows = 5;
        
        // Look for explicit "headers" or "columns" keyword first
        const explicitHeadersMatch = args.userMessage.match(/(?:headers?|columns?):?\s*([^,;\n.?!]+(?:\s*,\s*[^,;\n.?!]+)*)/i);
        if (explicitHeadersMatch) {
          headers = explicitHeadersMatch[1].split(/\s*,\s*/).map((s) => s.trim()).filter(h => h.length > 0);
        }
        
        // If no explicit headers, try different patterns
        if (headers.length === 0) {
          // Look for "with" pattern: "create table with name and sex"
          const withMatch = args.userMessage.match(/(?:with|having|including)\s+([^,;\n.?!]+(?:\s+(?:and|&|\+)\s+[^,;\n.?!]+)+)/i);
          if (withMatch) {
            headers = withMatch[1].split(/\s+(?:and|&|\+)\s+/).map((s) => s.trim()).filter(h => h.length > 0 && !['table', 'sheet', 'rows', 'row', 'columns', 'column'].includes(h.toLowerCase()));
          }
          
          // Look for comma-separated values: "create table name, age, salary"
          if (headers.length === 0) {
            const commaSeparatedMatch = args.userMessage.match(/table\s+([a-zA-Z]+(?:\s*,\s*[a-zA-Z]+)+)/i);
            if (commaSeparatedMatch) {
              headers = commaSeparatedMatch[1].split(/\s*,\s*/).map((s) => s.trim()).filter(h => h.length > 0);
            }
          }
          
          // Look for common business patterns
          if (headers.length === 0) {
            if (args.userMessage.toLowerCase().includes("employee") || args.userMessage.toLowerCase().includes("staff")) {
              headers = ["name", "position", "salary", "department"];
            } else if (args.userMessage.toLowerCase().includes("product")) {
              headers = ["product", "price", "quantity", "category"];
            } else if (args.userMessage.toLowerCase().includes("student") || args.userMessage.toLowerCase().includes("course")) {
              headers = ["name", "course", "grade", "year"];
            } else if (args.userMessage.toLowerCase().includes("customer") || args.userMessage.toLowerCase().includes("client")) {
              headers = ["name", "email", "phone", "company"];
            } else if (args.userMessage.toLowerCase().includes("invoice") || args.userMessage.toLowerCase().includes("order")) {
              headers = ["order_id", "customer", "amount", "date"];
            }
          }
        }
        
        // If still no headers, use default
        if (headers.length === 0) {
          headers = ["column1", "column2", "column3"];
        }
        
        // Parse row count
        const numMatch = args.userMessage.match(/\b(\d{1,3})\s*(?:rows?|lines?|entries?|records?|items?)/i);
        if (numMatch) {
          numRows = Math.min(1000, Math.max(1, parseInt(numMatch[1]))); // Limit between 1-1000
        } else {
          // Try to find just a number in the message
          const numberMatch = args.userMessage.match(/\b(\d{1,3})\b/);
          if (numberMatch) {
            const num = parseInt(numberMatch[1]);
            if (num > 0 && num <= 100) { // Only use if it looks like a reasonable row count
              numRows = num;
            }
          }
        }
        
        // Parse sheet name from the message with improved patterns
        let sheetName: string | undefined = undefined;
        
        // Try different patterns for sheet names, including "sheet name X" syntax
        const patterns = [
          // "in sheet name X" or "to sheet name X"
          /(?:in|to|on|at)\s+(?:the\s+)?sheet\s+(?:name\s+|named\s+|called\s+)?["']?([A-Za-z][A-Za-z0-9_\-\s]+?)["']?(?:\s+(?:create|make|add|with|$)|$)/i,
          // "create sheet named X" or "make sheet called X"
          /(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?sheet\s+(?:name\s+|named\s+|called\s+)?["']?([A-Za-z][A-Za-z0-9_\-\s]+?)["']?(?:\s+(?:with|create|make|$)|$)/i,
          // "sheet X" or "tab X"
          /(?:sheet|tab)\s+(?:name\s+|named\s+|called\s+)?["']?([A-Za-z][A-Za-z0-9_\-\s]+?)["']?(?:\s+(?:with|create|make|$)|$)/i,
          // Quoted sheet name
          /["']([A-Za-z][A-Za-z0-9_\-\s]+?)["']/i,
        ];
        
        const stopWords = ['and', 'or', 'the', 'a', 'an', 'in', 'on', 'to', 'with', 'for', 'of', 'by', 'from', 'at', 'table', 'is', 'it'];
        
        for (const pattern of patterns) {
          const match = args.userMessage.match(pattern);
          if (match && match[1]) {
            const name = match[1].trim();
            // Remove trailing words that are likely not part of the sheet name
            const cleanedName = name.replace(/\s+(create|make|add|with)$/i, '').trim();
            
            if (cleanedName && !stopWords.includes(cleanedName.toLowerCase())) {
              sheetName = cleanedName;
              break;
            }
          }
        }
        
        // If no specific sheet mentioned but user asks for "new sheet", create a default name
        if (!sheetName && (args.userMessage.toLowerCase().includes('new sheet') || args.userMessage.toLowerCase().includes('another sheet'))) {
          sheetName = 'NewSheet';
        }

        // If no sheet name specified, ask user which sheet to use
        if (!sheetName) {
          const clarificationMessage = `Please provide full information. Write the prompt with specifying the sheet name or specify to create a new sheet.`;

          await ctx.runMutation(internal.ai.updateStreamingMessage, {
            messageId,
            content: clarificationMessage,
            isComplete: true,
          });
          
          return null;
        }

        const tableResult = await ctx.runMutation(internal.spreadsheets.internalCreateTableWithSpec, {
          spreadsheetId: conversation.conversation.spreadsheetId,
          ownerId: conversation.conversation.ownerId,
          headers,
          numRows,
          sheetName,
        });

        // Acknowledge completion immediately
        await ctx.runMutation(internal.ai.updateStreamingMessage, {
          messageId,
          content: `${tableResult.message}`,
          isComplete: true,
        });

        return null;
      }

      // Check for chart/graph creation requests
      if (
        (args.userMessage.toLowerCase().includes("chart") ||
         args.userMessage.toLowerCase().includes("graph") ||
         args.userMessage.toLowerCase().includes("visualize") ||
         args.userMessage.toLowerCase().includes("plot")) &&
        (args.userMessage.toLowerCase().includes("create") ||
         args.userMessage.toLowerCase().includes("make") ||
         args.userMessage.toLowerCase().includes("generate") ||
         args.userMessage.toLowerCase().includes("show") ||
         args.userMessage.toLowerCase().includes("bar") ||
         args.userMessage.toLowerCase().includes("line") ||
         args.userMessage.toLowerCase().includes("pie"))
      ) {
        // Create streaming message placeholder
        const messageId = await ctx.runMutation(internal.ai.createStreamingMessage, {
          conversationId: args.conversationId,
          agentId: args.agentId,
          modelName: agent?.modelName,
          provider: agent?.provider,
        });

        try {
          // Extract chart type
          let chartType: "bar" | "line" | "pie" | "area" = "bar";
          if (args.userMessage.toLowerCase().includes("line")) chartType = "line";
          else if (args.userMessage.toLowerCase().includes("pie")) chartType = "pie";
          else if (args.userMessage.toLowerCase().includes("area")) chartType = "area";
          else if (args.userMessage.toLowerCase().includes("bar")) chartType = "bar";

          // Extract sheet name with improved patterns and fuzzy matching
          let sheetName: string | undefined = undefined;
          
          // Get spreadsheet data first to know what sheets are available
          const spreadsheetData = await ctx.runQuery(internal.ai.getSpreadsheetData, {
            spreadsheetId: conversation.conversation.spreadsheetId,
          });

          if (!spreadsheetData?.data) {
            throw new Error("No spreadsheet data found");
          }

          const data = JSON.parse(spreadsheetData.data);
          const availableSheets = data.map((s: any) => s.name || "").filter((n: string) => n);
          
          console.log("Available sheets:", availableSheets);
          console.log("User message:", args.userMessage);
          
          // Enhanced patterns to extract sheet name, including "sheet name X" syntax
          const sheetPatterns = [
            // "in sheet name X" or "in sheet X"
            /(?:in|from|on|at)\s+(?:the\s+)?sheet\s+(?:name\s+|named\s+|called\s+)?["']?([A-Za-z][A-Za-z0-9_\-\s]+?)["']?(?:\s+(?:create|make|show|and|with|for|$)|$)/i,
            // "sheet X" or "sheet named X"
            /(?:sheet|tab)\s+(?:name\s+|named\s+|called\s+)?["']?([A-Za-z][A-Za-z0-9_\-\s]+?)["']?(?:\s+(?:create|make|show|and|with|for|$)|$)/i,
            // Quoted sheet name
            /["']([A-Za-z][A-Za-z0-9_\-\s]+?)["']/i,
          ];
          
          const stopWords = ['and', 'or', 'the', 'a', 'an', 'in', 'on', 'to', 'with', 'for', 'of', 'by', 'from', 'at', 'is', 'it', 'this', 'that'];
          let extractedName: string | undefined = undefined;
          
          for (const pattern of sheetPatterns) {
            const match = args.userMessage.match(pattern);
            if (match && match[1]) {
              const name = match[1].trim();
              // Remove trailing words that are likely not part of the sheet name
              const cleanedName = name.replace(/\s+(create|make|show|and|with|for)$/i, '').trim();
              
              if (cleanedName && !stopWords.includes(cleanedName.toLowerCase())) {
                extractedName = cleanedName;
                console.log("Extracted sheet name from pattern:", extractedName);
                break;
              }
            }
          }
          
          // If no pattern matched, try to find any sheet name mentioned in the message
          if (!extractedName && availableSheets.length > 0) {
            for (const sheet of availableSheets) {
              // Check if the sheet name appears in the message (case insensitive)
              if (args.userMessage.toLowerCase().includes(sheet.toLowerCase())) {
                extractedName = sheet;
                console.log("Found sheet name in message:", extractedName);
                break;
              }
            }
          }
          
          // Now find the best matching sheet from available sheets
          if (extractedName) {
            const extractedLower = extractedName.toLowerCase();
            
            // First try exact match (case insensitive)
            let matchedSheet = availableSheets.find((s: string) => 
              s.toLowerCase() === extractedLower
            );
            
            // If no exact match, try partial match (sheet name contains extracted name or vice versa)
            if (!matchedSheet) {
              matchedSheet = availableSheets.find((s: string) => 
                s.toLowerCase().includes(extractedLower) || 
                extractedLower.includes(s.toLowerCase())
              );
            }
            
            // If still no match, try word-based matching (all words in extracted name appear in sheet name)
            if (!matchedSheet) {
              const extractedWords = extractedLower.split(/\s+/);
              matchedSheet = availableSheets.find((s: string) => {
                const sheetLower = s.toLowerCase();
                return extractedWords.every((word: string) => sheetLower.includes(word));
              });
            }
            
            if (matchedSheet) {
              sheetName = matchedSheet;
              console.log(`Matched sheet: "${extractedName}" -> "${sheetName}"`);
            } else {
              console.log(`No match found for extracted name: "${extractedName}"`);
            }
          }
          
          // If still no sheet name found, use active sheet name or first sheet
          if (!sheetName) {
            if (args.activeSheetName && availableSheets.includes(args.activeSheetName)) {
              sheetName = args.activeSheetName;
              console.log("Using active sheet:", sheetName);
            } else if (availableSheets.length > 0) {
              sheetName = availableSheets[0];
              console.log("Using first available sheet:", sheetName);
            }
          }

          // Extract column names from the message
          // Look for patterns like "of X and Y", "X vs Y", "X and Y columns"
          let columns: string[] = [];
          
          const columnPatterns = [
            /(?:of|for|with)\s+([a-zA-Z][a-zA-Z0-9\s_-]+?)\s+and\s+([a-zA-Z][a-zA-Z0-9\s_-]+?)(?:\s+(?:in|from|on|column|chart|graph)|\s*$)/i,
            /(?:columns?|fields?)\s+([a-zA-Z][a-zA-Z0-9\s_-]+?)\s+and\s+([a-zA-Z][a-zA-Z0-9\s_-]+?)(?:\s|$)/i,
          ];

          for (const pattern of columnPatterns) {
            const match = args.userMessage.match(pattern);
            if (match && match[1] && match[2]) {
              columns = [match[1].trim(), match[2].trim()];
              break;
            }
          }

          if (columns.length === 0) {
            const sheetList = availableSheets.length > 0 
              ? `\n\nAvailable sheets: ${availableSheets.map((s: string) => `"${s}"`).join(", ")}`
              : "";
            
            await ctx.runMutation(internal.ai.updateStreamingMessage, {
              messageId,
              content: `Please specify which columns you want to visualize. For example: 'create a bar chart of column1 and column2 in sheet name ${availableSheets[0] || "Sheet1"}'${sheetList}`,
              isComplete: true,
            });
            return null;
          }

          if (!sheetName) {
            const sheetList = availableSheets.length > 0 
              ? `\n\nAvailable sheets: ${availableSheets.map((s: string) => `"${s}"`).join(", ")}`
              : "";
            
            await ctx.runMutation(internal.ai.updateStreamingMessage, {
              messageId,
              content: `Please specify which sheet contains the data. For example: 'create a bar chart of column1 and column2 in sheet name ${availableSheets[0] || "Sheet1"}'${sheetList}`,
              isComplete: true,
            });
            return null;
          }
          
          // Find the specified sheet (sheetName is now guaranteed to be a valid sheet name from our matching logic)
          const targetSheet = data.find((s: any) => s.name === sheetName);
          if (!targetSheet) {
            const sheetList = availableSheets.length > 0 
              ? `\n\nAvailable sheets: ${availableSheets.map((s: string) => `"${s}"`).join(", ")}`
              : "";
            
            throw new Error(`Sheet "${sheetName}" not found. Please use one of the available sheet names.${sheetList}`);
          }

          // Helper function to check if a cell text is a calculated row label
          const isCalculatedLabel = (text: string): boolean => {
            const lower = text.toLowerCase();
            return lower.startsWith('sum') || 
                   lower.startsWith('average') || 
                   lower.startsWith('avg') ||
                   lower.startsWith('total') ||
                   lower.startsWith('count') ||
                   lower.startsWith('min') ||
                   lower.startsWith('max') ||
                   lower.includes('sum of') ||
                   lower.includes('average of') ||
                   lower.includes('total of');
          };

          // Find the columns in the sheet - only search first 10 rows to avoid calculated rows
          const columnIndices: number[] = [];
          const foundColumns: string[] = [];
          let headerRowFound = -1;
          
          for (const rowKey in targetSheet.rows) {
            if (rowKey === "len") continue;
            
            const rowNum = parseInt(rowKey);
            // Only search first 10 rows for headers
            if (rowNum > 10) break;
            
            const row = targetSheet.rows[rowKey];
            if (!row.cells) continue;
            
            // Check if this row might be a header row by looking for column matches
            const tempColumnIndices: number[] = [];
            const tempFoundColumns: string[] = [];
            let hasCalculatedLabel = false;
            
            for (const colKey in row.cells) {
              const cell = row.cells[colKey];
              if (cell.text) {
                const cellLower = cell.text.toLowerCase();
                
                // Skip this row entirely if it contains calculated labels
                if (isCalculatedLabel(cell.text)) {
                  hasCalculatedLabel = true;
                  break;
                }
                
                // Check if this cell matches any of our column names
                for (const col of columns) {
                  const colLower = col.toLowerCase();
                  if (cellLower === colLower || cellLower.includes(colLower) || colLower.includes(cellLower)) {
                    const colIndex = parseInt(colKey);
                    if (!tempColumnIndices.includes(colIndex)) {
                      tempColumnIndices.push(colIndex);
                      tempFoundColumns.push(cell.text);
                    }
                  }
                }
              }
            }
            
            // If we found both columns in this row and it's not a calculated row, use it
            if (!hasCalculatedLabel && tempColumnIndices.length >= 2) {
              columnIndices.push(...tempColumnIndices);
              foundColumns.push(...tempFoundColumns);
              headerRowFound = rowNum;
              break;
            }
          }

          if (columnIndices.length < 2) {
            throw new Error(`Could not find columns: ${columns.join(", ")} in sheet "${sheetName}"`);
          }

          // Now count data rows starting from the row after the header
          let dataRowCount = 0;
          
          for (const rowKey in targetSheet.rows) {
            if (rowKey === "len") continue;
            
            const rowNum = parseInt(rowKey);
            const row = targetSheet.rows[rowKey];
            
            if (!row.cells) continue;
            
            // Count data rows after header
            if (rowNum > headerRowFound) {
              // Check if this row has data in our columns
              let hasData = false;
              let isCalculatedRow = false;
              
              // Check if this is a calculated row
              for (const colIndex of columnIndices) {
                if (row.cells[colIndex.toString()]?.text) {
                  const cellText = row.cells[colIndex.toString()].text;
                  
                  // Check if this is a calculated row
                  if (isCalculatedLabel(cellText)) {
                    isCalculatedRow = true;
                    break;
                  }
                  hasData = true;
                }
              }
              
              // Only count if has data and is not a calculated row
              if (hasData && !isCalculatedRow) {
                dataRowCount++;
              } else if (isCalculatedRow) {
                // Stop counting when we hit calculated rows
                break;
              }
            }
          }

          // Create the range (A1 notation)
          const startCol = Math.min(...columnIndices);
          const endCol = Math.max(...columnIndices);
          const startRow = headerRowFound;
          const endRow = headerRowFound + dataRowCount;
          
          const colToLetter = (col: number) => {
            let letter = "";
            while (col >= 0) {
              letter = String.fromCharCode((col % 26) + 65) + letter;
              col = Math.floor(col / 26) - 1;
            }
            return letter;
          };
          
          const range = `${colToLetter(startCol)}${startRow + 1}:${colToLetter(endCol)}${endRow + 1}`;

          // Create chart data
          const chartData = {
            type: chartType,
            range: range,
            sheetName: sheetName,
            title: `${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart: ${foundColumns.join(" vs ")}`,
          };

          // Save chart to charts table for persistence
          await ctx.runMutation(internal.spreadsheets.internalCreateChart, {
            spreadsheetId: conversation.conversation.spreadsheetId,
            ownerId: conversation.conversation.ownerId,
            title: chartData.title,
            type: chartType,
            range: range,
            sheetName: sheetName,
          });

          // Update message with chart
          await ctx.runMutation(internal.ai.updateStreamingMessage, {
            messageId,
            content: `I've created a ${chartType} chart showing **${foundColumns.join("** and **")}** from sheet "${sheetName}". The chart displays data from range ${range} with ${dataRowCount} data points.`,
            isComplete: true,
            chartData,
          });

          return null;
        } catch (error) {
          console.error("Error creating chart:", error);
          
          // Try to get available sheets for better error message
          let availableSheetsMsg = "";
          try {
            const spreadsheetData = await ctx.runQuery(internal.ai.getSpreadsheetData, {
              spreadsheetId: conversation.conversation.spreadsheetId,
            });
            if (spreadsheetData?.data) {
              const data = JSON.parse(spreadsheetData.data);
              const availableSheets = data.map((s: any) => s.name || "").filter((n: string) => n);
              if (availableSheets.length > 0) {
                availableSheetsMsg = `\n\nAvailable sheets: ${availableSheets.map((s: string) => `"${s}"`).join(", ")}`;
              }
            }
          } catch (e) {
            console.error("Error getting available sheets for error message:", e);
          }
          
          await ctx.runMutation(internal.ai.updateStreamingMessage, {
            messageId,
            content: `Failed to create chart: ${error instanceof Error ? error.message : String(error)}. Please make sure the columns and sheet name are correct.${availableSheetsMsg}`,
            isComplete: true,
          });
          
          return null;
        }
      }

      // Check for KPI dashboard creation requests
      if (
        (args.userMessage.toLowerCase().includes("dashboard") ||
         args.userMessage.toLowerCase().includes("kpi") ||
         args.userMessage.toLowerCase().includes("key performance indicator")) &&
        (args.userMessage.toLowerCase().includes("create") ||
         args.userMessage.toLowerCase().includes("make") ||
         args.userMessage.toLowerCase().includes("build") ||
         args.userMessage.toLowerCase().includes("generate") ||
         args.userMessage.toLowerCase().includes("show"))
      ) {
        console.log("📊 KPI Dashboard creation request detected");
        
        const messageId = await ctx.runMutation(internal.ai.createStreamingMessage, {
          conversationId: args.conversationId,
          agentId: args.agentId,
          modelName: agent?.modelName,
          provider: agent?.provider,
        });

        try {
          // Get spreadsheet data to analyze
          const spreadsheetData = await ctx.runQuery(internal.ai.getSpreadsheetData, {
            spreadsheetId: conversation.conversation.spreadsheetId,
          });

          if (!spreadsheetData?.data) {
            throw new Error("No spreadsheet data found");
          }

          const data = JSON.parse(spreadsheetData.data);
          
          if (!Array.isArray(data) || data.length === 0) {
            throw new Error("No sheets found in spreadsheet");
          }

          // Analyze the data to determine relevant KPIs
          const analysisResult = await ctx.runMutation(internal.ai.analyzeSheetsForDashboard, {
            spreadsheetId: conversation.conversation.spreadsheetId,
            ownerId: conversation.conversation.ownerId,
            userMessage: args.userMessage,
          });

          if (!analysisResult.success) {
            throw new Error(analysisResult.message || "Failed to analyze data");
          }

          // Update message with success
          await ctx.runMutation(internal.ai.updateStreamingMessage, {
            messageId,
            content: analysisResult.message,
            isComplete: true,
          });

          return null;
        } catch (error) {
          console.error("Error creating KPI dashboard:", error);
          
          await ctx.runMutation(internal.ai.updateStreamingMessage, {
            messageId,
            content: `Failed to create KPI dashboard: ${error instanceof Error ? error.message : String(error)}. Please make sure your spreadsheet has data in the sheets.`,
            isComplete: true,
          });
          
          return null;
        }
      }

      // Check for document table creation requests
      if (
        documents.length > 0 &&
        (args.userMessage.toLowerCase().includes("create table from") ||
         args.userMessage.toLowerCase().includes("table from document") ||
         args.userMessage.toLowerCase().includes("table from file") ||
         args.userMessage.toLowerCase().includes("table from the document") ||
         args.userMessage.toLowerCase().includes("table from the file") ||
         args.userMessage.toLowerCase().includes("table in the document") ||
         args.userMessage.toLowerCase().includes("table in document") ||
         args.userMessage.toLowerCase().includes("copy table") ||
         args.userMessage.toLowerCase().includes("extract table") ||
         args.userMessage.toLowerCase().includes("import table") ||
         args.userMessage.toLowerCase().includes("add table from") ||
         (args.userMessage.toLowerCase().includes("create") && 
          args.userMessage.toLowerCase().includes("table") && 
          (args.userMessage.toLowerCase().includes("document") || args.userMessage.toLowerCase().includes("pdf") || args.userMessage.toLowerCase().includes("docx"))))
      ) {
        console.log("🔍 Document table creation request detected");
        console.log(`Found ${documents.length} uploaded document(s)`);
        
        const messageId = await ctx.runMutation(internal.ai.createStreamingMessage, {
          conversationId: args.conversationId,
          agentId: args.agentId,
          modelName: agent?.modelName,
          provider: agent?.provider,
        });

        try {
          // Collect all tables from all documents
          const allTables: Array<{
            table: any;
            document: any;
          }> = [];
          
          for (const doc of documents) {
            console.log(`📄 Checking document: ${doc.fileName}`);
            console.log(`  - Has extractedTables: ${!!doc.extractedTables}`);
            console.log(`  - extractedTables length: ${doc.extractedTables?.length || 0}`);
            
            if (doc.extractedTables) {
              try {
                const tables = JSON.parse(doc.extractedTables);
                console.log(`  - Parsed ${Array.isArray(tables) ? tables.length : 0} table(s)`);
                
                if (Array.isArray(tables)) {
                  for (const table of tables) {
                    if (table.rows && Array.isArray(table.rows) && table.rows.length > 0) {
                      console.log(`    ✓ Valid table found: ${table.rows.length} rows, ${table.rows[0]?.length || 0} columns`);
                      allTables.push({ table, document: doc });
                    } else {
                      console.log(`    ✗ Invalid table structure:`, table);
                    }
                  }
                }
              } catch (e) {
                console.error(`  ✗ Error parsing tables from ${doc.fileName}:`, e);
              }
            } else {
              console.log(`  ℹ️ No extractedTables field in document`);
            }
          }

          console.log(`📊 Total valid tables found: ${allTables.length}`);

          if (allTables.length === 0) {
            // Provide more detailed feedback
            let errorMessage = "I couldn't find any tables in the uploaded documents.\n\n";
            errorMessage += "**Possible reasons:**\n";
            errorMessage += "- The document doesn't contain structured table data\n";
            errorMessage += "- The tables might be images (not text-based)\n";
            errorMessage += "- The document format is not supported\n\n";
            errorMessage += "**What you can try:**\n";
            errorMessage += "- Make sure your PDF/DOCX has text-based tables (not scanned images)\n";
            errorMessage += "- Check that the table has clear headers and data rows\n";
            errorMessage += "- Try a different document format if possible\n\n";
            
            // List the documents that were checked
            if (documents.length > 0) {
              errorMessage += "**Documents checked:**\n";
              documents.forEach(doc => {
                errorMessage += `- ${doc.fileName} (${doc.fileType})\n`;
              });
            }
            
            await ctx.runMutation(internal.ai.updateStreamingMessage, {
              messageId,
              content: errorMessage,
              isComplete: true,
            });
            return null;
          }

          // Determine base sheet name with improved logic
          let baseSheetName: string | undefined = undefined;
          let explicitSheetSpecified = false;
          
          // Check for explicit sheet name in various formats
          const sheetPatterns = [
            /(?:in|to|on)\s+(?:a\s+)?(?:new\s+)?sheet\s+(?:named\s+|called\s+)?["']?([A-Za-z][A-Za-z0-9_\-\s]+)["']?(?:\s|$|,|\.)/i,
            /(?:in|to)\s+["']?([A-Za-z][A-Za-z0-9_\-\s]+)["']?\s+sheet/i,
          ];
          
          for (const pattern of sheetPatterns) {
            const match = args.userMessage.match(pattern);
            if (match && match[1]) {
              const name = match[1].trim();
              if (!['and', 'or', 'the', 'a', 'an', 'in', 'on', 'to', 'with', 'new'].includes(name.toLowerCase())) {
                baseSheetName = name;
                explicitSheetSpecified = true;
                break;
              }
            }
          }
          
          // Check if user wants a new sheet (even without specifying name)
          const wantsNewSheet = args.userMessage.toLowerCase().includes('new sheet') || 
                                args.userMessage.toLowerCase().includes('create sheet') ||
                                args.userMessage.toLowerCase().includes('another sheet');
          
          // If no sheet name specified but user wants a new sheet, use document name as base
          if (!baseSheetName && wantsNewSheet && allTables.length > 0) {
            const firstDoc = allTables[0].document;
            baseSheetName = firstDoc.fileName.replace(/\.[^/.]+$/, "").substring(0, 20); // Remove extension, limit length
          }
          
          // If still no sheet name and multiple tables, use a descriptive name
          if (!baseSheetName) {
            if (allTables.length === 1) {
              // Single table - use document name
              const doc = allTables[0].document;
              baseSheetName = doc.fileName.replace(/\.[^/.]+$/, "").substring(0, 20);
            } else {
              // Multiple tables - use generic name (will be numbered)
              baseSheetName = "Table";
            }
          }
          
          // Final fallback to ensure baseSheetName is never undefined
          if (!baseSheetName) {
            baseSheetName = "DocumentTable";
          }
          
          console.log(`📋 Base sheet name: "${baseSheetName}" (explicit: ${explicitSheetSpecified}, wantsNew: ${wantsNewSheet})`);

          // Create all tables
          const results: string[] = [];
          
          for (let i = 0; i < allTables.length; i++) {
            const { table, document } = allTables[i];
            
            // Get headers from first row (filter empty cells) and convert to strings
            const headers = (table.rows[0] || [])
              .map((h: any) => String(h || ""))
              .filter((h: string) => h.trim());
            
            const dataRows = table.rows.slice(1).map((row: any[]) => {
              // Convert all values to strings and ensure row length matches headers
              const stringRow = row.map((cell: any) => String(cell || ""));
              const filteredRow = stringRow.slice(0, headers.length);
              while (filteredRow.length < headers.length) {
                filteredRow.push("");
              }
              return filteredRow;
            });

            if (headers.length === 0) {
              console.log(`⚠️ Skipping table ${i + 1} - no valid headers`);
              continue; // Skip tables without headers
            }

            // Determine sheet name for this table
            let sheetName: string;
            if (allTables.length === 1) {
              // Single table - use the base name directly
              sheetName = baseSheetName;
            } else {
              // Multiple tables - add number suffix
              sheetName = `${baseSheetName}_${i + 1}`;
            }
            
            console.log(`📄 Creating table ${i + 1}/${allTables.length} in sheet "${sheetName}"`);
            console.log(`   Headers: ${headers.join(", ")}`);
            console.log(`   Data rows: ${dataRows.length}`);

            // Create table with actual data from document
            const result = await ctx.runMutation(internal.spreadsheets.internalCreateTableFromDocument, {
              spreadsheetId: conversation.conversation.spreadsheetId,
              ownerId: conversation.conversation.ownerId,
              headers,
              dataRows,
              sheetName,
            });

            results.push(`📊 **${sheetName}**: ${headers.length} columns, ${dataRows.length} rows\n   Columns: ${headers.join(", ")}`);
          }

          if (results.length === 0) {
            await ctx.runMutation(internal.ai.updateStreamingMessage, {
              messageId,
              content: "I found tables in the documents but couldn't extract valid data from them. Please check that the tables have clear headers and data rows.",
              isComplete: true,
            });
            return null;
          }

          // Build response message based on what was created
          let responseMessage = "";
          
          if (allTables.length === 1) {
            const table = allTables[0].table;
            const doc = allTables[0].document;
            const headers = (table.rows[0] || []).map((h: any) => String(h || "")).filter((h: string) => h.trim());
            const dataRowCount = table.rows.length - 1;
            
            responseMessage = `✅ **Successfully created table from "${doc.fileName}"**\n\n`;
            responseMessage += `📋 **Sheet**: ${baseSheetName}\n`;
            responseMessage += `📊 **Size**: ${headers.length} columns × ${dataRowCount} data rows\n`;
            responseMessage += `📝 **Columns**: ${headers.join(", ")}\n\n`;
            responseMessage += `The table has been added to your spreadsheet and is ready to use!`;
          } else {
            responseMessage = `✅ **Successfully created ${allTables.length} tables from your documents**\n\n`;
            results.forEach((result, idx) => {
              responseMessage += `${idx + 1}. ${result}\n\n`;
            });
            responseMessage += `All tables have been added to your spreadsheet and are ready to use!`;
          }

          await ctx.runMutation(internal.ai.updateStreamingMessage, {
            messageId,
            content: responseMessage,
            isComplete: true,
          });

          return null;
        } catch (error) {
          console.error("Error creating table from document:", error);
          
          await ctx.runMutation(internal.ai.updateStreamingMessage, {
            messageId,
            content: `Failed to create table from document: ${error instanceof Error ? error.message : String(error)}`,
            isComplete: true,
          });
          
          return null;
        }
      }

      // Check for calculation requests (sum, avg, etc.)
      if (
        args.userMessage.toLowerCase().includes("sum") ||
        args.userMessage.toLowerCase().includes("average") ||
        args.userMessage.toLowerCase().includes("avg") ||
        args.userMessage.toLowerCase().includes("count") ||
        args.userMessage.toLowerCase().includes("min") ||
        args.userMessage.toLowerCase().includes("max") ||
        args.userMessage.toLowerCase().includes("calculate")
      ) {
        // Create streaming message placeholder
        const messageId = await ctx.runMutation(internal.ai.createStreamingMessage, {
          conversationId: args.conversationId,
          agentId: args.agentId,
          modelName: agent?.modelName,
          provider: agent?.provider,
        });

        // Parse calculation request
        const operationMatch = args.userMessage.match(/\b(sum|average|avg|count|min|max|calculate)\b/i);
        const operation = operationMatch ? operationMatch[1].toLowerCase() : "sum";
        
        // Extract column name from the message (supports multi-word column names)
        let columnName = "salary"; // default
        
        // Try multiple patterns to extract column name
        const patterns = [
          /(?:column|of|for)\s+["']([^"']+)["']/i,  // Quoted: "column 'price in Sheet1'"
          /(?:column|of|for)\s+([a-zA-Z][a-zA-Z0-9\s_-]+?)(?:\s+(?:in|on|to|at|from)\s|\s+column|\s*$|[.!?])/i,  // Multi-word but stop at location keywords
          /(?:column|of|for)\s+(\w+)/i,  // Single word: "sum of price"
        ];
        
        for (const pattern of patterns) {
          const match = args.userMessage.match(pattern);
          if (match && match[1]) {
            columnName = match[1].trim();
            break;
          }
        }

        const calcResult = await ctx.runMutation(internal.spreadsheets.internalCalculateColumnStats, {
          spreadsheetId: conversation.conversation.spreadsheetId,
          ownerId: conversation.conversation.ownerId,
          columnName,
          operation: (operation === "calculate" ? "sum" : operation) as "sum" | "average" | "avg" | "count" | "min" | "max",
        });

        // Update with calculation result
        await ctx.runMutation(internal.ai.updateStreamingMessage, {
          messageId,
          content: `I calculated the ${calcResult.operation} of column '${calcResult.columnName}' in sheet "${calcResult.sheetName}": **${calcResult.result}** (from ${calcResult.rowCount} values). The result has been added to your spreadsheet.`,
          isComplete: true,
        });

        return null;
      }

      // Create streaming message placeholder
      const messageId = await ctx.runMutation(internal.ai.createStreamingMessage, {
        conversationId: args.conversationId,
        agentId: args.agentId,
        modelName: agent?.modelName,
        provider: agent?.provider,
      });

      // Generate streaming response based on agent provider
      if (agent?.provider === "openai") {
        await generateStreamingOpenAIResponse(
          ctx,
          messageId,
          context,
          args.userMessage,
          agent
        );
      } else {
        // For non-OpenAI providers, use the agent system
        await generateStreamingAgentResponse(
          ctx,
          messageId,
          context,
          args.userMessage,
          agent,
          args.conversationId
        );
      }

      console.log("Streaming AI response completed successfully");
    } catch (error) {
      console.error("Error generating streaming AI response:", error);
      
      // Save error message
      try {
        await ctx.runMutation(internal.ai.saveAIResponse, {
          conversationId: args.conversationId,
          content: `I apologize, but I encountered an error while processing your request: ${error instanceof Error ? error.message : String(error)}. Please try again.`,
          chartData: undefined,
        });
      } catch (saveError) {
        console.error("Error saving error message:", saveError);
      }
    }

    return null;
  },
});

/**
 * Create an agent instance for a specific provider and model
 */
function createAgentInstance(provider: string, modelName: string, systemPrompt: string): Agent {
  let languageModel;
  
  switch (provider) {
    case "openai":
      languageModel = openai.chat(modelName);
      break;
    case "anthropic":
      languageModel = anthropic.chat(modelName);
      break;
    case "google":
      languageModel = google.chat(modelName);
      break;
    case "mistral":
      languageModel = mistral.chat(modelName);
      break;
    default:
      throw new Error(`Unsupported provider: ${provider}`);
  }

  return new Agent(components.agent, {
    name: `${provider}-${modelName}`,
    languageModel,
    instructions: systemPrompt,
  });
}

/**
 * Helper function to generate streaming response for non-OpenAI agents
 */
async function generateStreamingAgentResponse(
  ctx: any,
  messageId: any,
  context: string,
  userMessage: string,
  agent: any,
  conversationId: any
): Promise<void> {
  try {
    console.log(`Starting streaming agent response with provider: ${agent.provider}`);
    
    // Use direct API calls for streaming with non-OpenAI providers
    if (agent.provider === "anthropic") {
      await generateStreamingAnthropicResponse(ctx, messageId, context, userMessage, agent);
    } else if (agent.provider === "google") {
      await generateStreamingGoogleResponse(ctx, messageId, context, userMessage, agent);
    } else if (agent.provider === "mistral") {
      await generateStreamingMistralResponse(ctx, messageId, context, userMessage, agent);
    } else {
      // Fallback to non-streaming agent system
      await generateNonStreamingAgentResponse(ctx, messageId, context, userMessage, agent, conversationId);
    }

    console.log("Streaming agent response completed successfully");
  } catch (error) {
    console.error("Error in streaming agent response:", error);
    
    // Mark as complete with error message
    await ctx.runMutation(internal.ai.updateStreamingMessage, {
      messageId,
      content: "I encountered an error while generating the response. Please try again.",
      isComplete: true,
    });
    
    throw error;
  }
}

/**
 * Generate streaming Anthropic (Claude) response
 */
async function generateStreamingAnthropicResponse(
  ctx: any,
  messageId: any,
  context: string,
  userMessage: string,
  agent: any
): Promise<void> {
  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  
  if (!ANTHROPIC_API_KEY) {
    throw new Error("Anthropic API key not configured");
  }

  let accumulatedContent = "";
  let chartData: any = undefined;

  try {
    console.log(`Starting streaming Anthropic API call with model: ${agent.modelName}`);
    
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: agent.modelName,
        max_tokens: 2000,
        messages: [
          {
            role: "user",
            content: `${context}\n\nIMPORTANT: Format your response with proper markdown. Use **bold** for important information, *italics* for emphasis, and structure your response clearly. Always be helpful and provide detailed analysis.\n\nUser message: ${userMessage}`,
          },
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Anthropic API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Stream ended - mark as complete if not already done
        if (accumulatedContent) {
          // Check for chart data in final content
          if (accumulatedContent.toLowerCase().includes("chart") || accumulatedContent.toLowerCase().includes("graph")) {
            const chartMatch = accumulatedContent.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
            if (chartMatch) {
              const chartType = chartMatch[1].toLowerCase();
              const range = chartMatch[2];
              
              if (["line", "bar", "area", "pie"].includes(chartType)) {
                chartData = {
                  type: chartType as "line" | "bar" | "area" | "pie",
                  range: range,
                  title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
                };
              }
            }
          }
        }
        
        // Final update with complete content and mark as complete
        await ctx.runMutation(internal.ai.updateStreamingMessage, {
          messageId,
          content: accumulatedContent,
          isComplete: true,
          chartData,
        });
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            // Check for chart data in final content
            if (accumulatedContent.toLowerCase().includes("chart") || accumulatedContent.toLowerCase().includes("graph")) {
              const chartMatch = accumulatedContent.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
              if (chartMatch) {
                const chartType = chartMatch[1].toLowerCase();
                const range = chartMatch[2];
                
                if (["line", "bar", "area", "pie"].includes(chartType)) {
                  chartData = {
                    type: chartType as "line" | "bar" | "area" | "pie",
                    range: range,
                    title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
                  };
                }
              }
            }

            // Final update with complete content and mark as complete
            await ctx.runMutation(internal.ai.updateStreamingMessage, {
              messageId,
              content: accumulatedContent,
              isComplete: true,
              chartData,
            });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.delta?.text;
            
            if (content) {
              accumulatedContent += content;
              
              // Update streaming message with accumulated content
              await ctx.runMutation(internal.ai.updateStreamingMessage, {
                messageId,
                content: accumulatedContent,
                isComplete: false,
              });
            }
          } catch (parseError) {
            console.warn("Failed to parse streaming data:", parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in streaming Anthropic response:", error);
    
    // Mark as complete with error message
    await ctx.runMutation(internal.ai.updateStreamingMessage, {
      messageId,
      content: accumulatedContent || "I encountered an error while generating the response. Please try again.",
      isComplete: true,
    });
    
    throw error;
  }
}

/**
 * Generate streaming Google response
 */
async function generateStreamingGoogleResponse(
  ctx: any,
  messageId: any,
  context: string,
  userMessage: string,
  agent: any
): Promise<void> {
  const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
  
  if (!GOOGLE_API_KEY) {
    throw new Error("Google API key not configured");
  }

  let accumulatedContent = "";
  let chartData: any = undefined;

  try {
    console.log(`Starting Google API call with model: ${agent.modelName}`);
    
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${agent.modelName}:generateContent?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `${context}\n\nIMPORTANT: Format your response with proper markdown. Use **bold** for important information, *italics* for emphasis, and structure your response clearly. Always be helpful and provide detailed analysis.\n\nUser message: ${userMessage}`,
              },
            ],
          },
        ],
        generationConfig: {
          maxOutputTokens: 2000,
          temperature: 0.7,
        },
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Google API error: ${response.status} ${response.statusText}`);
      throw new Error(`Google API error: ${response.status} ${response.statusText}`);
    }

    const responseData = await response.json();
    console.log("Google API response received");

    if (responseData.candidates?.[0]?.content?.parts?.[0]?.text) {
      const fullContent = responseData.candidates[0].content.parts[0].text;
      
      // Check for chart data in final content
      if (fullContent.toLowerCase().includes("chart") || fullContent.toLowerCase().includes("graph")) {
        const chartMatch = fullContent.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
        if (chartMatch) {
          const chartType = chartMatch[1].toLowerCase();
          const range = chartMatch[2];
          
          if (["line", "bar", "area", "pie"].includes(chartType)) {
            chartData = {
              type: chartType as "line" | "bar" | "area" | "pie",
              range: range,
              title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
            };
          }
        }
      }
      
      // Simulate streaming by sending chunks
      const words = fullContent.split(' ');
      let currentContent = '';
      
      for (let i = 0; i < words.length; i++) {
        currentContent += (i > 0 ? ' ' : '') + words[i];
        
        // Update database with current content
        await ctx.runMutation(internal.ai.updateStreamingMessage, {
          messageId,
          content: currentContent,
          chartData,
        });

        // Small delay to simulate streaming
        await new Promise(resolve => setTimeout(resolve, 50));
        
        // console.log(`Google simulated streaming: ${i + 1}/${words.length} words`);
      }

      // Mark as complete
      await ctx.runMutation(internal.ai.updateStreamingMessage, {
        messageId,
        content: currentContent,
        isComplete: true,
        chartData,
      });

      console.log("Google simulated streaming completed successfully");
    } else {
      throw new Error("No content in Google API response");
    }
  } catch (error) {
    console.error("Error in streaming Google response:", error);
    
    // Mark as complete with error message
    await ctx.runMutation(internal.ai.updateStreamingMessage, {
      messageId,
      content: accumulatedContent || "I encountered an error while generating the response. Please try again.",
      isComplete: true,
    });
    
    throw error;
  }
}

/**
 * Generate streaming Mistral response
 */
async function generateStreamingMistralResponse(
  ctx: any,
  messageId: any,
  context: string,
  userMessage: string,
  agent: any
): Promise<void> {
  const MISTRAL_API_KEY = process.env.MISTRAL_API_KEY;
  
  if (!MISTRAL_API_KEY) {
    throw new Error("Mistral API key not configured");
  }

  let accumulatedContent = "";
  let chartData: any = undefined;

  try {
    console.log(`Starting streaming Mistral API call with model: ${agent.modelName}`);
    
    const response = await fetch("https://api.mistral.ai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${MISTRAL_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: agent.modelName,
        messages: [
          {
            role: "system",
            content: context + "\n\nIMPORTANT: Format your response with proper markdown. Use **bold** for important information, *italics* for emphasis, and structure your response clearly. Always be helpful and provide detailed analysis.",
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`Mistral API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        // Stream ended - mark as complete if not already done
        if (accumulatedContent) {
          // Check for chart data in final content
          if (accumulatedContent.toLowerCase().includes("chart") || accumulatedContent.toLowerCase().includes("graph")) {
            const chartMatch = accumulatedContent.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
            if (chartMatch) {
              const chartType = chartMatch[1].toLowerCase();
              const range = chartMatch[2];
              
              if (["line", "bar", "area", "pie"].includes(chartType)) {
                chartData = {
                  type: chartType as "line" | "bar" | "area" | "pie",
                  range: range,
                  title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
                };
              }
            }
          }
        }
        
        // Final update with complete content and mark as complete
        await ctx.runMutation(internal.ai.updateStreamingMessage, {
          messageId,
          content: accumulatedContent,
          isComplete: true,
          chartData,
        });
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            // Check for chart data in final content
            if (accumulatedContent.toLowerCase().includes("chart") || accumulatedContent.toLowerCase().includes("graph")) {
              const chartMatch = accumulatedContent.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
              if (chartMatch) {
                const chartType = chartMatch[1].toLowerCase();
                const range = chartMatch[2];
                
                if (["line", "bar", "area", "pie"].includes(chartType)) {
                  chartData = {
                    type: chartType as "line" | "bar" | "area" | "pie",
                    range: range,
                    title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
                  };
                }
              }
            }

            // Final update with complete content and mark as complete
            await ctx.runMutation(internal.ai.updateStreamingMessage, {
              messageId,
              content: accumulatedContent,
              isComplete: true,
              chartData,
            });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              accumulatedContent += content;
              
              // Update streaming message with accumulated content
              await ctx.runMutation(internal.ai.updateStreamingMessage, {
                messageId,
                content: accumulatedContent,
                isComplete: false,
              });
            }
          } catch (parseError) {
            console.warn("Failed to parse streaming data:", parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in streaming Mistral response:", error);
    
    // Mark as complete with error message
    await ctx.runMutation(internal.ai.updateStreamingMessage, {
      messageId,
      content: accumulatedContent || "I encountered an error while generating the response. Please try again.",
      isComplete: true,
    });
    
    throw error;
  }
}

/**
 * Fallback non-streaming agent response
 */
async function generateNonStreamingAgentResponse(
  ctx: any,
  messageId: any,
  context: string,
  userMessage: string,
  agent: any,
  conversationId: any
): Promise<void> {
  // Create agent instance
  const agentInstance = createAgentInstance(
    agent.provider,
    agent.modelName,
    agent.systemPrompt + "\n\n" + context
  );

  // Create or get thread for this conversation
  let threadData = await ctx.runQuery(internal.aiAgents.getThreadForConversation, {
    conversationId: conversationId,
    agentId: agent._id,
  });

  let thread;
  if (!threadData) {
    // Create new thread
    const { threadId, thread: newThread } = await agentInstance.createThread(ctx);
    thread = newThread;
    
    // Save thread to database
    await ctx.runMutation(internal.aiAgents.saveThread, {
      conversationId: conversationId,
      agentId: agent._id,
      threadId,
      ownerId: (await ctx.runQuery(internal.ai.getConversationData, { conversationId }))?.conversation.ownerId,
    });
  } else {
    // For existing threads, we'll create a new thread for now
    // TODO: Implement proper thread retrieval when Convex agents API supports it
    const { threadId, thread: newThread } = await agentInstance.createThread(ctx);
    thread = newThread;
  }

  // Generate response with user message
  const result = await thread.generateText({
    messages: [{ role: "user", content: userMessage }]
  });

  console.log("Agent response:", result);

  // Extract chart data if present
  let chartData;
  if (result.text.toLowerCase().includes("chart") || result.text.toLowerCase().includes("graph")) {
    const chartMatch = result.text.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
    if (chartMatch) {
      const chartType = chartMatch[1].toLowerCase();
      const range = chartMatch[2];
      
      if (["line", "bar", "area", "pie"].includes(chartType)) {
        chartData = {
          type: chartType as "line" | "bar" | "area" | "pie",
          range: range,
          title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
        };
      }
    }
  }

  // Update the streaming message with the complete response
  await ctx.runMutation(internal.ai.updateStreamingMessage, {
    messageId,
    content: result.text,
    isComplete: true,
    chartData,
  });
}

/**
 * Helper function to generate streaming OpenAI response
 */
async function generateStreamingOpenAIResponse(
  ctx: any,
  messageId: any,
  context: string,
  userMessage: string,
  agent?: any
): Promise<void> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  const model = agent?.modelName || "gpt-4o";
  let accumulatedContent = "";
  let chartData: any = undefined;
  let updateCounter = 0;

  try {
    console.log(`Starting streaming OpenAI API call with model: ${model}`);
    
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: model,
        messages: [
          {
            role: "system",
            content: context + "\n\nIMPORTANT: Format your response with proper markdown. Use **bold** for important information, *italics* for emphasis, and structure your response clearly. Always be helpful and provide detailed analysis.",
          },
          {
            role: "user",
            content: userMessage,
          },
        ],
        temperature: 0.7,
        max_tokens: 2000,
        stream: true,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
    }

    const reader = response.body?.getReader();
    if (!reader) {
      throw new Error("No response body reader available");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      
      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            // Check for chart data in final content
            if (accumulatedContent.toLowerCase().includes("chart") || accumulatedContent.toLowerCase().includes("graph")) {
              const chartMatch = accumulatedContent.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
              if (chartMatch) {
                const chartType = chartMatch[1].toLowerCase();
                const range = chartMatch[2];
                
                if (["line", "bar", "area", "pie"].includes(chartType)) {
                  chartData = {
                    type: chartType as "line" | "bar" | "area" | "pie",
                    range: range,
                    title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
                  };
                }
              }
            }

            // Final update with complete content and mark as complete
            await ctx.runMutation(internal.ai.updateStreamingMessage, {
              messageId,
              content: accumulatedContent,
              isComplete: true,
              chartData,
            });
            return;
          }

          try {
            const parsed = JSON.parse(data);
            const content = parsed.choices?.[0]?.delta?.content;
            
            if (content) {
              accumulatedContent += content;
              updateCounter++;
              
              // Update streaming message with accumulated content (throttled for performance)
              // Only update every 3rd chunk or when content is short to reduce database calls
              if (updateCounter % 3 === 0 || accumulatedContent.length < 100) {
                await ctx.runMutation(internal.ai.updateStreamingMessage, {
                  messageId,
                  content: accumulatedContent,
                  isComplete: false,
                });
              }
            }
          } catch (parseError) {
            console.warn("Failed to parse streaming data:", parseError);
          }
        }
      }
    }
  } catch (error) {
    console.error("Error in streaming OpenAI response:", error);
    
    // Mark as complete with error message
    await ctx.runMutation(internal.ai.updateStreamingMessage, {
      messageId,
      content: accumulatedContent || "I encountered an error while generating the response. Please try again.",
      isComplete: true,
    });
    
    throw error;
  }
}

/**
 * Helper function to generate OpenAI response with retry logic (non-streaming fallback)
 */
async function generateOpenAIResponse(context: string, userMessage: string): Promise<{
  content: string;
  chartData?: {
    type: "line" | "bar" | "area" | "pie";
    range: string;
    sheetName?: string;
    title?: string;
  };
}> {
  const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
  
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key not configured");
  }

  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      console.log(`OpenAI API attempt ${attempt}/3`);
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
      
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gpt-4o",
          messages: [
            {
              role: "system",
              content: context + "\n\nIMPORTANT: Format your response with proper markdown. Use **bold** for important information, *italics* for emphasis, and structure your response clearly. Always be helpful and provide detailed analysis.",
            },
            {
              role: "user",
              content: userMessage,
            },
          ],
          temperature: 0.7,
          max_tokens: 2000,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`OpenAI API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const content = data.choices[0]?.message?.content || "I couldn't generate a response.";

      // Check if the response contains chart generation request
      let chartData;
      if (content.toLowerCase().includes("chart") || content.toLowerCase().includes("graph")) {
        // Try to extract chart information from the response
        const chartMatch = content.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
        if (chartMatch) {
          const chartType = chartMatch[1].toLowerCase();
          const range = chartMatch[2];
          
          if (["line", "bar", "area", "pie"].includes(chartType)) {
            chartData = {
              type: chartType as "line" | "bar" | "area" | "pie",
              range: range,
              title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
            };
          }
        }
      }

      console.log(`OpenAI API success on attempt ${attempt}`);
      return {
        content,
        chartData,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`OpenAI API attempt ${attempt} failed:`, lastError.message);
      
      // If it's a connection error, wait before retrying
      if (attempt < 3 && (
        lastError.message.includes('connection') || 
        lastError.message.includes('timeout') ||
        lastError.message.includes('ECONNRESET') ||
        lastError.message.includes('aborted')
      )) {
        const delay = attempt * 1000; // 1s, 2s, 3s
        console.log(`Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  // If all attempts failed, throw the last error
  throw new Error(`Failed to generate AI response after 3 attempts: ${lastError?.message || 'Unknown error'}`);
}
