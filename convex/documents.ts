import { query, mutation, action, internalQuery, internalMutation, internalAction } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";

/**
 * Generate upload URL for document
 */
export const generateUploadUrl = mutation({
  args: {},
  returns: v.string(),
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    return await ctx.storage.generateUploadUrl();
  },
});

/**
 * Create document record after file upload
 */
export const createDocument = mutation({
  args: {
    spreadsheetId: v.id("spreadsheets"),
    conversationId: v.optional(v.id("aiConversations")),
    fileName: v.string(),
    fileType: v.union(v.literal("pdf"), v.literal("docx")),
    storageId: v.id("_storage"),
    extractedText: v.optional(v.string()),
    extractedTables: v.optional(v.string()),
  },
  returns: v.id("documents"),
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
    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to upload to this spreadsheet");
    }

    const now = Date.now();
    const documentId = await ctx.db.insert("documents", {
      spreadsheetId: args.spreadsheetId,
      conversationId: args.conversationId,
      ownerId: user._id,
      fileName: args.fileName,
      fileType: args.fileType,
      storageId: args.storageId,
      extractedText: args.extractedText,
      extractedTables: args.extractedTables,
      processingStatus: args.extractedText ? "completed" : "pending",
      createdAt: now,
      updatedAt: now,
    });

    // Only schedule processing if text wasn't provided (fallback)
    if (!args.extractedText) {
      await ctx.scheduler.runAfter(0, internal.documents.processDocument, {
        documentId,
      });
    }

    return documentId;
  },
});

/**
 * List documents for a spreadsheet
 */
export const listDocuments = query({
  args: {
    spreadsheetId: v.id("spreadsheets"),
  },
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      conversationId: v.optional(v.id("aiConversations")),
      ownerId: v.id("users"),
      fileName: v.string(),
      fileType: v.union(v.literal("pdf"), v.literal("docx")),
      storageId: v.id("_storage"),
      extractedText: v.optional(v.string()),
      extractedTables: v.optional(v.string()),
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
    if (spreadsheet.ownerId !== user._id) {
      throw new Error("Not authorized to view documents");
    }

    return await ctx.db
      .query("documents")
      .withIndex("by_spreadsheet", (q) => q.eq("spreadsheetId", args.spreadsheetId))
      .order("desc")
      .collect();
  },
});

/**
 * Get document by ID
 */
export const getDocument = query({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.union(
    v.object({
      _id: v.id("documents"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      conversationId: v.optional(v.id("aiConversations")),
      ownerId: v.id("users"),
      fileName: v.string(),
      fileType: v.union(v.literal("pdf"), v.literal("docx")),
      storageId: v.id("_storage"),
      extractedText: v.optional(v.string()),
      extractedTables: v.optional(v.string()),
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
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const user = await ctx.db
      .query("users")
      .withIndex("by_clerk_id", (q) => q.eq("clerkId", identity.subject))
      .unique();
    if (!user) throw new Error("User not found");

    const document = await ctx.db.get(args.documentId);
    if (!document) return null;
    if (document.ownerId !== user._id) {
      throw new Error("Not authorized to view this document");
    }

    return document;
  },
});

/**
 * Delete document
 */
export const deleteDocument = mutation({
  args: {
    documentId: v.id("documents"),
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

    const document = await ctx.db.get(args.documentId);
    if (!document) throw new Error("Document not found");
    if (document.ownerId !== user._id) {
      throw new Error("Not authorized to delete this document");
    }

    // Delete from storage
    await ctx.storage.delete(document.storageId);

    // Delete document record
    await ctx.db.delete(args.documentId);

    return null;
  },
});

/**
 * Process document - extract text and tables
 * Note: Document processing not yet implemented
 */
export const processDocument = internalAction({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    try {
      // Update status to processing
      await ctx.runMutation(internal.documents.updateDocumentStatus, {
        documentId: args.documentId,
        status: "processing",
      });

      // Get document
      const document = await ctx.runQuery(internal.documents.internalGetDocument, {
        documentId: args.documentId,
      });

      if (!document) {
        throw new Error("Document not found");
      }

      // TODO: Implement document processing via external service
      // For now, mark as failed with informative message
      await ctx.runMutation(internal.documents.updateDocumentStatus, {
        documentId: args.documentId,
        status: "failed",
        errorMessage: "Document processing not yet implemented. Please use an external service or process client-side.",
      });

      console.log(`Document ${args.documentId} upload completed (processing not yet implemented)`);
    } catch (error) {
      console.error("Error processing document:", error);
      
      await ctx.runMutation(internal.documents.updateDocumentStatus, {
        documentId: args.documentId,
        status: "failed",
        errorMessage: error instanceof Error ? error.message : String(error),
      });
    }

    return null;
  },
});

/**
 * Internal query to get document
 */
export const internalGetDocument = internalQuery({
  args: {
    documentId: v.id("documents"),
  },
  returns: v.union(
    v.object({
      _id: v.id("documents"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      conversationId: v.optional(v.id("aiConversations")),
      ownerId: v.id("users"),
      fileName: v.string(),
      fileType: v.union(v.literal("pdf"), v.literal("docx")),
      storageId: v.id("_storage"),
      extractedText: v.optional(v.string()),
      extractedTables: v.optional(v.string()),
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
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await ctx.db.get(args.documentId);
  },
});

/**
 * Update document processing status
 */
export const updateDocumentStatus = internalMutation({
  args: {
    documentId: v.id("documents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    errorMessage: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      processingStatus: args.status,
      errorMessage: args.errorMessage,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Update document with extracted content
 */
export const updateDocumentContent = internalMutation({
  args: {
    documentId: v.id("documents"),
    extractedText: v.string(),
    extractedTables: v.string(),
    pageCount: v.optional(v.number()),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    await ctx.db.patch(args.documentId, {
      extractedText: args.extractedText,
      extractedTables: args.extractedTables,
      pageCount: args.pageCount,
      processingStatus: args.status,
      updatedAt: Date.now(),
    });
    return null;
  },
});

/**
 * Get documents for a conversation
 */
export const getConversationDocuments = internalQuery({
  args: {
    spreadsheetId: v.id("spreadsheets"),
  },
  returns: v.array(
    v.object({
      _id: v.id("documents"),
      _creationTime: v.number(),
      spreadsheetId: v.id("spreadsheets"),
      conversationId: v.optional(v.id("aiConversations")),
      ownerId: v.id("users"),
      fileName: v.string(),
      fileType: v.union(v.literal("pdf"), v.literal("docx")),
      storageId: v.id("_storage"),
      extractedText: v.optional(v.string()),
      extractedTables: v.optional(v.string()),
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
  ),
  handler: async (ctx, args) => {
    return await ctx.db
      .query("documents")
      .withIndex("by_spreadsheet", (q) => q.eq("spreadsheetId", args.spreadsheetId))
      .filter((q) => q.eq(q.field("processingStatus"), "completed"))
      .order("desc")
      .collect();
  },
});

