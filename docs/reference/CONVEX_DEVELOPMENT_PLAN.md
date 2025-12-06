# 🚀 План разработки MVP с Convex

> **Цель**: Минимизировать баги и проблемы через правильный порядок разработки  
> **Backend**: Convex (Actions/Mutations/Queries)  
> **Frontend**: Next.js 15 + Convex React hooks

---

## 📋 Стратегия разработки: "Снизу вверх"

### Принцип: Сначала данные, потом логика, потом UI

**Почему этот порядок?**
1. ✅ Раннее обнаружение проблем с данными
2. ✅ Типобезопасность с самого начала
3. ✅ Легче тестировать изолированные части
4. ✅ Меньше рефакторинга на поздних этапах

---

## 🎯 Этап 1: Настройка и схема данных (1 час)

### 1.1 Инициализация Convex проекта

```bash
# В корне проекта
npx convex dev

# Следуйте инструкциям:
# 1. Войдите через GitHub
# 2. Создайте новый проект или выберите существующий
# 3. Convex создаст папку convex/ с базовой структурой
```

**Структура после инициализации**:
```
Cursor-Hackathon/
├── convex/
│   ├── _generated/
│   │   └── api.d.ts          # Автогенерируемые типы
│   ├── schema.ts             # Схема БД
│   └── functions/            # Функции (queries, mutations, actions)
├── frontend/
└── package.json
```

**Чеклист**:
- [ ] Convex проект создан
- [ ] `npx convex dev` запущен и работает
- [ ] Папка `convex/` создана
- [ ] Типы генерируются автоматически

---

### 1.2 Определение схемы данных

**Файл**: `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // 1. User profiles (минимальная версия)
  userProfiles: defineTable({
    email: v.string(),
    fullName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),

  // 2. Styles (предустановленные стили)
  styles: defineTable({
    name: v.string(),
    description: v.optional(v.string()),
    prompt: v.string(),
    imageUrl: v.optional(v.string()),
    isPublic: v.boolean(),
    createdAt: v.number(),
  })
    .index("by_public", ["isPublic"]),

  // 3. Projects
  projects: defineTable({
    userId: v.id("userProfiles"),
    name: v.string(),
    scenarioText: v.string(),
    styleId: v.id("styles"),
    createdAt: v.number(),
  })
    .index("by_user", ["userId"])
    .index("by_user_created", ["userId", "createdAt"]),

  // 4. Scenes
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

  // 5. Generation events (для отслеживания статуса)
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

**Ключевые моменты**:
- ✅ Все поля типизированы через `v.*`
- ✅ Индексы для быстрого поиска
- ✅ Связи через `v.id("tableName")`
- ✅ Опциональные поля через `v.optional()`

**Чеклист**:
- [ ] Схема определена
- [ ] Все индексы созданы
- [ ] Типы генерируются корректно
- [ ] Нет ошибок в `convex dev`

---

### 1.3 Seed данные (предустановленные стили)

**Файл**: `convex/functions/seed.ts`

```typescript
import { mutation } from "../_generated/server";
import { v } from "convex/values";

export const seedStyles = mutation({
  args: {},
  handler: async (ctx) => {
    // Проверяем, есть ли уже стили
    const existingStyles = await ctx.db.query("styles").collect();
    if (existingStyles.length > 0) {
      return { message: "Styles already seeded" };
    }

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

    return { message: "Styles seeded successfully" };
  },
});
```

**Запуск seed**:
```bash
# В Convex Dashboard → Functions → Run seedStyles
# Или через CLI (если есть)
```

**Чеклист**:
- [ ] Seed функция создана
- [ ] Стили загружены в БД
- [ ] Можно запросить стили через query

---

## 🎯 Этап 2: Базовые Queries (30 минут)

### 2.1 Query для получения стилей

**Файл**: `convex/functions/styles.ts`

```typescript
import { query } from "../_generated/server";

// Получить все публичные стили
export const getPublicStyles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("styles")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect();
  },
});

// Получить стиль по ID
export const getStyleById = query({
  args: { styleId: v.id("styles") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.styleId);
  },
});
```

**Тестирование**:
- В Convex Dashboard → Data → можно проверить данные
- В Convex Dashboard → Functions → можно запустить query

**Чеклист**:
- [ ] Query функции созданы
- [ ] Работают корректно
- [ ] Типы генерируются правильно

---

### 2.2 Query для получения проектов пользователя

**Файл**: `convex/functions/projects.ts`

```typescript
import { query } from "../_generated/server";
import { v } from "convex/values";

export const getUserProjects = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Найти userProfile по email
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    if (!userProfile) {
      return [];
    }

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
    if (!identity) {
      throw new Error("Not authenticated");
    }

    const project = await ctx.db.get(args.projectId);
    if (!project) {
      return null;
    }

    // Проверка прав доступа
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

**Чеклист**:
- [ ] Query функции созданы
- [ ] Аутентификация работает
- [ ] Проверка прав доступа работает

---

### 2.3 Query для получения сцен проекта

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

export const getGenerationStatus = query({
  args: { sceneId: v.id("scenes") },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("generationEvents")
      .withIndex("by_scene", (q) => q.eq("sceneId", args.sceneId))
      .order("desc")
      .first();
  },
});
```

**Чеклист**:
- [ ] Query функции созданы
- [ ] Сортировка работает корректно

---

## 🎯 Этап 3: Mutations (1 час)

### 3.1 Mutation для создания проекта

**Файл**: `convex/functions/projects.ts` (добавить к существующим queries)

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
    if (!identity) {
      throw new Error("Not authenticated");
    }

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

    // Создать проект
    const projectId = await ctx.db.insert("projects", {
      userId: userProfile!._id,
      name: args.name,
      scenarioText: args.scenarioText,
      styleId: args.styleId,
      createdAt: Date.now(),
    });

    return projectId;
  },
});
```

**Чеклист**:
- [ ] Mutation создана
- [ ] Аутентификация работает
- [ ] UserProfile создается автоматически
- [ ] Проект создается корректно

---

### 3.2 Mutation для создания сцен

**Файл**: `convex/functions/scenes.ts` (добавить к существующим queries)

```typescript
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
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // Проверка прав доступа
    const project = await ctx.db.get(args.projectId);
    if (!project) {
      throw new Error("Project not found");
    }

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

**Чеклист**:
- [ ] Mutation создана
- [ ] Проверка прав доступа работает
- [ ] Сцены создаются корректно

---

## 🎯 Этап 4: Actions для внешних API (2 часа)

### 4.1 Action для генерации storyboard (OpenRouter)

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

    if (!style) {
      throw new Error("Style not found");
    }

    // 2. Построить промпт для AI
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

    // 3. Вызвать OpenRouter API
    const openRouterResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
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
      }
    );

    if (!openRouterResponse.ok) {
      const errorText = await openRouterResponse.text();
      throw new Error(`OpenRouter API error: ${openRouterResponse.status} - ${errorText}`);
    }

    const openRouterData = await openRouterResponse.json();
    const aiResponse = openRouterData.choices[0].message.content;

    // 4. Парсить JSON из ответа AI
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("No JSON found in AI response");
    }

    const scenes = JSON.parse(jsonMatch[0]);

    // 5. Сохранить сцены через mutation
    const sceneIds = await ctx.runMutation(api.functions.scenes.createScenes, {
      projectId: args.projectId,
      scenes: scenes.map((scene: any, index: number) => ({
        orderIndex: index,
        name: scene.title,
        scriptContent: scene.text,
        imagePrompt: scene.imagePrompt,
      })),
    });

    return { sceneIds, scenesCount: scenes.length };
  },
});
```

**Важные моменты**:
- ✅ Actions могут делать внешние HTTP запросы
- ✅ Actions вызывают mutations для сохранения данных
- ✅ Обработка ошибок на каждом шаге

**Чеклист**:
- [ ] Action создана
- [ ] OpenRouter API вызывается корректно
- [ ] JSON парсится правильно
- [ ] Сцены сохраняются в БД

---

### 4.2 Action для генерации изображения (Replicate)

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
    // 1. Создать generation event (через mutation)
    const eventId = await ctx.runMutation(
      api.functions.generationEvents.createEvent,
      {
        sceneId: args.sceneId,
        type: "image",
        status: "processing",
      }
    );

    try {
      // 2. Вызвать Replicate API
      const replicateResponse = await fetch(
        "https://api.replicate.com/v1/predictions",
        {
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
        }
      );

      if (!replicateResponse.ok) {
        throw new Error(`Replicate API error: ${replicateResponse.statusText}`);
      }

      const prediction = await replicateResponse.json();

      // 3. Polling результата (синхронный, max 2 минуты)
      let result = prediction;
      const maxAttempts = 60;
      let attempts = 0;

      while (
        result.status !== "succeeded" &&
        result.status !== "failed" &&
        attempts < maxAttempts
      ) {
        await new Promise((resolve) => setTimeout(resolve, 2000)); // 2 секунды

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

      // 4. Загрузить изображение в Convex Storage
      const imageUrl = result.output[0];
      const imageResponse = await fetch(imageUrl);
      const imageBlob = await imageResponse.blob();

      const storageId = await ctx.storage.store(imageBlob);

      // 5. Получить URL изображения
      const imageUrl_convex = await ctx.storage.getUrl(storageId);

      // 6. Обновить сцену и event (через mutations)
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
      // Обновить event с ошибкой
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
- [ ] Replicate API вызывается корректно
- [ ] Polling работает
- [ ] Изображение загружается в Storage
- [ ] Сцена обновляется корректно

---

### 4.3 Action для генерации аудио (ElevenLabs НАПРЯМУЮ)

**Файл**: `convex/functions/audio.ts`

```typescript
import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const generateAudio = action({
  args: {
    sceneId: v.id("scenes"),
    text: v.string(),
    voiceId: v.string(), // ElevenLabs voice ID
  },
  handler: async (ctx, args) => {
    // 1. Создать generation event
    const eventId = await ctx.runMutation(
      api.functions.generationEvents.createEvent,
      {
        sceneId: args.sceneId,
        type: "audio",
        status: "processing",
      }
    );

    try {
      // ⚠️ КРИТИЧЕСКИ ВАЖНО: Прямой вызов ElevenLabs API (БЕЗ PROXY!)
      console.log("🎵 TTS: Calling ElevenLabs API directly");
      console.log(`URL: https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`);

      const elevenLabsResponse = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${args.voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": process.env.ELEVENLABS_API_KEY!, // НАСТОЯЩИЙ КЛЮЧ!
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

      if (!elevenLabsResponse.ok) {
        const errorText = await elevenLabsResponse.text();
        throw new Error(
          `ElevenLabs API error: ${elevenLabsResponse.status} - ${errorText}`
        );
      }

      // 2. Получить аудио как ArrayBuffer
      const audioArrayBuffer = await elevenLabsResponse.arrayBuffer();

      // 3. Загрузить в Convex Storage
      const audioBlob = new Blob([audioArrayBuffer], { type: "audio/mpeg" });
      const storageId = await ctx.storage.store(audioBlob);

      // 4. Получить URL аудио
      const audioUrl = await ctx.storage.getUrl(storageId);

      // 5. Обновить сцену и event
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
      // Обновить event с ошибкой
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

**КРИТИЧЕСКИ ВАЖНО**: Проверить в логах, что ElevenLabs вызывается напрямую!

**Чеклист**:
- [ ] Action создана
- [ ] ElevenLabs вызывается НАПРЯМУЮ (проверить код!)
- [ ] Аудио загружается в Storage
- [ ] Сцена обновляется корректно
- [ ] В логах видно прямой вызов ElevenLabs

---

## 🎯 Этап 5: Frontend интеграция (2 часа)

### 5.1 Настройка Convex в Next.js

**Файл**: `frontend/src/lib/convex.ts`

```typescript
import { ConvexReactClient } from "convex/react";

export const convex = new ConvexReactClient(
  process.env.NEXT_PUBLIC_CONVEX_URL!
);
```

**Файл**: `frontend/src/app/layout.tsx`

```typescript
import { ConvexProvider } from "convex/react";
import { convex } from "@/lib/convex";

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html>
      <body>
        <ConvexProvider client={convex}>
          {children}
        </ConvexProvider>
      </body>
    </html>
  );
}
```

**Чеклист**:
- [ ] Convex клиент настроен
- [ ] ConvexProvider добавлен в layout
- [ ] Переменная окружения `NEXT_PUBLIC_CONVEX_URL` настроена

---

### 5.2 Использование queries в компонентах

**Пример**: `frontend/src/components/StyleSelector.tsx`

```typescript
"use client";

import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

export function StyleSelector() {
  const styles = useQuery(api.functions.styles.getPublicStyles);

  if (styles === undefined) {
    return <div>Loading styles...</div>;
  }

  return (
    <div>
      {styles.map((style) => (
        <div key={style._id}>{style.name}</div>
      ))}
    </div>
  );
}
```

**Чеклист**:
- [ ] Queries используются корректно
- [ ] Loading states обрабатываются
- [ ] Типы работают правильно

---

### 5.3 Использование mutations и actions

**Пример**: `frontend/src/components/ProjectCreator.tsx`

```typescript
"use client";

import { useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";

export function ProjectCreator() {
  const createProject = useMutation(api.functions.projects.createProject);
  const generateStoryboard = useAction(api.functions.storyboard.generateStoryboard);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleCreate = async (name: string, scenarioText: string, styleId: string) => {
    setIsGenerating(true);
    try {
      // 1. Создать проект
      const projectId = await createProject({
        name,
        scenarioText,
        styleId: styleId as any,
      });

      // 2. Генерировать storyboard
      await generateStoryboard({
        projectId,
        scenarioText,
        styleId: styleId as any,
      });

      return projectId;
    } finally {
      setIsGenerating(false);
    }
  };

  // ... остальной код
}
```

**Чеклист**:
- [ ] Mutations и actions используются корректно
- [ ] Loading states обрабатываются
- [ ] Ошибки обрабатываются

---

## 🚨 Потенциальные проблемы и решения

### Проблема 1: Типы не генерируются

**Симптом**: TypeScript ошибки в `api.functions.*`

**Решение**:
```bash
# Убедитесь что convex dev запущен
npx convex dev

# Проверьте что файл convex/_generated/api.d.ts существует
# Если нет - перезапустите convex dev
```

---

### Проблема 2: Ошибки аутентификации

**Симптом**: "Not authenticated" ошибки

**Решение**:
1. Проверьте что Convex Auth настроен
2. Проверьте что пользователь залогинен на фронтенде
3. Используйте `ctx.auth.getUserIdentity()` в queries/mutations

---

### Проблема 3: Storage не работает

**Симптом**: Ошибки при загрузке файлов

**Решение**:
1. Проверьте что используете `ctx.storage.store()` в actions (не в mutations!)
2. Проверьте что blob создан правильно
3. Проверьте размер файла (есть лимиты)

---

### Проблема 4: Actions не могут вызвать внешние API

**Симптом**: Network errors в actions

**Решение**:
1. Убедитесь что используете `action`, а не `mutation`
2. Проверьте переменные окружения в Convex Dashboard
3. Проверьте CORS настройки внешних API

---

### Проблема 5: Real-time не работает

**Симптом**: Данные не обновляются автоматически

**Решение**:
1. Убедитесь что используете `useQuery` (не `useQueryOnce`)
2. Проверьте что queries правильно индексированы
3. Проверьте что mutations обновляют правильные таблицы

---

## ✅ Финальный чеклист

### Backend (Convex)
- [ ] Схема определена и работает
- [ ] Seed данные загружены
- [ ] Все queries работают
- [ ] Все mutations работают
- [ ] Все actions работают
- [ ] ElevenLabs вызывается напрямую (проверено в логах)
- [ ] Storage работает для изображений и аудио

### Frontend
- [ ] ConvexProvider настроен
- [ ] Queries используются корректно
- [ ] Mutations и actions используются корректно
- [ ] Loading states обрабатываются
- [ ] Ошибки обрабатываются
- [ ] Real-time обновления работают

### Интеграция
- [ ] End-to-end flow работает
- [ ] Нет критических ошибок
- [ ] Готово к демо

---

*Создано: 2025-01-31*  
*Для анализа рисков см.: [RISK_ANALYSIS.md](./RISK_ANALYSIS.md)*

