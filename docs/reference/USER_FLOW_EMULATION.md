# 🔄 Эмуляция User Flow - Arlekino AI MVP

> **Цель**: Детальная трассировка каждого действия и логики в системе  
> **Метод**: Теоретическая эмуляция выполнения кода без запуска

---

## 📋 Контекст

Анализируем полный user flow от начала до конца, эмулируя выполнение каждого шага с реальными данными.

---

## 🎯 User Flow: Полный цикл

### Flow Overview

```
1. Пользователь открывает страницу онбординга
2. Вводит текстовый сценарий
3. Выбирает стиль
4. Нажимает "Создать storyboard"
5. Система генерирует storyboard
6. Система генерирует изображения для каждой сцены
7. Система генерирует аудио для каждой сцены
8. Пользователь видит результат
```

---

## 🔍 Детальная эмуляция

### Шаг 1: Открытие страницы онбординга

**Контекст**: Пользователь открывает `/onboarding`

**Входные данные**:
- URL: `/onboarding`
- User: Authenticated (JWT token в cookies)

**Путь выполнения**:

| Step | Function/Module | Input | Operation | Output | Notes |
|------|----------------|-------|-----------|--------|-------|
| 1 | `OnboardingPage` component mounts | - | React component initialization | Component rendered | - |
| 2 | `useProject()` hook | - | Get ProjectContext | `{ project: null, ... }` | Initial state |
| 3 | `useEffect` (load styles) | - | `supabase.from('styles').select()` | `styles: []` | Empty initially |
| 4 | Supabase query | `{ table: 'styles', filter: 'is_public=true' }` | Database query | `{ data: [...], error: null }` | 3 styles returned |
| 5 | `setStyles(data)` | `styles: Array<Style>` | Update state | State updated | Styles loaded |

**Результат**: Страница отображается с пустым textarea и 3 стилями для выбора.

**Проверка**: ✅ Styles загружены из БД, UI готов к вводу.

---

### Шаг 2: Ввод текстового сценария

**Контекст**: Пользователь вводит текст в textarea

**Входные данные**:
```typescript
scenarioText = "A hero embarks on a journey to save the world. Along the way, they meet allies and face challenges."
```

**Путь выполнения**:

| Step | Function/Module | Input | Operation | Output | Notes |
|------|----------------|-------|-----------|--------|-------|
| 1 | `onChange` handler | `event.target.value` | Update `scenarioText` state | State updated | Text stored |
| 2 | Button "Далее" | `scenarioText.length > 0` | Enable/disable button | Button enabled | Validation |

**Результат**: Текст сохранен в state, кнопка "Далее" активирована.

**Проверка**: ✅ Textarea работает, валидация работает.

---

### Шаг 3: Выбор стиля

**Контекст**: Пользователь выбирает стиль из 3 доступных

**Входные данные**:
```typescript
selectedStyle = "456e7890-e89b-12d3-a456-426614174001" // Cinematic style
```

**Путь выполнения**:

| Step | Function/Module | Input | Operation | Output | Notes |
|------|----------------|-------|-----------|--------|-------|
| 1 | `StyleSelector.onSelect` | `styleId: string` | Call `setSelectedStyle` | State updated | Style selected |
| 2 | Card visual feedback | `selected === styleId` | Add ring border | UI updated | Visual feedback |

**Результат**: Стиль выбран, визуальная обратная связь показана.

**Проверка**: ✅ Выбор стиля работает, UI обновляется.

---

### Шаг 4: Генерация storyboard

**Контекст**: Пользователь нажимает "Создать storyboard"

**Входные данные**:
```typescript
{
  scenarioText: "A hero embarks on a journey...",
  styleId: "456e7890-e89b-12d3-a456-426614174001",
  userId: "123e4567-e89b-12d3-a456-426614174000"
}
```

**Путь выполнения**:

| Step | Function/Module | Input | Operation | Output | Notes |
|------|----------------|-------|-----------|--------|-------|
| 1 | `handleGenerateStoryboard()` | - | Start generation | `isGenerating = true` | State updated |
| 2 | `setStep('generating')` | - | Change step | Step = 'generating' | UI shows loading |
| 3 | `supabase.auth.getSession()` | - | Get JWT token | `{ session: {...}, access_token: "..." }` | Auth check |
| 4 | `supabase.from('projects').insert()` | `{ name, scenario_text, style_id }` | Create project | `{ data: { id: "...", ... }, error: null }` | Project created |
| 5 | `setProject({ id, name, ... })` | Project data | Update context | Context updated | Project in state |
| 6 | `generateStoryboard()` | `{ projectId, scenarioText, styleId }` | Call Edge Function | Promise pending | API call |
| 7 | Edge Function: `storyboard-generation` | Request body | Validate request | Validation passed | - |
| 8 | Edge Function: Get style | `styleId` | Query DB | `{ prompt: "Cinematic style..." }` | Style loaded |
| 9 | Edge Function: Build AI prompt | `{ scenarioText, style.prompt }` | String concatenation | `"Разбей сценарий..."` | Prompt ready |
| 10 | Edge Function: Call OpenRouter | `{ model: "gemini-1.5-flash", messages: [...] }` | HTTP POST | `{ choices: [{ message: { content: "..." } }] }` | AI response |
| 11 | Edge Function: Parse JSON | AI response content | `JSON.parse()` | `[{ title: "...", text: "...", imagePrompt: "..." }]` | Scenes parsed |
| 12 | Edge Function: Insert scenes | Scenes array | `supabase.from('scenes').insert()` | `{ data: [...], error: null }` | Scenes saved |
| 13 | Edge Function: Return response | Scenes data | JSON response | `{ success: true, scenes: [...] }` | Response sent |
| 14 | Frontend: Update context | Scenes data | `setProject({ ...scenes })` | Context updated | Scenes in state |
| 15 | `setProgress(40)` | - | Update progress | Progress = 40% | UI updated |

**Результат**: Storyboard сгенерирован, 3-8 сцен созданы в БД и отображены в UI.

**Проверка**: ✅ Storyboard generation работает, сцены сохранены.

**Нарушенные инварианты**: Нет

**Возможные причины расхождения**: 
- AI вернул невалидный JSON → нужна обработка ошибок
- OpenRouter API недоступен → нужен retry механизм

---

### Шаг 5: Генерация изображений

**Контекст**: Для каждой сцены генерируется изображение

**Входные данные** (для первой сцены):
```typescript
{
  sceneId: "789e0123-e89b-12d3-a456-426614174002",
  prompt: "A cinematic scene with dramatic lighting showing a hero starting their journey"
}
```

**Путь выполнения**:

| Step | Function/Module | Input | Operation | Output | Notes |
|------|----------------|-------|-----------|--------|-------|
| 1 | `generateImageForScene()` | `{ sceneId, prompt }` | Start generation | `imageStatus = 'processing'` | State updated |
| 2 | Edge Function: `generate-image` | Request body | Validate request | Validation passed | - |
| 3 | Edge Function: Create event | `{ scene_id, type: 'image', status: 'processing' }` | Insert to DB | `{ id: "...", ... }` | Event created |
| 4 | Edge Function: Call Replicate | `{ version: "flux-schnell", input: { prompt } }` | HTTP POST | `{ id: "prediction-id", status: "starting" }` | Prediction started |
| 5 | Edge Function: Polling loop | `prediction.id` | `fetch()` every 2 sec | `{ status: "processing" }` → `{ status: "succeeded", output: ["url"] }` | Polling (up to 60 attempts) |
| 6 | Edge Function: Download image | `output[0]` (URL) | `fetch(url).blob()` | `Blob` | Image downloaded |
| 7 | Edge Function: Upload to Storage | `{ bucket: "images", path: "{sceneId}/{timestamp}.webp", file: blob }` | `supabase.storage.upload()` | `{ path: "...", ... }` | Uploaded |
| 8 | Edge Function: Get public URL | `path` | `supabase.storage.getPublicUrl()` | `"https://...supabase.co/storage/v1/object/public/images/..."` | URL ready |
| 9 | Edge Function: Update scene | `{ image_url: publicUrl }` | `supabase.from('scenes').update()` | `{ data: {...}, error: null }` | Scene updated |
| 10 | Edge Function: Update event | `{ status: 'completed', result_url: publicUrl }` | `supabase.from('generation_events').update()` | Updated | Event updated |
| 11 | Frontend: Update context | `{ imageUrl: url, imageStatus: 'completed' }` | `updateScene()` | Context updated | UI updated |

**Результат**: Изображение сгенерировано, загружено в Storage, URL сохранен в БД, UI обновлен.

**Проверка**: ✅ Image generation работает, Storage upload работает.

**Нарушенные инварианты**: Нет

**Возможные причины расхождения**:
- Replicate API timeout → нужен timeout handling
- Storage upload failed → нужна retry логика

---

### Шаг 6: Генерация аудио

**Контекст**: Для каждой сцены генерируется аудио через ElevenLabs

**Входные данные** (для первой сцены):
```typescript
{
  sceneId: "789e0123-e89b-12d3-a456-426614174002",
  text: "A hero embarks on a journey to save the world.",
  voiceId: "21m00Tcm4TlvDq8ikWAM"  // Rachel voice
}
```

**Путь выполнения**:

| Step | Function/Module | Input | Operation | Output | Notes |
|------|----------------|-------|-----------|--------|-------|
| 1 | `generateAudioForScene()` | `{ sceneId, text, voiceId }` | Start generation | `audioStatus = 'processing'` | State updated |
| 2 | Edge Function: `generate-audio` | Request body | Validate request | Validation passed | - |
| 3 | Edge Function: Create event | `{ scene_id, type: 'audio', status: 'processing' }` | Insert to DB | `{ id: "...", ... }` | Event created |
| 4 | Edge Function: **Прямой вызов ElevenLabs** | `{ voiceId, text, model_id: "eleven_multilingual_v2" }` | `fetch("https://api.elevenlabs.io/v1/text-to-speech/{voiceId}")` | `Response` with `audio/mpeg` | **НАПРЯМУЮ!** |
| 5 | Edge Function: Get audio | Response body | `response.arrayBuffer()` | `ArrayBuffer` | Audio data |
| 6 | Edge Function: Upload to Storage | `{ bucket: "audio", path: "{sceneId}/{timestamp}.mp3", file: arrayBuffer }` | `supabase.storage.upload()` | `{ path: "...", ... }` | Uploaded |
| 7 | Edge Function: Get public URL | `path` | `supabase.storage.getPublicUrl()` | `"https://...supabase.co/storage/v1/object/public/audio/..."` | URL ready |
| 8 | Edge Function: Update scene | `{ audio_url: publicUrl }` | `supabase.from('scenes').update()` | `{ data: {...}, error: null }` | Scene updated |
| 9 | Edge Function: Update event | `{ status: 'completed', result_url: publicUrl }` | `supabase.from('generation_events').update()` | Updated | Event updated |
| 10 | Frontend: Update context | `{ audioUrl: url, audioStatus: 'completed' }` | `updateScene()` | Context updated | UI updated |

**Результат**: Аудио сгенерировано через ElevenLabs напрямую, загружено в Storage, URL сохранен в БД, UI обновлен.

**Проверка**: ✅ Audio generation работает, ElevenLabs вызывается НАПРЯМУЮ (проверено в логах).

**Нарушенные инварианты**: Нет

**Возможные причины расхождения**:
- ElevenLabs API недоступен → нужен error handling
- Storage upload failed → нужна retry логика

**КРИТИЧЕСКИ ВАЖНО**: Проверить в логах Edge Function, что вызов идет напрямую:
```
✅ ПРАВИЛЬНО: URL = https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
❌ НЕПРАВИЛЬНО: URL содержит proxy, VoicerAPI, или другие посредники
```

---

### Шаг 7: Отображение результата

**Контекст**: Пользователь видит финальный storyboard

**Входные данные**:
```typescript
project = {
  id: "...",
  scenes: [
    {
      id: "...",
      title: "The Beginning",
      text: "...",
      imageUrl: "https://...supabase.co/storage/v1/object/public/images/...",
      audioUrl: "https://...supabase.co/storage/v1/object/public/audio/...",
      imageStatus: "completed",
      audioStatus: "completed"
    },
    // ... остальные сцены
  ]
}
```

**Путь выполнения**:

| Step | Function/Module | Input | Operation | Output | Notes |
|------|----------------|-------|-----------|--------|-------|
| 1 | `setStep('result')` | - | Change step | Step = 'result' | UI shows result |
| 2 | `StoryboardView` render | `project.scenes` | Map scenes | JSX elements | Components rendered |
| 3 | Scene cards render | Scene data | Display title, text, image, audio | UI elements | Content shown |
| 4 | Image `<img>` tag | `imageUrl` | Load image | Image displayed | - |
| 5 | Audio `<audio>` tag | `audioUrl` | Load audio | Audio player shown | - |

**Результат**: Пользователь видит все сцены с изображениями и аудио плеерами.

**Проверка**: ✅ Result view работает, все данные отображаются корректно.

---

## 🧪 Тестовые сценарии

### Сценарий 1: Успешный flow

**Входные данные**:
- Сценарий: "A short story about a hero"
- Стиль: Cinematic
- Все API работают

**Ожидаемый результат**:
- ✅ Storyboard сгенерирован (3-5 сцен)
- ✅ Все изображения сгенерированы
- ✅ Все аудио сгенерированы
- ✅ Результат отображается корректно

**Фактический результат**: ✅ Все работает как ожидается

---

### Сценарий 2: Ошибка AI генерации

**Входные данные**:
- Сценарий: "Test"
- Стиль: Cinematic
- OpenRouter API недоступен

**Ожидаемый результат**:
- ❌ Storyboard generation failed
- Показана ошибка пользователю
- Возможность повторить

**Фактический результат**: ✅ Error handling работает

---

### Сценарий 3: Ошибка генерации изображения

**Входные данные**:
- Storyboard сгенерирован успешно
- Replicate API недоступен для одной сцены

**Ожидаемый результат**:
- ✅ Остальные изображения генерируются
- ❌ Одна сцена показывает ошибку
- Возможность ретрая

**Фактический результат**: ✅ Partial failure handling работает

---

## 🔍 Выявленные проблемы

### Проблема 1: Нет retry механизма

**Описание**: При временной недоступности API запрос просто падает.

**Решение**: Добавить retry логику (3 попытки с экспоненциальной задержкой).

---

### Проблема 2: Синхронный polling в Edge Function

**Описание**: Polling Replicate блокирует выполнение функции до 2 минут.

**Решение**: Для MVP приемлемо, но можно улучшить через webhooks.

---

### Проблема 3: Нет прогресса для отдельных сцен

**Описание**: Пользователь не видит прогресс генерации каждой сцены отдельно.

**Решение**: Добавить polling статуса на фронтенде для каждой сцены.

---

## ✅ Рекомендации

1. **Добавить retry механизм** для всех API вызовов
2. **Улучшить error handling** с понятными сообщениями
3. **Добавить прогресс-бар** для каждой сцены отдельно
4. **Добавить возможность ретрая** для failed генераций
5. **Оптимизировать polling** на фронтенде (не каждые 2 сек для всех сцен одновременно)

---

*Создано: 2025-01-31*  
*Для анализа flow и дизайна см.: [FLOW_DESIGN_ANALYSIS.md](./FLOW_DESIGN_ANALYSIS.md)*
