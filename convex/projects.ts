import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

/**
 * Get all projects for the current user
 */
export const getUserProjects = query({
  args: {},
  returns: v.array(
    v.object({
      _id: v.id("projects"),
      _creationTime: v.number(),
      name: v.string(),
      description: v.optional(v.string()),
      ownerId: v.id("users"),
      createdAt: v.number(),
      updatedAt: v.number(),
    }),
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

    return await ctx.db
      .query("projects")
      .withIndex("by_owner", (q) => q.eq("ownerId", user._id))
      .order("desc")
      .collect();
  },
});

/**
 * Create a new project
 */
export const createProject = mutation({
  args: {
    name: v.string(),
    description: v.optional(v.string()),
  },
  returns: v.id("projects"),
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
    return await ctx.db.insert("projects", {
      name: args.name,
      description: args.description,
      ownerId: user._id,
      createdAt: now,
      updatedAt: now,
    });
  },
});

/**
 * Update a project
 */
export const updateProject = mutation({
  args: {
    projectId: v.id("projects"),
    name: v.optional(v.string()),
    description: v.optional(v.string()),
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

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Not authorized to update this project");
    }

    const updates: any = { updatedAt: Date.now() };
    if (args.name !== undefined) updates.name = args.name;
    if (args.description !== undefined) updates.description = args.description;

    await ctx.db.patch(args.projectId, updates);
    return null;
  },
});

/**
 * Delete a project
 */
export const deleteProject = mutation({
  args: {
    projectId: v.id("projects"),
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

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

    if (project.ownerId !== user._id) {
      throw new Error("Not authorized to delete this project");
    }

    // Delete all spreadsheets associated with this project
    const spreadsheets = await ctx.db
      .query("spreadsheets")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .collect();

    for (const spreadsheet of spreadsheets) {
      await ctx.db.delete(spreadsheet._id);
    }

    await ctx.db.delete(args.projectId);
    return null;
  },
});
