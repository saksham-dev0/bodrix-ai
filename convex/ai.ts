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

      // Build context for AI
      const context = buildAIContext(
        spreadsheetData,
        args.selectedRange,
        args.activeSheetName,
        conversation.messages
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
 * Helper function to build AI context with complete spreadsheet data
 */
function buildAIContext(
  spreadsheetData: { name: string; data: string } | null,
  selectedRange?: string,
  activeSheetName?: string,
  messages: Array<{ role: "user" | "assistant"; content: string }> = []
): string {
  let context = "You are an AI assistant with complete access to the user's spreadsheet data. You can see and analyze ALL data in ALL sheets. When asked about any sheet or data, provide specific analysis based on the actual content shown below. ";
  
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
  
  // Add recent conversation context
  if (messages.length > 0) {
    context += "\n=== RECENT CONVERSATION ===\n";
    const recentMessages = messages.slice(-6); // Last 6 messages
    recentMessages.forEach(msg => {
      context += `${msg.role}: ${msg.content}\n`;
    });
    context += "=== END CONVERSATION ===\n";
  }
  
  context += "\nINSTRUCTIONS: You have complete access to all the spreadsheet data shown above. When the user asks about any sheet, data, or analysis, provide specific insights based on the actual content. Be detailed and specific. If they ask 'what's in Sheet1', tell them exactly what data is in that sheet. If they ask for analysis, provide real analysis of the actual data shown.";
  
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

      // Build context for AI
      const context = buildAIContext(
        spreadsheetData,
        args.selectedRange,
        args.activeSheetName,
        conversation.messages
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

      // Create table intent (streaming fast-path)
      if (
        // Primary table creation patterns
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
        
        // Try different patterns for sheet names
        const patterns = [
          /(?:in|to|on)\s+(?:sheet\s+)?["']?([A-Za-z][A-Za-z0-9_\-\s]*)["']?(?:\s|$|,|\.)/i,
          /(?:create|make|add)\s+(?:a\s+)?(?:new\s+)?sheet\s+(?:named\s+|called\s+)?["']?([A-Za-z][A-Za-z0-9_\-\s]*)["']?(?:\s|$|,|\.)/i,
          /(?:sheet|tab)(?:\s+named|\s+called)?\s+["']?([A-Za-z][A-Za-z0-9_\-\s]*)["']?(?:\s|$|,|\.)/i,
        ];
        
        for (const pattern of patterns) {
          const match = args.userMessage.match(pattern);
          if (match && match[1]) {
            const name = match[1].trim();
            if (!['and', 'or', 'the', 'a', 'an', 'in', 'on', 'to', 'with', 'table'].includes(name.toLowerCase())) {
              sheetName = name;
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
