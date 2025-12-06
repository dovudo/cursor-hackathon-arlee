import { mutation, query } from "../_generated/server";
import { v } from "convex/values";

export const createEvent = mutation({
  args: {
    sceneId: v.id("scenes"),
    type: v.union(v.literal("image"), v.literal("audio")),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generationEvents", {
      sceneId: args.sceneId,
      type: args.type,
      status: "pending",
      createdAt: Date.now(),
    });
  },
});

export const updateEvent = mutation({
  args: {
    eventId: v.id("generationEvents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, {
      status: args.status,
      resultUrl: args.resultUrl,
      errorMessage: args.errorMessage,
    });
  },
});

export const getEventsByScene = query({
  args: {
    sceneId: v.id("scenes"),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generationEvents")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .collect();
  },
});



