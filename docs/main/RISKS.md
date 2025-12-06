# 🚨 Анализ рисков и решения

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
    throw new Error(`Invalid scene structure: ${JSON.stringify(scene)}`);
  }
}
```

**Решение при возникновении**:
1. Проверить логи AI ответа
2. Добавить более гибкий парсинг
3. Попросить AI перегенерировать ответ

**Время на исправление**: 20-30 минут

---

### 3. Проблемы с Storage

**Описание**: Файлы не загружаются или не доступны.

**Симптомы**:
- `ctx.storage.store()` ошибки
- URL не работает
- Файлы не отображаются

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Storage только в Actions
export const generateImage = action({
  handler: async (ctx, args) => {
    // 1. Получить файл
    const imageResponse = await fetch(imageUrl);
    const imageBlob = await imageResponse.blob();

    // 2. Загрузить в Storage
    const storageId = await ctx.storage.store(imageBlob);

    // 3. Получить URL
    const url = await ctx.storage.getUrl(storageId);
    // URL автоматически доступен для авторизованных пользователей

    return url;
  }
});

// ❌ НЕПРАВИЛЬНО: Storage в mutation
export const createProject = mutation({
  handler: async (ctx, args) => {
    const storageId = await ctx.storage.store(blob); // ❌ ERROR!
  }
});
```

**Решение при возникновении**:
1. Проверить что используете `action`, а не `mutation`
2. Проверить что файл не слишком большой
3. Проверить что URL правильный

**Время на исправление**: 15-30 минут

---

### 4. Ошибки аутентификации

**Описание**: Пользователь не может авторизоваться или нет доступа к данным.

**Симптомы**:
- `Not authenticated` ошибки
- Данные не загружаются
- Mutations не работают

**Профилактика**:
```typescript
// ✅ ПРАВИЛЬНО: Проверка аутентификации в каждом query/mutation
export const getUserProjects = query({
  args: {},
  handler: async (ctx) => {
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

    return await ctx.db
      .query("projects")
      .withIndex("by_user", (q) => q.eq("userId", userProfile!._id))
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
- [ ] Настроить Convex Auth
- [ ] Проверить переменные окружения
- [ ] Создать тестовую схему

### Во время разработки
- [ ] Тестировать каждый этап сразу
- [ ] Проверять типы после каждого изменения схемы
- [ ] Логировать ошибки
- [ ] Валидировать AI ответы

### Перед релизом
- [ ] Протестировать end-to-end flow
- [ ] Проверить что ElevenLabs вызывается напрямую
- [ ] Проверить что real-time работает
- [ ] Проверить что все ошибки обрабатываются

---

## 🎯 Критические проверки перед демо

### 1. ElevenLabs НАПРЯМУЮ ⚠️

**Проверка**: В логах Convex Dashboard должно быть:
```
🎵 TTS: Calling ElevenLabs API directly
URL: https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
```

**НЕ должно быть**:
- ❌ Proxy URL
- ❌ VoicerAPI
- ❌ Любые посредники

**Где проверить**: `convex/functions/audio.ts` - action `generateAudio`

---

### 2. Типизация Convex ⚠️

**Проверка**: После каждого изменения схемы:
1. Сохраните `schema.ts`
2. Проверьте что `convex dev` перегенерировал типы
3. Проверьте что нет ошибок в IDE
4. Проверьте что `_generated/api.d.ts` обновился

---

### 3. Storage только в Actions ⚠️

**Правило**: `ctx.storage.store()` можно использовать ТОЛЬКО в `action`, НЕ в `mutation`!

**Правильно**:
```typescript
export const generateImage = action({
  handler: async (ctx, args) => {
    const storageId = await ctx.storage.store(blob); // ✅ OK
  }
});
```

**Неправильно**:
```typescript
export const createProject = mutation({
  handler: async (ctx, args) => {
    const storageId = await ctx.storage.store(blob); // ❌ ERROR!
  }
});
```

---

## 💡 Советы по отладке

1. **Используйте Convex Dashboard** - там можно тестировать queries и mutations
2. **Логируйте ошибки** - используйте `console.log` для отладки
3. **Проверяйте типы** - Convex генерирует их автоматически, используйте это
4. **Тестируйте изолированно** - сначала queries, потом mutations, потом actions
5. **Не паникуйте при ошибках** - большинство проблем уже описаны выше

---

*Создано: 2025-01-31*  
*Для архитектуры см.: [ARCHITECTURE.md](./ARCHITECTURE.md)*  
*Для плана разработки см.: [DEVELOPMENT_PLAN.md](./DEVELOPMENT_PLAN.md)*

