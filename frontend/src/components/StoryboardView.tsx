"use client";

import { useEffect, useState, useRef } from "react";
import { useProject } from "@/context/ProjectContext";
import { Id } from "../../convex/_generated/dataModel";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { IMGVideoEditor } from "./IMGVideoEditor";

interface StoryboardViewProps {
  projectId: Id<"projects">;
}

interface AudioSectionProps {
  scene: {
    _id: Id<"scenes">;
    audioUrl?: string;
    scriptContent?: string;
  };
  generateAudio: (sceneId: Id<"scenes">, text: string) => Promise<void>;
  onRetry?: (sceneId: Id<"scenes">) => void;
}

function AudioSection({ scene, generateAudio, onRetry }: AudioSectionProps) {
  const audioEvents = useQuery(api.functions.generationEvents.getEventsByScene, { sceneId: scene._id }) ?? [];
  const failedAudioEvent = audioEvents.find(e => e.type === "audio" && e.status === "failed");
  const processingAudioEvent = audioEvents.find(e => e.type === "audio" && (e.status === "pending" || e.status === "processing"));

  return (
    <div>
      <h4 className="font-semibold mb-2 text-[hsl(var(--foreground))]">Audio</h4>
      {scene.audioUrl ? (
        <div className="card p-4">
          <audio controls className="w-full">
            <source src={scene.audioUrl} type="audio/mpeg" />
            Your browser does not support the audio element.
          </audio>
        </div>
      ) : (
        <div className="w-full h-48 bg-[hsl(var(--muted))] rounded-lg border border-[hsl(var(--border))] flex items-center justify-center">
          <div className="text-center px-4">
            {scene.scriptContent ? (
              <>
                {failedAudioEvent ? (
                  <>
                    <div className="text-red-500 mb-2">
                      <svg className="w-8 h-8 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <p className="text-sm text-red-500 mb-2 font-semibold">Audio generation failed</p>
                    <p className="text-xs text-[hsl(var(--foreground))]/70 mb-3 max-w-md">
                      {failedAudioEvent.errorMessage || "Unknown error occurred"}
                    </p>
                    <button
                      onClick={() => {
                        if (onRetry) onRetry(scene._id);
                        generateAudio(scene._id, scene.scriptContent!).catch(console.error);
                      }}
                      className="text-xs text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-dark))] underline"
                    >
                      Retry
                    </button>
                  </>
                ) : processingAudioEvent ? (
                  <>
                    <div className="animate-spin rounded-full h-8 w-8 border-2 border-[hsl(var(--primary))] border-t-transparent mx-auto mb-2"></div>
                    <p className="text-sm text-[hsl(var(--foreground))]/70 mb-2">Generating audio...</p>
                    <button
                      onClick={() => {
                        if (onRetry) onRetry(scene._id);
                        generateAudio(scene._id, scene.scriptContent!).catch(console.error);
                      }}
                      className="text-xs text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-dark))] underline"
                    >
                      Retry
                    </button>
                  </>
                ) : (
                  <>
                    <p className="text-sm text-[hsl(var(--foreground))]/70 mb-2">Ready to generate audio</p>
                    <button
                      onClick={() => generateAudio(scene._id, scene.scriptContent!).catch(console.error)}
                      className="text-xs text-[hsl(var(--primary))] hover:text-[hsl(var(--primary-dark))] underline"
                    >
                      Generate Audio
                    </button>
                  </>
                )}
              </>
            ) : (
              <p className="text-sm text-[hsl(var(--foreground))]/50">No script content</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function StoryboardView({ projectId }: StoryboardViewProps) {
  const { generateImage, generateAudio } = useProject();
  const [activeTab, setActiveTab] = useState<"scenes" | "timeline" | "settings">("scenes");
  const videoEditorRef = useRef<any>(null);
  const [showSettingsForm, setShowSettingsForm] = useState(false);
  
  // Get project and scenes
  const project = useQuery(api.functions.projects.getProjectById, { projectId });
  const scenes = useQuery(api.functions.scenes.getScenesByProject, { projectId }) ?? [];
  
  // Settings form state
  const [settings, setSettings] = useState({
    language: project?.settings?.language || "ru",
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
  }, [project]);

  // Mutation for updating settings
  const updateSettings = useMutation(api.functions.projects.updateProjectSettings);

  // Track which scenes are currently generating to prevent duplicates
  const generatingImagesRef = useRef<Set<Id<"scenes">>>(new Set());
  const generatingAudioRef = useRef<Set<Id<"scenes">>>(new Set());
  // Track scenes that failed audio generation to prevent infinite retries
  const failedAudioScenesRef = useRef<Set<Id<"scenes">>>(new Set());

  // Auto-generate images and audio for scenes that don't have them
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
      
      // Generate audio if needed and not already generating (separate tracking)
      // Skip if audio generation failed before (user can manually retry)
      if (
        !scene.audioUrl && 
        scene.scriptContent && 
        !generatingAudioRef.current.has(scene._id) &&
        !failedAudioScenesRef.current.has(scene._id)
      ) {
        generatingAudioRef.current.add(scene._id);
        console.log("[StoryboardView] Auto-generating audio for scene", scene._id);
        generateAudio(scene._id, scene.scriptContent)
          .catch((error) => {
            console.error("[StoryboardView] Error generating audio:", error);
            // Mark as failed to prevent infinite retries
            failedAudioScenesRef.current.add(scene._id);
          })
          .finally(() => {
            generatingAudioRef.current.delete(scene._id);
          });
      }
    });
  }, [scenes, generateImage, generateAudio]); // Removed activeTab from dependencies

  // Track if timeline was already populated to prevent duplicate calls
  const timelinePopulatedRef = useRef<string>("");

  // Add images to timeline when switching to timeline tab or when images are ready
  useEffect(() => {
    if (activeTab === "timeline" && videoEditorRef.current?.addAssetsToTimeline && scenes.length > 0) {
      // Wait a bit for editor to be fully ready
      const timer = setTimeout(() => {
        // Use scenes from useQuery (automatically updated via real-time)
        const scenesWithImages = scenes
          .filter(s => s.imageUrl)
          .map(s => ({
            imageUrl: s.imageUrl!,
            orderIndex: s.orderIndex,
          }));
        
        // Create a key from all image URLs to detect changes
        const timelineKey = scenesWithImages.map(s => `${s.orderIndex}:${s.imageUrl}`).join('|');
        
        // Only populate if images changed (different key)
        if (scenesWithImages.length > 0 && timelinePopulatedRef.current !== timelineKey) {
          timelinePopulatedRef.current = timelineKey;
          console.log("[StoryboardView] Populating timeline with", scenesWithImages.length, "images");
          videoEditorRef.current?.addAssetsToTimeline(scenesWithImages).catch(console.error);
        }
      }, 2000);

      return () => clearTimeout(timer);
    }
  }, [activeTab, scenes]); // scenes from useQuery automatically updates, removed videoEditorRef

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
          <div className="card p-4 mb-6">
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
                  <option value="ru">Russian</option>
                  <option value="en">English</option>
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

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Image */}
                    <div>
                      <h4 className="font-semibold mb-2 text-[hsl(var(--foreground))]">Image</h4>
                      {scene.imageUrl ? (
                        <img
                          src={scene.imageUrl}
                          alt={scene.name}
                          className="w-full h-48 object-cover rounded-lg border border-[hsl(var(--border))] shadow-elevation-1"
                        />
                      ) : (
                        <div className="w-full h-48 bg-[hsl(var(--muted))] rounded-lg border border-[hsl(var(--border))] flex items-center justify-center">
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

                    {/* Audio */}
                    <AudioSection 
                      scene={scene} 
                      generateAudio={generateAudio}
                      onRetry={(sceneId) => {
                        // Clear failed flag when user manually retries
                        failedAudioScenesRef.current.delete(sceneId);
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        )}

        <div className="mt-8 text-center">
          <button
            onClick={() => window.location.href = "/onboarding"}
            className="btn-primary"
          >
            Create New Storyboard
          </button>
        </div>
      </div>
    </div>
  );
}



