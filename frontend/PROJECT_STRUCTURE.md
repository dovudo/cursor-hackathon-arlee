# 📁 Структура проекта Arlee MVP

## Backend функции (Convex)

Все функции находятся в: `frontend/convex/functions/`

```
convex/functions/
├── audio.ts                    ✅ Генерация аудио (ElevenLabs)
├── generationEvents.ts         ✅ Трекинг событий генерации
├── images.ts                   ✅ Генерация изображений (Replicate)
├── projects.ts                 ✅ Проекты (queries + mutations)
├── scenes.ts                   ✅ Сцены (queries + mutations)
├── seed.ts                     ✅ Seed функция для стилей
├── storyboard.ts               ✅ Генерация storyboard (OpenRouter)
├── styles.ts                   ✅ Стили (queries)
└── test.ts                     ✅ Тестовая функция
```

## Frontend компоненты

```
src/
├── app/
│   ├── (onboarding)/
│   │   └── onboarding/
│   │       └── page.tsx        ✅ Onboarding flow
│   ├── layout.tsx              ✅ Root layout с провайдерами
│   └── page.tsx                ✅ Главная страница (редирект)
├── components/
│   └── StoryboardView.tsx      ✅ Отображение storyboard
├── context/
│   └── ProjectContext.tsx      ✅ State management
└── convex-provider.tsx         ✅ Convex клиент
```

## Schema

```
convex/
└── schema.ts                   ✅ Схема БД (5 таблиц)
```

## Проверка файлов

Выполните в терминале:
```bash
cd frontend/convex/functions
ls -la
```

Должны увидеть все 9 файлов функций.


