import { query, mutation, action, internalAction, internalQuery, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import { Agent } from "@convex-dev/agent";
import { openai } from "@ai-sdk/openai";
import { anthropic } from "@ai-sdk/anthropic";
import { google } from "@ai-sdk/google";
import { mistral } from "@ai-sdk/mistral";
import { components } from "./_generated/api";

/**
 * Get all available AI agents for a user
 */
export const getAgents = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("aiAgents"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      provider: v.union(
        v.literal("openai"),
        v.literal("anthropic"),
        v.literal("google"),
        v.literal("mistral")
      ),
      modelName: v.string(),
      systemPrompt: v.string(),
      isActive: v.boolean(),
      ownerId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
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

    return await ctx.db
      .query("aiAgents")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Create a new AI agent
 */
export const createAgent = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral")
    ),
    modelName: v.string(),
    systemPrompt: v.string(),
  },
  returns: v.id("aiAgents"),
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

    const now = Date.now();
    return await ctx.db.insert("aiAgents", {
      name: args.name,
      description: args.description,
      provider: args.provider,
      modelName: args.modelName,
      systemPrompt: args.systemPrompt,
      isActive: true,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update an AI agent
 */
export const updateAgent = mutation({
  args: {
    agentId: v.id("aiAgents"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
    provider: v.optional(v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral")
    )),
    modelName: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    isActive: v.optional(v.boolean()),
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

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      throw new Error("Agent not found");
    }

    if (agent.ownerId !== user._id) {
      throw new Error("Not authorized to update this agent");
    }

    const updateData: any = {
      updatedAt: Date.now(),
    };

    if (args.name !== undefined) updateData.name = args.name;
    if (args.description !== undefined) updateData.description = args.description;
    if (args.provider !== undefined) updateData.provider = args.provider;
    if (args.modelName !== undefined) updateData.modelName = args.modelName;
    if (args.systemPrompt !== undefined) updateData.systemPrompt = args.systemPrompt;
    if (args.isActive !== undefined) updateData.isActive = args.isActive;

    await ctx.db.patch(args.agentId, updateData);
    return null;
  },
});

/**
 * Delete an AI agent
 */
export const deleteAgent = mutation({
  args: {
    agentId: v.id("aiAgents"),
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

    const agent = await ctx.db.get(args.agentId);
    if (!agent) {
      return null;
    }

    if (agent.ownerId !== user._id) {
      throw new Error("Not authorized to delete this agent");
    }

    await ctx.db.delete(args.agentId);
    return null;
  },
});

/**
 * Get default agents for a user (creates them if they don't exist)
 */
export const getDefaultAgents = mutation({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("aiAgents"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      provider: v.union(
        v.literal("openai"),
        v.literal("anthropic"),
        v.literal("google"),
        v.literal("mistral")
      ),
      modelName: v.string(),
      systemPrompt: v.string(),
      isActive: v.boolean(),
      ownerId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
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

    // Check if user already has agents
    const existingAgents = await ctx.db
      .query("aiAgents")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .collect();

    if (existingAgents.length > 0) {
      return existingAgents as any;
    }

    // Create default agents
    const now = Date.now();
    const defaultAgents = [
      {
        name: "GPT-4o",
        description: "OpenAI's most capable model for complex analysis",
        provider: "openai" as const,
        modelName: "gpt-4o",
        systemPrompt: "You are an AI assistant specialized in spreadsheet analysis. You can help users understand their data, create charts, and provide insights. Always be helpful and accurate.",
      },
      {
        name: "Claude 3.5 Sonnet",
        description: "Anthropic's advanced model for detailed analysis",
        provider: "anthropic" as const,
        modelName: "claude-3-5-sonnet-20241022",
        systemPrompt: "You are an AI assistant specialized in spreadsheet analysis. You excel at understanding complex data patterns and providing detailed insights. Always be thorough and precise.",
      },
      {
        name: "Gemini Pro",
        description: "Google's powerful model for data analysis",
        provider: "google" as const,
        modelName: "gemini-2.5-flash",
        systemPrompt: "You are an AI assistant specialized in spreadsheet analysis. You can help users analyze data, create visualizations, and understand trends. Be clear and informative.",
      },
    ];

    const createdAgents = [];
    for (const agentData of defaultAgents) {
      const agentId = await ctx.db.insert("aiAgents", {
        ...agentData,
        isActive: true,
        ownerId: user._id,
        createdAt: now,
        updatedAt: now,
      });
      const agent = await ctx.db.get(agentId);
      if (agent) {
        createdAgents.push(agent);
      }
    }

    return createdAgents as any;
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
 * Generate AI response using the new agent system
 */
export const generateAgentResponse = internalAction({
  args: {
    conversationId: v.id("aiConversations"),
    agentId: v.id("aiAgents"),
    userMessage: v.string(),
    selectedRange: v.optional(v.string()),
    activeSheetName: v.optional(v.string()),
    liveSpreadsheetData: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      console.log("Starting agent response generation for conversation:", args.conversationId);
      
      // Get agent configuration
      const agent = await ctx.runQuery(internal.aiAgents.getAgentData, {
        agentId: args.agentId,
      });

      if (!agent) {
        throw new Error("Agent not found");
      }

      // Get conversation data
      const conversation = await ctx.runQuery(internal.ai.getConversationData, {
        conversationId: args.conversationId,
      });

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

      // Extract table creation state from previous messages
      const tableCreationState = extractTableCreationState(conversation.messages);

      // Build context for AI
      const context = buildAIContext(
        spreadsheetData,
        args.selectedRange,
        args.activeSheetName,
        conversation.messages,
        tableCreationState
      );

      console.log("Built context:", context);

      // Create agent instance
      const agentInstance = createAgentInstance(
        agent.provider,
        agent.modelName,
        agent.systemPrompt + "\n\n" + context
      );

      // Create or get thread for this conversation
      let threadData = await ctx.runQuery(internal.aiAgents.getThreadForConversation, {
        conversationId: args.conversationId,
        agentId: args.agentId,
      });

      let thread;
      if (!threadData) {
        // Create new thread
        const { threadId, thread: newThread } = await agentInstance.createThread(ctx);
        thread = newThread;
        
        // Save thread to database
        await ctx.runMutation(internal.aiAgents.saveThread, {
          conversationId: args.conversationId,
          agentId: args.agentId,
          threadId,
          ownerId: conversation.conversation.ownerId,
        });
      } else {
        // For existing threads, we'll create a new thread for now
        // TODO: Implement proper thread retrieval when Convex agents API supports it
        const { threadId, thread: newThread } = await agentInstance.createThread(ctx);
        thread = newThread;
      }

      // Check if user wants to add test data
      if (args.userMessage.toLowerCase().includes("add test") || 
          args.userMessage.toLowerCase().includes("insert test")) {
        // Call the test data insertion function
        await ctx.runMutation(internal.ai.aiInsertTestData, {
          conversationId: args.conversationId,
        });
        
        // Generate response
        const result = await thread.generateText({
          messages: [{ role: "user", content: args.userMessage }]
        });

        console.log("Agent response after test data insertion:", result);

        // Save AI response
        await ctx.runMutation(internal.ai.saveAIResponse, {
          conversationId: args.conversationId,
          content: "I've added 'test' to the next available row in your spreadsheet. " + result.text,
          chartData: extractChartData(result.text),
          agentId: args.agentId,
          modelName: agent.modelName,
          provider: agent.provider,
        });
      } else if (
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
         args.userMessage.toLowerCase().includes("table")) ||
        // Handle follow-up responses for table creation
        (args.userMessage.toLowerCase().includes("new sheet") && conversation.messages.some(m => m.content.includes("table"))) ||
        (args.userMessage.toLowerCase().includes("sheet") && conversation.messages.some(m => m.content.includes("create") && m.content.includes("table")))
      ) {
        console.log("🎯 TABLE CREATION DETECTED! User message:", args.userMessage);
        
        // Parse table creation request more intelligently
        let headers: string[] = [];
        let numRows = 5;
        let isFollowUp = false;
        
        // Check if this is a follow-up response about sheet selection
        const isSheetSelectionResponse = args.userMessage.toLowerCase().includes("new sheet") ||
          args.userMessage.toLowerCase().includes("sheet1") ||
          args.userMessage.toLowerCase().includes("sheet26") ||
          args.userMessage.toLowerCase().includes("existing sheet");

        // Get previous message to check for context
        const previousMessages = conversation.messages;
        let previousHeaders: string[] | undefined;
        
        if (isSheetSelectionResponse && previousMessages.length > 0) {
          // Look for previous message about table creation
          const prevAiMessage = previousMessages[previousMessages.length - 1];
          if (prevAiMessage.role === "assistant" && 
              prevAiMessage.content.includes("create a table with headers:")) {
            const headerMatch = prevAiMessage.content.match(/headers:\s*([^.]+)/);
            if (headerMatch) {
              previousHeaders = headerMatch[1].split(",").map(h => h.trim());
              headers = previousHeaders;
              isFollowUp = true;
            }
          }
        }

        // Only parse headers if this is not a follow-up response
        if (!isFollowUp) {
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
        
        // Handle follow-up messages for sheet creation
        if (!sheetName && (args.userMessage.toLowerCase().includes('new sheet') || args.userMessage.toLowerCase().includes('another sheet'))) {
          sheetName = 'NewSheet';
        }

        // Create the table immediately - no clarification needed
        const convData = await ctx.runQuery(internal.ai.getConversationData, {
          conversationId: args.conversationId,
        });
        if (!convData) throw new Error("Conversation not found");

        try {
          console.log("📝 Creating table with headers:", headers, "rows:", numRows, "sheet:", sheetName);
          
          const tableResult = await ctx.runMutation(internal.spreadsheets.internalCreateTableWithSpec, {
            spreadsheetId: convData.conversation.spreadsheetId,
            ownerId: convData.conversation.ownerId,
            headers,
            numRows,
            sheetName,
          });

          console.log("✅ Table created successfully:", tableResult);

          // Use the actual table creation result instead of generating generic text
          await ctx.runMutation(internal.ai.saveAIResponse, {
            conversationId: args.conversationId,
            content: tableResult.message,
            chartData: undefined,
            agentId: args.agentId,
            modelName: agent.modelName,
            provider: agent.provider,
          });
          
          console.log("💾 Success response saved to conversation");
        } catch (error) {
          console.error("❌ Table creation error:", error);
          
          // If table creation fails, report the error
          await ctx.runMutation(internal.ai.saveAIResponse, {
            conversationId: args.conversationId,
            content: `❌ Failed to create table: ${error instanceof Error ? error.message : String(error)}`,
            chartData: undefined,
            agentId: args.agentId,
            modelName: agent.modelName,
            provider: agent.provider,
          });
        }
      } else if (
        args.userMessage.toLowerCase().includes("sum") ||
        args.userMessage.toLowerCase().includes("average") ||
        args.userMessage.toLowerCase().includes("avg") ||
        args.userMessage.toLowerCase().includes("count") ||
        args.userMessage.toLowerCase().includes("min") ||
        args.userMessage.toLowerCase().includes("max") ||
        args.userMessage.toLowerCase().includes("calculate")
      ) {
        // Parse calculation request
        const operationMatch = args.userMessage.match(/\b(sum|average|avg|count|min|max|calculate)\b/i);
        const operation = operationMatch ? operationMatch[1].toLowerCase() : "sum";
        
        // Extract column name from the message (supports multi-word column names)
        let columnName = "salary"; // default
        
        // Try multiple patterns to extract column name
        const patterns = [
          /(?:column|of|for)\s+["']([^"']+)["']/i,  // Quoted: "column 'price in Sheet1'"
          /(?:column|of|for)\s+([a-zA-Z][a-zA-Z0-9\s_-]+?)(?:\s+column|\s*$|[.!?])/i,  // Multi-word: "sum of price in Sheet1"
          /(?:column|of|for)\s+(\w+)/i,  // Single word: "sum of price"
        ];
        
        for (const pattern of patterns) {
          const match = args.userMessage.match(pattern);
          if (match && match[1]) {
            columnName = match[1].trim();
            break;
          }
        }

        const convData = await ctx.runQuery(internal.ai.getConversationData, {
          conversationId: args.conversationId,
        });
        if (!convData) throw new Error("Conversation not found");

        const calcResult = await ctx.runMutation(internal.spreadsheets.internalCalculateColumnStats, {
          spreadsheetId: convData.conversation.spreadsheetId,
          ownerId: convData.conversation.ownerId,
          columnName,
          operation: (operation === "calculate" ? "sum" : operation) as "sum" | "average" | "avg" | "count" | "min" | "max",
        });

        const result = await thread.generateText({
          messages: [{ role: "user", content: args.userMessage }],
        });

        await ctx.runMutation(internal.ai.saveAIResponse, {
          conversationId: args.conversationId,
          content: `I calculated the ${calcResult.operation} of column '${calcResult.columnName}': ${calcResult.result} (from ${calcResult.rowCount} values). The result has been added to your spreadsheet. ` + result.text,
          chartData: extractChartData(result.text),
          agentId: args.agentId,
          modelName: agent.modelName,
          provider: agent.provider,
        });
      } else {
        console.log("💬 No special action detected, generating text response for:", args.userMessage);
        
        // Generate response with user message
        const result = await thread.generateText({
          messages: [{ role: "user", content: args.userMessage }]
        });

        console.log("Agent response:", result);

        // Save AI response
        await ctx.runMutation(internal.ai.saveAIResponse, {
          conversationId: args.conversationId,
          content: result.text,
          chartData: extractChartData(result.text),
          agentId: args.agentId,
          modelName: agent.modelName,
          provider: agent.provider,
        });
      }

      console.log("Agent response saved successfully");
    } catch (error) {
      console.error("Error generating agent response:", error);
      
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
 * Internal query to get agent data
 */
export const getAgentData = internalQuery({
  args: {
    agentId: v.id("aiAgents"),
  },
  returns: v.union(
    v.object({
      _id: v.id("aiAgents"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      provider: v.union(
        v.literal("openai"),
        v.literal("anthropic"),
        v.literal("google"),
        v.literal("mistral")
      ),
      modelName: v.string(),
      systemPrompt: v.string(),
      isActive: v.boolean(),
      ownerId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.agentId);
  },
});

/**
 * Internal query to get thread for conversation
 */
export const getThreadForConversation = internalQuery({
  args: {
    conversationId: v.id("aiConversations"),
    agentId: v.id("aiAgents"),
  },
  returns: v.union(
    v.object({
      _id: v.id("aiThreads"),
      _creationTime: v.number(),
      conversationId: v.id("aiConversations"),
      agentId: v.string(),
      threadId: v.string(),
      ownerId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("aiThreads")
      .withIndex("by_conversation", (q) => q.eq("conversationId", args.conversationId))
      .filter((q) => q.eq(q.field("agentId"), args.agentId))
      .unique();
  },
});

/**
 * Internal mutation to save thread
 */
export const saveThread = internalMutation({
  args: {
    conversationId: v.id("aiConversations"),
    agentId: v.id("aiAgents"),
    threadId: v.string(),
    ownerId: v.id("users"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const now = Date.now();
    await ctx.db.insert("aiThreads", {
      conversationId: args.conversationId,
      agentId: args.agentId,
      threadId: args.threadId,
      ownerId: args.ownerId,
      createdAt: now,
      updatedAt: now,
    });
    return null;
  },
});

/**
 * Helper function to extract chart data from AI response
 */
function extractChartData(content: string): {
  type: "line" | "bar" | "area" | "pie";
  range: string;
  sheetName?: string;
  title?: string;
} | undefined {
  if (content.toLowerCase().includes("chart") || content.toLowerCase().includes("graph")) {
    // Try to extract chart information from the response
    const chartMatch = content.match(/chart.*?(\w+).*?range.*?([A-Z]+\d+:[A-Z]+\d+)/i);
    if (chartMatch) {
      const chartType = chartMatch[1].toLowerCase();
      const range = chartMatch[2];
      
      if (["line", "bar", "area", "pie"].includes(chartType)) {
        return {
          type: chartType as "line" | "bar" | "area" | "pie",
          range: range,
          title: `AI Generated ${chartType.charAt(0).toUpperCase() + chartType.slice(1)} Chart`,
        };
      }
    }
  }
  return undefined;
}

/**
 * Helper function to build AI context with complete spreadsheet data
 */
interface TableCreationState {
  isCreatingTable: boolean;
  headers?: string[];
  numRows?: number;
  pendingSheetSelection?: boolean;
}

function extractTableCreationState(messages: Array<{ role: "user" | "assistant"; content: string }>): TableCreationState {
  const state: TableCreationState = {
    isCreatingTable: false,
  };

  if (messages.length === 0) return state;

  // Look at the last few messages to determine state
  const recentMessages = messages.slice(-3);
  for (const msg of recentMessages) {
    if (msg.role === "assistant" && msg.content.includes("create a table with headers:")) {
      state.isCreatingTable = true;
      state.pendingSheetSelection = true;
      
      // Extract headers from assistant's message
      const headerMatch = msg.content.match(/headers:\s*([^.]+)/);
      if (headerMatch) {
        state.headers = headerMatch[1].split(",").map(h => h.trim());
      }
      break;
    }
  }

  // Check if the last message is about table creation
  const lastMessage = messages[messages.length - 1];
  if (lastMessage.role === "user") {
    const hasTableKeywords = lastMessage.content.toLowerCase().includes("table") ||
      lastMessage.content.toLowerCase().includes("create") ||
      lastMessage.content.toLowerCase().includes("product") ||
      lastMessage.content.toLowerCase().includes("price");
    
    if (hasTableKeywords) {
      state.isCreatingTable = true;
    }

    // Look for number of rows
    const numMatch = lastMessage.content.match(/\b(\d{1,3})\b/);
    if (numMatch) {
      state.numRows = parseInt(numMatch[1]);
    }
  }

  return state;
}

function buildAIContext(
  spreadsheetData: { name: string; data: string } | null,
  selectedRange?: string,
  activeSheetName?: string,
  messages: Array<{ role: "user" | "assistant"; content: string }> = [],
  tableCreationState?: TableCreationState
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
  
  // Add table creation state context if relevant
  if (tableCreationState?.isCreatingTable) {
    context += "\n=== TABLE CREATION STATE ===\n";
    if (tableCreationState.headers) {
      context += `Pending table creation with headers: ${tableCreationState.headers.join(", ")}\n`;
    }
    if (tableCreationState.numRows) {
      context += `Number of rows requested: ${tableCreationState.numRows}\n`;
    }
    if (tableCreationState.pendingSheetSelection) {
      context += "Waiting for user to select target sheet (existing or new)\n";
    }
    context += "=== END TABLE CREATION STATE ===\n";
  }

  context += "\nINSTRUCTIONS: You have complete access to all the spreadsheet data shown above. When the user asks about any sheet, data, or analysis, provide specific insights based on the actual content. Be detailed and specific. If they ask 'what's in Sheet1', tell them exactly what data is in that sheet. If they ask for analysis, provide real analysis of the actual data shown.";
  
  if (tableCreationState?.isCreatingTable) {
    context += "\n\nIMPORTANT: You are currently helping the user create a table. If they mention 'new sheet' or specify a sheet name, make sure to preserve the previously discussed headers and create the table with those exact headers. Do not default to using just 'name' as a header.";
  }
  
  return context;
}

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
