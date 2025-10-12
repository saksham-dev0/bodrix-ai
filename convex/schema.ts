import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  users: defineTable({
    clerkId: v.string(), // Clerk user ID
    name: v.string(),
    email: v.string(),
    imageUrl: v.optional(v.string()),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_clerk_id", ["clerkId"])
    .index("by_email", ["email"]),

  projects: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_owner", ["ownerId"]),

  spreadsheets: defineTable({
    projectId: v.id("projects"),
    name: v.string(),
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
    // x-spreadsheet data as JSON string
    data: v.optional(v.string()), // JSON string of x-spreadsheet data
    // Legacy fields for backward compatibility
    charts: v.optional(v.string()), // legacy stringified charts stored on spreadsheet
    activeSheetIndex: v.optional(v.number()),
    workbookData: v.optional(v.string()),
    xSpreadsheetData: v.optional(v.string()),
  })
    .index("by_project", ["projectId"])
    .index("by_owner", ["ownerId"]),

  charts: defineTable({
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
    title: v.string(),
    type: v.union(
      v.literal("line"),
      v.literal("bar"),
      v.literal("area"),
      v.literal("pie"),
    ),
    range: v.string(), // e.g. "A1:C10"
    sheetName: v.optional(v.string()), // Name of the sheet to use for chart data
    options: v.optional(
      v.object({
        xIsFirstRowHeader: v.optional(v.boolean()),
        xIsFirstColumn: v.optional(v.boolean()),
      }),
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spreadsheet", ["spreadsheetId"])
    .index("by_owner", ["ownerId"]),

  // AI Chat Conversations
  aiConversations: defineTable({
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
    title: v.string(),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spreadsheet", ["spreadsheetId"])
    .index("by_owner", ["ownerId"]),

  // AI Chat Messages
  aiMessages: defineTable({
    conversationId: v.id("aiConversations"),
    ownerId: v.id("users"),
    role: v.union(v.literal("user"), v.literal("assistant")),
    content: v.string(),
    // For AI responses that include charts
    chartData: v.optional(
      v.object({
        type: v.union(
          v.literal("line"),
          v.literal("bar"),
          v.literal("area"),
          v.literal("pie"),
        ),
        range: v.string(),
        sheetName: v.optional(v.string()),
        title: v.optional(v.string()),
      }),
    ),
    // Agent and LLM information
    agentId: v.optional(v.string()),
    modelName: v.optional(v.string()),
    provider: v.optional(v.string()), // "openai", "anthropic", "google", "mistral"
    // Streaming support
    isStreaming: v.optional(v.boolean()), // true if message is currently being streamed
    isComplete: v.optional(v.boolean()), // true if streaming is complete
    createdAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_owner", ["ownerId"]),

  // AI Agent Configurations
  aiAgents: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    provider: v.union(
      v.literal("openai"),
      v.literal("anthropic"),
      v.literal("google"),
      v.literal("mistral"),
    ),
    modelName: v.string(),
    systemPrompt: v.string(),
    isActive: v.boolean(),
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_owner", ["ownerId"])
    .index("by_provider", ["provider"]),

  // AI Threads for agent conversations
  aiThreads: defineTable({
    conversationId: v.id("aiConversations"),
    agentId: v.string(),
    threadId: v.string(), // External thread ID from agent
    ownerId: v.id("users"),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_conversation", ["conversationId"])
    .index("by_agent", ["agentId"])
    .index("by_owner", ["ownerId"]),

  // Documents uploaded by users
  documents: defineTable({
    spreadsheetId: v.id("spreadsheets"),
    conversationId: v.optional(v.id("aiConversations")),
    ownerId: v.id("users"),
    fileName: v.string(),
    fileType: v.union(v.literal("pdf"), v.literal("docx")),
    storageId: v.id("_storage"), // Convex file storage ID
    extractedText: v.optional(v.string()), // Full text content
    extractedTables: v.optional(v.string()), // JSON string of tables found
    pageCount: v.optional(v.number()),
    processingStatus: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spreadsheet", ["spreadsheetId"])
    .index("by_conversation", ["conversationId"])
    .index("by_owner", ["ownerId"])
    .index("by_status", ["processingStatus"]),

  // KPI Dashboards
  dashboards: defineTable({
    spreadsheetId: v.id("spreadsheets"),
    ownerId: v.id("users"),
    name: v.string(),
    description: v.optional(v.string()),
    // Array of widget configurations stored as JSON string
    // Each widget contains: type, chartId (optional), title, config (ranges, sheets, etc.)
    widgetsData: v.string(),
    layout: v.optional(v.string()), // Grid layout configuration as JSON
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spreadsheet", ["spreadsheetId"])
    .index("by_owner", ["ownerId"]),

  // Dashboard Widgets (individual visualizations/metrics in a dashboard)
  dashboardWidgets: defineTable({
    dashboardId: v.id("dashboards"),
    ownerId: v.id("users"),
    type: v.union(
      v.literal("chart"),
      v.literal("metric"),
      v.literal("table"),
      v.literal("text")
    ),
    title: v.string(),
    // For chart widgets
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
    // For metric widgets (single KPI value)
    metricValue: v.optional(v.string()),
    metricFormula: v.optional(v.string()), // e.g., "SUM", "AVG", "COUNT"
    metricColumn: v.optional(v.string()),
    // For table widgets
    tableRange: v.optional(v.string()),
    tableSheetName: v.optional(v.string()),
    // Position and sizing in grid
    position: v.object({
      x: v.number(),
      y: v.number(),
      width: v.number(),
      height: v.number(),
    }),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_dashboard", ["dashboardId"])
    .index("by_owner", ["ownerId"]),
});
