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
  createProject: (name: string, scenarioText: string, styleId: Id<"styles">, settings?: {
    language?: string;
    pacing?: "dynamic" | "moderate" | "slow" | "custom";
    target_duration?: number;
    min_sec?: number;
    max_sec?: number;
    framing?: string;
    audience?: string;
    wordsPerMinute?: number;
  }) => Promise<Id<"projects">>;
  generateStoryboard: (projectId: Id<"projects">, scenarioText: string, styleId: Id<"styles">) => Promise<void>;
  generateScript: (idea: string, options?: { language?: string; duration?: number; style?: string; targetAudience?: string }) => Promise<{ narration_text: string; title?: string; language?: string }>;
  generateImage: (sceneId: Id<"scenes">, prompt: string) => Promise<void>;
  generateProjectAudio: (projectId: Id<"projects">, text: string) => Promise<void>;
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
  const generateAudioUploadUrlMutation = useMutation(api.functions.scenes.generateAudioUploadUrl);
  
  // Actions
  const updateProjectAudioFromStorageAction = useAction(api.functions.projects.updateProjectAudioFromStorage);

  // Actions
  const generateStoryboardAction = useAction(api.functions.storyboard.generateStoryboard);
  const generateScriptAction = useAction(api.functions.script.generateScript);
  const generateImageAction = useAction(api.functions.images.generateImage);

  const createProject = async (
    name: string,
    scenarioText: string,
    styleId: Id<"styles">,
    settings?: {
      language?: string;
      pacing?: "dynamic" | "moderate" | "slow" | "custom";
      target_duration?: number;
      min_sec?: number;
      max_sec?: number;
      framing?: string;
      audience?: string;
      wordsPerMinute?: number;
    }
  ): Promise<Id<"projects">> => {
    // Use provided settings or default settings for MVP
    const projectSettings = settings || {
      language: "en",
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
      settings: projectSettings,
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

  const generateScript = async (
    idea: string,
    options?: { language?: string; duration?: number; style?: string; targetAudience?: string }
  ) => {
    const result = await generateScriptAction({
      idea,
      language: options?.language,
      duration: options?.duration,
      targetWords: options?.duration ? Math.round(options.duration * 140) : undefined,
      style: options?.style,
      targetAudience: options?.targetAudience,
    });
    
    if (!result.success || !result.data) {
      throw new Error("Failed to generate script");
    }
    
    return result.data;
  };

  const generateImage = async (sceneId: Id<"scenes">, prompt: string) => {
    await generateImageAction({
      sceneId,
      prompt,
    });
  };

  // Generate single audio track for entire project (not per scene)
  const generateProjectAudio = async (projectId: Id<"projects">, text: string) => {
    try {
      // Generate audio on client-side using ElevenLabs API
      console.log("[generateProjectAudio] Generating TTS on client-side...");
      const audioBlob = await generateTTS({ text });
      
      // Get upload URL from Convex
      console.log("[generateProjectAudio] Getting upload URL from Convex...");
      const uploadUrl = await generateAudioUploadUrlMutation();
      
      // Upload audio file directly to Convex Storage
      console.log("[generateProjectAudio] Uploading audio to Convex Storage...");
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
      
      // Convex Storage returns storageId - could be plain text or JSON string
      const responseText = await uploadResponse.text();
      if (!responseText) {
        throw new Error("No storageId returned from upload");
      }
      
      // Parse storageId - Convex Storage may return JSON string or plain text
      let storageId: Id<"_storage">;
      try {
        let parsed: any = responseText.trim();
        
        // Handle double JSON encoding
        if (parsed.startsWith('"') && parsed.endsWith('"')) {
          parsed = JSON.parse(parsed);
        }
        
        if (typeof parsed === 'string' && (parsed.startsWith('{') || parsed.startsWith('"'))) {
          try {
            parsed = JSON.parse(parsed);
          } catch {
            // If second parse fails, use the string as-is
          }
        }
        
        if (typeof parsed === 'object' && parsed !== null) {
          storageId = (parsed.storageId || parsed.id || parsed) as Id<"_storage">;
        } else {
          storageId = parsed as Id<"_storage">;
        }
      } catch (error) {
        console.warn("[generateProjectAudio] Failed to parse storageId, using as-is:", responseText, error);
        storageId = responseText.trim() as Id<"_storage">;
      }
      
      if (!storageId) {
        throw new Error(`Invalid storageId format: ${responseText}`);
      }
      
      console.log("[generateProjectAudio] Parsed storageId:", storageId);
      
      // Update project with audio URL from storage (via action)
      const result = await updateProjectAudioFromStorageAction({
        projectId,
        storageId,
      });
      
      console.log("[generateProjectAudio] Project audio uploaded successfully");
    } catch (error: any) {
      console.error("[generateProjectAudio] Error:", error);
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
        generateScript,
        generateImage,
        generateProjectAudio,
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



