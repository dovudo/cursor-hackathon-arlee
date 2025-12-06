import { query, mutation, action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const getSceneById = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.sceneId);
  },
});

export const getScenesByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scenes")
      .withIndex("by_project_order", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});

export const deleteScenesByProject = mutation({
  args: {
    projectId: v.id("projects"),
  },
  handler: async (ctx, args) => {
    // Find all scenes for this project
    const existingScenes = await ctx.db
      .query("scenes")
      .withIndex("by_project_order", (q) => q.eq("projectId", args.projectId))
      .collect();
    
    // Delete all existing scenes
    for (const scene of existingScenes) {
      await ctx.db.delete(scene._id);
    }
    
    return { deletedCount: existingScenes.length };
  },
});

export const createScenes = mutation({
  args: {
    projectId: v.id("projects"),
    scenes: v.array(
      v.object({
        orderIndex: v.number(),
        name: v.string(),
        scriptContent: v.string(),
        imagePrompt: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const sceneIds = [];
    for (const scene of args.scenes) {
      const id = await ctx.db.insert("scenes", {
        projectId: args.projectId,
        orderIndex: scene.orderIndex,
        name: scene.name,
        scriptContent: scene.scriptContent,
        imagePrompt: scene.imagePrompt,
        createdAt: Date.now(),
      });
      sceneIds.push(id);
    }
    return sceneIds;
  },
});

export const updateSceneImage = mutation({
  args: {
    sceneId: v.id("scenes"),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sceneId, {
      imageUrl: args.imageUrl,
    });
  },
});

export const updateSceneAudio = mutation({
  args: {
    sceneId: v.id("scenes"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sceneId, {
      audioUrl: args.audioUrl,
    });
  },
});

export const generateAudioUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    // Generate upload URL for audio file
    return await ctx.storage.generateUploadUrl();
  },
});

export const updateSceneAudioFromStorage = mutation({
  args: {
    sceneId: v.id("scenes"),
    storageId: v.id("_storage"),
  },
  handler: async (ctx, args) => {
    // Get URL from storage ID
    const url = await ctx.storage.getUrl(args.storageId);
    if (!url) {
      throw new Error("Failed to get storage URL");
    }
    
    // Update scene with audio URL
    await ctx.db.patch(args.sceneId, {
      audioUrl: url,
    });
    
    return { success: true, audioUrl: url };
  },
});



