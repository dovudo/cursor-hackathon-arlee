"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useProject } from "@/context/ProjectContext";
import { Id } from "../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { IMGVideoEditor } from "./IMGVideoEditor";

interface StoryboardViewProps {
  projectId: Id<"projects">;
}

// AudioSection removed - we use single project-level audio track, not per-scene

export default function StoryboardView({ projectId }: StoryboardViewProps) {
  const router = useRouter();
  const { generateImage, generateProjectAudio, setProjectId } = useProject();
  const [activeTab, setActiveTab] = useState<"scenes" | "timeline" | "settings">("scenes");
  const videoEditorRef = useRef<any>(null);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  const [isGeneratingProjectAudio, setIsGeneratingProjectAudio] = useState(false);
  
  // Get project and scenes
  const project = useQuery(api.functions.projects.getProjectById, { projectId });
  const scenes = useQuery(api.functions.scenes.getScenesByProject, { projectId }) ?? [];
  
  // Settings form state
  const [settings, setSettings] = useState({
    language: project?.settings?.language || "en",
    pacing: project?.settings?.pacing || "moderate",
    target_duration: project?.settings?.target_duration || 60,
    min_sec: project?.settings?.min_sec || 2,
    max_sec: project?.settings?.max_sec || 10,
    framing: project?.settings?.framing || "16:9",
    audience: project?.settings?.audience || "general",
    wordsPerMinute: project?.settings?.wordsPerMinute || 140,
  });

  // Update settings when project loads
  useEffect(() => {
    if (project?.settings) {
      setSettings({
        language: project.settings.language || "en",
        pacing: project.settings.pacing || "moderate",
        target_duration: project.settings.target_duration || 60,
        min_sec: project.settings.min_sec || 2,
        max_sec: project.settings.max_sec || 10,
        framing: project.settings.framing || "16:9",
        audience: project.settings.audience || "general",
        wordsPerMinute: project.settings.wordsPerMinute || 140,
      });
    }
  }, [project]);

  // Mutation for updating settings
  const updateSettings = useMutation(api.functions.projects.updateProjectSettings);

  // Track which scenes are currently generating to prevent duplicates
  const generatingImagesRef = useRef<Set<Id<"scenes">>>(new Set());

  // Auto-generate images for scenes that don't have them
  // NOTE: Audio is generated at project level, not per scene
  useEffect(() => {
    scenes.forEach((scene) => {
      // Generate image if needed and not already generating
      if (!scene.imageUrl && scene.imagePrompt && !generatingImagesRef.current.has(scene._id)) {
        generatingImagesRef.current.add(scene._id);
        console.log("[StoryboardView] Auto-generating image for scene", scene._id);
        generateImage(scene._id, scene.imagePrompt)
          .catch((error) => {
            console.error("[StoryboardView] Error generating image:", error);
          })
          .finally(() => {
            generatingImagesRef.current.delete(scene._id);
          });
      }
    });
  }, [scenes, generateImage]);

  // Track if timeline was already populated to prevent duplicate calls
  const timelinePopulatedRef = useRef<string>("");

  // Function to add assets to timeline (can be called manually or automatically)
  const handleAddToTimeline = async () => {
    if (!videoEditorRef.current?.addAssetsToTimeline || scenes.length === 0 || !project) {
      console.warn("[StoryboardView] Cannot add to timeline: missing editor, scenes, or project");
      return;
    }

    // Use scenes from useQuery (automatically updated via real-time)
    const scenesWithImages = scenes
      .filter(s => s.imageUrl)
      .map(s => ({
        imageUrl: s.imageUrl!,
        orderIndex: s.orderIndex,
      }));
    
    if (scenesWithImages.length === 0) {
      alert("No images available to add to timeline. Please generate images for scenes first.");
      return;
    }

    try {
      console.log("[StoryboardView] Adding to timeline:", scenesWithImages.length, "images and audio:", project.audioUrl || "none");
      await videoEditorRef.current.addAssetsToTimeline(scenesWithImages, project.audioUrl || undefined);
      
      // Update the populated ref to track what was added
      const timelineKey = `${scenesWithImages.map(s => `${s.orderIndex}:${s.imageUrl}`).join('|')}|audio:${project.audioUrl || 'none'}`;
      timelinePopulatedRef.current = timelineKey;
    } catch (error) {
      console.error("[StoryboardView] Error adding to timeline:", error);
      alert(`Failed to add assets to timeline: ${error instanceof Error ? error.message : "Unknown error"}`);
    }
  };

  // Add images and audio to timeline when switching to timeline tab (auto-populate)
  useEffect(() => {
    if (activeTab === "timeline" && videoEditorRef.current?.addAssetsToTimeline && scenes.length > 0 && project) {
      // Wait a bit for editor to be fully ready
      const timer = setTimeout(() => {
        // Use scenes from useQuery (automatically updated via real-time)
        const scenesWithImages = scenes
          .filter(s => s.imageUrl)
          .map(s => ({
            imageUrl: s.imageUrl!,
            orderIndex: s.orderIndex,
          }));
        
        // Create a key from all image URLs and audio URL to detect changes
        const timelineKey = `${scenesWithImages.map(s => `${s.orderIndex}:${s.imageUrl}`).join('|')}|audio:${project.audioUrl || 'none'}`;
        
        // Only populate if assets changed (different key)
        if (scenesWithImages.length > 0 && timelinePopulatedRef.current !== timelineKey) {
          timelinePopulatedRef.current = timelineKey;
          console.log("[StoryboardView] Populating timeline with", scenesWithImages.length, "images and audio:", project.audioUrl || "none");
          videoEditorRef.current?.addAssetsToTimeline(scenesWithImages, project.audioUrl || undefined).catch(console.error);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [activeTab, scenes, project]); // scenes and project from useQuery automatically updates

  if (!scenes || scenes.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-lg shadow-lg p-8 text-center">
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-4"></div>
            <h2 className="text-2xl font-semibold mb-2">Loading Storyboard...</h2>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[hsl(var(--background))] p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2 text-[hsl(var(--foreground))]">Your Storyboard</h1>
          <p className="text-[hsl(var(--foreground))]/70">
            {scenes.length} scene{scenes.length !== 1 ? "s" : ""} generated
          </p>
        </div>

        {/* Tabs */}
        <div className="mb-6 border-b border-[hsl(var(--border))]">
          <div className="flex gap-4">
            <button
              onClick={() => setActiveTab("scenes")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "scenes"
                  ? "text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]"
                  : "text-[hsl(var(--foreground))]/60 hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Scenes
            </button>
            <button
              onClick={() => setActiveTab("timeline")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "timeline"
                  ? "text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]"
                  : "text-[hsl(var(--foreground))]/60 hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Timeline Editor
            </button>
            <button
              onClick={() => setActiveTab("settings")}
              className={`px-4 py-2 font-medium transition-colors ${
                activeTab === "settings"
                  ? "text-[hsl(var(--primary))] border-b-2 border-[hsl(var(--primary))]"
                  : "text-[hsl(var(--foreground))]/60 hover:text-[hsl(var(--foreground))]"
              }`}
            >
              Settings
            </button>
          </div>
        </div>

        {/* Timeline Tab */}
        {activeTab === "timeline" && (
          <div className="space-y-6">
            {/* Add to Timeline Button */}
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-[hsl(var(--foreground))]">Timeline Editor</h3>
                <button
                  onClick={handleAddToTimeline}
                  className="btn-primary"
                  disabled={scenes.filter(s => s.imageUrl).length === 0}
                >
                  Add to Timeline
                </button>
              </div>
              <p className="text-sm text-[hsl(var(--foreground))]/70">
                Click "Add to Timeline" to place all generated scenes and audio on the video timeline. 
                {scenes.filter(s => s.imageUrl).length === 0 && " Generate images for scenes first."}
              </p>
            </div>

            {/* Project Audio Track */}
            <div className="card p-6">
              <h3 className="text-xl font-bold mb-4 text-[hsl(var(--foreground))]">Project Audio Track</h3>
              {project?.audioUrl ? (
                <div className="space-y-4">
                  <audio controls className="w-full">
                    <source src={project.audioUrl} type="audio/mpeg" />
                    Your browser does not support the audio element.
                  </audio>
                  <p className="text-sm text-[hsl(var(--foreground))]/70">
                    This audio track will be used for all scenes in the video editor. Scenes will be placed according to STT timestamps.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-6 bg-[hsl(var(--muted))] rounded-lg border border-[hsl(var(--border))] text-center">
                    {isGeneratingProjectAudio ? (
                      <>
                        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent mx-auto mb-2"></div>
                        <p className="text-sm text-[hsl(var(--foreground))]/70">Generating project audio...</p>
                      </>
                    ) : (
                      <>
                        <p className="text-sm text-[hsl(var(--foreground))]/70 mb-4">
                          Generate a single audio track for the entire project from the script text.
                        </p>
                        <button
                          onClick={async () => {
                            if (!project?.scenarioText) {
                              alert("No script text available for audio generation");
                              return;
                            }
                            try {
                              setIsGeneratingProjectAudio(true);
                              await generateProjectAudio(projectId, project.scenarioText);
                            } catch (error: any) {
                              console.error("[StoryboardView] Error generating project audio:", error);
                              alert(`Failed to generate audio: ${error.message || "Unknown error"}`);
                            } finally {
                              setIsGeneratingProjectAudio(false);
                            }
                          }}
                          disabled={isGeneratingProjectAudio || !project?.scenarioText}
                          className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          Generate Project Audio
                        </button>
                      </>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Video Editor */}
            <div className="card p-4">
              <IMGVideoEditor
                ref={videoEditorRef}
                projectId={projectId}
                onExport={(blob) => {
                  console.log("Video exported:", blob);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement("a");
                  a.href = url;
                  a.download = "storyboard-video.mp4";
                  a.click();
                }}
                onSave={(data) => {
                  console.log("Timeline saved:", data);
                }}
                className="w-full"
              />
            </div>
          </div>
        )}

        {/* Settings Tab */}
        {activeTab === "settings" && (
          <div className="card p-8">
            <h2 className="text-2xl font-bold mb-6 text-[hsl(var(--foreground))]">Project Settings</h2>
            <div className="space-y-6">
              {/* Language */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                  Language
                </label>
                  <select
                    value={settings.language}
                    onChange={(e) => setSettings({ ...settings, language: e.target.value })}
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
                  value={settings.pacing}
                  onChange={(e) => setSettings({ ...settings, pacing: e.target.value as any })}
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
                  value={settings.target_duration}
                  onChange={(e) => setSettings({ ...settings, target_duration: parseInt(e.target.value) || 60 })}
                  className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                />
              </div>

              {/* Custom Pacing Range (if pacing is custom) */}
              {settings.pacing === "custom" && (
                <>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                      Min Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.min_sec}
                      onChange={(e) => setSettings({ ...settings, min_sec: parseInt(e.target.value) || 2 })}
                      className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                      Max Duration (seconds)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="60"
                      value={settings.max_sec}
                      onChange={(e) => setSettings({ ...settings, max_sec: parseInt(e.target.value) || 10 })}
                      className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                    />
                  </div>
                </>
              )}

              {/* Framing */}
              <div>
                <label className="block text-sm font-medium mb-2 text-[hsl(var(--foreground))]">
                  Framing (Aspect Ratio)
                </label>
                <select
                  value={settings.framing}
                  onChange={(e) => setSettings({ ...settings, framing: e.target.value })}
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
                  value={settings.audience}
                  onChange={(e) => setSettings({ ...settings, audience: e.target.value })}
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
                  value={settings.wordsPerMinute}
                  onChange={(e) => setSettings({ ...settings, wordsPerMinute: parseInt(e.target.value) || 140 })}
                  className="w-full p-2 border border-[hsl(var(--border))] rounded-lg bg-[hsl(var(--background))] text-[hsl(var(--foreground))]"
                />
              </div>

              {/* Save Button */}
              <div className="flex gap-4 pt-4">
                <button
                  onClick={async () => {
                    try {
                      await updateSettings({
                        projectId,
                        settings,
                      });
                      alert("Settings saved successfully!");
                    } catch (error: any) {
                      console.error("Error saving settings:", error);
                      alert(`Error saving settings: ${error.message}`);
                    }
                  }}
                  className="btn-primary flex-1"
                >
                  Save Settings
                </button>
                <button
                  onClick={() => {
                    if (project?.settings) {
                      setSettings({
                        language: project.settings.language || "ru",
                        pacing: project.settings.pacing || "moderate",
                        target_duration: project.settings.target_duration || 60,
                        min_sec: project.settings.min_sec || 2,
                        max_sec: project.settings.max_sec || 10,
                        framing: project.settings.framing || "16:9",
                        audience: project.settings.audience || "general",
                        wordsPerMinute: project.settings.wordsPerMinute || 140,
                      });
                    }
                  }}
                  className="btn-secondary flex-1"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Scenes Tab */}
        {activeTab === "scenes" && (
        <div className="space-y-8">
          {scenes.map((scene, index) => (
            <div
              key={scene._id}
              className="card p-6 mb-6 border-l-4 border-l-[hsl(var(--primary))]"
            >
              <div className="flex items-start gap-6">
                <div className="flex-shrink-0 w-12 h-12 bg-[hsl(var(--primary))] text-white rounded-full flex items-center justify-center font-bold text-lg shadow-elevation-2">
                  {index + 1}
                </div>

                <div className="flex-1">
                  <h3 className="text-2xl font-bold mb-3 text-[hsl(var(--foreground))]">{scene.name}</h3>
                  <p className="text-[hsl(var(--foreground))]/80 mb-4 leading-relaxed">{scene.scriptContent}</p>

                  {/* Image */}
                  <div>
                    <h4 className="font-semibold mb-2 text-[hsl(var(--foreground))]">Image</h4>
                    {scene.imageUrl ? (
                      <div className="w-full">
                        <img
                          src={scene.imageUrl}
                          alt={scene.name}
                          className="w-full max-h-[600px] object-contain rounded-lg border border-[hsl(var(--border))] shadow-elevation-1 bg-[hsl(var(--muted))]"
                        />
                      </div>
                    ) : (
                      <div className="w-full h-96 bg-[hsl(var(--muted))] rounded-lg border border-[hsl(var(--border))] flex items-center justify-center">
                        <div className="text-center">
                          {scene.imagePrompt ? (
                            <>
                              <div className="animate-spin rounded-full h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent mx-auto mb-2"></div>
                              <p className="text-sm text-[hsl(var(--foreground))]/70 mb-2">Generating image...</p>
                              <button
                                onClick={() => generateImage(scene._id, scene.imagePrompt!).catch(console.error)}
                                className="text-xs text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-dark))] underline"
                              >
                                Retry
                              </button>
                            </>
                          ) : (
                            <p className="text-sm text-[hsl(var(--foreground))]/50">No image prompt</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => {
              // Reset project state and navigate to onboarding
              setProjectId(null);
              router.push("/onboarding");
            }}
            className="btn-primary"
          >
            Create New Storyboard
          </button>
        </div>
      </div>
    </div>
  );
}



