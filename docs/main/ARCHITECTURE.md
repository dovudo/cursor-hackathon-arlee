# 🏗️ Архитектура Arlekino AI MVP

> **Версия**: MVP для хакатона | **Backend**: Convex | **Frontend**: Next.js 15  
> **Время реализации**: 6-7 часов | **Принцип**: Максимальная простота

---

## 📋 Обзор системы

**Arlekino AI MVP** - упрощенная версия платформы для создания AI-генерируемых видеоконтентов. Система принимает текстовый сценарий, генерирует storyboard с помощью AI, создает изображения и аудио для каждой сцены.

### Ключевые принципы

1. **Простота > Производительность** - приоритет на скорость разработки
2. **Прямые вызовы API** - минимум абстракций
3. **Convex для backend** - автоматический real-time, типобезопасность
4. **React Context** - вместо Redux для простоты
5. **Автоматический real-time** - через Convex queries (не нужен polling)

---

## 🏗️ Технологический стек

### Backend: Convex
- **Database**: Document-relational (TypeScript схема)
- **Functions**: Queries (read-only), Mutations (transactions), Actions (external API)
- **Storage**: Встроенное File Storage API
- **Real-time**: Автоматический через queries
- **Auth**: Convex Auth (интеграция с внешними провайдерами)

### Frontend: Next.js 15
- **Framework**: Next.js 15 с App Router
- **UI**: Tailwind CSS + shadcn/ui компоненты
- **State**: React Context (вместо Redux)
- **Convex Integration**: `convex/react` hooks (`useQuery`, `useMutation`, `useAction`)
- **Real-time**: Автоматический через `useQuery`

### AI Providers
- **Text Generation**: OpenRouter (Gemini 1.5 Flash)
- **Image Generation**: Replicate (FLUX Pro)
- **Audio Generation**: ElevenLabs (напрямую, без proxy)

---

## 🗄️ Схема базы данных (Convex)

**Файл**: `convex/schema.ts`

```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  // 1. User profiles
  userProfiles: defineTable({
    email: v.string(),
    fullName: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_email", ["email"]),

  // 2. Styles (предустановленные)
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

  // 5. Generation events
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

**Ключевые особенности**:
- ✅ Типобезопасность через `v.*` валидаторы
- ✅ Индексы для быстрого поиска
- ✅ Связи через `v.id("tableName")`
- ✅ Автогенерируемые типы в `_generated/api.d.ts`

---

## 🔧 Backend: Convex Functions

### Структура

```
convex/
├── schema.ts                    # Схема БД
├── functions/
│   ├── styles.ts               # Queries для стилей
│   ├── projects.ts             # Queries + Mutations для проектов
│   ├── scenes.ts               # Queries + Mutations для сцен
│   ├── storyboard.ts           # Action: генерация storyboard (OpenRouter)
│   ├── images.ts               # Action: генерация изображений (Replicate)
│   └── audio.ts                # Action: генерация аудио (ElevenLabs)
└── _generated/                 # Автогенерируемые типы
```

### 1. Queries (Read-only)

**Пример**: `convex/functions/styles.ts`

```typescript
import { query } from "../_generated/server";

export const getPublicStyles = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("styles")
      .withIndex("by_public", (q) => q.eq("isPublic", true))
      .collect();
  },
});
```

**Особенности**:
- ✅ Только чтение данных
- ✅ Автоматический real-time (UI обновляется при изменении данных)
- ✅ Типобезопасность из коробки

---

### 2. Mutations (Transactions)

**Пример**: `convex/functions/projects.ts`

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

    // Создать проект
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

**Особенности**:
- ✅ Транзакции (все или ничего)
- ✅ Автоматический real-time (UI обновляется)
- ✅ Проверка прав доступа через `ctx.auth`

---

### 3. Actions (External API)

**Пример**: `convex/functions/storyboard.ts`

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
    // 1. Получить стиль через query
    const style = await ctx.runQuery(api.functions.styles.getStyleById, {
      styleId: args.styleId,
    });

    // 2. Построить промпт
    const prompt = `Разбей следующий сценарий на сцены...`;

    // 3. Вызвать OpenRouter API
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-1.5-flash",
        messages: [{ role: "user", content: prompt }],
      }),
    });

    const data = await response.json();
    const scenes = JSON.parse(data.choices[0].message.content);

    // 4. Сохранить через mutation
    await ctx.runMutation(api.functions.scenes.createScenes, {
      projectId: args.projectId,
      scenes: scenes.map((scene, index) => ({
        orderIndex: index,
        name: scene.title,
        scriptContent: scene.text,
        imagePrompt: scene.imagePrompt,
      })),
    });

    return { success: true };
  },
});
```

**Особенности**:
- ✅ Могут делать HTTP запросы (`fetch`)
- ✅ Могут вызывать queries и mutations через `ctx.runQuery/Mutation`
- ✅ Могут работать с Storage (`ctx.storage.store()`)
- ✅ Нет ограничений на долгие операции (до 10 минут)

---

## 🎨 Frontend: Архитектура

### Структура

```
frontend/src/
├── app/
│   ├── layout.tsx              # ConvexProvider wrapper
│   ├── page.tsx                 # Главная страница
│   └── (onboarding)/
│       └── onboarding/
│           └── page.tsx         # Onboarding flow
├── components/
│   ├── ui/                      # shadcn/ui компоненты
│   ├── StyleSelector.tsx        # Выбор стиля
│   └── StoryboardView.tsx      # Отображение storyboard
├── context/
│   └── ProjectContext.tsx       # React Context для state
└── lib/
    └── convex-provider.tsx     # Convex клиент
```

### State Management: React Context

```typescript
"use client";

import { createContext, useContext, useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "../../convex/_generated/api";

interface ProjectContextType {
  project: Project | null;
  scenes: Scene[];
  generateStoryboard: (scenarioText: string, styleId: string) => Promise<void>;
  generateImage: (sceneId: string, prompt: string) => Promise<void>;
  generateAudio: (sceneId: string, text: string) => Promise<void>;
}

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

  const generateStoryboard = async (scenarioText: string, styleId: string) => {
    // 1. Создать проект
    const newProjectId = await createProject({
      name: "New Project",
      scenarioText,
      styleId: styleId as Id<"styles">,
    });

    // 2. Генерировать storyboard
    await generateStoryboardAction({
      projectId: newProjectId,
      scenarioText,
      styleId: styleId as Id<"styles">,
    });

    setProjectId(newProjectId);
  };

  return (
    <ProjectContext.Provider value={{ project, scenes, generateStoryboard }}>
      {children}
    </ProjectContext.Provider>
  );
}
```

**Особенности**:
- ✅ Автоматический real-time (queries обновляются сами)
- ✅ Типобезопасность (автогенерируемые типы)
- ✅ Проще чем Redux (меньше boilerplate)

---

## 🔄 Data Flow

### Storyboard Generation Flow

```
User Input (scenarioText, styleId)
  ↓
Frontend: useAction(api.functions.storyboard.generateStoryboard)
  ↓
Convex Action: generateStoryboard
  ├── ctx.runQuery(api.functions.styles.getStyleById) → получить стиль
  ├── fetch('https://openrouter.ai/...') → вызвать OpenRouter
  ├── JSON.parse() → парсить AI ответ
  └── ctx.runMutation(api.functions.scenes.createScenes) → сохранить сцены
  ↓
Convex автоматически обновляет queries
  ↓
Frontend: useQuery автоматически получает новые данные
  ↓
UI обновляется автоматически (real-time!)
```

**Ключевое отличие от Supabase**: Не нужен polling - Convex автоматически обновляет UI!

---

### Image Generation Flow

```
Frontend: useAction(api.functions.images.generateImage)
  ↓
Convex Action: generateImage
  ├── ctx.runMutation(api.functions.generationEvents.createEvent) → создать event
  ├── fetch('https://api.replicate.com/...') → вызвать Replicate
  ├── Polling результата (setTimeout в цикле)
  ├── fetch(imageUrl) → скачать изображение
  ├── ctx.storage.store(blob) → загрузить в Convex Storage
  ├── ctx.storage.getUrl(storageId) → получить URL
  └── ctx.runMutation(api.functions.scenes.updateSceneImage) → обновить сцену
  ↓
Convex автоматически обновляет queries
  ↓
Frontend: useQuery автоматически получает обновленную сцену
  ↓
UI показывает изображение автоматически!
```

---

### Audio Generation Flow

```
Frontend: useAction(api.functions.audio.generateAudio)
  ↓
Convex Action: generateAudio
  ├── ctx.runMutation(api.functions.generationEvents.createEvent) → создать event
  ├── fetch('https://api.elevenlabs.io/v1/text-to-speech/{voiceId}') → ⚠️ НАПРЯМУЮ!
  ├── response.arrayBuffer() → получить аудио
  ├── ctx.storage.store(new Blob([buffer])) → загрузить в Storage
  ├── ctx.storage.getUrl(storageId) → получить URL
  └── ctx.runMutation(api.functions.scenes.updateSceneAudio) → обновить сцену
  ↓
Convex автоматически обновляет queries
  ↓
Frontend: useQuery автоматически получает обновленную сцену
  ↓
UI показывает аудио автоматически!
```

**КРИТИЧЕСКИ ВАЖНО**: ElevenLabs вызывается напрямую, без proxy!

---

## 🔐 Безопасность

### Аутентификация

**Convex Auth**:
```typescript
// В queries/mutations/actions
const identity = await ctx.auth.getUserIdentity();
if (!identity) {
  throw new Error("Not authenticated");
}

// Проверка прав доступа
const project = await ctx.db.get(projectId);
if (project.userId !== userProfile._id) {
  throw new Error("Unauthorized");
}
```

**Frontend**:
```typescript
// Convex автоматически передает auth токен
// Никаких дополнительных настроек не нужно!
```

### API Keys

- Все API ключи хранятся в Convex Dashboard → Settings → Environment Variables
- Никогда не передаются на клиент
- ElevenLabs ключ используется напрямую в Action (без посредников)

### Storage

- Convex Storage автоматически управляет доступом
- URL генерируются через `ctx.storage.getUrl()`
- Файлы доступны только авторизованным пользователям

---

## 📊 Производительность

### Оптимизации для MVP

1. **Автоматический real-time** - не нужен polling на фронтенде
2. **Индексы в схеме** - быстрый поиск данных
3. **Минимальная БД** - только 5 таблиц
4. **Прямые вызовы API** - минимум абстракций

### Компромиссы

- ⚠️ Нет кеширования (можно добавить позже)
- ⚠️ Последовательная обработка (не параллельная) для простоты

---

## 🚀 Развертывание

### Environment Variables

**Convex Dashboard → Settings → Environment Variables**:
```bash
OPENROUTER_API_KEY=sk-or-...
REPLICATE_API_TOKEN=r8_...
ELEVENLABS_API_KEY=...  # НАСТОЯЩИЙ КЛЮЧ!
```

**Frontend `.env.local`**:
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
```

### Deployment Steps

1. **Convex**: `npx convex deploy` (deploy functions)
2. **Frontend**: `npm run build && vercel deploy`

---

## ✅ Преимущества Convex для MVP

1. ✅ **Автоматический real-time** - не нужен polling
2. ✅ **Типобезопасность** - автогенерируемые типы
3. ✅ **Проще API** - меньше boilerplate кода
4. ✅ **Встроенный Storage** - не нужны отдельные bucket'ы
5. ✅ **Долгие операции** - до 10 минут (Edge Functions - 300 сек)

---

*Создано: 2025-01-31*  
*Для плана разработки см.: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)*  
*Для API документации см.: [API_REFERENCE.md](./API_REFERENCE.md)*

