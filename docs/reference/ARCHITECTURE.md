# 🏗️ Архитектура Arlekino AI - Hackathon MVP

> **Версия**: MVP для хакатона  
> **Время реализации**: 6-7 часов  
> **Принцип**: Максимальная простота при сохранении core функциональности

---

## 📋 Обзор системы

Arlekino AI MVP - это упрощенная версия платформы для создания AI-генерируемых видеоконтентов. Система принимает текстовый сценарий от пользователя, генерирует storyboard с помощью AI, создает изображения и аудио для каждой сцены, и показывает результат.

### Ключевые принципы архитектуры

1. **Простота > Производительность** - для MVP приоритет на скорость разработки
2. **Прямые вызовы API** - минимум абстракций, максимум прозрачности
3. **Минимальная БД** - только необходимые таблицы
4. **React Context** - вместо Redux для простоты
5. **Polling** - вместо Realtime для упрощения

---

## 🗄️ Архитектура базы данных

### Схема (5 таблиц)

```sql
-- 1. user_profiles (минимальная версия)
CREATE TABLE user_profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  full_name text,
  created_at timestamptz DEFAULT now()
);

-- 2. projects (упрощенная версия)
CREATE TABLE projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name text NOT NULL,
  scenario_text text NOT NULL,
  style_id uuid REFERENCES styles(id),
  created_at timestamptz DEFAULT now()
);

-- 3. scenes (с image_url и audio_url напрямую)
CREATE TABLE scenes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid REFERENCES projects(id) ON DELETE CASCADE NOT NULL,
  order_index integer NOT NULL,
  name text NOT NULL,
  script_content text NOT NULL,
  image_prompt text,  -- Промпт для генерации изображения
  image_url text,      -- URL изображения из Supabase Storage
  audio_url text,      -- URL аудио из Supabase Storage
  created_at timestamptz DEFAULT now(),
  UNIQUE(project_id, order_index)
);

-- 4. styles (только публичные, предустановленные)
CREATE TABLE styles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  prompt text NOT NULL,
  image_url text,
  is_public boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- 5. generation_events (для отслеживания статуса через polling)
CREATE TABLE generation_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id uuid REFERENCES scenes(id) ON DELETE CASCADE,
  type text NOT NULL CHECK (type IN ('image', 'audio')),
  status text NOT NULL CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  result_url text,
  error_message text,
  created_at timestamptz DEFAULT now()
);

-- Индексы для производительности
CREATE INDEX idx_scenes_project_id ON scenes(project_id);
CREATE INDEX idx_scenes_order_index ON scenes(project_id, order_index);
CREATE INDEX idx_generation_events_scene_id ON generation_events(scene_id);
CREATE INDEX idx_generation_events_status ON generation_events(status);

-- Seed данные: 3 простых стиля
INSERT INTO styles (name, description, prompt, is_public) VALUES
  ('Cinematic', 'Cinematic style with dramatic lighting', 'Cinematic style with dramatic lighting, film noir atmosphere, high contrast', true),
  ('Documentary', 'Documentary style, realistic and natural', 'Documentary style, realistic and natural lighting, authentic feel', true),
  ('Minimalist', 'Minimalist style, clean and simple', 'Minimalist style, clean and simple, modern aesthetic', true);

-- RLS политики
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes ENABLE ROW LEVEL SECURITY;
ALTER TABLE generation_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own projects" ON projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can manage scenes in their projects" ON scenes
  FOR ALL USING (
    EXISTS (SELECT 1 FROM projects WHERE id = scenes.project_id AND user_id = auth.uid())
  );

CREATE POLICY "Anyone can view public styles" ON styles
  FOR SELECT USING (is_public = true);

CREATE POLICY "Users can view their generation events" ON generation_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM scenes s
      JOIN projects p ON s.project_id = p.id
      WHERE s.id = generation_events.scene_id AND p.user_id = auth.uid()
    )
  );
```

### Удаленные таблицы (не нужны для MVP)

- ❌ `assets` - храним URL напрямую в `scenes`
- ❌ `credits_transactions` - нет системы кредитов
- ❌ `usage_logs` - не нужны для MVP
- ❌ `provider_config` - хардкодим модели
- ❌ `jobs` - синхронная обработка
- ❌ `error_logs` - console.log достаточно

---

## 🔧 Backend: Edge Functions

### Структура (3 функции)

```
backend/supabase/functions/
├── storyboard-generation/    # Генерация storyboard из сценария
├── generate-image/           # Генерация изображений через Replicate
└── generate-audio/           # Генерация аудио через ElevenLabs (напрямую!)
```

### 1. `storyboard-generation/index.ts`

**Назначение**: Разбивает текстовый сценарий на сцены с помощью AI

**Входные данные**:
```typescript
{
  projectId: string
  scenarioText: string
  styleId: string
}
```

**Процесс**:
1. Получает стиль из БД
2. Формирует промпт для AI
3. Вызывает OpenRouter API (Gemini 1.5 Flash)
4. Парсит JSON ответ
5. Сохраняет сцены в БД

**Выходные данные**:
```typescript
{
  success: boolean
  scenes: Array<{
    id: string
    orderIndex: number
    title: string
    text: string
    imagePrompt: string
  }>
}
```

### 2. `generate-image/index.ts`

**Назначение**: Генерирует изображение для сцены через Replicate FLUX

**Входные данные**:
```typescript
{
  sceneId: string
  prompt: string
}
```

**Процесс**:
1. Создает `generation_event` со статусом `processing`
2. Вызывает Replicate API напрямую
3. Polling результата (синхронный, до 2 минут)
4. Загружает изображение в Supabase Storage
5. Обновляет `scenes.image_url` и `generation_events.status`

**Выходные данные**:
```typescript
{
  success: boolean
  url: string
  eventId: string
}
```

### 3. `generate-audio/index.ts`

**Назначение**: Генерирует аудио для сцены через ElevenLabs **НАПРЯМУЮ**

**Входные данные**:
```typescript
{
  sceneId: string
  text: string
  voiceId: string
}
```

**Процесс**:
1. Создает `generation_event` со статусом `processing`
2. **Прямой вызов ElevenLabs API** (`https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`)
3. Получает аудио как ArrayBuffer
4. Загружает в Supabase Storage
5. Обновляет `scenes.audio_url` и `generation_events.status`

**Выходные данные**:
```typescript
{
  success: boolean
  url: string
  eventId: string
}
```

**КРИТИЧЕСКИ ВАЖНО**: ElevenLabs вызывается напрямую, без proxy, без посредников!

---

## 🎨 Frontend: Архитектура

### Структура

```
frontend/src/
├── app/
│   ├── (onboarding)/
│   │   └── onboarding/
│   │       └── page.tsx          # Главная страница онбординга
│   └── api/                      # API роуты (опционально)
├── components/
│   ├── ui/                       # shadcn/ui компоненты
│   ├── onboarding/
│   │   ├── StyleSelector.tsx    # Выбор стиля
│   │   └── StoryboardView.tsx   # Отображение storyboard
│   └── Storyboard.tsx            # Компонент storyboard
├── context/
│   └── ProjectContext.tsx        # React Context для state (вместо Redux)
├── lib/
│   ├── supabase/
│   │   └── client.ts            # Supabase client
│   └── utils.ts                 # Утилиты
└── hooks/
    └── use-polling.ts           # Hook для polling статуса
```

### State Management: React Context

**Вместо Redux используем простой React Context**:

```typescript
interface ProjectContextType {
  project: Project | null
  setProject: (project: Project | null) => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  generateStoryboard: (projectId: string, scenarioText: string, styleId: string) => Promise<void>
  generateImageForScene: (sceneId: string, prompt: string) => Promise<void>
  generateAudioForScene: (sceneId: string, text: string, voiceId: string) => Promise<void>
}
```

### User Flow

```
1. Onboarding Page
   ├── Step 1: Script Input (textarea)
   ├── Step 2: Style Selection (3 предустановленных стиля)
   ├── Step 3: Generating (loading state)
   └── Step 4: Result (storyboard с изображениями и аудио)
```

---

## 🔄 Data Flow

### Storyboard Generation Flow

```
User Input (scenarioText, styleId)
  ↓
Frontend: POST /functions/v1/storyboard-generation
  ↓
Edge Function: storyboard-generation
  ├── Get style from DB
  ├── Build AI prompt
  ├── Call OpenRouter API
  ├── Parse JSON response
  └── Insert scenes to DB
  ↓
Frontend: Update ProjectContext with scenes
  ↓
For each scene:
  ├── Generate Image (generate-image Edge Function)
  └── Generate Audio (generate-audio Edge Function)
```

### Image Generation Flow

```
Frontend: POST /functions/v1/generate-image
  ↓
Edge Function: generate-image
  ├── Create generation_event (status: processing)
  ├── Call Replicate API
  ├── Polling result (sync, max 2 min)
  ├── Download image
  ├── Upload to Supabase Storage
  └── Update scenes.image_url + generation_events.status
  ↓
Frontend: Polling generation_events (every 2-3 sec)
  ↓
Update UI when status = completed
```

### Audio Generation Flow

```
Frontend: POST /functions/v1/generate-audio
  ↓
Edge Function: generate-audio
  ├── Create generation_event (status: processing)
  ├── Call ElevenLabs API DIRECTLY (no proxy!)
  ├── Get audio ArrayBuffer
  ├── Upload to Supabase Storage
  └── Update scenes.audio_url + generation_events.status
  ↓
Frontend: Polling generation_events (every 2-3 sec)
  ↓
Update UI when status = completed
```

---

## 🔐 Безопасность

### Authentication

- **Supabase Auth** с JWT токенами
- Все Edge Functions проверяют JWT токен из Authorization header
- RLS политики на уровне БД

### API Keys

- Все API ключи хранятся в переменных окружения Supabase
- Никогда не передаются на клиент
- ElevenLabs ключ используется напрямую в Edge Function (без посредников)

### Storage

- Supabase Storage с публичными bucket'ами для изображений и аудио
- RLS политики для доступа к файлам

---

## 📊 Производительность

### Оптимизации для MVP

1. **Синхронный polling** в Edge Functions (для простоты)
2. **Прямые вызовы API** (минимум абстракций)
3. **Минимальная БД** (5 таблиц вместо 15+)
4. **React Context** (легче чем Redux)
5. **Простой polling** на фронтенде (каждые 2-3 секунды)

### Компромиссы

- ⚠️ Polling вместо Realtime (приемлемо для MVP)
- ⚠️ Синхронная обработка (может быть медленнее)
- ⚠️ Нет кеширования (можно добавить позже)

---

## 🚀 Развертывание

### Environment Variables

```bash
# Supabase
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI Providers
OPENROUTER_API_KEY=your-openrouter-key
REPLICATE_API_TOKEN=your-replicate-token
ELEVENLABS_API_KEY=your-elevenlabs-key  # НАСТОЯЩИЙ КЛЮЧ!
```

### Deployment Steps

1. **Database**: Применить миграцию БД
2. **Edge Functions**: Deploy все 3 функции
3. **Storage**: Создать bucket'ы `images` и `audio` (публичные)
4. **Frontend**: Deploy Next.js приложение

---

## 📈 Масштабирование (post-MVP)

Если MVP успешен, можно добавить:

1. **Realtime** вместо polling
2. **Кеширование** результатов генерации
3. **Асинхронная обработка** через очереди
4. **Система кредитов** (если нужно)
5. **Больше провайдеров** с fallback

---

*Создано: 2025-01-31*  
*Для детального плана реализации см.: [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md)*
