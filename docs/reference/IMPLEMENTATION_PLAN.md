# 📋 План реализации MVP для хакатона

> **Время**: 6-7 часов  
> **Приоритет**: Максимальная простота и скорость разработки

---

## 🎯 Общая стратегия

1. **Backend first** - сначала БД и Edge Functions
2. **Frontend second** - затем UI компоненты
3. **Integration** - интеграция и тестирование
4. **Polish** - финальная полировка

---

## 📅 Пошаговый план

### Этап 1: Подготовка (30 минут)

#### 1.1 Создание структуры проекта
```bash
# Создать новую ветку
git checkout -b hackathon-mvp

# Создать backup текущей БД (если нужно)
supabase db dump > backup_$(date +%Y%m%d).sql
```

#### 1.2 Настройка окружения
```bash
# Создать .env.local для фронтенда
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# Настроить переменные окружения в Supabase Dashboard для Edge Functions
OPENROUTER_API_KEY=your-openrouter-key
REPLICATE_API_TOKEN=your-replicate-token
ELEVENLABS_API_KEY=your-elevenlabs-key
```

**Чеклист**:
- [ ] Создана ветка `hackathon-mvp`
- [ ] Настроены переменные окружения
- [ ] Создан backup БД (опционально)

---

### Этап 2: Database (1 час)

#### 2.1 Создание миграции
```bash
supabase migration new hackathon_mvp_simplified
```

#### 2.2 SQL миграция
Скопировать SQL из `ARCHITECTURE.md` (раздел "Схема БД") в файл миграции.

**Содержимое миграции**:
- Создание 5 таблиц (user_profiles, projects, scenes, styles, generation_events)
- Индексы для производительности
- RLS политики
- Seed данные (3 стиля)

#### 2.3 Применение миграции
```bash
supabase db push
```

#### 2.4 Создание Storage buckets
В Supabase Dashboard:
- Создать bucket `images` (публичный)
- Создать bucket `audio` (публичный)

**Чеклист**:
- [ ] Миграция создана
- [ ] Миграция применена
- [ ] Storage buckets созданы
- [ ] Seed данные загружены (3 стиля)

---

### Этап 3: Backend - Edge Functions (2-3 часа)

#### 3.1 `storyboard-generation` (1 час)

**Шаг 1**: Создать функцию
```bash
supabase functions new storyboard-generation
```

**Шаг 2**: Реализовать логику
- Получить стиль из БД
- Сформировать промпт для AI
- Вызвать OpenRouter API
- Парсить JSON ответ
- Сохранить сцены в БД

**Шаг 3**: Deploy
```bash
supabase functions deploy storyboard-generation
```

**Чеклист**:
- [ ] Функция создана
- [ ] Логика реализована
- [ ] Обработка ошибок добавлена
- [ ] Функция задеплоена
- [ ] Протестирована через Supabase Dashboard

#### 3.2 `generate-image` (1 час)

**Шаг 1**: Создать функцию
```bash
supabase functions new generate-image
```

**Шаг 2**: Реализовать логику
- Создать generation_event
- Вызвать Replicate API
- Polling результата (синхронный)
- Загрузить в Storage
- Обновить scenes.image_url

**Шаг 3**: Deploy
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

#### 3.3 `generate-audio` (1 час)

**Шаг 1**: Создать функцию
```bash
supabase functions new generate-audio
```

**Шаг 2**: Реализовать логику
- Создать generation_event
- **Прямой вызов ElevenLabs API** (без proxy!)
- Получить аудио ArrayBuffer
- Загрузить в Storage
- Обновить scenes.audio_url

**КРИТИЧЕСКИ ВАЖНО**: 
```typescript
// ✅ ПРАВИЛЬНО: Прямой вызов
const response = await fetch(
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
  {
    method: 'POST',
    headers: {
      'xi-api-key': Deno.env.get('ELEVENLABS_API_KEY'),
      'Content-Type': 'application/json',
      'Accept': 'audio/mpeg'
    },
    body: JSON.stringify({ text, model_id: 'eleven_multilingual_v2' })
  }
)
```

**Шаг 3**: Deploy
```bash
supabase functions deploy generate-audio
```

**Чеклист**:
- [ ] Функция создана
- [ ] ElevenLabs вызывается НАПРЯМУЮ (проверить код!)
- [ ] Storage upload работает
- [ ] Функция задеплоена
- [ ] Протестирована

---

### Этап 4: Frontend (2-3 часа)

#### 4.1 ProjectContext (30 минут)

**Шаг 1**: Создать `context/ProjectContext.tsx`
- Определить интерфейсы (Project, Scene)
- Создать Context
- Реализовать методы (generateStoryboard, generateImageForScene, generateAudioForScene)

**Шаг 2**: Обернуть приложение в Provider
```typescript
// app/layout.tsx
<ProjectProvider>
  {children}
</ProjectProvider>
```

**Чеклист**:
- [ ] ProjectContext создан
- [ ] Все методы реализованы
- [ ] Provider добавлен в layout
- [ ] Hook useProject работает

#### 4.2 Onboarding Page (1.5 часа)

**Шаг 1**: Создать базовую структуру
```typescript
// app/(onboarding)/onboarding/page.tsx
- Step 1: Script Input
- Step 2: Style Selection
- Step 3: Generating
- Step 4: Result
```

**Шаг 2**: Реализовать Step 1 (Script Input)
- Textarea для ввода сценария
- Кнопка "Далее"

**Шаг 3**: Реализовать Step 2 (Style Selection)
- Загрузить стили из БД
- Отобразить в grid (3 колонки)
- Выбор стиля

**Шаг 4**: Реализовать Step 3 (Generating)
- Loading state
- Вызов generateStoryboard
- Последовательная генерация изображений и аудио

**Шаг 5**: Реализовать Step 4 (Result)
- Отображение storyboard
- Карточки сцен с изображениями и аудио
- Polling статуса генерации

**Чеклист**:
- [ ] Все 4 шага реализованы
- [ ] Интеграция с ProjectContext работает
- [ ] Вызовы Edge Functions работают
- [ ] Polling статуса работает
- [ ] UI приятный и похож на оригинал

#### 4.3 Компоненты (1 час)

**Шаг 1**: StyleSelector компонент
- Grid с карточками стилей
- Выбор стиля

**Шаг 2**: StoryboardView компонент
- Отображение сцен
- Карточки с изображениями и аудио
- Loading states

**Чеклист**:
- [ ] StyleSelector создан
- [ ] StoryboardView создан
- [ ] Компоненты переиспользуемые
- [ ] UI приятный

---

### Этап 5: Интеграция и тестирование (1 час)

#### 5.1 End-to-end тестирование

**Тест 1**: Создание проекта
1. Ввести сценарий
2. Выбрать стиль
3. Нажать "Создать storyboard"
4. Проверить создание проекта в БД

**Тест 2**: Генерация storyboard
1. Проверить вызов storyboard-generation
2. Проверить создание сцен в БД
3. Проверить отображение сцен в UI

**Тест 3**: Генерация изображений
1. Проверить вызов generate-image для каждой сцены
2. Проверить загрузку в Storage
3. Проверить обновление scenes.image_url
4. Проверить отображение в UI

**Тест 4**: Генерация аудио
1. Проверить вызов generate-audio для каждой сцены
2. Проверить прямой вызов ElevenLabs (в логах!)
3. Проверить загрузку в Storage
4. Проверить обновление scenes.audio_url
5. Проверить отображение в UI

**Чеклист**:
- [ ] Все тесты пройдены
- [ ] Нет критических ошибок
- [ ] UI работает корректно
- [ ] ElevenLabs вызывается напрямую (проверено в логах)

---

### Этап 6: Полировка (30 минут)

#### 6.1 UI/UX улучшения
- [ ] Добавить loading states везде
- [ ] Добавить error handling
- [ ] Улучшить визуальный дизайн
- [ ] Добавить анимации (опционально)

#### 6.2 Оптимизации
- [ ] Проверить производительность
- [ ] Оптимизировать запросы к БД
- [ ] Проверить размер bundle

**Чеклист**:
- [ ] UI приятный и похож на оригинал
- [ ] Нет критических проблем с производительностью
- [ ] Готово к демо

---

## 🚨 Критические моменты

### 1. ElevenLabs НАПРЯМУЮ

**Проверка**: В логах Edge Function `generate-audio` должно быть:
```
🎵 TTS: Calling ElevenLabs API directly
URL: https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
Headers: xi-api-key: ***
```

**НЕ должно быть**:
- ❌ Proxy URL
- ❌ VoicerAPI
- ❌ Любые посредники

### 2. Нет кредитов

**Проверка**: В коде НЕ должно быть:
- ❌ Проверок баланса
- ❌ Списаний кредитов
- ❌ Таблицы credits_transactions

### 3. Простой polling

**Проверка**: На фронтенде должен быть простой polling:
```typescript
// Каждые 2-3 секунды проверяем статус
setInterval(() => {
  checkGenerationStatus(sceneId)
}, 2000)
```

---

## 📊 Метрики успеха

### Функциональность
- ✅ Пользователь может создать проект
- ✅ Storyboard генерируется успешно
- ✅ Изображения генерируются для всех сцен
- ✅ Аудио генерируется для всех сцен (через ElevenLabs напрямую)
- ✅ Результат отображается корректно

### Технические
- ✅ Нет критических ошибок
- ✅ Edge Functions работают стабильно
- ✅ БД схема корректна
- ✅ RLS политики работают
- ✅ Storage работает

### UX
- ✅ UI приятный и похож на оригинал
- ✅ Loading states информативные
- ✅ Error handling понятный
- ✅ Flow интуитивный

---

## 🎯 Временная оценка

| Этап | Время | Приоритет |
|------|-------|-----------|
| Подготовка | 30 мин | P0 |
| Database | 1 час | P0 |
| Backend (3 функции) | 2-3 часа | P0 |
| Frontend | 2-3 часа | P0 |
| Тестирование | 1 час | P1 |
| Полировка | 30 мин | P2 |
| **ИТОГО** | **6-7 часов** | |

---

## 📝 Чеклист финальной проверки

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

*Создано: 2025-01-31*  
*Для архитектуры см.: [ARCHITECTURE.md](./ARCHITECTURE.md)*  
*Для API документации см.: [API_REFERENCE.md](./API_REFERENCE.md)*
