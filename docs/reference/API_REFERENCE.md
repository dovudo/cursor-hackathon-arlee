# 📡 API Reference - Arlekino AI MVP

> **Версия**: MVP для хакатона  
> **Base URL**: `https://your-project.supabase.co/functions/v1`

---

## 🔐 Authentication

Все Edge Functions требуют JWT токен в заголовке:

```
Authorization: Bearer <JWT_TOKEN>
```

Токен получается через Supabase Auth:
```typescript
const { data: { session } } = await supabase.auth.getSession()
const token = session?.access_token
```

---

## 📋 Endpoints

### 1. Storyboard Generation

**Endpoint**: `POST /storyboard-generation`

**Описание**: Генерирует storyboard из текстового сценария с помощью AI

**Request Body**:
```typescript
{
  projectId: string      // UUID проекта
  scenarioText: string   // Текст сценария
  styleId: string        // UUID выбранного стиля
}
```

**Response** (200 OK):
```typescript
{
  success: true
  scenes: Array<{
    id: string           // UUID сцены
    orderIndex: number   // Порядковый номер (0-based)
    title: string        // Название сцены
    text: string         // Текст сцены для озвучки
    imagePrompt: string  // Промпт для генерации изображения
  }>
}
```

**Response** (400 Bad Request):
```typescript
{
  success: false
  error: string  // Описание ошибки
}
```

**Response** (401 Unauthorized):
```typescript
{
  success: false
  error: "Unauthorized" | "Invalid token"
}
```

**Пример использования**:
```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/storyboard-generation`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      projectId: '123e4567-e89b-12d3-a456-426614174000',
      scenarioText: 'A story about a hero...',
      styleId: '456e7890-e89b-12d3-a456-426614174001'
    })
  }
)

const data = await response.json()
if (data.success) {
  console.log('Scenes generated:', data.scenes)
}
```

---

### 2. Generate Image

**Endpoint**: `POST /generate-image`

**Описание**: Генерирует изображение для сцены через Replicate FLUX

**Request Body**:
```typescript
{
  sceneId: string  // UUID сцены
  prompt: string   // Промпт для генерации изображения
}
```

**Response** (200 OK):
```typescript
{
  success: true
  url: string      // Публичный URL изображения в Supabase Storage
  eventId: string  // UUID события генерации
}
```

**Response** (400/500):
```typescript
{
  success: false
  error: string  // Описание ошибки
}
```

**Процесс**:
1. Создает `generation_event` со статусом `processing`
2. Вызывает Replicate API
3. Polling результата (синхронный, до 2 минут)
4. Загружает изображение в Storage
5. Обновляет `scenes.image_url`

**Пример использования**:
```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/generate-image`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sceneId: '789e0123-e89b-12d3-a456-426614174002',
      prompt: 'A cinematic scene with dramatic lighting...'
    })
  }
)

const data = await response.json()
if (data.success) {
  console.log('Image URL:', data.url)
}
```

---

### 3. Generate Audio

**Endpoint**: `POST /generate-audio`

**Описание**: Генерирует аудио для сцены через ElevenLabs **НАПРЯМУЮ**

**Request Body**:
```typescript
{
  sceneId: string  // UUID сцены
  text: string     // Текст для озвучки
  voiceId: string  // UUID голоса ElevenLabs (например, '21m00Tcm4TlvDq8ikWAM')
}
```

**Response** (200 OK):
```typescript
{
  success: true
  url: string      // Публичный URL аудио в Supabase Storage
  eventId: string  // UUID события генерации
}
```

**Response** (400/500):
```typescript
{
  success: false
  error: string  // Описание ошибки
}
```

**Процесс**:
1. Создает `generation_event` со статусом `processing`
2. **Прямой вызов ElevenLabs API** (`https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`)
3. Получает аудио как ArrayBuffer
4. Загружает в Storage
5. Обновляет `scenes.audio_url`

**КРИТИЧЕСКИ ВАЖНО**: ElevenLabs вызывается напрямую, без proxy!

**Пример использования**:
```typescript
const response = await fetch(
  `${SUPABASE_URL}/functions/v1/generate-audio`,
  {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      sceneId: '789e0123-e89b-12d3-a456-426614174002',
      text: 'This is the narration text for the scene.',
      voiceId: '21m00Tcm4TlvDq8ikWAM'  // Rachel voice
    })
  }
)

const data = await response.json()
if (data.success) {
  console.log('Audio URL:', data.url)
}
```

---

## 🗄️ Database Queries

### Получить стили

```typescript
const { data: styles } = await supabase
  .from('styles')
  .select('*')
  .eq('is_public', true)
```

### Получить сцены проекта

```typescript
const { data: scenes } = await supabase
  .from('scenes')
  .select('*')
  .eq('project_id', projectId)
  .order('order_index', { ascending: true })
```

### Получить статус генерации

```typescript
const { data: event } = await supabase
  .from('generation_events')
  .select('status, result_url, error_message')
  .eq('scene_id', sceneId)
  .eq('type', 'image')  // или 'audio'
  .order('created_at', { ascending: false })
  .limit(1)
  .single()
```

---

## 🔄 Polling Pattern

Для проверки статуса генерации используйте polling:

```typescript
async function pollGenerationStatus(
  sceneId: string,
  type: 'image' | 'audio'
): Promise<string> {
  const maxAttempts = 30  // 30 * 2 сек = 1 минута максимум
  let attempts = 0

  while (attempts < maxAttempts) {
    const { data: event } = await supabase
      .from('generation_events')
      .select('status, result_url')
      .eq('scene_id', sceneId)
      .eq('type', type)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (event?.status === 'completed') {
      return event.result_url
    }

    if (event?.status === 'failed') {
      throw new Error('Generation failed')
    }

    await new Promise(resolve => setTimeout(resolve, 2000))  // 2 секунды
    attempts++
  }

  throw new Error('Polling timeout')
}
```

---

## 🚨 Error Handling

### Типичные ошибки

**401 Unauthorized**:
- Проверьте JWT токен
- Убедитесь, что токен не истек
- Проверьте формат заголовка Authorization

**400 Bad Request**:
- Проверьте формат входных данных
- Убедитесь, что все обязательные поля заполнены
- Проверьте типы данных (UUID, string, etc.)

**500 Internal Server Error**:
- Проверьте логи Edge Functions в Supabase Dashboard
- Убедитесь, что все переменные окружения настроены
- Проверьте доступность внешних API (OpenRouter, Replicate, ElevenLabs)

### Обработка ошибок в коде

```typescript
try {
  const response = await fetch(endpoint, options)
  
  if (!response.ok) {
    const error = await response.json()
    throw new Error(error.error || `HTTP ${response.status}`)
  }
  
  const data = await response.json()
  return data
} catch (error) {
  console.error('API Error:', error)
  // Показать пользователю понятное сообщение об ошибке
  throw error
}
```

---

## 📊 Rate Limits

### OpenRouter
- Зависит от вашего плана OpenRouter
- Рекомендуется: не более 10 запросов в секунду

### Replicate
- Зависит от вашего плана Replicate
- Рекомендуется: не более 5 одновременных генераций

### ElevenLabs
- Зависит от вашего плана ElevenLabs
- Рекомендуется: не более 3 одновременных запросов

**Для MVP**: Последовательная обработка (не параллельная) для простоты.

---

## 🔍 Debugging

### Логи Edge Functions

Проверьте логи в Supabase Dashboard:
1. Перейдите в Edge Functions
2. Выберите функцию
3. Откройте вкладку "Logs"

### Проверка вызова ElevenLabs

В логах `generate-audio` должно быть:
```
🎵 TTS: Calling ElevenLabs API directly
URL: https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
```

**НЕ должно быть**:
- Proxy URL
- VoicerAPI
- Любые посредники

---

*Создано: 2025-01-31*  
*Для архитектуры см.: [ARCHITECTURE.md](./ARCHITECTURE.md)*  
*Для плана реализации см.: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)*
