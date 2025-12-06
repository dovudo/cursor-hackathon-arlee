import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

// Helper to get user profile (for queries - read only)
async function getUserProfile(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  const email = identity?.email || `anonymous-${Date.now()}@demo.local`;

  const userProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .first();

  return userProfile;
}

// Helper to get or create user profile (for mutations only)
async function getOrCreateUserProfile(ctx: any) {
  const identity = await ctx.auth.getUserIdentity();
  const email = identity?.email || `anonymous-${Date.now()}@demo.local`;
  const name = identity?.name || "Anonymous User";

  let userProfile = await ctx.db
    .query("userProfiles")
    .withIndex("by_email", (q: any) => q.eq("email", email))
    .first();

  if (!userProfile) {
    const userId = await ctx.db.insert("userProfiles", {
      email: email,
      fullName: name,
      createdAt: Date.now(),
    });
    userProfile = await ctx.db.get(userId);
  }

  return userProfile!;
}

export const getUserProjects = query({
  args: {},
  handler: async (ctx) => {
    const userProfile = await getUserProfile(ctx);
    if (!userProfile) {
      return []; // Return empty array if no user profile exists yet
    }
    return await ctx.db
      .query("projects")
      .withIndex("by_user_created", (q: any) => q.eq("userId", userProfile._id))
      .order("desc")
      .collect();
  },
});

export const getProjectById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const userProfile = await getUserProfile(ctx);
    const project = await ctx.db.get(args.projectId);
    
    if (!project) {
      return null;
    }

    // Check access (skip if no user profile - allow anonymous access for MVP)
    if (userProfile && project.userId !== userProfile._id) {
      throw new Error("Unauthorized");
    }

    return project;
  },
});

export const createProject = mutation({
  args: {
    name: v.string(),
    scenarioText: v.string(),
    styleId: v.id("styles"),
    settings: v.optional(
      v.object({
        language: v.optional(v.string()),
        pacing: v.optional(v.union(v.literal("dynamic"), v.literal("moderate"), v.literal("slow"), v.literal("custom"))),
        target_duration: v.optional(v.number()),
        min_sec: v.optional(v.number()),
        max_sec: v.optional(v.number()),
        audience: v.optional(v.string()),
        framing: v.optional(v.string()),
        category: v.optional(v.string()),
        wordsPerMinute: v.optional(v.number()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const userProfile = await getOrCreateUserProfile(ctx);

    return await ctx.db.insert("projects", {
      userId: userProfile._id,
      name: args.name,
      scenarioText: args.scenarioText,
      styleId: args.styleId,
      settings: args.settings,
      createdAt: Date.now(),
    });
  },
});

export const updateProjectSettings = mutation({
  args: {
    projectId: v.id("projects"),
    settings: v.object({
      language: v.optional(v.string()),
      pacing: v.optional(v.union(v.literal("dynamic"), v.literal("moderate"), v.literal("slow"), v.literal("custom"))),
      target_duration: v.optional(v.number()),
      min_sec: v.optional(v.number()),
      max_sec: v.optional(v.number()),
      audience: v.optional(v.string()),
      framing: v.optional(v.string()),
      category: v.optional(v.string()),
      wordsPerMinute: v.optional(v.number()),
    }),
  },
  handler: async (ctx, args) => {
    const userProfile = await getUserProfile(ctx);
    const project = await ctx.db.get(args.projectId);
    
    if (!project) {
      throw new Error("Project not found");
    }

    // Check access
    if (userProfile && project.userId !== userProfile._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.projectId, {
      settings: args.settings,
    });

    return { success: true };
  },
});

export const updateProjectAudio = mutation({
  args: {
    projectId: v.id("projects"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    const userProfile = await getUserProfile(ctx);
    const project = await ctx.db.get(args.projectId);
    
    if (!project) {
      throw new Error("Project not found");
    }

    // Check access
    if (userProfile && project.userId !== userProfile._id) {
      throw new Error("Unauthorized");
    }

    await ctx.db.patch(args.projectId, {
      audioUrl: args.audioUrl,
    });

    return { success: true };
  },
});

export const updateProjectAudioFromStorage = action({
  args: {
    projectId: v.id("projects"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Get URL from storage ID (storage can only be accessed in actions)
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to get storage URL");
    }
    
    // Update project with audio URL via mutation
    await ctx.runMutation(api.functions.projects.updateProjectAudio, {
      projectId: args.projectId,
      audioUrl: url,
    });
    
    return { success: true, audioUrl: url };
  },
});
