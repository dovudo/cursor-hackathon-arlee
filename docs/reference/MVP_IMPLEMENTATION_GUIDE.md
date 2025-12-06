# 🚀 Руководство по реализации MVP для хакатона

> **Время**: 6-7 часов | **Цель**: Рабочий MVP для демо | **Основа**: arlekino-firebase-2

---

## 🎯 Быстрый старт

### Выбор архитектуры

**Рекомендация**: Использовать **Supabase** для быстрой реализации (6-7 часов)

**Альтернатива**: Использовать **Convex** если есть время и хотите продемонстрировать продукт спонсора (8-10 часов)

Подробный анализ: [HACKATHON_SPONSORS_ANALYSIS.md](./HACKATHON_SPONSORS_ANALYSIS.md)

---

## 📋 Пошаговый план (Supabase вариант)

### Этап 1: Подготовка (30 минут)

#### 1.1 Создание проекта
```bash
# Клонировать или создать новую ветку
git checkout -b hackathon-mvp

# Установить зависимости
cd frontend && npm install
cd ../backend && npm install
```

#### 1.2 Настройка окружения

**Frontend (.env.local)**:
```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Backend (Supabase Dashboard → Edge Functions → Secrets)**:
```bash
OPENROUTER_API_KEY=sk-or-...
REPLICATE_API_TOKEN=r8_...
ELEVENLABS_API_KEY=...  # НАСТОЯЩИЙ КЛЮЧ!
```

#### 1.3 Создание Storage buckets
В Supabase Dashboard → Storage:
- Создать bucket `images` (публичный)
- Создать bucket `audio` (публичный)

**Чеклист**:
- [ ] Проект создан
- [ ] Зависимости установлены
- [ ] Переменные окружения настроены
- [ ] Storage buckets созданы

---

### Этап 2: Database (1 час)

#### 2.1 Создание миграции
```bash
cd backend
supabase migration new hackathon_mvp_simplified
```

#### 2.2 SQL миграция

Создать файл миграции с содержимым:

```sql
-- 1. user_profiles (минимальная версия)
CREATE TABLE IF NOT EXISTS user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- 2. styles (предустановленные стили)
CREATE TABLE IF NOT EXISTS styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prompt text NOT NULL,
  image_url text,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 3. projects (упрощенная версия)
CREATE TABLE IF NOT EXISTS projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  scenario_text text NOT NULL,
  style_id uuid REFERENCES styles(id),
  created_at timestamptz DEFAULT now()
);

-- 4. scenes (с image_url и audio_url напрямую)
CREATE TABLE IF NOT EXISTS scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  order_index integer NOT NULL,
  name text NOT NULL,
  script_content text NOT NULL,
  image_prompt text,
  image_url text,
  audio_url text,
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, order_index)
);

-- 5. generation_events (для отслеживания статуса)
CREATE TABLE IF NOT EXISTS generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES scenes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image', 'audio')),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_url text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_scenes_project_id ON scenes(project_id);
CREATE INDEX IF NOT EXISTS idx_scenes_order_index ON scenes(project_id, order_index);
CREATE INDEX IF NOT EXISTS idx_generation_events_scene_id ON generation_events(scene_id);
CREATE INDEX IF NOT EXISTS idx_generation_events_status ON generation_events(status);

-- Seed данные: 3 простых стиля
INSERT INTO styles (name, description, prompt, is_public) VALUES
  ('Cinematic', 'Cinematic style with dramatic lighting', 'Cinematic style with dramatic lighting, film noir atmosphere, high contrast', true),
  ('Documentary', 'Documentary style, realistic and natural', 'Documentary style, realistic and natural lighting, authentic feel', true),
  ('Minimalist', 'Minimalist style, clean and simple', 'Minimalist style, clean and simple, modern aesthetic', true)
ON CONFLICT DO NOTHING;

-- RLS политики
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE styles ENABLE ROW LEVEL SECURITY;

-- Политики для projects
CREATE POLICY "Users can manage their own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

-- Политики для scenes
CREATE POLICY "Users can manage scenes in their projects" ON scenes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = scenes.project_id AND user_id = auth.uid())
  );

-- Политики для styles
CREATE POLICY "Anyone can view public styles" ON styles
  FOR SELECT USING (is_public = true);

-- Политики для generation_events
CREATE POLICY "Users can view their generation events" ON generation_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scenes s
      JOIN projects p ON s.project_id = p.id
      WHERE s.id = generation_events.scene_id AND p.user_id = auth.uid()
    )
  );
```

#### 2.3 Применение миграции
```bash
supabase db push
```

**Чеклист**:
- [ ] Миграция создана
- [ ] Миграция применена
- [ ] Seed данные загружены (3 стиля)
- [ ] RLS политики работают

---

### Этап 3: Backend - Edge Functions (2-3 часа)

#### 3.1 `storyboard-generation` (1 час)

**Создать функцию**:
```bash
supabase functions new storyboard-generation
```

**Реализация** (`backend/supabase/functions/storyboard-generation/index.ts`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get JWT token
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    // Verify user
    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Parse request
    const { projectId, scenarioText, styleId } = await req.json()

    if (!projectId || !scenarioText || !styleId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get style
    const { data: style, error: styleError } = await supabase
      .from('styles')
      .select('prompt')
      .eq('id', styleId)
      .single()

    if (styleError || !style) {
      return new Response(
        JSON.stringify({ success: false, error: 'Style not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build AI prompt
    const prompt = `Разбей следующий сценарий на сцены для видеоролика. Каждая сцена должна иметь:
1. Название сцены (краткое, 2-5 слов)
2. Текст сцены для озвучки (1-3 предложения)
3. Промпт для генерации изображения (детальное описание визуала)

Стиль: ${style.prompt}

Сценарий:
${scenarioText}

Верни результат в формате JSON массива:
[
  {
    "title": "Название сцены",
    "text": "Текст для озвучки",
    "imagePrompt": "Детальный промпт для изображения"
  }
]`

    // Call OpenRouter API
    const openRouterResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://your-app.com',
        'X-Title': 'Arlekino AI'
      },
      body: JSON.stringify({
        model: 'google/gemini-1.5-flash',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.7
      })
    })

    if (!openRouterResponse.ok) {
      throw new Error(`OpenRouter API error: ${openRouterResponse.statusText}`)
    }

    const openRouterData = await openRouterResponse.json()
    const aiResponse = openRouterData.choices[0].message.content

    // Parse JSON from AI response
    const jsonMatch = aiResponse.match(/\[[\s\S]*\]/)
    if (!jsonMatch) {
      throw new Error('No JSON found in AI response')
    }

    const scenes = JSON.parse(jsonMatch[0])

    // Save scenes to database
    const scenesToInsert = scenes.map((scene: any, index: number) => ({
      project_id: projectId,
      order_index: index,
      name: scene.title,
      script_content: scene.text,
      image_prompt: scene.imagePrompt
    }))

    const { data: insertedScenes, error: insertError } = await supabase
      .from('scenes')
      .insert(scenesToInsert)
      .select()

    if (insertError) {
      throw new Error(`Database error: ${insertError.message}`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        scenes: insertedScenes.map((scene, index) => ({
          id: scene.id,
          orderIndex: scene.order_index,
          title: scene.name,
          text: scene.script_content,
          imagePrompt: scene.image_prompt
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

**Deploy**:
```bash
supabase functions deploy storyboard-generation
```

**Чеклист**:
- [ ] Функция создана
- [ ] Логика реализована
- [ ] Обработка ошибок добавлена
- [ ] Функция задеплоена
- [ ] Протестирована через Supabase Dashboard

---

#### 3.2 `generate-image` (1 час)

**Создать функцию**:
```bash
supabase functions new generate-image
```

**Реализация** (`backend/supabase/functions/generate-image/index.ts`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { sceneId, prompt } = await req.json()

    if (!sceneId || !prompt) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing sceneId or prompt' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create generation event
    const { data: event, error: eventError } = await supabase
      .from('generation_events')
      .insert({
        scene_id: sceneId,
        type: 'image',
        status: 'processing'
      })
      .select()
      .single()

    if (eventError) {
      throw new Error(`Failed to create event: ${eventError.message}`)
    }

    // Call Replicate API
    const replicateResponse = await fetch('https://api.replicate.com/v1/predictions', {
      method: 'POST',
      headers: {
        'Authorization': `Token ${Deno.env.get('REPLICATE_API_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        version: 'black-forest-labs/flux-pro',
        input: {
          prompt: prompt,
          aspect_ratio: '16:9',
          output_format: 'webp'
        }
      })
    })

    if (!replicateResponse.ok) {
      throw new Error(`Replicate API error: ${replicateResponse.statusText}`)
    }

    const prediction = await replicateResponse.json()

    // Poll for result (synchronous, max 2 minutes)
    let result = prediction
    const maxAttempts = 60
    let attempts = 0

    while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, 2000)) // Wait 2 seconds

      const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
        headers: {
          'Authorization': `Token ${Deno.env.get('REPLICATE_API_TOKEN')}`
        }
      })

      result = await statusResponse.json()
      attempts++
    }

    if (result.status !== 'succeeded') {
      await supabase
        .from('generation_events')
        .update({ status: 'failed', error_message: 'Generation timeout or failed' })
        .eq('id', event.id)

      throw new Error('Image generation failed')
    }

    // Download image
    const imageUrl = result.output[0]
    const imageResponse = await fetch(imageUrl)
    const imageBlob = await imageResponse.blob()

    // Upload to Supabase Storage
    const fileName = `${sceneId}-${Date.now()}.webp`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('images')
      .upload(fileName, imageBlob, {
        contentType: 'image/webp',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Storage upload error: ${uploadError.message}`)
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('images')
      .getPublicUrl(fileName)

    // Update scene with image URL
    await supabase
      .from('scenes')
      .update({ image_url: publicUrl })
      .eq('id', sceneId)

    // Update generation event
    await supabase
      .from('generation_events')
      .update({ status: 'completed', result_url: publicUrl })
      .eq('id', event.id)

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        eventId: event.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

**Deploy**:
```bash
supabase functions deploy generate-image
```

**Чеклист**:
- [ ] Функция создана
- [ ] Логика реализована
- [ ] Polling реализован
- [ ] Storage upload работает
- [ ] Функция задеплоена
- [ ] Протестирована

---

#### 3.3 `generate-audio` (1 час) ⚠️ КРИТИЧЕСКИ ВАЖНО

**Создать функцию**:
```bash
supabase functions new generate-audio
```

**Реализация** (`backend/supabase/functions/generate-audio/index.ts`):

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    )

    const { data: { user }, error: userError } = await supabase.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { sceneId, text, voiceId } = await req.json()

    if (!sceneId || !text || !voiceId) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing sceneId, text, or voiceId' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create generation event
    const { data: event, error: eventError } = await supabase
      .from('generation_events')
      .insert({
        scene_id: sceneId,
        type: 'audio',
        status: 'processing'
      })
      .select()
      .single()

    if (eventError) {
      throw new Error(`Failed to create event: ${eventError.message}`)
    }

    // ⚠️ КРИТИЧЕСКИ ВАЖНО: Прямой вызов ElevenLabs API (БЕЗ PROXY!)
    console.log('🎵 TTS: Calling ElevenLabs API directly')
    console.log(`URL: https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`)

    const elevenLabsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY')!, // НАСТОЯЩИЙ КЛЮЧ!
          'Content-Type': 'application/json',
          'Accept': 'audio/mpeg'
        },
        body: JSON.stringify({
          text: text,
          model_id: 'eleven_multilingual_v2',
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.8
          }
        })
      }
    )

    if (!elevenLabsResponse.ok) {
      const errorText = await elevenLabsResponse.text()
      throw new Error(`ElevenLabs API error: ${elevenLabsResponse.status} - ${errorText}`)
    }

    // Get audio as ArrayBuffer
    const audioArrayBuffer = await elevenLabsResponse.arrayBuffer()

    // Upload to Supabase Storage
    const fileName = `${sceneId}-${Date.now()}.mp3`
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('audio')
      .upload(fileName, audioArrayBuffer, {
        contentType: 'audio/mpeg',
        upsert: false
      })

    if (uploadError) {
      throw new Error(`Storage upload error: ${uploadError.message}`)
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('audio')
      .getPublicUrl(fileName)

    // Update scene with audio URL
    await supabase
      .from('scenes')
      .update({ audio_url: publicUrl })
      .eq('id', sceneId)

    // Update generation event
    await supabase
      .from('generation_events')
      .update({ status: 'completed', result_url: publicUrl })
      .eq('id', event.id)

    return new Response(
      JSON.stringify({
        success: true,
        url: publicUrl,
        eventId: event.id
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
```

**Deploy**:
```bash
supabase functions deploy generate-audio
```

**КРИТИЧЕСКИ ВАЖНО**: Проверить в логах, что ElevenLabs вызывается напрямую!

**Чеклист**:
- [ ] Функция создана
- [ ] ElevenLabs вызывается НАПРЯМУЮ (проверить код!)
- [ ] Storage upload работает
- [ ] Функция задеплоена
- [ ] Протестирована
- [ ] В логах видно прямой вызов ElevenLabs

---

### Этап 4: Frontend (2-3 часа)

См. детальный план в [FRONTEND_FROM_SCRATCH.md](./FRONTEND_FROM_SCRATCH.md)

**Основные шаги**:
1. Создать ProjectContext (React Context)
2. Реализовать onboarding page (4 шага)
3. Компонент отображения storyboard
4. Polling статуса генерации

---

### Этап 5: Тестирование (1 час)

**End-to-end тесты**:
1. Создать проект
2. Генерировать storyboard
3. Проверить генерацию изображений
4. Проверить генерацию аудио (ElevenLabs)

**Чеклист**:
- [ ] Все тесты пройдены
- [ ] Нет критических ошибок
- [ ] UI работает корректно
- [ ] ElevenLabs вызывается напрямую (проверено в логах)

---

### Этап 6: Деплой (30 минут)

```bash
# Deploy все функции
supabase functions deploy --all

# Deploy frontend
cd frontend
npm run build
vercel deploy  # или другой хостинг
```

---

## ✅ Финальный чеклист

### Backend
- [ ] Все 3 Edge Functions задеплоены
- [ ] ElevenLabs вызывается напрямую (проверено в логах)
- [ ] Нет проверок кредитов
- [ ] Storage buckets созданы и работают

### Frontend
- [ ] ProjectContext работает
- [ ] Onboarding flow работает полностью
- [ ] Polling статуса работает
- [ ] UI приятный и похож на оригинал

### Интеграция
- [ ] End-to-end flow работает
- [ ] Нет критических ошибок
- [ ] Готово к демо

---

## 🚨 Критические моменты

1. **ElevenLabs НАПРЯМУЮ** - проверить в коде и логах
2. **Нет кредитов** - удалить все проверки баланса
3. **Простой polling** - каждые 2-3 секунды

---

*Создано: 2025-01-31*  
*Для анализа продуктов спонсоров см.: [HACKATHON_SPONSORS_ANALYSIS.md](./HACKATHON_SPONSORS_ANALYSIS.md)*

