# 🚀 План разработки MVP

> **Время**: 6-7 часов | **Стратегия**: "Снизу вверх" | **Backend**: Convex

---

## 📋 Стратегия: "Снизу вверх"

**Принцип**: Сначала данные, потом логика, потом UI

**Почему**:
1. ✅ Раннее обнаружение проблем с данными
2. ✅ Типобезопасность с самого начала
3. ✅ Легче тестировать изолированные части
4. ✅ Меньше рефакторинга на поздних этапах

---

## 🎯 Этап 1: Схема данных (1 час)

### 1.1 Создать схему БД

**Файл**: `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  userProfiles: defineTable({
    email: v.string(),
    fullName: v.optional(v.string()),
    createdAt: v.number(),
  }).index("by_email", ["email"]),

  styles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    imageUrl: v.optional(v.string()),
    isPublic: v.boolean(),
    createdAt: v.number(),
  }).index("by_public", ["isPublic"]),

  projects: defineTable({
    userId: v.id("userProfiles"),
    name: v.string(),
    scenarioText: v.string(),
    styleId: v.id("styles"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  scenes: defineTable({
    projectId: v.id("projects"),
    orderIndex: v.number(),
    name: v.string(),
    scriptContent: v.string(),
    imagePrompt: v.optional(v.string()),
    imageUrl: v.optional(v.string()),
    audioUrl: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_project", ["projectId"])
    .index("by_project_order", ["projectId", "orderIndex"]),

  generationEvents: defineTable({
    sceneId: v.id("scenes"),
    type: v.union(v.literal("image"), v.literal("audio")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_scene", ["sceneId"])
    .index("by_scene_type", ["sceneId", "type"])
    .index("by_status", ["status"]),
});
```

**Чеклист**:
- [ ] Схема создана
- [ ] `convex dev` запущен
- [ ] Типы генерируются (`_generated/api.d.ts` существует)
- [ ] Нет ошибок в IDE

---

### 1.2 Seed данные (3 стиля)

**Файл**: `convex/functions/seed.ts`

```typescript
import { mutation } from "../_generated/server";

export const seedStyles = mutation({
  args: {},
  handler: async (ctx) => {
    const existing = await ctx.db.query("styles").collect();
    if (existing.length > 0) return { message: "Already seeded" };

    const styles = [
      {
        name: "Cinematic",
        description: "Cinematic style with dramatic lighting",
        prompt: "Cinematic style with dramatic lighting, film noir atmosphere, high contrast",
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Documentary",
        description: "Documentary style, realistic and natural",
        prompt: "Documentary style, realistic and natural lighting, authentic feel",
        isPublic: true,
        createdAt: Date.now(),
      },
      {
        name: "Minimalist",
        description: "Minimalist style, clean and simple",
        prompt: "Minimalist style, clean and simple, modern aesthetic",
        isPublic: true,
        createdAt: Date.now(),
      },
    ];

    for (const style of styles) {
      await ctx.db.insert("styles", style);
    }

    return { message: "Styles seeded" };
  },
});
```

**Запуск**: Convex Dashboard → Functions → Run `seedStyles`

**Чеклист**:
- [ ] Seed функция создана
- [ ] Стили загружены в БД
- [ ] Можно запросить через query

---

## 🎯 Этап 2: Queries (30 минут)

### 2.1 Стили

**Файл**: `convex/functions/styles.ts`

```typescript
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getPublicStyles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("styles")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect();
  },
});

export const getStyleById = query({
  args: { styleId: v.id("styles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.styleId);
  },
});
```

### 2.2 Проекты

**Файл**: `convex/functions/projects.ts`

```typescript
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUserProjects = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!userProfile) return [];

    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userProfile._id))
      .order("desc")
      .collect();
  },
});

export const getProjectById = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const project = await ctx.db.get(args.projectId);
    if (!project) return null;

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (project.userId !== userProfile?._id) {
      throw new Error("Unauthorized");
    }

    return project;
  },
});
```

### 2.3 Сцены

**Файл**: `convex/functions/scenes.ts`

```typescript
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getScenesByProject = query({
  args: { projectId: v.id("projects") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("scenes")
      .withIndex("by_project", (q) => q.eq("projectId", args.projectId))
      .order("asc")
      .collect();
  },
});
```

**Чеклист**:
- [ ] Все queries созданы
- [ ] Работают в Convex Dashboard
- [ ] Типы генерируются правильно

---

## 🎯 Этап 3: Mutations (1 час)

### 3.1 Создание проекта

**Файл**: `convex/functions/projects.ts` (добавить)

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createProject = mutation({
  args: {
    name: v.string(),
    scenarioText: v.string(),
    styleId: v.id("styles"),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Найти или создать userProfile
    let userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!userProfile) {
      const userId = await ctx.db.insert("userProfiles", {
        email: identity.email!,
        fullName: identity.name,
        createdAt: Date.now(),
      });
      userProfile = await ctx.db.get(userId);
    }

    return await ctx.db.insert("projects", {
      userId: userProfile!._id,
      name: args.name,
      scenarioText: args.scenarioText,
      styleId: args.styleId,
      createdAt: Date.now(),
    });
  },
});
```

### 3.2 Создание сцен

**Файл**: `convex/functions/scenes.ts` (добавить)

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createScenes = mutation({
  args: {
    projectId: v.id("projects"),
    scenes: v.array(
      v.object({
        orderIndex: v.number(),
        name: v.string(),
        scriptContent: v.string(),
        imagePrompt: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    // Проверка прав доступа
    const project = await ctx.db.get(args.projectId);
    if (!project) throw new Error("Project not found");

    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (project.userId !== userProfile?._id) {
      throw new Error("Unauthorized");
    }

    // Создать сцены
    const sceneIds = [];
    for (const scene of args.scenes) {
      const sceneId = await ctx.db.insert("scenes", {
        projectId: args.projectId,
        orderIndex: scene.orderIndex,
        name: scene.name,
        scriptContent: scene.scriptContent,
        imagePrompt: scene.imagePrompt,
        createdAt: Date.now(),
      });
      sceneIds.push(sceneId);
    }

    return sceneIds;
  },
});
```

### 3.3 Обновление сцен

**Файл**: `convex/functions/scenes.ts` (добавить)

```typescript
export const updateSceneImage = mutation({
  args: {
    sceneId: v.id("scenes"),
    imageUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sceneId, { imageUrl: args.imageUrl });
  },
});

export const updateSceneAudio = mutation({
  args: {
    sceneId: v.id("scenes"),
    audioUrl: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.sceneId, { audioUrl: args.audioUrl });
  },
});
```

### 3.4 Generation Events

**Файл**: `convex/functions/generationEvents.ts`

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const createEvent = mutation({
  args: {
    sceneId: v.id("scenes"),
    type: v.union(v.literal("image"), v.literal("audio")),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("generationEvents", {
      sceneId: args.sceneId,
      type: args.type,
      status: args.status,
      createdAt: Date.now(),
    });
  },
});

export const updateEvent = mutation({
  args: {
    eventId: v.id("generationEvents"),
    status: v.union(
      v.literal("pending"),
      v.literal("processing"),
      v.literal("completed"),
      v.literal("failed")
    ),
    resultUrl: v.optional(v.string()),
    errorMessage: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.eventId, {
      status: args.status,
      resultUrl: args.resultUrl,
      errorMessage: args.errorMessage,
    });
  },
});
```

**Чеклист**:
- [ ] Все mutations созданы
- [ ] Проверка прав доступа работает
- [ ] Тестирование в Convex Dashboard

---

## 🎯 Этап 4: Actions для AI (2 часа)

### 4.1 Storyboard Generation (OpenRouter)

**Файл**: `convex/functions/storyboard.ts`

```typescript
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const generateStoryboard = action({
  args: {
    projectId: v.id("projects"),
    scenarioText: v.string(),
    styleId: v.id("styles"),
  },
  handler: async (ctx, args) => {
    // 1. Получить стиль
    const style = await ctx.runQuery(api.functions.styles.getStyleById, {
      styleId: args.styleId,
    });
    if (!style) throw new Error("Style not found");

    // 2. Построить промпт
    const prompt = `Разбей следующий сценарий на сцены для видеоролика. Каждая сцена должна иметь:
1. Название сцены (краткое, 2-5 слов)
2. Текст сцены для озвучки (1-3 предложения)
3. Промпт для генерации изображения (детальное описание визуала)

Стиль: ${style.prompt}

Сценарий:
${args.scenarioText}

Верни результат в формате JSON массива:
[
  {
    "title": "Название сцены",
    "text": "Текст для озвучки",
    "imagePrompt": "Детальный промпт для изображения"
  }
]`;

    // 3. Вызвать OpenRouter
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://your-app.com",
        "X-Title": "Arlekino AI",
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages: [{ role: "user", content: prompt }],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0].message.content;

    // 4. Парсить JSON
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) throw new Error("No JSON found in AI response");

    let scenes;
    try {
      scenes = JSON.parse(jsonMatch[0]);
    } catch (error) {
      throw new Error(`Failed to parse AI response: ${error}`);
    }

    // 5. Валидация
    if (!Array.isArray(scenes)) throw new Error("AI response is not an array");
    for (const scene of scenes) {
      if (!scene.title || !scene.text || !scene.imagePrompt) {
        throw new Error("Invalid scene structure");
      }
    }

    // 6. Сохранить сцены
    await ctx.runMutation(api.functions.scenes.createScenes, {
      projectId: args.projectId,
      scenes: scenes.map((scene, index) => ({
        orderIndex: index,
        name: scene.title,
        scriptContent: scene.text,
        imagePrompt: scene.imagePrompt,
      })),
    });

    return { success: true, scenesCount: scenes.length };
  },
});
```

**Чеклист**:
- [ ] Action создана
- [ ] OpenRouter API вызывается
- [ ] JSON парсится с валидацией
- [ ] Сцены сохраняются

---

### 4.2 Image Generation (Replicate)

**Файл**: `convex/functions/images.ts`

```typescript
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const generateImage = action({
  args: {
    sceneId: v.id("scenes"),
    prompt: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Создать event
    const eventId = await ctx.runMutation(api.functions.generationEvents.createEvent, {
      sceneId: args.sceneId,
      type: "image",
      status: "processing",
    });

    try {
      // 2. Вызвать Replicate
      const response = await fetch("https://api.replicate.com/v1/predictions", {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          version: "black-forest-labs/flux-pro",
          input: {
            prompt: args.prompt,
            aspect_ratio: "16:9",
            output_format: "webp",
          },
        }),
      });

      if (!response.ok) throw new Error(`Replicate API error: ${response.status}`);

      const prediction = await response.json();

      // 3. Polling (до 2 минут)
      let result = prediction;
      const maxAttempts = 60;
      let attempts = 0;

      while (
        result.status !== "succeeded" &&
        result.status !== "failed" &&
        attempts < maxAttempts
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000));

        const statusResponse = await fetch(
          `https://api.replicate.com/v1/predictions/${result.id}`,
          {
            headers: {
              Authorization: `Token ${process.env.REPLICATE_API_TOKEN}`,
            },
          }
        );

        result = await statusResponse.json();
        attempts++;
      }

      if (result.status !== "succeeded") {
        throw new Error("Image generation failed or timeout");
      }

      // 4. Загрузить в Storage
      const imageUrl = result.output[0];
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();

      const storageId = await ctx.storage.store(imageBlob);
      const imageUrl_convex = await ctx.storage.getUrl(storageId);

      // 5. Обновить сцену и event
      await ctx.runMutation(api.functions.scenes.updateSceneImage, {
        sceneId: args.sceneId,
        imageUrl: imageUrl_convex,
      });

      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "completed",
        resultUrl: imageUrl_convex,
      });

      return { url: imageUrl_convex, eventId };
    } catch (error: any) {
      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "failed",
        errorMessage: error.message,
      });
      throw error;
    }
  },
});
```

**Чеклист**:
- [ ] Action создана
- [ ] Replicate API вызывается
- [ ] Polling работает
- [ ] Изображение загружается в Storage
- [ ] Сцена обновляется

---

### 4.3 Audio Generation (ElevenLabs НАПРЯМУЮ)

**Файл**: `convex/functions/audio.ts`

```typescript
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const generateAudio = action({
  args: {
    sceneId: v.id("scenes"),
    text: v.string(),
    voiceId: v.string(),
  },
  handler: async (ctx, args) => {
    // 1. Создать event
    const eventId = await ctx.runMutation(api.functions.generationEvents.createEvent, {
      sceneId: args.sceneId,
      type: "audio",
      status: "processing",
    });

    try {
      // ⚠️ КРИТИЧЕСКИ ВАЖНО: Прямой вызов ElevenLabs API
      console.log("🎵 TTS: Calling ElevenLabs API directly");
      console.log(`URL: https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`);

      const response = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY!,
            "Content-Type": "application/json",
            Accept: "audio/mpeg",
          },
          body: JSON.stringify({
            text: args.text,
            model_id: "eleven_multilingual_v2",
            voice_settings: {
              stability: 0.5,
              similarity_boost: 0.8,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      // 2. Получить аудио
      const audioArrayBuffer = await response.arrayBuffer();
      const audioBlob = new Blob([audioArrayBuffer], { type: "audio/mpeg" });

      // 3. Загрузить в Storage
      const storageId = await ctx.storage.store(audioBlob);
      const audioUrl = await ctx.storage.getUrl(storageId);

      // 4. Обновить сцену и event
      await ctx.runMutation(api.functions.scenes.updateSceneAudio, {
        sceneId: args.sceneId,
        audioUrl: audioUrl,
      });

      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "completed",
        resultUrl: audioUrl,
      });

      return { url: audioUrl, eventId };
    } catch (error: any) {
      await ctx.runMutation(api.functions.generationEvents.updateEvent, {
        eventId,
        status: "failed",
        errorMessage: error.message,
      });
      throw error;
    }
  },
});
```

**КРИТИЧЕСКИ ВАЖНО**: Проверить в логах прямой вызов ElevenLabs!

**Чеклист**:
- [ ] Action создана
- [ ] ElevenLabs вызывается НАПРЯМУЮ (проверить код!)
- [ ] Аудио загружается в Storage
- [ ] В логах видно прямой вызов

---

## 🎯 Этап 5: Frontend (2 часа)

### 5.1 ConvexProvider

**Файл**: `frontend/src/lib/convex-provider.tsx`

```typescript
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;
if (!convexUrl) throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");

const convex = new ConvexReactClient(convexUrl);

export function ConvexProviderWrapper({ children }: { children: React.ReactNode }) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

### 5.2 ProjectContext

**Файл**: `frontend/src/context/ProjectContext.tsx`

```typescript
"use client";

import { createContext, useContext, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface ProjectContextType {
  projectId: Id<"projects"> | null;
  project: any;
  scenes: any[];
  generateStoryboard: (scenarioText: string, styleId: string) => Promise<void>;
  generateImage: (sceneId: Id<"scenes">, prompt: string) => Promise<void>;
  generateAudio: (sceneId: Id<"scenes">, text: string, voiceId: string) => Promise<void>;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export function ProjectProvider({ children }: { children: React.ReactNode }) {
  const [projectId, setProjectId] = useState<Id<"projects"> | null>(null);

  // ✅ Автоматический real-time через useQuery
  const project = useQuery(
    api.functions.projects.getProjectById,
    projectId ? { projectId } : "skip"
  );

  const scenes = useQuery(
    api.functions.scenes.getScenesByProject,
    projectId ? { projectId } : "skip"
  ) ?? [];

  const createProject = useMutation(api.functions.projects.createProject);
  const generateStoryboardAction = useAction(api.functions.storyboard.generateStoryboard);
  const generateImageAction = useAction(api.functions.images.generateImage);
  const generateAudioAction = useAction(api.functions.audio.generateAudio);

  const generateStoryboard = async (scenarioText: string, styleId: string) => {
    const newProjectId = await createProject({
      name: "New Project",
      scenarioText,
      styleId: styleId as Id<"styles">,
    });

    await generateStoryboardAction({
      projectId: newProjectId,
      scenarioText,
      styleId: styleId as Id<"styles">,
    });

    setProjectId(newProjectId);
  };

  const generateImage = async (sceneId: Id<"scenes">, prompt: string) => {
    await generateImageAction({ sceneId, prompt });
  };

  const generateAudio = async (sceneId: Id<"scenes">, text: string, voiceId: string) => {
    await generateAudioAction({ sceneId, text, voiceId });
  };

  return (
    <ProjectContext.Provider
      value={{
        projectId,
        project,
        scenes,
        generateStoryboard,
        generateImage,
        generateAudio,
      }}
    >
      {children}
    </ProjectContext.Provider>
  );
}

export function useProject() {
  const context = useContext(ProjectContext);
  if (!context) throw new Error("useProject must be used within ProjectProvider");
  return context;
}
```

### 5.3 Onboarding Page

**Файл**: `frontend/src/app/(onboarding)/onboarding/page.tsx`

```typescript
"use client";

import { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useProject } from "@/context/ProjectContext";

export default function OnboardingPage() {
  const [step, setStep] = useState<"script" | "style" | "generating" | "result">("script");
  const [scenarioText, setScenarioText] = useState("");
  const [selectedStyleId, setSelectedStyleId] = useState<string | null>(null);

  const styles = useQuery(api.functions.styles.getPublicStyles) ?? [];
  const { generateStoryboard, scenes } = useProject();

  const handleGenerate = async () => {
    if (!selectedStyleId) return;
    setStep("generating");
    await generateStoryboard(scenarioText, selectedStyleId);
    setStep("result");
  };

  if (step === "script") {
    return (
      <div>
        <textarea
          value={scenarioText}
          onChange={(e) => setScenarioText(e.target.value)}
          placeholder="Введите сценарий..."
        />
        <button onClick={() => setStep("style")}>Далее</button>
      </div>
    );
  }

  if (step === "style") {
    return (
      <div>
        {styles.map((style) => (
          <div
            key={style._id}
            onClick={() => setSelectedStyleId(style._id)}
            className={selectedStyleId === style._id ? "selected" : ""}
          >
            {style.name}
          </div>
        ))}
        <button onClick={handleGenerate}>Создать storyboard</button>
      </div>
    );
  }

  if (step === "generating") {
    return <div>Генерация storyboard...</div>;
  }

  return (
    <div>
      {scenes.map((scene) => (
        <div key={scene._id}>
          <h3>{scene.name}</h3>
          {scene.imageUrl && <img src={scene.imageUrl} alt={scene.name} />}
          {scene.audioUrl && <audio src={scene.audioUrl} controls />}
        </div>
      ))}
    </div>
  );
}
```

**Чеклист**:
- [ ] ConvexProvider настроен
- [ ] ProjectContext создан
- [ ] Onboarding page работает
- [ ] Real-time обновления работают

---

## ✅ Финальный чеклист

### Backend
- [ ] Схема создана и работает
- [ ] Seed данные загружены
- [ ] Все queries работают
- [ ] Все mutations работают
- [ ] Все actions работают
- [ ] ElevenLabs вызывается напрямую (проверено в логах)
- [ ] Storage работает

### Frontend
- [ ] ConvexProvider настроен
- [ ] ProjectContext работает
- [ ] Onboarding flow работает
- [ ] Real-time обновления работают
- [ ] UI приятный

### Интеграция
- [ ] End-to-end flow работает
- [ ] Нет критических ошибок
- [ ] Готово к демо

---

*Создано: 2025-01-31*  
*Для архитектуры см.: [ARCHITECTURE.md](./ARCHITECTURE.md)*  
*Для рисков см.: [RISKS.md](./RISKS.md)*

