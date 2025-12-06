import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const generateAudio = action({
  args: {
    sceneId: v.id("scenes"),
    text: v.string(),
  },
  handler: async (ctx, args) => {
    console.log("🎵 TTS: Calling ElevenLabs API directly");

    // 1. Create generation event
    const eventId = await ctx.runMutation(api.functions.generationEvents.createEvent, {
      sceneId: args.sceneId,
      type: "audio",
    });

    try {
      // 2. Update to processing
      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "processing",
      });

      // 3. Call ElevenLabs API DIRECTLY
      const elevenLabsKey = process.env.ELEVENLABS_API_KEY;
      if (!elevenLabsKey) {
        const errorMessage =
          "ELEVENLABS_API_KEY not set. " +
          "Please add it in Convex Dashboard → Settings → Environment Variables. " +
          "Get your API key at https://elevenlabs.io/app/settings/api-keys";
        console.error("[generateAudio] Configuration error:", errorMessage);
        throw new Error(errorMessage);
      }

      // Use default voice ID (Rachel) - can be made configurable later
      const voiceId = "21m00Tcm4TlvDq8ikWAM"; // Rachel voice

      console.log("[generateAudio] Calling ElevenLabs API", {
        voiceId,
        textLength: args.text.length,
        model: "eleven_multilingual_v2",
      });

      const elevenLabsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
        {
          method: "POST",
          headers: {
            Accept: "audio/mpeg",
            "Content-Type": "application/json",
            "xi-api-key": elevenLabsKey,
          },
          body: JSON.stringify({
            text: args.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.75,
              use_speaker_boost: true, // Added to match production format
            },
          }),
        }
      );

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text();
        let errorMessage = `ElevenLabs API error: ${errorText}`;
        
        // Provide helpful error messages for common issues
        try {
          const errorJson = JSON.parse(errorText);
          const errorStatus = errorJson.detail?.status;
          const errorMsg = errorJson.detail?.message || "";
          
          if (errorStatus === "missing_permissions") {
            errorMessage =
              `ElevenLabs API key missing 'text_to_speech' permission. ` +
              `Please check your API key permissions at https://elevenlabs.io/app/settings/api-keys. ` +
              `The API key must have 'text_to_speech' permission enabled.`;
          } else if (errorStatus === "detected_unusual_activity") {
            errorMessage =
              `ElevenLabs Free Tier has been disabled due to unusual activity detection. ` +
              `This can happen if using VPN/proxy or multiple free accounts. ` +
              `For hackathon demo, you may need a paid ElevenLabs subscription. ` +
              `Alternatively, audio generation can be skipped for demo purposes. ` +
              `Error details: ${errorMsg}`;
          } else if (errorStatus === "quota_exceeded" || errorMsg.toLowerCase().includes("quota")) {
            errorMessage =
              `ElevenLabs API quota exceeded. ` +
              `Please check your usage limits at https://elevenlabs.io/app/settings/api-keys. ` +
              `For hackathon demo, consider using a paid plan or skipping audio generation.`;
          }
        } catch {
          // If error is not JSON, use original error message
        }
        
        console.error("[generateAudio] ElevenLabs API error:", errorMessage);
        throw new Error(errorMessage);
      }

      // 4. Get audio as ArrayBuffer
      const audioBuffer = await elevenLabsResponse.arrayBuffer();
      const audioBlob = new Blob([audioBuffer], { type: "audio/mpeg" });

      // 5. Store in Convex Storage
      const storageId = await ctx.storage.store(audioBlob);

      // 6. Get URL
      const url = await ctx.storage.getUrl(storageId);
      if (!url) {
        throw new Error("Failed to get storage URL");
      }

      // 7. Update scene and event
      await ctx.runMutation(api.functions.scenes.updateSceneAudio, {
        sceneId: args.sceneId,
        audioUrl: url,
      });

      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "completed",
        resultUrl: url,
      });

      console.log("🎵 TTS: Successfully generated and stored audio");
      return { success: true, audioUrl: url };
    } catch (error: any) {
      console.error("🎵 TTS: Error:", error);
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



