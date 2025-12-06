"use client";

import { useState, useEffect } from "react";
import { useProject } from "@/context/ProjectContext";
import { Id } from "../../../../convex/_generated/dataModel";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import StoryboardView from "@/components/StoryboardView";

type Step = "script" | "style" | "generating" | "result";

export default function OnboardingPage() {
  const { styles, createProject, generateStoryboard, isLoading, setProjectId } = useProject();
  const [step, setStep] = useState<Step>("script");
  const [scriptText, setScriptText] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<Id<"styles"> | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [createdProjectId, setCreatedProjectId] = useState<Id<"projects"> | null>(null);

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
        setStep("result");
        setIsGenerating(false);
      } catch (error) {
        console.error("[OnboardingPage] Error transitioning to result:", error);
        // Don't redirect, stay on generating step
        setIsGenerating(false);
      }
    }
  }, [step, createdProjectId, scenes.length, setProjectId]);

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
      });
      const newProjectId = await createProject("New Project", scriptText, selectedStyleId);
      setCreatedProjectId(newProjectId);
      // Set projectId in context so StoryboardView can access it
      setProjectId(newProjectId);
      console.log("[OnboardingPage] Project created", { projectId: newProjectId });

      // Generate storyboard
      console.log("[OnboardingPage] Starting storyboard generation...");
      await generateStoryboard(newProjectId, scriptText, selectedStyleId);
      console.log("[OnboardingPage] Storyboard generation initiated");

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

  // Render StoryboardView when we have result step and projectId
  if (step === "result" && createdProjectId) {
    console.log("[OnboardingPage] Rendering StoryboardView", { projectId: createdProjectId });
    try {
      return <StoryboardView projectId={createdProjectId} />;
    } catch (error) {
      console.error("[OnboardingPage] Error rendering StoryboardView:", error);
      // Fallback: show error message instead of redirecting
      return (
        <div className="min-h-screen bg-[hsl(var(--background))] p-8">
          <div className="max-w-4xl mx-auto">
            <div className="card p-8 text-center">
              <h2 className="text-2xl font-semibold mb-4 text-red-600">Error Loading Storyboard</h2>
              <p className="text-[hsl(var(--foreground))]/70 mb-6">{error instanceof Error ? error.message : "Unknown error"}</p>
              <button
                onClick={() => {
                  setStep("script");
                  setCreatedProjectId(null);
                  setProjectId(null);
                }}
                className="btn-primary"
              >
                Start Over
              </button>
            </div>
          </div>
        </div>
      );
    }
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-8">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 text-[hsl(var(--foreground))]">
            Arlee AI
          </h1>
          <p className="text-xl text-[hsl(var(--foreground))]/70">
            Transform your script into a complete storyboard with AI
          </p>
        </div>

        {step === "script" && (
          <div className="card p-8">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-[hsl(var(--primary))] text-white flex items-center justify-center font-bold text-lg">
                1
              </div>
              <h2 className="text-2xl font-semibold text-[hsl(var(--foreground))]">Enter Your Script</h2>
            </div>
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
            <div className="mt-4 text-sm text-[hsl(var(--foreground))]/60">
              {scriptText.trim().length === 0 ? (
                <span className="text-red-500">Please enter your script to continue</span>
              ) : (
                <span className="text-green-600">✓ {scriptText.trim().length} characters entered</span>
              )}
            </div>
            <button
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
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
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
              {styles.map((style) => (
                <button
                  key={style._id}
                  onClick={() => setSelectedStyleId(style._id)}
                  className={`card p-0 overflow-hidden text-left transition-all duration-200 ${
                    selectedStyleId === style._id
                      ? "ring-2 ring-[hsl(var(--primary))] bg-[hsl(var(--primary))]/5 shadow-elevation-2"
                      : "hover:shadow-elevation-2 hover:border-[hsl(var(--primary))]/30"
                  }`}
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
                onClick={() => setStep("script")}
                className="btn-secondary flex-1"
              >
                Back
              </button>
              <button
                onClick={handleStart}
                disabled={!selectedStyleId || isGenerating}
                className="btn-primary flex-1"
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
            <p className="text-[hsl(var(--foreground))]/70">AI is creating scenes, images, and audio. This may take a minute.</p>
          </div>
        )}
      </div>
    </div>
  );
}



