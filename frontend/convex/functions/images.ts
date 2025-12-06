import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const generateImage = action({
  args: {
    sceneId: v.id("scenes"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Get scene to find project and settings
    const scene = await ctx.runQuery(api.functions.scenes.getSceneById, {
      sceneId: args.sceneId,
    });

    if (!scene) {
      throw new Error(`Scene not found: ${args.sceneId}`);
    }

    // 2. Get project to get aspect_ratio from settings
    const project = await ctx.runQuery(api.functions.projects.getProjectById, {
      projectId: scene.projectId,
    });

    const aspectRatio = project?.settings?.framing || "16:9";

    // 3. Create generation event
    const eventId = await ctx.runMutation(api.functions.generationEvents.createEvent, {
      sceneId: args.sceneId,
      type: "image",
    });

    try {
      // 4. Update to processing
      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "processing",
      });

      // 5. Call Replicate API
      const replicateKey = process.env.REPLICATE_API_TOKEN;
      if (!replicateKey) {
        throw new Error("REPLICATE_API_TOKEN not set");
      }

      const replicateResponse = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${replicateKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "black-forest-labs/flux-schnell", // Faster generation for MVP
          input: {
            prompt: args.prompt,
            aspect_ratio: aspectRatio,
            output_format: "png",
          },
        }),
      });

      if (!replicateResponse.ok) {
        const error = await replicateResponse.text();
        throw new Error(`Replicate API error: ${error}`);
      }

      const prediction = await replicateResponse.json();
      let predictionId = prediction.id;

      // 4. Poll for result (up to 2 minutes)
      const maxAttempts = 40; // 40 * 3 seconds = 2 minutes
      let attempts = 0;
      let result: any = null;

      while (attempts < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 3000)); // Wait 3 seconds

        const statusResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${predictionId}`,
          {
            headers: {
              Authorization: `Token ${replicateKey}`,
            },
          }
        );

        result = await statusResponse.json();

        if (result.status === "succeeded") {
          break;
        }

        if (result.status === "failed" || result.status === "canceled") {
          throw new Error(`Replicate prediction failed: ${result.error || "Unknown error"}`);
        }

        attempts++;
      }

      if (!result || result.status !== "succeeded") {
        throw new Error("Image generation timeout");
      }

      const imageUrl = result.output?.[0] || result.output;

      if (!imageUrl) {
        throw new Error("No image URL in Replicate response");
      }

      // 5. Download image and store in Convex Storage
      const imageResponse = await fetch(imageUrl);
      if (!imageResponse.ok) {
        throw new Error("Failed to download image");
      }

      const imageBlob = await imageResponse.blob();
      const storageId = await ctx.storage.store(imageBlob);

      // 6. Get URL
      const url = await ctx.storage.getUrl(storageId);
      if (!url) {
        throw new Error("Failed to get storage URL");
      }

      // 7. Update scene and event
      await ctx.runMutation(api.functions.scenes.updateSceneImage, {
        sceneId: args.sceneId,
        imageUrl: url,
      });

      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "completed",
        resultUrl: url,
      });

      return { success: true, imageUrl: url };
    } catch (error: any) {
      // Update event with error
      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "failed",
        errorMessage: error.message || "Unknown error",
      });
      throw error;
    }
  },
});



