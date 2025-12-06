# 🔍 Сравнение Convex Actions vs Supabase Edge Functions

> **Цель**: Оценить возможность замены Edge Functions на Convex Actions для MVP

---

## 📊 Сравнительная таблица

| Функциональность | Edge Functions | Convex Actions | Статус |
|------------------|----------------|----------------|--------|
| **HTTP запросы к внешним API** | ✅ `fetch()` | ✅ `fetch()` | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **Обработка JSON ответов** | ✅ `response.json()` | ✅ `response.json()` | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **Работа с Blob/ArrayBuffer** | ✅ `response.arrayBuffer()` | ✅ `response.arrayBuffer()` | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **Загрузка файлов в Storage** | ✅ Supabase Storage | ✅ Convex Storage | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **Получение файлов из Storage** | ✅ `storage.from().getPublicUrl()` | ✅ `ctx.storage.getUrl()` | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **Аутентификация пользователя** | ✅ JWT токены | ✅ `ctx.auth.getUserIdentity()` | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **Переменные окружения** | ✅ `Deno.env.get()` | ✅ `process.env.*` | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **Долгие операции (polling)** | ✅ До 300 сек | ✅ Без ограничений (async) | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **Real-time обновления** | ⚠️ Supabase Realtime (WebSockets) | ✅ Автоматический (встроен) | ✅ **ЛУЧШЕ** |
| **Обработка ошибок** | ✅ try/catch | ✅ try/catch | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |
| **CORS headers** | ✅ Вручную | ✅ HTTP Actions поддерживают | ✅ **ПОЛНАЯ ПОДДЕРЖКА** |

---

## ✅ Что ПОЛНОСТЬЮ поддерживается

### 1. HTTP запросы к внешним API

**Edge Functions (Supabase)**:
```typescript
const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/...', {
  method: 'POST',
  headers: {
    'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
    'Content-Type': 'application/json'
  },
  body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' })
});
```

**Convex Actions**:
```typescript
// ✅ ТАКОЕ ЖЕ поведение
export const generateAudio = action({
  handler: async (ctx, args) => {
    const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/...', {
      method: 'POST',
      headers: {
        'xi-api-key': process.env.ELEVENLABS_API_KEY!,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: args.text, model_id: 'eleven_multilingual_v2' })
    });
    
    const audioArrayBuffer = await response.arrayBuffer();
    // ...
  }
});
```

**Вывод**: ✅ **ИДЕНТИЧНО** - Convex Actions полностью поддерживают fetch API

---

### 2. Polling долгих операций (Replicate)

**Edge Functions (Supabase)**:
```typescript
let result = prediction;
const maxAttempts = 60;
for (let i = 0; i < maxAttempts; i++) {
  await new Promise(resolve => setTimeout(resolve, 2000)); // 2 секунды
  const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`);
  result = await statusResponse.json();
  if (result.status === 'succeeded' || result.status === 'failed') break;
}
```

**Convex Actions**:
```typescript
// ✅ ТАКОЕ ЖЕ поведение
export const generateImage = action({
  handler: async (ctx, args) => {
    let result = prediction;
    const maxAttempts = 60;
    for (let i = 0; i < maxAttempts; i++) {
      await new Promise(resolve => setTimeout(resolve, 2000)); // 2 секунды
      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`);
      result = await statusResponse.json();
      if (result.status === 'succeeded' || result.status === 'failed') break;
    }
    // ...
  }
});
```

**Вывод**: ✅ **ИДЕНТИЧНО** - Convex Actions поддерживают async/await и setTimeout

**Важно**: Convex Actions НЕ имеют timeout ограничений для долгих операций (в отличие от Edge Functions с лимитом 300 сек)

---

### 3. Загрузка файлов в Storage

**Edge Functions (Supabase)**:
```typescript
const imageBlob = await imageResponse.blob();
const { data: uploadData, error } = await supabase.storage
  .from('images')
  .upload(fileName, imageBlob, { contentType: 'image/webp' });

const { data: { publicUrl } } = supabase.storage
  .from('images')
  .getPublicUrl(fileName);
```

**Convex Actions**:
```typescript
// ✅ ПОЧТИ ИДЕНТИЧНО, но проще
const imageBlob = await imageResponse.blob();
const storageId = await ctx.storage.store(imageBlob);
const imageUrl = await ctx.storage.getUrl(storageId);
```

**Вывод**: ✅ **ЛУЧШЕ** - Convex Storage API проще и не требует bucket'ов

---

### 4. Работа с ArrayBuffer/Blob

**Edge Functions (Supabase)**:
```typescript
const audioArrayBuffer = await elevenLabsResponse.arrayBuffer();
const { data, error } = await supabase.storage
  .from('audio')
  .upload(fileName, audioArrayBuffer, { contentType: 'audio/mpeg' });
```

**Convex Actions**:
```typescript
// ✅ ИДЕНТИЧНО
const audioArrayBuffer = await elevenLabsResponse.arrayBuffer();
const audioBlob = new Blob([audioArrayBuffer], { type: 'audio/mpeg' });
const storageId = await ctx.storage.store(audioBlob);
```

**Вывод**: ✅ **ПОЛНАЯ ПОДДЕРЖКА** - Convex Actions поддерживают все типы данных

---

### 5. Аутентификация

**Edge Functions (Supabase)**:
```typescript
const authHeader = req.headers.get('Authorization');
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  global: { headers: { Authorization: authHeader } }
});
const { data: { user } } = await supabase.auth.getUser();
```

**Convex Actions**:
```typescript
// ✅ ПРОЩЕ
export const myAction = action({
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) {
      throw new Error("Not authenticated");
    }
    // identity.email, identity.name, identity.tokenIdentifier
  }
});
```

**Вывод**: ✅ **ЛУЧШЕ** - Convex Auth API проще и интегрирован

---

## ⚠️ Различия (не критичные для MVP)

### 1. Переменные окружения

**Edge Functions**: `Deno.env.get('KEY')`  
**Convex Actions**: `process.env.KEY!`

**Вывод**: ⚠️ **РАЗЛИЧИЕ** - но не критично, просто другой синтаксис

---

### 2. Real-time обновления

**Edge Functions (Supabase)**:
```typescript
// Нужно вручную подписываться
const channel = supabase.channel(`project:${projectId}`)
  .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'scenes' }, 
    (payload) => { /* обновить UI */ }
  )
  .subscribe();
```

**Convex**:
```typescript
// ✅ АВТОМАТИЧЕСКИ через queries
const scenes = useQuery(api.functions.scenes.getScenesByProject, { projectId });
// UI обновляется автоматически при изменении данных!
```

**Вывод**: ✅ **ЛУЧШЕ** - Convex автоматически обновляет UI через queries

---

### 3. HTTP Endpoints (для webhooks)

**Edge Functions**: Встроены в Supabase  
**Convex**: HTTP Actions (нужно создавать отдельно)

**Вывод**: ⚠️ **РАЗЛИЧИЕ** - но для MVP не критично (не используем webhooks)

---

## 📋 Детальное сравнение функций MVP

### Функция 1: Storyboard Generation (OpenRouter)

| Аспект | Edge Functions | Convex Actions | Совместимость |
|--------|----------------|----------------|---------------|
| HTTP запрос к OpenRouter | ✅ `fetch()` | ✅ `fetch()` | ✅ 100% |
| Обработка JSON ответа | ✅ `response.json()` | ✅ `response.json()` | ✅ 100% |
| Парсинг AI ответа | ✅ `JSON.parse()` | ✅ `JSON.parse()` | ✅ 100% |
| Сохранение в БД | ✅ Supabase client | ✅ `ctx.runMutation()` | ✅ 100% |
| Обработка ошибок | ✅ try/catch | ✅ try/catch | ✅ 100% |

**Вывод**: ✅ **ПОЛНОСТЬЮ СОВМЕСТИМО**

---

### Функция 2: Image Generation (Replicate)

| Аспект | Edge Functions | Convex Actions | Совместимость |
|--------|----------------|----------------|---------------|
| HTTP запрос к Replicate | ✅ `fetch()` | ✅ `fetch()` | ✅ 100% |
| Polling статуса | ✅ `setTimeout()` в цикле | ✅ `setTimeout()` в цикле | ✅ 100% |
| Обработка результата | ✅ `response.json()` | ✅ `response.json()` | ✅ 100% |
| Загрузка изображения | ✅ `fetch(imageUrl)` | ✅ `fetch(imageUrl)` | ✅ 100% |
| Сохранение в Storage | ✅ Supabase Storage | ✅ Convex Storage | ✅ 100% |
| Обновление БД | ✅ Supabase client | ✅ `ctx.runMutation()` | ✅ 100% |

**Вывод**: ✅ **ПОЛНОСТЬЮ СОВМЕСТИМО**

---

### Функция 3: Audio Generation (ElevenLabs)

| Аспект | Edge Functions | Convex Actions | Совместимость |
|--------|----------------|----------------|---------------|
| HTTP запрос к ElevenLabs | ✅ `fetch()` напрямую | ✅ `fetch()` напрямую | ✅ 100% |
| Получение ArrayBuffer | ✅ `response.arrayBuffer()` | ✅ `response.arrayBuffer()` | ✅ 100% |
| Создание Blob | ✅ `new Blob([buffer])` | ✅ `new Blob([buffer])` | ✅ 100% |
| Загрузка в Storage | ✅ Supabase Storage | ✅ Convex Storage | ✅ 100% |
| Обновление БД | ✅ Supabase client | ✅ `ctx.runMutation()` | ✅ 100% |

**Вывод**: ✅ **ПОЛНОСТЬЮ СОВМЕСТИМО**

---

## 🎯 Итоговая оценка

### ✅ Convex Actions ПОДДЕРЖИВАЮТ ВСЮ НЕОБХОДИМУЮ ЛОГИКУ

| Критерий | Оценка | Комментарий |
|----------|--------|-------------|
| **Совместимость с Edge Functions** | ✅ 95% | Почти идентичная функциональность |
| **HTTP запросы** | ✅ 100% | Полная поддержка fetch API |
| **File Storage** | ✅ 100% | Convex Storage проще в использовании |
| **Long-running operations** | ✅ 100% | Нет timeout ограничений |
| **Real-time** | ✅ 100% | Автоматический (лучше чем Supabase) |
| **Аутентификация** | ✅ 100% | Проще API |
| **Обработка ошибок** | ✅ 100% | Стандартный try/catch |

---

## 🚨 Единственное отличие для MVP

### Webhooks (НЕ используем в MVP)

**Edge Functions**: Встроенная поддержка webhooks  
**Convex**: Нужно создавать HTTP Actions

**Для MVP**: ⚠️ **НЕ КРИТИЧНО** - мы используем polling вместо webhooks

---

## 📝 Рекомендация

### ✅ Convex Actions ПОЛНОСТЬЮ подходят для замены Edge Functions

**Преимущества Convex**:
1. ✅ Автоматический real-time (не нужен polling на фронтенде)
2. ✅ Проще API для Storage
3. ✅ Проще аутентификация
4. ✅ Нет timeout ограничений
5. ✅ Типобезопасность из коробки
6. ✅ Меньше boilerplate кода

**Недостатки Convex**:
1. ⚠️ Нужно изучить новую платформу (1-2 часа)
2. ⚠️ Другой синтаксис для env переменных

**Вывод**: ✅ **ИСПОЛЬЗОВАТЬ CONVEX** - все функции MVP поддерживаются, код будет проще и чище

---

## 🔄 Миграция с Edge Functions на Convex Actions

### Пример: Storyboard Generation

**Было (Edge Function)**:
```typescript
serve(async (req) => {
  const { projectId, scenarioText, styleId } = await req.json();
  
  // Получить стиль
  const { data: style } = await supabase.from('styles').select('prompt').eq('id', styleId).single();
  
  // Вызвать OpenRouter
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model: 'google/gemini-1.5-flash', messages: [...] })
  });
  
  const data = await response.json();
  const scenes = JSON.parse(data.choices[0].message.content);
  
  // Сохранить сцены
  await supabase.from('scenes').insert(scenes.map(...));
  
  return new Response(JSON.stringify({ success: true }));
});
```

**Станет (Convex Action)**:
```typescript
export const generateStoryboard = action({
  args: {
    projectId: v.id("projects"),
    scenarioText: v.string(),
    styleId: v.id("styles"),
  },
  handler: async (ctx, args) => {
    // Получить стиль через mutation (типобезопасно!)
    const style = await ctx.runQuery(api.functions.styles.getStyleById, {
      styleId: args.styleId
    });
    
    // Вызвать OpenRouter (идентично)
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ model: 'google/gemini-1.5-flash', messages: [...] })
    });
    
    const data = await response.json();
    const scenes = JSON.parse(data.choices[0].message.content);
    
    // Сохранить сцены через mutation (типобезопасно!)
    await ctx.runMutation(api.functions.scenes.createScenes, {
      projectId: args.projectId,
      scenes: scenes.map(...)
    });
    
    return { success: true };
  }
});
```

**Различия**:
- ✅ Типобезопасность (автогенерируемые типы)
- ✅ Проще API (не нужно создавать Supabase client)
- ✅ Автоматический real-time (UI обновляется сам)

---

## ✅ Финальный вердикт

### Convex Actions **ПОЛНОСТЬЮ** поддерживают всю логику Edge Functions

**Можно реализовать в Convex**:
- ✅ Storyboard generation (OpenRouter)
- ✅ Image generation (Replicate + polling)
- ✅ Audio generation (ElevenLabs напрямую)
- ✅ File storage (загрузка и получение)
- ✅ Real-time обновления
- ✅ Аутентификация
- ✅ Обработка ошибок

**Вывод**: ✅ **ИСПОЛЬЗОВАТЬ CONVEX** - все работает, код будет проще!

---

*Создано: 2025-01-31*  
*Для плана разработки см.: [CONVEX_DEVELOPMENT_PLAN.md](./CONVEX_DEVELOPMENT_PLAN.md)*

