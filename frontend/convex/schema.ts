import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // 1. User profiles
  userProfiles: defineTable({
    email: v.string(),
    fullName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  // 2. Styles (предустановленные)
  styles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    imageUrl: v.optional(v.string()),
    isPublic: v.boolean(),
    createdAt: v.number(),
  }).index("by_public", ["isPublic"]),

  // 3. Projects
  projects: defineTable({
    userId: v.id("userProfiles"),
    name: v.string(),
    scenarioText: v.string(),
    styleId: v.id("styles"),
    // Project settings (matching original Arlee AI structure)
    settings: v.optional(
      v.object({
        // Language settings
        language: v.optional(v.string()),
        // Pacing settings
        pacing: v.optional(v.union(v.literal("dynamic"), v.literal("moderate"), v.literal("slow"), v.literal("custom"))),
        // Duration settings
        target_duration: v.optional(v.number()),
        min_sec: v.optional(v.number()),
        max_sec: v.optional(v.number()),
        // Audience settings
        audience: v.optional(v.string()),
        // Visual settings
        framing: v.optional(v.string()), // "16:9", "9:16", "1:1", "4:3"
        // Project metadata
        category: v.optional(v.string()),
        wordsPerMinute: v.optional(v.number()),
      })
    ),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  // 4. Scenes
  scenes: defineTable({
    projectId: v.id("projects"),
    orderIndex: v.number(),
    name: v.string(),
    scriptContent: v.string(),
    imagePrompt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_order", ["projectId", "orderIndex"]),

  // 5. Generation events
  generationEvents: defineTable({
    sceneId: v.id("scenes"),
    type: v.union(v.literal("image"), v.literal("audio")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_scene_type", ["sceneId", "type"])
    .index("by_status", ["status"]),
});



