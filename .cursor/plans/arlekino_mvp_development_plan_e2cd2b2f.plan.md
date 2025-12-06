---
name: Arlekino MVP Development Plan
overview: Детальный план разработки MVP с использованием Convex и Next.js 15, с референсами к документации и активным использованием Context7 для получения актуальной документации на каждом этапе
todos: []
---

# План разработки Arlekino AI MVP

## Обзор

Разработка MVP платформы для создания AI-генерируемых видеоконтентов с использованием Convex (backend) и Next.js 15 (frontend). План следует стратегии "снизу вверх" и активно использует Context7 для получения актуальной документации.

**Ссылки на документацию**:

- [ARCHITECTURE.md](docs/main/ARCHITECTURE.md) - полная архитектура системы
- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md) - базовый план разработки
- [API_REFERENCE.md](docs/main/API_REFERENCE.md) - API документация
- [RISKS.md](docs/main/RISKS.md) - риски и решения

---

## Этап 1: Схема данных и базовая настройка (1 час)

### 1.1 Создание схемы Convex

**Файл**: `frontend/convex/schema.ts`

**Действия**:

1. Использовать Context7 для получения актуальной документации Convex по схемам:

- Запросить `/llmstxt/convex_dev_llms_txt` с темой "schema definition and table indexes"
- Изучить примеры использования `defineSchema`, `defineTable`, `v.*` валидаторов

2. Создать схему согласно [ARCHITECTURE.md](docs/main/ARCHITECTURE.md#схема-базы-данных-convex)
3. Добавить индексы для оптимизации запросов
4. Проверить генерацию типов в `_generated/api.d.ts`

**Чеклист**:

- [ ] Схема создана с 5 таблицами (userProfiles, styles, projects, scenes, generationEvents)
- [ ] Все индексы добавлены согласно архитектуре
- [ ] `convex dev` запущен и типы генерируются
- [ ] Нет ошибок TypeScript в IDE

**Референсы**:

- [ARCHITECTURE.md](docs/main/ARCHITECTURE.md#схема-базы-данных-convex) - структура схемы
- Context7: `/llmstxt/convex_dev_llms_txt` - актуальная документация Convex

---

### 1.2 Seed данные для стилей

**Файл**: `frontend/convex/functions/seed.ts`

**Действия**:

1. Использовать Context7 для изучения паттернов создания mutations в Convex
2. Создать mutation для загрузки 3 предустановленных стилей
3. Протестировать через Convex Dashboard

**Чеклист**:

- [ ] Seed функция создана
- [ ] 3 стиля загружены (Cinematic, Documentary, Minimalist)
- [ ] Можно запросить через query

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#12-seed-данные-3-стиля) - пример кода
- Context7: `/llmstxt/convex_dev_llms_txt` - mutations в Convex

---

## Этап 2: Queries (30 минут)

### 2.1 Queries для стилей

**Файл**: `frontend/convex/functions/styles.ts`

**Действия**:

1. Использовать Context7 для изучения паттернов queries в Convex:

- Запросить `/llmstxt/convex_dev_llms_txt` с темой "queries with indexes and filtering"

2. Создать `getPublicStyles` и `getStyleById` queries
3. Протестировать через Convex Dashboard

**Чеклист**:

- [ ] Queries созданы и работают
- [ ] Используются правильные индексы
- [ ] Типы генерируются корректно

**Референсы**:

- [API_REFERENCE.md](docs/main/API_REFERENCE.md#queries-read-only) - API документация
- Context7: `/llmstxt/convex_dev_llms_txt` - queries в Convex

---

### 2.2 Queries для проектов

**Файл**: `frontend/convex/functions/projects.ts`

**Действия**:

1. Использовать Context7 для изучения аутентификации в Convex:

- Запросить `/llmstxt/convex_dev_llms_txt` с темой "authentication and user identity"

2. Создать `getUserProjects` и `getProjectById` с проверкой прав доступа
3. Реализовать автоматическое создание userProfile при первом запросе

**Чеклист**:

- [ ] Queries созданы с проверкой аутентификации
- [ ] Автоматическое создание userProfile работает
- [ ] Проверка прав доступа реализована

**Референсы**:

- [RISKS.md](docs/main/RISKS.md#4-ошибки-аутентификации) - обработка ошибок auth
- Context7: `/llmstxt/convex_dev_llms_txt` - authentication в Convex

---

### 2.3 Queries для сцен

**Файл**: `frontend/convex/functions/scenes.ts`

**Действия**:

1. Создать `getScenesByProject` query с сортировкой по orderIndex
2. Использовать индекс `by_project` для оптимизации

**Чеклист**:

- [ ] Query создан
- [ ] Сортировка работает корректно

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#23-сцены) - пример кода

---

## Этап 3: Mutations (1 час)

### 3.1 Mutation для создания проекта

**Файл**: `frontend/convex/functions/projects.ts` (добавить к queries)

**Действия**:

1. Использовать Context7 для изучения транзакций в Convex:

- Запросить `/llmstxt/convex_dev_llms_txt` с темой "mutations and transactions"

2. Создать `createProject` mutation с автоматическим созданием userProfile
3. Реализовать проверку прав доступа

**Чеклист**:

- [ ] Mutation создана
- [ ] Аутентификация работает
- [ ] UserProfile создается автоматически

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#31-создание-проекта) - пример кода
- Context7: `/llmstxt/convex_dev_llms_txt` - mutations в Convex

---

### 3.2 Mutations для сцен

**Файл**: `frontend/convex/functions/scenes.ts` (добавить к queries)

**Действия**:

1. Создать `createScenes` mutation для массового создания сцен
2. Создать `updateSceneImage` и `updateSceneAudio` mutations
3. Реализовать проверку прав доступа через projectId

**Чеклист**:

- [ ] Все mutations созданы
- [ ] Проверка прав доступа работает
- [ ] Массовое создание сцен работает

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#32-создание-сцен) - пример кода

---

### 3.3 Mutations для generation events

**Файл**: `frontend/convex/functions/generationEvents.ts`

**Действия**:

1. Создать `createEvent` и `updateEvent` mutations
2. Использовать union типы для status и type

**Чеклист**:

- [ ] Mutations созданы
- [ ] Типы корректны

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#34-generation-events) - пример кода

---

## Этап 4: Actions для AI интеграций (2 часа)

### 4.1 Storyboard Generation (OpenRouter)

**Файл**: `frontend/convex/functions/storyboard.ts`

**Действия**:

1. Использовать Context7 для изучения Actions в Convex:

- Запросить `/llmstxt/convex_dev_llms_txt` с темой "actions and external API calls"

2. Изучить документацию OpenRouter API через Context7 или web search
3. Реализовать `generateStoryboard` action:

- Получить стиль через `ctx.runQuery`
- Построить промпт для AI
- Вызвать OpenRouter API
- Парсить JSON ответ с валидацией (см. [RISKS.md](docs/main/RISKS.md#2-ошибки-парсинга-ai-ответов))
- Сохранить сцены через `ctx.runMutation`

**Чеклист**:

- [ ] Action создана
- [ ] OpenRouter API вызывается корректно
- [ ] JSON парсится с валидацией и fallback
- [ ] Сцены сохраняются в БД

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#41-storyboard-generation-openrouter) - пример кода
- [RISKS.md](docs/main/RISKS.md#2-ошибки-парсинга-ai-ответов) - обработка ошибок парсинга
- Context7: `/llmstxt/convex_dev_llms_txt` - actions в Convex

---

### 4.2 Image Generation (Replicate)

**Файл**: `frontend/convex/functions/images.ts`

**Действия**:

1. Использовать Context7 для изучения Storage в Convex:

- Запросить `/llmstxt/convex_dev_llms_txt` с темой "file storage and blob handling"

2. Изучить документацию Replicate API через Context7 или web search
3. Реализовать `generateImage` action:

- Создать generation event
- Вызвать Replicate API
- Реализовать polling результата (до 2 минут)
- Загрузить изображение в Convex Storage через `ctx.storage.store()`
- Получить URL через `ctx.storage.getUrl()`
- Обновить сцену и event

**Чеклист**:

- [ ] Action создана
- [ ] Replicate API вызывается
- [ ] Polling работает корректно
- [ ] Изображение загружается в Storage (⚠️ только в Actions!)
- [ ] Сцена обновляется

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#42-image-generation-replicate) - пример кода
- [RISKS.md](docs/main/RISKS.md#3-проблемы-с-storage) - правила использования Storage
- Context7: `/llmstxt/convex_dev_llms_txt` - storage в Convex

---

### 4.3 Audio Generation (ElevenLabs НАПРЯМУЮ)

**Файл**: `frontend/convex/functions/audio.ts`

**Действия**:

1. Изучить документацию ElevenLabs API через Context7 или web search
2. Реализовать `generateAudio` action:

- ⚠️ КРИТИЧЕСКИ ВАЖНО: Прямой вызов ElevenLabs API без proxy
- URL: `https://api.elevenlabs.io/v1/text-to-speech/{voiceId}`
- Получить аудио как ArrayBuffer
- Загрузить в Convex Storage
- Обновить сцену и event

3. Добавить логирование для проверки прямого вызова

**Чеклист**:

- [ ] Action создана
- [ ] ElevenLabs вызывается НАПРЯМУЮ (проверено в логах!)
- [ ] В логах видно: `🎵 TTS: Calling ElevenLabs API directly`
- [ ] Аудио загружается в Storage
- [ ] Сцена обновляется

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#43-audio-generation-elevenlabs-напрямую) - пример кода
- [RISKS.md](docs/main/RISKS.md#критические-проверки-перед-демо) - проверка прямого вызова
- Context7: `/llmstxt/convex_dev_llms_txt` - storage в Convex

---

## Этап 5: Frontend интеграция (2 часа)

### 5.1 ConvexProvider настройка

**Файл**: `frontend/src/lib/convex-provider.tsx`

**Действия**:

1. Использовать Context7 для изучения Convex React интеграции:

- Запросить `/llmstxt/convex_dev_llms_txt` с темой "React hooks and ConvexProvider"

2. Проверить что ConvexProvider правильно настроен в `layout.tsx`
3. Убедиться что `NEXT_PUBLIC_CONVEX_URL` установлен

**Чеклист**:

- [ ] ConvexProvider настроен
- [ ] Переменная окружения установлена
- [ ] Тестовый query работает

**Референсы**:

- [ARCHITECTURE.md](docs/main/ARCHITECTURE.md#frontend-архитектура) - структура frontend
- Context7: `/llmstxt/convex_dev_llms_txt` - React интеграция

---

### 5.2 ProjectContext

**Файл**: `frontend/src/context/ProjectContext.tsx`

**Действия**:

1. Использовать Context7 для изучения React Context и hooks:

- Запросить `/websites/react_dev` с темой "useContext and custom hooks"

2. Использовать Context7 для изучения Convex React hooks:

- Запросить `/llmstxt/convex_dev_llms_txt` с темой "useQuery useMutation useAction hooks"

3. Создать ProjectContext с использованием:

- `useQuery` для автоматического real-time обновления
- `useMutation` для создания проектов
- `useAction` для генерации контента

**Чеклист**:

- [ ] ProjectContext создан
- [ ] Используются правильные Convex hooks
- [ ] Real-time обновления работают автоматически

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#52-projectcontext) - пример кода
- Context7: `/websites/react_dev` - React Context
- Context7: `/llmstxt/convex_dev_llms_txt` - Convex React hooks

---

### 5.3 Onboarding Page

**Файл**: `frontend/src/app/(onboarding)/onboarding/page.tsx`

**Действия**:

1. Использовать Context7 для изучения Next.js App Router:

- Запросить `/vercel/next.js` с темой "App Router and client components"

2. Использовать Context7 для изучения Tailwind CSS:

- Запросить документацию Tailwind через web search

3. Создать onboarding flow:

- Step 1: Script Input (textarea)
- Step 2: Style Selection (использовать `useQuery` для загрузки стилей)
- Step 3: Generating (loading state)
- Step 4: Result (storyboard с изображениями и аудио)

**Чеклист**:

- [ ] Onboarding page создана
- [ ] Все шаги работают
- [ ] Real-time обновления работают
- [ ] UI приятный

**Референсы**:

- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md#53-onboarding-page) - пример кода
- Context7: `/vercel/next.js` - Next.js App Router
- Context7: `/websites/react_dev` - React компоненты

---

### 5.4 Storyboard View компонент

**Файл**: `frontend/src/components/StoryboardView.tsx`

**Действия**:

1. Создать компонент для отображения storyboard
2. Использовать `useQuery` для автоматического обновления сцен
3. Реализовать генерацию изображений и аудио для каждой сцены
4. Добавить loading states и error handling

**Чеклист**:

- [ ] Компонент создан
- [ ] Автоматическое обновление работает
- [ ] Генерация изображений и аудио работает
- [ ] Обработка ошибок реализована

**Референсы**:

- [ARCHITECTURE.md](docs/main/ARCHITECTURE.md#data-flow) - flow данных
- Context7: `/websites/react_dev` - React компоненты

---

## Этап 6: Тестирование и полировка (1 час)

### 6.1 End-to-end тестирование

**Действия**:

1. Протестировать полный flow:

- Создание проекта
- Генерация storyboard
- Генерация изображений
- Генерация аудио

2. Проверить что ElevenLabs вызывается напрямую (логи)
3. Проверить что real-time обновления работают
4. Проверить обработку ошибок

**Чеклист**:

- [ ] Весь flow работает
- [ ] ElevenLabs вызывается напрямую (проверено!)
- [ ] Real-time работает
- [ ] Ошибки обрабатываются корректно

**Референсы**:

- [RISKS.md](docs/main/RISKS.md#критические-проверки-перед-демо) - чеклист проверок

---

### 6.2 UI/UX улучшения

**Действия**:

1. Добавить loading states для всех операций
2. Добавить error boundaries
3. Улучшить визуальное отображение storyboard
4. Добавить retry механизмы для failed генераций

**Чеклист**:

- [ ] Loading states добавлены
- [ ] Error boundaries настроены
- [ ] UI приятный и понятный
- [ ] Retry механизмы работают

**Референсы**:

- [RISKS.md](docs/main/RISKS.md#5-timeout-внешних-api) - retry механизмы

---

## Использование Context7 на каждом этапе

### Рекомендуемые запросы Context7:

1. **Convex документация**: `/llmstxt/convex_dev_llms_txt`

- Темы: "schema definition", "queries", "mutations", "actions", "storage", "authentication", "React hooks"

2. **Next.js документация**: `/vercel/next.js` (версия v15.1.8 или выше)

- Темы: "App Router", "client components", "server components", "routing"

3. **React документация**: `/websites/react_dev` или `/reactjs/react.dev`

- Темы: "useContext", "custom hooks", "component patterns", "state management"

4. **Внешние API**: Использовать web_search для получения актуальной документации:

- OpenRouter API
- Replicate API
- ElevenLabs API

---

## Критические моменты

1. **Storage только в Actions**: `ctx.storage.store()` можно использовать ТОЛЬКО в `action`, НЕ в `mutation`!
2. **ElevenLabs напрямую**: Проверить в логах прямой вызов API
3. **Типизация Convex**: После каждого изменения схемы проверить генерацию типов
4. **Real-time**: Использовать `useQuery`, а не `useQueryOnce` для автоматических обновлений

---

## Референсы к документации

- [ARCHITECTURE.md](docs/main/ARCHITECTURE.md) - полная архитектура
- [DEVELOPMENT_PLAN.md](docs/main/DEVELOPMENT_PLAN.md) - базовый план
- [API_REFERENCE.md](docs/main/API_REFERENCE.md) - API документация
- [RISKS.md](docs/main/RISKS.md) - риски и решения
- [README.md](README.md) - быстрый старт