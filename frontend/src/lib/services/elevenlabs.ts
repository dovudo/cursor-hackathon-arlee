/**
 * Client-side ElevenLabs TTS API integration
 * For hackathon MVP - API key is stored in NEXT_PUBLIC_ELEVENLABS_API_KEY
 */

export interface ElevenLabsTTSOptions {
  text: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
  useSpeakerBoost?: boolean;
}

export async function generateTTS(options: ElevenLabsTTSOptions): Promise<Blob> {
  const apiKey = process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error(
      "NEXT_PUBLIC_ELEVENLABS_API_KEY not set. " +
      "Please add it in .env.local file. " +
      "Get your API key at https://elevenlabs.io/app/settings/api-keys"
    );
  }

  const voiceId = options.voiceId || "21m00Tcm4TlvDq8ikWAM"; // Rachel voice (default)
  const modelId = options.modelId || "eleven_multilingual_v2";

  console.log("[generateTTS] Calling ElevenLabs API from client", {
    voiceId,
    textLength: options.text.length,
    model: modelId,
  });

  const response = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(voiceId)}`,
    {
      method: "POST",
      headers: {
        Accept: "audio/mpeg",
        "Content-Type": "application/json",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: options.text,
        model_id: modelId,
        voice_settings: {
          stability: options.stability ?? 0.5,
          similarity_boost: options.similarityBoost ?? 0.75,
          use_speaker_boost: options.useSpeakerBoost ?? true,
        },
      }),
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    let errorMessage = `ElevenLabs API error: ${errorText}`;
    
    // Provide helpful error messages for common issues
    try {
      const errorJson = JSON.parse(errorText);
      const errorStatus = errorJson.detail?.status;
      const errorMsg = errorJson.detail?.message || "";
      
      if (errorStatus === "invalid_api_key") {
        errorMessage =
          `ElevenLabs API key is invalid. ` +
          `Please check your API key at https://elevenlabs.io/app/settings/api-keys. ` +
          `Make sure NEXT_PUBLIC_ELEVENLABS_API_KEY in .env.local is correct and restart the dev server.`;
      } else if (errorStatus === "missing_permissions") {
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
    
    console.error("[generateTTS] ElevenLabs API error:", errorMessage);
    throw new Error(errorMessage);
  }

  const audioBuffer = await response.arrayBuffer();
  return new Blob([audioBuffer], { type: "audio/mpeg" });
}

