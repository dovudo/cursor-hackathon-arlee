# ⚡ Quick Start - Arlekino AI MVP

> **Время**: 6-7 часов | **Цель**: Рабочий MVP для демо | **Фокус**: Только core функциональность

---

## 🎯 ЧТО ДЕЛАЕМ

**Core идея**: AI-режиссер, который генерирует storyboard с изображениями и аудио.

**Flow**:
1. Пользователь вводит сценарий → выбирает стиль
2. AI разбивает на сцены (OpenRouter)
3. Генерирует изображения (Replicate FLUX)
4. Генерирует аудио (ElevenLabs **НАПРЯМУЮ**)
5. Показывает результат

---

## ❌ ЧТО УДАЛЯЕМ

- ❌ Система кредитов (`credits_transactions`, `deduct_credits_atomic`)
- ❌ Балансы (`user_profiles.credits`)
- ❌ Подсчеты стоимости (`PricingService`, `provider_config`)
- ❌ Redux (заменяем на React Context)
- ❌ Realtime (заменяем на polling)
- ❌ Сложные Edge Functions (`secure-proxy`, `replicate-webhook`)
- ❌ Таблицы: `assets`, `usage_logs`, `jobs`, `error_logs`

---

## ✅ ЧТО ОСТАВЛЯЕМ

### БД (5 таблиц):
- `user_profiles` (минимальная)
- `projects` (упрощенная)
- `scenes` (с `image_url`, `audio_url`, `image_prompt`)
- `styles` (только публичные, 3 предустановленных)
- `generation_events` (для polling статуса)

### Edge Functions (3 функции):
- `storyboard-generation` (упрощенная)
- `generate-image` (новая, упрощенная)
- `generate-audio` (новая, **ElevenLabs напрямую**)

### Frontend:
- React Context вместо Redux
- Упрощенный onboarding flow
- Компонент отображения storyboard

---

## 🔧 КРИТИЧЕСКИЕ МОМЕНТЫ

### 1. ElevenLabs НАПРЯМУЮ (без посредников!)

```typescript
// ✅ ПРАВИЛЬНО: Прямой вызов
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'), // НАСТОЯЩИЙ КЛЮЧ
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({
      text: text,
      model_id: 'eleven_multilingual_v2',
      voice_settings: { stability: 0.5, similarity_boost: 0.8 }
    })
  }
)

// ❌ НЕПРАВИЛЬНО: Через proxy или посредников
// НЕТ: proxy-elevenlabs, secure-proxy, VoicerAPI
```

### 2. НЕТ кредитов

```typescript
// ❌ УДАЛЯЕМ все проверки кредитов
// if (userCredits < requiredCredits) throw new Error('Insufficient credits')

// ✅ Просто генерируем без проверок
await generateImage(sceneId, prompt)
```

### 3. Простой polling вместо Realtime

```typescript
// ✅ Простой polling каждые 2-3 секунды
while (status === 'processing') {
  await new Promise(resolve => setTimeout(resolve, 2000))
  const { data } = await supabase
    .from('generation_events')
    .select('status, result_url')
    .eq('scene_id', sceneId)
    .single()
  status = data?.status
}
```

---

## 📋 ПОШАГОВЫЙ ПЛАН

### Шаг 1: БД (30 мин)
```bash
# Создать миграцию
supabase migration new hackathon_mvp_simplified

# Скопировать SQL из ARCHITECTURE.md
# Применить миграцию
supabase db push

# Создать Storage buckets (в Dashboard)
# - images (публичный)
# - audio (публичный)
```

### Шаг 2: Edge Functions (2 часа)
```bash
# 1. Упростить storyboard-generation
supabase functions deploy storyboard-generation

# 2. Создать generate-image
supabase functions new generate-image
# Скопировать код из ARCHITECTURE.md
supabase functions deploy generate-image

# 3. Создать generate-audio (ElevenLabs напрямую!)
supabase functions new generate-audio
# Скопировать код из ARCHITECTURE.md
# КРИТИЧЕСКИ: Проверить что ElevenLabs вызывается напрямую!
supabase functions deploy generate-audio
```

### Шаг 3: Frontend (2 часа)
```bash
# 1. Создать ProjectContext
# Скопировать код из FRONTEND_FROM_SCRATCH.md

# 2. Создать onboarding page
# Скопировать код из FRONTEND_FROM_SCRATCH.md

# 3. Создать компоненты
# - StyleSelector
# - StoryboardView

# 4. Удалить Redux зависимости
npm uninstall @reduxjs/toolkit react-redux
```

### Шаг 4: Тестирование (1 час)
- Создать проект
- Генерировать storyboard
- Проверить генерацию изображений
- Проверить генерацию аудио (ElevenLabs)

### Шаг 5: Деплой (30 мин)
```bash
# Deploy все функции
supabase functions deploy --all

# Deploy frontend
vercel deploy
```

---

## 🔐 ПЕРЕМЕННЫЕ ОКРУЖЕНИЯ

```bash
# .env.local (Frontend)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Edge Functions (в Supabase Dashboard)
OPENROUTER_API_KEY=your-openrouter-key
REPLICATE_API_TOKEN=your-replicate-token
ELEVENLABS_API_KEY=your-elevenlabs-key  # НАСТОЯЩИЙ КЛЮЧ!
```

---

## 📚 ДОКУМЕНТАЦИЯ

- **Детальный мастер-промпт**: `ARCHITECTURE.md`
- **Создание фронтенда с нуля**: `FRONTEND_FROM_SCRATCH.md`
- **API документация**: `API_REFERENCE.md`
- **План реализации**: `IMPLEMENTATION_PLAN.md`

---

## ✅ ЧЕКЛИСТ

- [ ] Миграция БД создана и применена
- [ ] 3 Edge Functions реализованы и задеплоены
- [ ] ElevenLabs вызывается НАПРЯМУЮ (проверить код!)
- [ ] Frontend использует React Context (не Redux)
- [ ] Удалены все проверки кредитов
- [ ] Удалены Redux зависимости
- [ ] Протестирован полный flow
- [ ] Готово к демо на хакатоне

---

**Главное правило**: Если что-то не критично для демо - удаляем или упрощаем!

*Создано: 2025-01-31*
