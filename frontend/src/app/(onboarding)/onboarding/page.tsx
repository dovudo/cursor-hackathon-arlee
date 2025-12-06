"use client";

import { useState, useEffect } from "react";
import { useProject } from "@/context/ProjectContext";
import { Id } from "../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import StoryboardView from "@/components/StoryboardView";

type Step = "script" | "style" | "generating" | "result";

const STEPS: { key: Step; label: string; number: number }[] = [
  { key: "script", label: "Script", number: 1 },
  { key: "style", label: "Style", number: 2 },
  { key: "generating", label: "Generating", number: 3 },
];

function ProgressBar({ currentStep }: { currentStep: Step }) {
  const currentStepIndex = STEPS.findIndex(s => s.key === currentStep);
  
  return (
    <div className="mb-8">
      <div className="flex items-center justify-between mb-4">
        {STEPS.map((step, index) => (
          <div key={step.key} className="flex items-center flex-1">
            <div className="flex flex-col items-center flex-1">
              <div
                className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm transition-all duration-300 ${
                  index <= currentStepIndex
                    ? "bg-[hsl(var(--primary))] text-white"
                    : "bg-[hsl(var(--muted))] text-[hsl(var(--foreground))]/40"
                }`}
              >
                {index < currentStepIndex ? "✓" : step.number}
              </div>
              <span
                className={`text-xs mt-2 transition-colors duration-300 ${
                  index <= currentStepIndex
                    ? "text-[hsl(var(--foreground))] font-medium"
                    : "text-[hsl(var(--foreground))]/40"
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`h-0.5 flex-1 mx-2 transition-colors duration-300 ${
                  index < currentStepIndex
                    ? "bg-[hsl(var(--primary))]"
                    : "bg-[hsl(var(--muted))]"
                }`}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default function OnboardingPage() {
  const { styles, createProject, generateStoryboard, generateScript, generateProjectAudio, isLoading, setProjectId } = useProject();
  const [step, setStep] = useState<Step>("script");
  const [scriptText, setScriptText] = useState("");
  const [scriptIdea, setScriptIdea] = useState("");
  const [isGeneratingScript, setIsGeneratingScript] = useState(false);
  const [selectedStyleId, setSelectedStyleId] = useState<Id<"styles"> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<Id<"projects"> | null>(null);
  const [generationProgress, setGenerationProgress] = useState<string>("");
  const [showSettings, setShowSettings] = useState(false);
  
  // Project settings state (for new projects)
  const [projectSettings, setProjectSettings] = useState({
    language: "en",
    pacing: "moderate" as const,
    target_duration: 60,
    min_sec: 2,
    max_sec: 10,
    framing: "16:9",
    audience: "general",
    wordsPerMinute: 140,
  });

  // Query scenes to detect when they're created (real-time waiting)
  const scenes = useQuery(
    api.functions.scenes.getScenesByProject,
    createdProjectId ? { projectId: createdProjectId } : "skip"
  ) ?? [];

  // Reset projectId when component mounts ONLY if we're on script step (starting fresh)
  useEffect(() => {
    // Only reset if we're on the initial script step and don't have a created project
    // This prevents resetting when navigating back or when scenes are already created
    if (step === "script" && !createdProjectId) {
      console.log("[OnboardingPage] Component mounted on script step, resetting projectId");
      setProjectId(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Empty array = only run on mount, not on every render

  // Ensure projectId is set in context when createdProjectId changes
  useEffect(() => {
    if (createdProjectId) {
      console.log("[OnboardingPage] Setting projectId in context", { projectId: createdProjectId });
      setProjectId(createdProjectId);
    }
  }, [createdProjectId, setProjectId]);

  // Auto-transition to result when scenes are created
  useEffect(() => {
    if (step === "generating" && createdProjectId && scenes.length > 0) {
      console.log("[OnboardingPage] Scenes created, transitioning to result", {
        sceneCount: scenes.length,
        projectId: createdProjectId,
        step,
      });
      try {
        // Ensure projectId is set before transitioning
        setProjectId(createdProjectId);
        setGenerationProgress("Complete! Loading storyboard...");
        // Small delay for better UX
        const timeoutId = setTimeout(() => {
          setStep("result");
          setIsGenerating(false);
        }, 500);
        
        return () => {
          clearTimeout(timeoutId);
        };
      } catch (error) {
        console.error("[OnboardingPage] Error transitioning to result:", error);
        // Don't redirect, stay on generating step
        setIsGenerating(false);
      }
    }
  }, [step, createdProjectId, scenes.length, setProjectId]);

  // Update generation progress based on scenes
  useEffect(() => {
    if (step === "generating" && createdProjectId) {
      if (scenes.length === 0) {
        setGenerationProgress("Creating scenes...");
      } else {
        const scenesWithImages = scenes.filter(s => s.imageUrl).length;
        
        if (scenesWithImages === scenes.length) {
          setGenerationProgress("All scenes ready!");
        } else {
          setGenerationProgress(`Generating images... (${scenesWithImages}/${scenes.length})`);
        }
      }
    }
  }, [step, createdProjectId, scenes]);

  const handleStart = async () => {
    if (!scriptText.trim() || !selectedStyleId) {
      console.warn("[OnboardingPage] Cannot start: missing scriptText or selectedStyleId", {
        hasScriptText: !!scriptText.trim(),
        hasSelectedStyleId: !!selectedStyleId,
      });
      return;
    }

    try {
      setIsGenerating(true);
      setStep("generating");

      // Create project and get projectId
      console.log("[OnboardingPage] Creating project...", {
        scriptLength: scriptText.length,
        styleId: selectedStyleId,
        settings: projectSettings,
      });
      setGenerationProgress("Creating project...");
      const newProjectId = await createProject("New Project", scriptText, selectedStyleId, projectSettings);
      setCreatedProjectId(newProjectId);
      // Set projectId in context so StoryboardView can access it
      setProjectId(newProjectId);
      console.log("[OnboardingPage] Project created", { projectId: newProjectId });

      // Generate storyboard
      console.log("[OnboardingPage] Starting storyboard generation...");
      setGenerationProgress("Generating storyboard scenes...");
      await generateStoryboard(newProjectId, scriptText, selectedStyleId);
      console.log("[OnboardingPage] Storyboard generation initiated");
      setGenerationProgress("Waiting for scenes...");

      // Start audio generation immediately after storyboard generation starts
      // This runs in parallel with image generation
      try {
        console.log("[OnboardingPage] Starting project audio generation in parallel...");
        setGenerationProgress("Generating audio track...");
        // Generate audio asynchronously - don't wait for it to complete
        // Use the generateProjectAudio from useProject hook
        generateProjectAudio(newProjectId, scriptText).catch((audioError: any) => {
          console.warn("[OnboardingPage] Audio generation error (non-blocking):", audioError);
          // Audio generation failure doesn't block the flow
        });
      } catch (audioError: any) {
        console.warn("[OnboardingPage] Failed to start audio generation:", audioError);
        // Continue even if audio generation fails to start
      }

      // Note: Transition to result happens automatically via useEffect when scenes are created
      // No need for setTimeout - we wait for real-time updates from Convex
    } catch (error: any) {
      console.error("[OnboardingPage] Error in handleStart:", error);
      
      // Reset state on error
      setIsGenerating(false);
      // Stay on generating step to show error, don't change step immediately
      
      // Better error message handling
      let errorMessage = "Unknown error occurred";
      if (error?.message) {
        errorMessage = error.message;
        // If it's about API key, provide helpful guidance
        if (error.message.includes("OPENROUTER_API_KEY")) {
          errorMessage = 
            "API key not configured. " +
            "Please add OPENROUTER_API_KEY in Convex Dashboard → Settings → Environment Variables.";
        }
      }
      
      // Show error but don't redirect - stay on current page
      alert(`Error generating storyboard: ${errorMessage}. Please try again.`);
      
      // Go back to style selection after showing error
      setStep("style");
    }
  };

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-8">
      <div className="max-w-4xl mx-auto">
        {/* Render StoryboardView when we have result step and projectId */}
        {step === "result" && createdProjectId ? (
          <div className="min-h-screen">
            <StoryboardView projectId={createdProjectId} />
          </div>
        ) : (
          <>
            <div className="text-center mb-8">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1"></div>
                <div className="flex-1 text-center">
                  <h1 className="text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
                    Arlee AI
                  </h1>
                  <p className="text-xl text-[hsl(var(--foreground))]/70 mb-8">
                    Transform your script into a complete storyboard with AI
                  </p>
                </div>
                <div className="flex-1 flex justify-end">
                  <button
                    onClick={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      setShowSettings(!showSettings);
                    }}
                    className="p-2 rounded-lg hover:bg-[hsl(var(--muted))] transition-colors"
                    title="Project Settings"
                    type="button"
                  >
                    <svg className="w-6 h-6 text-[hsl(var(--foreground))]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </button>
                </div>
              </div>
              {step !== "result" && <ProgressBar currentStep={step} />}
              
              {/* Settings Panel */}
              {showSettings && (
                <div className="mt-6 card p-6 text-left">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-[hsl(var(--foreground))]">Project Settings</h3>
                    <button
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        setShowSettings(false);
                      }}
                      className="text-[hsl(var(--foreground))]/70 hover:text-[hsl(var(--foreground))]"
                      type="button"
                    >
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Language */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                        Language
                      </label>
                      <select
                        value={projectSettings.language}
                        onChange={(e) => setProjectSettings({ ...projectSettings, language: e.target.value })}
                        className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                      >
                        <option value="en">English</option>
                        <option value="ru">Russian</option>
                        <option value="es">Spanish</option>
                        <option value="fr">French</option>
                        <option value="de">German</option>
                        <option value="zh">Chinese</option>
                      </select>
                    </div>

                    {/* Pacing */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                        Pacing
                      </label>
                      <select
                        value={projectSettings.pacing}
                        onChange={(e) => setProjectSettings({ ...projectSettings, pacing: e.target.value as any })}
                        className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                      >
                        <option value="dynamic">Dynamic (1-3s)</option>
                        <option value="moderate">Moderate (3-7s)</option>
                        <option value="slow">Slow (7-20s)</option>
                        <option value="custom">Custom</option>
                      </select>
                    </div>

                    {/* Target Duration */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                        Target Duration (seconds)
                      </label>
                      <input
                        type="number"
                        min="10"
                        max="3600"
                        value={projectSettings.target_duration}
                        onChange={(e) => setProjectSettings({ ...projectSettings, target_duration: parseInt(e.target.value) || 60 })}
                        className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                      />
                    </div>

                    {/* Framing */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                        Framing (Aspect Ratio)
                      </label>
                      <select
                        value={projectSettings.framing}
                        onChange={(e) => setProjectSettings({ ...projectSettings, framing: e.target.value })}
                        className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                      >
                        <option value="16:9">16:9 (Widescreen)</option>
                        <option value="9:16">9:16 (Vertical)</option>
                        <option value="1:1">1:1 (Square)</option>
                        <option value="4:3">4:3 (Classic)</option>
                      </select>
                    </div>

                    {/* Audience */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                        Target Audience
                      </label>
                      <input
                        type="text"
                        value={projectSettings.audience}
                        onChange={(e) => setProjectSettings({ ...projectSettings, audience: e.target.value })}
                        placeholder="general"
                        className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                      />
                    </div>

                    {/* Words Per Minute */}
                    <div>
                      <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                        Words Per Minute (for TTS)
                      </label>
                      <input
                        type="number"
                        min="100"
                        max="200"
                        value={projectSettings.wordsPerMinute}
                        onChange={(e) => setProjectSettings({ ...projectSettings, wordsPerMinute: parseInt(e.target.value) || 140 })}
                        className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                      />
                    </div>
                  </div>
                </div>
              )}
            </div>

            {step === "script" && (
          <div className="card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold text-lg">
                1
              </div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Enter Your Script</h2>
            </div>

            {/* AI Script Generation */}
            <div className="mb-6 p-4 bg-[hsl(var(--muted))] rounded-lg border border-[hsl(var(--border))]">
              <h3 className="text-sm font-medium mb-2 text-[hsl(var(--foreground))]">Generate Script with AI</h3>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={scriptIdea}
                  onChange={(e) => setScriptIdea(e.target.value)}
                  placeholder="Enter your idea for the video script..."
                  className="flex-1 px-4 py-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent"
                  disabled={isGeneratingScript}
                />
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    if (!scriptIdea.trim()) {
                      alert("Please enter an idea for script generation");
                      return;
                    }
                    try {
                      setIsGeneratingScript(true);
                      const result = await generateScript(scriptIdea.trim(), {
                        language: "en",
                        duration: 1,
                        style: "dynamic",
                        targetAudience: "general",
                      });
                      setScriptText(result.narration_text);
                      setScriptIdea("");
                    } catch (error: any) {
                      console.error("[OnboardingPage] Script generation error:", error);
                      alert(`Failed to generate script: ${error.message || "Unknown error"}`);
                    } finally {
                      setIsGeneratingScript(false);
                    }
                  }}
                  disabled={isGeneratingScript || !scriptIdea.trim()}
                  className="btn-primary px-6 whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  type="button"
                >
                  {isGeneratingScript ? "Generating..." : "Generate Script"}
                </button>
              </div>
            </div>

            {/* Script Textarea */}
            <div className="mb-2">
              <label className="text-sm font-medium text-[hsl(var(--foreground))] mb-2 block">Or enter your script manually:</label>
              <textarea
                value={scriptText}
                onChange={(e) => {
                  const value = e.target.value;
                  console.log("[OnboardingPage] Textarea onChange", { valueLength: value.length, trimmed: value.trim().length });
                  setScriptText(value);
                }}
                onInput={(e) => {
                  // Fallback for browsers that don't trigger onChange properly
                  const value = (e.target as HTMLTextAreaElement).value;
                  if (value !== scriptText) {
                    console.log("[OnboardingPage] Textarea onInput fallback", { valueLength: value.length });
                    setScriptText(value);
                  }
                }}
                placeholder="Enter your video script here...&#10;&#10;Example: 'A young entrepreneur walks through a bustling city street, looking determined and focused. They enter a modern office building and sit down at a desk, ready to start their day.'"
                className="w-full h-64 p-4 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))] focus:ring-2 focus:ring-[hsl(var(--primary))] focus:border-transparent resize-none transition-all"
              />
            </div>
            <div className="mt-2 mb-6 text-sm text-[hsl(var(--foreground))]/60">
              {scriptText.trim().length === 0 ? (
                <span className="text-red-500">Please enter your script to continue</span>
              ) : (
                <span className="text-green-600">✓ {scriptText.trim().length} characters entered</span>
              )}
            </div>
            <button
              onClick={() => {
                const trimmed = scriptText.trim();
                console.log("[OnboardingPage] Continue button clicked", { 
                  scriptText, 
                  scriptTextLength: scriptText.length,
                  trimmed, 
                  trimmedLength: trimmed.length,
                  willProceed: !!trimmed
                });
                if (trimmed) {
                  setStep("style");
                  console.log("[OnboardingPage] Step changed to 'style'");
                } else {
                  console.warn("[OnboardingPage] Button clicked but scriptText is empty");
                  alert("Please enter your script before continuing.");
                }
              }}
              disabled={!scriptText.trim()}
              className={`btn-primary mt-6 w-full ${!scriptText.trim() ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              type="button"
            >
              Continue to Style Selection
            </button>
          </div>
            )}

            {step === "style" && (
          <div className="card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold text-lg">
                2
              </div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Choose a Style</h2>
            </div>
            
            {/* Script preview with edit option */}
            <div className="mb-6 p-4 bg-[hsl(var(--muted))] rounded-lg border border-[hsl(var(--border))]">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-[hsl(var(--foreground))]/70">Your Script:</span>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setStep("script");
                  }}
                  className="text-xs text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-dark))] underline"
                  type="button"
                >
                  Edit
                </button>
              </div>
              <p className="text-sm text-[hsl(var(--foreground))]/90 line-clamp-3">
                {scriptText.trim() || "No script entered"}
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {styles.map((style) => (
                <button
                  key={style._id}
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    setSelectedStyleId(style._id);
                  }}
                  className={`card p-0 overflow-hidden text-left transition-all duration-200 ${
                    selectedStyleId === style._id
                      ? "ring-2 ring-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 shadow-elevation-2"
                      : "hover:shadow-elevation-2 hover:border-[hsl(var(--primary))]/30"
                  }`}
                  type="button"
                >
                  {style.imageUrl && (
                    <div className="w-full h-32 overflow-hidden bg-[hsl(var(--muted))]">
                      <img
                        src={style.imageUrl}
                        alt={style.name}
                        className="w-full h-full object-cover"
                        loading="lazy"
                      />
                    </div>
                  )}
                  <div className="p-4">
                    <h3 className="font-bold text-lg mb-2 text-[hsl(var(--foreground))]">{style.name}</h3>
                    <p className="text-sm text-[hsl(var(--foreground))]/70">{style.description}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-4">
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setStep("script");
                }}
                className="btn-secondary flex-1"
                type="button"
              >
                Back
              </button>
              <button
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleStart();
                }}
                disabled={!selectedStyleId || isGenerating}
                className="btn-primary flex-1"
                type="button"
              >
                {isGenerating ? "Generating..." : "Generate Storyboard"}
              </button>
            </div>
          </div>
            )}

            {step === "generating" && (
          <div className="card p-12 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-4 border-[hsl(var(--primary))] border-t-transparent mx-auto mb-6"></div>
            <h2 className="text-2xl font-semibold mb-2 text-[hsl(var(--foreground))]">Generating Your Storyboard...</h2>
            {generationProgress && (
              <p className="text-[hsl(var(--primary))] font-medium mb-4">{generationProgress}</p>
            )}
            <p className="text-[hsl(var(--foreground))]/70 mb-6">
              AI is creating scenes, images, and audio. This may take a minute.
            </p>
            
            {/* Progress indicators */}
            {createdProjectId && scenes.length > 0 && (
              <div className="mt-6 space-y-2">
                <div className="flex items-center justify-center gap-2 text-sm text-[hsl(var(--foreground))]/70">
                  <span className={`w-2 h-2 rounded-full ${scenes.length > 0 ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                  <span>Scenes created ({scenes.length})</span>
                </div>
                <div className="flex items-center justify-center gap-2 text-sm text-[hsl(var(--foreground))]/70">
                  <span className={`w-2 h-2 rounded-full ${scenes.filter(s => s.imageUrl).length === scenes.length ? 'bg-green-500' : 'bg-gray-300 animate-pulse'}`}></span>
                  <span>Images ({scenes.filter(s => s.imageUrl).length}/{scenes.length})</span>
                </div>
              </div>
            )}
          </div>
        )}
          </>
        )}
      </div>
    </div>
  );
}



