import { query } from "../_generated/server";
import { v } from "convex/values";

export const getPublicStyles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("styles")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect();
  },
});

export const getStyleById = query({
  args: { styleId: v.id("styles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.styleId);
  },
});



