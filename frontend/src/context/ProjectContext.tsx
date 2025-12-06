"use client";

import { createContext, useContext, useState, ReactNode } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { generateTTS } from "@/lib/services/elevenlabs";

interface ProjectContextType {
  projectId: Id<"projects"> | null;
  project: any;
  scenes: any[];
  styles: any[];
  isLoading: boolean;
  createProject: (name: string, scenarioText: string, styleId: Id<"styles">) => Promise<Id<"projects">>;
  generateStoryboard: (projectId: Id<"projects">, scenarioText: string, styleId: Id<"styles">) => Promise<void>;
  generateImage: (sceneId: Id<"scenes">, prompt: string) => Promise<void>;
  generateAudio: (sceneId: Id<"scenes">, text: string) => Promise<void>;
  setProjectId: (id: Id<"projects"> | null) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(null);

  // Queries
  const styles = useQuery(api.functions.styles.getPublicStyles) ?? [];
  const project = useQuery(
    api.functions.projects.getProjectById,
    projectId ? { projectId } : "skip"
  );
  const scenes = useQuery(
    api.functions.scenes.getScenesByProject,
    projectId ? { projectId } : "skip"
  ) ?? [];

  // Mutations
  const createProjectMutation = useMutation(api.functions.projects.createProject);
  const createEventMutation = useMutation(api.functions.generationEvents.createEvent);
  const updateEventMutation = useMutation(api.functions.generationEvents.updateEvent);
  const generateAudioUploadUrlMutation = useMutation(api.functions.scenes.generateAudioUploadUrl);
  const updateSceneAudioFromStorageMutation = useMutation(api.functions.scenes.updateSceneAudioFromStorage);

  // Actions
  const generateStoryboardAction = useAction(api.functions.storyboard.generateStoryboard);
  const generateImageAction = useAction(api.functions.images.generateImage);

  const createProject = async (
    name: string,
    scenarioText: string,
    styleId: Id<"styles">
  ): Promise<Id<"projects">> => {
    // Add default settings for MVP
    const defaultSettings = {
      language: "ru",
      pacing: "moderate" as const,
      target_duration: 60,
      min_sec: 2,
      max_sec: 10,
      framing: "16:9",
      audience: "general",
      wordsPerMinute: 140,
    };
    
    const newProjectId = await createProjectMutation({
      name,
      scenarioText,
      styleId,
      settings: defaultSettings,
    });
    setProjectId(newProjectId);
    return newProjectId;
  };

  const generateStoryboard = async (
    projectId: Id<"projects">,
    scenarioText: string,
    styleId: Id<"styles">
  ) => {
    await generateStoryboardAction({
      projectId,
      scenarioText,
      styleId,
    });
  };

  const generateImage = async (sceneId: Id<"scenes">, prompt: string) => {
    await generateImageAction({
      sceneId,
      prompt,
    });
  };

  const generateAudio = async (sceneId: Id<"scenes">, text: string) => {
    // Create generation event before starting
    const eventId = await createEventMutation({
      sceneId,
      type: "audio",
    });

    try {
      // Update to processing
      await updateEventMutation({
        eventId,
        status: "processing",
      });

      // Generate audio on client-side using ElevenLabs API
      console.log("[generateAudio] Generating TTS on client-side...");
      const audioBlob = await generateTTS({ text });
      
      // Get upload URL from Convex
      console.log("[generateAudio] Getting upload URL from Convex...");
      const uploadUrl = await generateAudioUploadUrlMutation();
      
      // Upload audio file directly to Convex Storage
      console.log("[generateAudio] Uploading audio to Convex Storage...");
      const uploadResponse = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type": audioBlob.type || "audio/mpeg",
        },
        body: audioBlob,
      });
      
      if (!uploadResponse.ok) {
        const errorText = await uploadResponse.text();
        throw new Error(`Failed to upload to Convex Storage: ${errorText}`);
      }
      
      // Convex Storage returns storageId - could be plain text or JSON
      const responseText = await uploadResponse.text();
      if (!responseText) {
        throw new Error("No storageId returned from upload");
      }
      
      // Parse storageId - handle both JSON and plain text formats
      let storageId: Id<"_storage">;
      try {
        // Try parsing as JSON first (in case Convex returns JSON)
        const jsonResponse = JSON.parse(responseText);
        storageId = (jsonResponse.storageId || jsonResponse.id || responseText) as Id<"_storage">;
      } catch {
        // If not JSON, use as plain text ID
        storageId = responseText.trim() as Id<"_storage">;
      }
      
      // Update scene with audio URL from storage
      const result = await updateSceneAudioFromStorageMutation({
        sceneId,
        storageId,
      });
      
      // Update event to completed
      await updateEventMutation({
        eventId,
        status: "completed",
        resultUrl: result.audioUrl,
      });
      
      console.log("[generateAudio] Audio uploaded successfully");
    } catch (error: any) {
      console.error("[generateAudio] Error:", error);
      // Update event with error
      await updateEventMutation({
        eventId,
        status: "failed",
        errorMessage: error.message || "Unknown error",
      });
      throw error;
    }
  };

  return (
    <ProjectContext.Provider
      value={{
        projectId,
        project,
        scenes,
        styles,
        isLoading: styles === undefined || (projectId !== null && project === undefined),
        createProject,
        generateStoryboard,
        generateImage,
        generateAudio,
        setProjectId,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (context === undefined) {
    throw new Error("useProject must be used within a ProjectProvider");
  }
  return context;
}



