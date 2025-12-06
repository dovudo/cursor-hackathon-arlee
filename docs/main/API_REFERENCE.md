# 📡 API Reference - Convex Functions

> **Backend**: Convex | **Frontend**: Next.js 15 + Convex React hooks

---

## 🔐 Аутентификация

Convex автоматически обрабатывает аутентификацию через `ctx.auth.getUserIdentity()`.

**На фронтенде**: Никаких дополнительных настроек не нужно - Convex автоматически передает auth токен.

---

## 📋 Queries (Read-only)

### `api.functions.styles.getPublicStyles`

**Описание**: Получить все публичные стили

**Аргументы**: Нет

**Возвращает**: `Array<Style>`

**Пример**:
```typescript
const styles = useQuery(api.functions.styles.getPublicStyles);
// styles автоматически обновляется при изменении данных!
```

---

### `api.functions.styles.getStyleById`

**Описание**: Получить стиль по ID

**Аргументы**:
```typescript
{ styleId: Id<"styles"> }
```

**Возвращает**: `Style | null`

**Пример**:
```typescript
const style = useQuery(api.functions.styles.getStyleById, {
  styleId: "j1234567890abcdef" as Id<"styles">
});
```

---

### `api.functions.projects.getUserProjects`

**Описание**: Получить все проекты текущего пользователя

**Аргументы**: Нет

**Возвращает**: `Array<Project>`

**Пример**:
```typescript
const projects = useQuery(api.functions.projects.getUserProjects);
```

---

### `api.functions.projects.getProjectById`

**Описание**: Получить проект по ID (с проверкой прав доступа)

**Аргументы**:
```typescript
{ projectId: Id<"projects"> }
```

**Возвращает**: `Project | null`

**Пример**:
```typescript
const project = useQuery(api.functions.projects.getProjectById, {
  projectId: projectId!
});
```

---

### `api.functions.scenes.getScenesByProject`

**Описание**: Получить все сцены проекта (отсортированные по orderIndex)

**Аргументы**:
```typescript
{ projectId: Id<"projects"> }
```

**Возвращает**: `Array<Scene>`

**Пример**:
```typescript
const scenes = useQuery(api.functions.scenes.getScenesByProject, {
  projectId: projectId!
});
// Автоматически обновляется при изменении сцен!
```

---

## 🔄 Mutations (Transactions)

### `api.functions.projects.createProject`

**Описание**: Создать новый проект

**Аргументы**:
```typescript
{
  name: string;
  scenarioText: string;
  styleId: Id<"styles">;
}
```

**Возвращает**: `Id<"projects">`

**Пример**:
```typescript
const createProject = useMutation(api.functions.projects.createProject);

const projectId = await createProject({
  name: "My Project",
  scenarioText: "A story about...",
  styleId: "j1234567890abcdef" as Id<"styles">
});
```

---

### `api.functions.scenes.createScenes`

**Описание**: Создать несколько сцен для проекта

**Аргументы**:
```typescript
{
  projectId: Id<"projects">;
  scenes: Array<{
    orderIndex: number;
    name: string;
    scriptContent: string;
    imagePrompt?: string;
  }>;
}
```

**Возвращает**: `Array<Id<"scenes">>`

**Пример**:
```typescript
const createScenes = useMutation(api.functions.scenes.createScenes);

const sceneIds = await createScenes({
  projectId: projectId!,
  scenes: [
    {
      orderIndex: 0,
      name: "Scene 1",
      scriptContent: "Text for narration",
      imagePrompt: "A cinematic scene..."
    }
  ]
});
```

---

### `api.functions.scenes.updateSceneImage`

**Описание**: Обновить URL изображения сцены

**Аргументы**:
```typescript
{
  sceneId: Id<"scenes">;
  imageUrl: string;
}
```

**Возвращает**: `void`

---

### `api.functions.scenes.updateSceneAudio`

**Описание**: Обновить URL аудио сцены

**Аргументы**:
```typescript
{
  sceneId: Id<"scenes">;
  audioUrl: string;
}
```

**Возвращает**: `void`

---

### `api.functions.generationEvents.createEvent`

**Описание**: Создать событие генерации

**Аргументы**:
```typescript
{
  sceneId: Id<"scenes">;
  type: "image" | "audio";
  status: "pending" | "processing" | "completed" | "failed";
}
```

**Возвращает**: `Id<"generationEvents">`

---

### `api.functions.generationEvents.updateEvent`

**Описание**: Обновить статус события генерации

**Аргументы**:
```typescript
{
  eventId: Id<"generationEvents">;
  status: "pending" | "processing" | "completed" | "failed";
  resultUrl?: string;
  errorMessage?: string;
}
```

**Возвращает**: `void`

---

## ⚡ Actions (External API)

### `api.functions.storyboard.generateStoryboard`

**Описание**: Генерирует storyboard из сценария через OpenRouter

**Аргументы**:
```typescript
{
  projectId: Id<"projects">;
  scenarioText: string;
  styleId: Id<"styles">;
}
```

**Возвращает**:
```typescript
{
  success: boolean;
  scenesCount: number;
}
```

**Пример**:
```typescript
const generateStoryboard = useAction(api.functions.storyboard.generateStoryboard);

await generateStoryboard({
  projectId: projectId!,
  scenarioText: "A story about...",
  styleId: styleId as Id<"styles">
});
```

**Процесс**:
1. Получает стиль через query
2. Формирует промпт для AI
3. Вызывает OpenRouter API
4. Парсит JSON ответ с валидацией
5. Сохраняет сцены через mutation

---

### `api.functions.images.generateImage`

**Описание**: Генерирует изображение через Replicate FLUX

**Аргументы**:
```typescript
{
  sceneId: Id<"scenes">;
  prompt: string;
}
```

**Возвращает**:
```typescript
{
  url: string;
  eventId: Id<"generationEvents">;
}
```

**Пример**:
```typescript
const generateImage = useAction(api.functions.images.generateImage);

await generateImage({
  sceneId: sceneId!,
  prompt: "A cinematic scene with dramatic lighting..."
});
```

**Процесс**:
1. Создает generation event
2. Вызывает Replicate API
3. Polling результата (до 2 минут)
4. Загружает изображение в Convex Storage
5. Обновляет сцену и event

---

### `api.functions.audio.generateAudio`

**Описание**: Генерирует аудио через ElevenLabs **НАПРЯМУЮ**

**Аргументы**:
```typescript
{
  sceneId: Id<"scenes">;
  text: string;
  voiceId: string; // ElevenLabs voice ID (например, '21m00Tcm4TlvDq8ikWAM')
}
```

**Возвращает**:
```typescript
{
  url: string;
  eventId: Id<"generationEvents">;
}
```

**Пример**:
```typescript
const generateAudio = useAction(api.functions.audio.generateAudio);

await generateAudio({
  sceneId: sceneId!,
  text: "This is the narration text for the scene.",
  voiceId: "21m00Tcm4TlvDq8ikWAM" // Rachel voice
});
```

**Процесс**:
1. Создает generation event
2. **Прямой вызов ElevenLabs API** (`https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`)
3. Получает аудио как ArrayBuffer
4. Загружает в Convex Storage
5. Обновляет сцену и event

**КРИТИЧЕСКИ ВАЖНО**: ElevenLabs вызывается напрямую, без proxy!

---

## 🔄 Real-time обновления

### Автоматический real-time через queries

```typescript
// ✅ Автоматически обновляется при изменении данных
const scenes = useQuery(api.functions.scenes.getScenesByProject, {
  projectId: projectId!
});

// Когда mutation обновляет сцену, useQuery автоматически получает новые данные
// UI обновляется без polling!
```

**Преимущество**: Не нужен polling на фронтенде - Convex автоматически обновляет queries!

---

## 🚨 Обработка ошибок

### На фронтенде

```typescript
try {
  await generateStoryboard({ projectId, scenarioText, styleId });
} catch (error: any) {
  console.error("Error:", error);
  // Показать пользователю понятное сообщение
  alert(`Failed to generate storyboard: ${error.message}`);
}
```

### В Actions

```typescript
export const generateStoryboard = action({
  handler: async (ctx, args) => {
    try {
      // Логика
    } catch (error: any) {
      console.error("Storyboard generation error:", error);
      throw new Error(`Failed to generate storyboard: ${error.message}`);
    }
  }
});
```

---

## 📊 Типы данных

### Style
```typescript
{
  _id: Id<"styles">;
  name: string;
  description?: string;
  prompt: string;
  imageUrl?: string;
  isPublic: boolean;
  createdAt: number;
}
```

### Project
```typescript
{
  _id: Id<"projects">;
  userId: Id<"userProfiles">;
  name: string;
  scenarioText: string;
  styleId: Id<"styles">;
  createdAt: number;
}
```

### Scene
```typescript
{
  _id: Id<"scenes">;
  projectId: Id<"projects">;
  orderIndex: number;
  name: string;
  scriptContent: string;
  imagePrompt?: string;
  imageUrl?: string;
  audioUrl?: string;
  createdAt: number;
}
```

### GenerationEvent
```typescript
{
  _id: Id<"generationEvents">;
  sceneId: Id<"scenes">;
  type: "image" | "audio";
  status: "pending" | "processing" | "completed" | "failed";
  resultUrl?: string;
  errorMessage?: string;
  createdAt: number;
}
```

---

## 🔍 Debugging

### Проверка вызова ElevenLabs

В логах Convex Dashboard должно быть:
```
🎵 TTS: Calling ElevenLabs API directly
URL: https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
```

**НЕ должно быть**:
- ❌ Proxy URL
- ❌ VoicerAPI
- ❌ Любые посредники

### Проверка типов

После изменения схемы:
1. Сохраните `schema.ts`
2. Проверьте что `convex dev` перегенерировал типы
3. Проверьте что `_generated/api.d.ts` обновился
4. Проверьте что нет ошибок в IDE

---

*Создано: 2025-01-31*  
*Для архитектуры см.: [ARCHITECTURE.md](./ARCHITECTURE.md)*

