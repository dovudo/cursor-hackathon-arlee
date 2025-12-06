# 🚨 Анализ рисков и проблемных мест

> **Цель**: Заранее выявить потенциальные проблемы и подготовить решения

---

## 📊 Матрица рисков

| Риск | Вероятность | Влияние | Приоритет | Решение |
|------|-------------|---------|-----------|---------|
| Проблемы с типизацией Convex | Высокая | Среднее | P0 | Тестировать схему сразу |
| Ошибки парсинга AI ответов | Средняя | Высокое | P0 | Валидация + fallback |
| Проблемы с Storage | Средняя | Высокое | P0 | Тестировать загрузку файлов |
| Ошибки аутентификации | Средняя | Высокое | P0 | Настроить Auth сразу |
| Timeout внешних API | Средняя | Среднее | P1 | Retry механизм |
| Проблемы с real-time | Низкая | Среднее | P1 | Проверить queries |
| Ошибки CORS | Низкая | Среднее | P2 | Проверить настройки |

---

## 🔴 Критические риски (P0)

### 1. Проблемы с типизацией Convex

**Описание**: Convex генерирует типы автоматически, но если схема неправильная - все сломается.

**Симптомы**:
- TypeScript ошибки в `api.functions.*`
- Ошибки при компиляции
- Неправильные типы в runtime

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Всегда проверяйте типы после изменения схемы
// 1. Измените schema.ts
// 2. Сохраните файл
// 3. Проверьте что convex dev перегенерировал типы
// 4. Проверьте что нет ошибок в IDE

// ✅ ПРАВИЛЬНО: Используйте строгие типы
export const createProject = mutation({
  args: {
    name: v.string(), // не v.any()!
    scenarioText: v.string(),
    styleId: v.id("styles"), // правильный тип ID
  },
  // ...
});
```

**Решение при возникновении**:
1. Остановить `convex dev`
2. Проверить схему на ошибки
3. Запустить `convex dev` заново
4. Проверить что `_generated/api.d.ts` обновился

**Время на исправление**: 10-15 минут

---

### 2. Ошибки парсинга AI ответов

**Описание**: AI может вернуть ответ не в нужном формате JSON.

**Симптомы**:
- `JSON.parse()` ошибки
- Неправильная структура данных
- Отсутствие нужных полей

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Валидация и fallback
const aiResponse = openRouterData.choices[0].message.content;

// 1. Попытка найти JSON в ответе
const jsonMatch = aiResponse.match(/\[[\s\S]*\]/);
if (!jsonMatch) {
  // Fallback: попробовать другой паттерн
  const jsonMatch2 = aiResponse.match(/\{[\s\S]*\}/);
  if (!jsonMatch2) {
    throw new Error("No JSON found in AI response");
  }
}

// 2. Парсинг с обработкой ошибок
let scenes;
try {
  scenes = JSON.parse(jsonMatch[0]);
} catch (error) {
  throw new Error(`Failed to parse AI response: ${error.message}`);
}

// 3. Валидация структуры
if (!Array.isArray(scenes)) {
  throw new Error("AI response is not an array");
}

// 4. Валидация каждого элемента
for (const scene of scenes) {
  if (!scene.title || !scene.text || !scene.imagePrompt) {
    throw new Error("Invalid scene structure");
  }
}
```

**Решение при возникновении**:
1. Логировать полный ответ AI
2. Добавить более гибкий парсинг
3. Добавить retry с другим промптом

**Время на исправление**: 30-60 минут

---

### 3. Проблемы с Storage

**Описание**: Convex Storage может не работать или файлы не загружаются.

**Симптомы**:
- Ошибки при `ctx.storage.store()`
- Файлы не сохраняются
- URL не генерируется

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Проверка на каждом шаге
try {
  // 1. Проверить что blob создан
  if (!imageBlob || imageBlob.size === 0) {
    throw new Error("Invalid image blob");
  }

  // 2. Проверить размер файла (лимит Convex: 10MB)
  if (imageBlob.size > 10 * 1024 * 1024) {
    throw new Error("File too large");
  }

  // 3. Загрузить в Storage
  const storageId = await ctx.storage.store(imageBlob);
  if (!storageId) {
    throw new Error("Failed to store file");
  }

  // 4. Получить URL
  const url = await ctx.storage.getUrl(storageId);
  if (!url) {
    throw new Error("Failed to get file URL");
  }

  return url;
} catch (error) {
  console.error("Storage error:", error);
  throw error;
}
```

**Решение при возникновении**:
1. Проверить размер файла
2. Проверить формат файла
3. Проверить что используете `action`, а не `mutation` для Storage

**Время на исправление**: 20-30 минут

---

### 4. Ошибки аутентификации

**Описание**: Пользователь не может авторизоваться или запросы отклоняются.

**Симптомы**:
- "Not authenticated" ошибки
- Запросы отклоняются
- Данные не загружаются

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Проверка аутентификации везде
export const getUserProjects = query({
  args: {},
  handler: async (ctx) => {
    // 1. Проверить identity
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }

    // 2. Проверить email
    if (!identity.email) {
      throw new Error("Email not found in identity");
    }

    // 3. Найти userProfile
    const userProfile = await ctx.db
      .query("userProfiles")
      .withIndex("by_email", (q) => q.eq("email", identity.email!))
      .first();

    // 4. Создать если не существует
    if (!userProfile) {
      const userId = await ctx.db.insert("userProfiles", {
        email: identity.email,
        fullName: identity.name,
        createdAt: Date.now(),
      });
      return []; // Пустой массив для нового пользователя
    }

    // 5. Вернуть данные
    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userProfile._id))
      .collect();
  },
});
```

**Решение при возникновении**:
1. Проверить что Convex Auth настроен
2. Проверить что пользователь залогинен на фронтенде
3. Проверить что `identity.email` существует

**Время на исправление**: 15-30 минут

---

## 🟡 Средние риски (P1)

### 5. Timeout внешних API

**Описание**: OpenRouter, Replicate или ElevenLabs могут долго отвечать.

**Симптомы**:
- Запросы зависают
- Actions не завершаются
- Пользователь ждет долго

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Timeout и retry
async function callWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3,
  timeout = 30000
): Promise<T> {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);

      const result = await fn();
      clearTimeout(timeoutId);
      return result;
    } catch (error: any) {
      if (i === maxRetries - 1) {
        throw error;
      }
      // Ждать перед retry (exponential backoff)
      await new Promise((resolve) =>
        setTimeout(resolve, Math.pow(2, i) * 1000)
      );
    }
  }
  throw new Error("Max retries exceeded");
}
```

**Решение при возникновении**:
1. Увеличить timeout
2. Добавить retry механизм
3. Показать прогресс пользователю

**Время на исправление**: 30-60 минут

---

### 6. Проблемы с real-time обновлениями

**Описание**: Данные не обновляются автоматически в UI.

**Симптомы**:
- UI не обновляется после mutations
- Нужно обновлять страницу вручную
- Queries не реагируют на изменения

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Использовать useQuery (не useQueryOnce)
const scenes = useQuery(api.functions.scenes.getScenesByProject, {
  projectId: projectId!,
});

// ✅ ПРАВИЛЬНО: Правильные индексы в схеме
export default defineSchema({
  scenes: defineTable({
    // ...
  })
    .index("by_project", ["projectId"]) // Индекс для быстрого поиска
    .index("by_project_order", ["projectId", "orderIndex"]),
});
```

**Решение при возникновении**:
1. Проверить что используете `useQuery`, а не `useQueryOnce`
2. Проверить что индексы правильные
3. Проверить что mutations обновляют правильные таблицы

**Время на исправление**: 20-40 минут

---

## 🟢 Низкие риски (P2)

### 7. Ошибки CORS

**Описание**: Внешние API могут блокировать запросы из Convex.

**Симптомы**:
- CORS ошибки в консоли
- Запросы отклоняются
- Actions не работают

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Правильные заголовки
const response = await fetch("https://api.elevenlabs.io/...", {
  method: "POST",
  headers: {
    "xi-api-key": process.env.ELEVENLABS_API_KEY!,
    "Content-Type": "application/json",
    Accept: "audio/mpeg",
    // Не добавляйте Origin или другие CORS заголовки
  },
  body: JSON.stringify({ ... }),
});
```

**Решение при возникновении**:
1. Проверить заголовки запроса
2. Проверить что не добавляете лишние заголовки
3. Обратиться к документации API провайдера

**Время на исправление**: 10-20 минут

---

## 📋 Чеклист для минимизации рисков

### Перед началом разработки
- [ ] Изучить документацию Convex (30 минут)
- [ ] Настроить Convex проект
- [ ] Проверить что типы генерируются
- [ ] Создать тестовую схему и проверить queries

### Во время разработки
- [ ] Тестировать каждую функцию сразу после создания
- [ ] Проверять типы после каждого изменения схемы
- [ ] Логировать ошибки на каждом шаге
- [ ] Тестировать edge cases (пустые данные, ошибки API)

### Перед деплоем
- [ ] Протестировать весь flow end-to-end
- [ ] Проверить что все ошибки обрабатываются
- [ ] Проверить что loading states работают
- [ ] Проверить что real-time обновления работают

---

## 🎯 Рекомендуемый порядок разработки

### День 1: Backend (4-5 часов)
1. **Утро (2 часа)**: Схема + Queries
   - Настроить Convex проект
   - Создать схему
   - Создать seed данные
   - Создать базовые queries
   - **Тестировать**: Проверить что queries работают

2. **День (2-3 часа)**: Mutations + Actions
   - Создать mutations для проектов и сцен
   - Создать action для storyboard generation
   - Создать action для генерации изображений
   - Создать action для генерации аудио
   - **Тестировать**: Проверить что все actions работают

### День 2: Frontend (3-4 часа)
3. **Утро (2 часа)**: Базовая интеграция
   - Настроить ConvexProvider
   - Создать компоненты для отображения данных
   - Интегрировать queries
   - **Тестировать**: Проверить что данные загружаются

4. **День (1-2 часа)**: Интеграция actions
   - Интегрировать создание проекта
   - Интегрировать генерацию storyboard
   - Интегрировать генерацию изображений и аудио
   - **Тестировать**: Проверить что весь flow работает

### День 3: Полировка (2-3 часа)
5. **Утро (1-2 часа)**: Обработка ошибок
   - Добавить error boundaries
   - Добавить retry механизмы
   - Улучшить loading states
   - **Тестировать**: Проверить что ошибки обрабатываются

6. **День (1 час)**: Финальное тестирование
   - End-to-end тестирование
   - Исправление багов
   - Подготовка к демо

---

## 🛡️ Защитные механизмы

### 1. Валидация на каждом уровне

```typescript
// ✅ Схема (типы)
export const createProject = mutation({
  args: {
    name: v.string(), // Валидация типа
    scenarioText: v.string(),
    styleId: v.id("styles"),
  },
  handler: async (ctx, args) => {
    // ✅ Бизнес-логика (дополнительная валидация)
    if (args.name.length < 3) {
      throw new Error("Name too short");
    }
    if (args.scenarioText.length < 10) {
      throw new Error("Scenario too short");
    }
    // ...
  },
});
```

### 2. Обработка ошибок везде

```typescript
// ✅ Try-catch в actions
export const generateStoryboard = action({
  // ...
  handler: async (ctx, args) => {
    try {
      // Логика
    } catch (error: any) {
      // Логирование
      console.error("Storyboard generation error:", error);
      // Понятная ошибка для пользователя
      throw new Error(`Failed to generate storyboard: ${error.message}`);
    }
  },
});
```

### 3. Fallback значения

```typescript
// ✅ Fallback для queries
const styles = useQuery(api.functions.styles.getPublicStyles) ?? [];

// ✅ Fallback для данных
const projectName = project?.name ?? "Untitled Project";
```

---

*Создано: 2025-01-31*  
*Для плана разработки см.: [CONVEX_DEVELOPMENT_PLAN.md](./CONVEX_DEVELOPMENT_PLAN.md)*

