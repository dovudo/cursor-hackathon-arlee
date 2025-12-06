import { action } from "../_generated/server";
import { v } from "convex/values";

export const generateScript = action({
  args: {
    idea: v.string(),
    language: v.optional(v.string()),
    duration: v.optional(v.number()),
    targetWords: v.optional(v.number()),
    style: v.optional(v.string()),
    targetAudience: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Default values
    const language = args.language || "en";
    const duration = args.duration || 1; // 1 minute default
    const targetWords = args.targetWords || Math.round(duration * 140); // ~140 words per minute
    const style = args.style || "dynamic";
    const targetAudience = args.targetAudience || "general";

    if (!args.idea || args.idea.trim().length === 0) {
      throw new Error("Idea cannot be empty");
    }

    console.log("[generateScript] Starting generation", {
      ideaLength: args.idea.length,
      language,
      duration,
      targetWords,
      style,
      targetAudience,
    });

    // Build prompt based on arlekino-firebase-2 script generation prompt
    const prompt = `CONTEXT: The user is creating a voiceover text for a video.

STYLE RULES FOR VIDEO SCRIPT:
1) Structure & Pacing
- Opening hook: the first 15–30 seconds must grab attention — question, intrigue, or a strong value promise.
- Fast pacing: no long intros; go straight to the point. Every paragraph should drive the story and engagement.
- Clear payoff: resolve the intrigue with a tangible result/insight.
- Ending: strong final thought and/or call to action.

2) Language & Tone
- Write in plain, conversational ${language === "ru" ? "Russian" : "English"}. Use short sentences.
- Write as for a friend: accessible, no pomp, no bureaucratic language.
- Avoid cliches and fluff. Keep a rhythm of short – punchy – dynamic.
- Use pattern interrupts: unexpected facts, twists, emotions, metaphors, relevant jokes.
- Add relatable moments — recognizable situations and real-life examples.

3) Engagement Strategy
- End key segments with micro-stories, open questions, or mini cliffhangers to motivate watching further.
- Add soft CTAs where relevant: "Subscribe", "Comment below", "Watch next".
- Use facts, comparisons, analogies from familiar contexts (daily life, pop culture, etc.).

4) Voiceover Text
- Produce a COHESIVE VOICEOVER TEXT ready for direct TTS.
- Avoid technical notes, editing directions, and scene lists.
- Convert dialogues into indirect speech without character names.
- Ensure natural flow with logical transitions.
- Keep paragraphs separated by double newlines (\\n\\n).

5) Basic Video Structure
- Hook/Intro (question/shock/problem, 15–30s)
- Short teaser: what's coming (no spoilers)
- Main part (facts, stories, dynamics, insights)
- Climax/Resolution (payoff, conclusion, solution)
- Ending with a clear CTA

INPUT REQUIREMENTS:
- Idea: "${args.idea}"
- Language: ${language}
- Duration: ${duration} minutes
- Target words: ${targetWords}
- Speaking style: ${style} (dynamic/measured/lazy)
- Target audience: ${targetAudience}

QUALITY CONSTRAINTS:
- Create a SINGLE COHESIVE VOICEOVER TEXT ready for TTS.
- The text should match ~${duration} minutes.
- CRITICAL: The text should contain ~${targetWords} words (±10%).
- IMPORTANT: DO NOT create scene lists, technical notes, or editing instructions.
- Convert dialogues to indirect speech; no character names.
- Keep fast pacing; avoid cliches and filler.
- AUDIENCE: Adapt style and content to ${targetAudience}.

OUTPUT STRUCTURE (JSON):
{
  "narration_text": "string - cohesive voiceover text ready for TTS; use \\n\\n for paragraph breaks.",
  "title": "string - catchy video title (20–120 chars) reflecting the core idea and drawing attention.",
  "language": "string - language code (e.g., en, ru)"
}

FORMAT REQUIREMENTS (CRITICAL):
1. RETURN ONLY VALID JSON — no markdown code fences \`\`\`json, no comments, no prefixes/suffixes.
2. ESCAPE ALL SPECIAL CHARS in JSON strings:
   - Newlines as \\n
   - Quotes as \\\" 
   - Backslashes as \\\\
3. VALIDATE JSON before sending.
4. In "narration_text" use \\n\\n for paragraph breaks, \\n for line breaks within a paragraph.

EXAMPLE OF CORRECT FORMAT:
{"narration_text": "Hello! Today we discuss...\\n\\nHere is what matters...", "title": "Surprising facts about...", "language": "${language}"}`;

    // Call OpenRouter API
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      const errorMessage = 
        "OPENROUTER_API_KEY not set. " +
        "Please add it in Convex Dashboard → Settings → Environment Variables. " +
        "Get your API key at https://openrouter.ai/keys";
      console.error("[generateScript] Configuration error:", errorMessage);
      throw new Error(errorMessage);
    }

    console.log("[generateScript] Calling OpenRouter API", {
      model: "google/gemini-2.5-flash",
      promptLength: prompt.length,
    });

    const systemContent = `You are a scriptwriter for Arlee AI. Return ONLY one valid JSON object and NOTHING else.
STRICTLY FORBIDDEN to use markdown or code fences: no \`\`\`json, no \`\`\` blocks, no headers, no pre/post text, no comments.
Create a SINGLE COHESIVE VOICEOVER TEXT in the "narration_text" field: directly ready for TTS, no scene lists, no technical notes, no editing directions.
For the "title" field: produce a catchy video title (60–120 chars) that conveys the core idea and attracts attention.
Escape special characters in JSON strings: newlines as \\n, quotes as \\", backslashes as \\\\.
Validate JSON before sending and ensure the response contains ONLY the JSON object.
Response format: {"narration_text": "cohesive voiceover text", "title": "catchy title", "language": "${language}"}
Language: ${language}. Text should match duration ${duration} minutes.`;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemContent },
          { role: "user", content: prompt },
        ],
        max_tokens: 2000,
        temperature: 0.7,
        response_format: { type: "json_object" },
        top_p: 0.9,
        frequency_penalty: 0,
        presence_penalty: 0,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    // Parse JSON response
    let scriptData;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      scriptData = JSON.parse(jsonStr.trim());
    } catch (error) {
      // Fallback: try to parse as-is
      try {
        scriptData = JSON.parse(content.trim());
      } catch (e) {
        throw new Error(`Failed to parse AI response as JSON: ${e}`);
      }
    }

    // Validate response structure
    if (!scriptData.narration_text || typeof scriptData.narration_text !== "string") {
      throw new Error("Invalid response format: missing narration_text");
    }

    console.log("[generateScript] Script generated successfully", {
      narrationLength: scriptData.narration_text.length,
      title: scriptData.title,
      language: scriptData.language,
    });

    return {
      success: true,
      data: {
        narration_text: scriptData.narration_text,
        title: scriptData.title || "Generated Script",
        language: scriptData.language || language,
      },
    };
  },
});
