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
      v.literal("pie")
    ),
    range: v.string(), // e.g. "A1:C10"
    options: v.optional(
      v.object({
        xIsFirstRowHeader: v.optional(v.boolean()),
        xIsFirstColumn: v.optional(v.boolean()),
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_spreadsheet", ["spreadsheetId"]) 
    .index("by_owner", ["ownerId"]),
});
