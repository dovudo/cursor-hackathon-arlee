# 🚀 Arlekino AI MVP - Cursor Hackathon

> **Backend**: Convex | **Frontend**: Next.js 15 | **Время**: 6-7 часов

---

## 📚 Документация

**Все ключевые документы находятся в [`docs/main/`](./docs/main/)**:

1. **[ARCHITECTURE.md](./docs/main/ARCHITECTURE.md)** - Полная архитектура системы
2. **[DEVELOPMENT_PLAN.md](./docs/main/DEVELOPMENT_PLAN.md)** - Пошаговый план разработки
3. **[API_REFERENCE.md](./docs/main/API_REFERENCE.md)** - API документация для Convex функций
4. **[RISKS.md](./docs/main/RISKS.md)** - Риски и решения

**Остальные документы**: [`docs/reference/`](./docs/reference/) - справочные материалы

---

## 🎯 Быстрый старт

### 1. Настройка Convex

```bash
cd frontend
npx convex dev
# Следуйте инструкциям для входа и создания проекта
```

### 2. Переменные окружения

**Convex Dashboard → Settings → Environment Variables**:
```bash
OPENROUTER_API_KEY=sk-or-...
REPLICATE_API_TOKEN=r8_...
```

**Frontend `.env.local`**:
```bash
NEXT_PUBLIC_CONVEX_URL=https://your-deployment.convex.cloud
NEXT_PUBLIC_ELEVENLABS_API_KEY=...  # ElevenLabs API ключ (клиентская генерация)
NEXT_PUBLIC_CESDK_LICENSE=your-imgly-license-key  # Optional: для IMG.ly видео редактора
NEXT_PUBLIC_CESDK_BASE_URL=https://cdn.img.ly/packages/imgly/cesdk-js/1.58.0/assets  # Optional
```

**⚠️ Важно для ElevenLabs API Key:**
- Получите ключ на https://elevenlabs.io/app/settings/api-keys
- **Ключ должен иметь разрешение `text_to_speech`**
- Добавьте в `.env.local` как `NEXT_PUBLIC_ELEVENLABS_API_KEY` (запросы идут с клиента)
- Если используете Service Account API Key, убедитесь что у него включено разрешение `text_to_speech`
- При ошибке `missing_permissions` проверьте настройки ключа в ElevenLabs Dashboard
- **Free Tier ограничения**: Если получаете ошибку `detected_unusual_activity`, это означает что ElevenLabs заблокировал Free Tier из-за подозрительной активности (VPN/proxy/множественные аккаунты). Для хакатона рекомендуется использовать платный план или пропустить генерацию аудио для демо

### 3. Установка зависимостей

```bash
cd frontend
npm install
```

### 4. Seed данные (стили)

После запуска Convex dev server, выполните seed функцию через Convex Dashboard:
1. Откройте Convex Dashboard
2. Перейдите в Functions → `functions:seed:seedStyles`
3. Нажмите "Run" для создания 3 предустановленных стилей

Или через CLI:
```bash
npx convex run functions:seed:seedStyles
```

### 5. Запуск

```bash
# Terminal 1: Convex dev server
npm run convex:dev

# Terminal 2: Next.js dev server
npm run dev
```

Откройте http://localhost:3000/onboarding

---

## 📖 С чего начать

1. **Прочитайте [ARCHITECTURE.md](./docs/main/ARCHITECTURE.md)** - понимание системы
2. **Откройте [DEVELOPMENT_PLAN.md](./docs/main/DEVELOPMENT_PLAN.md)** - план разработки
3. **Изучите [RISKS.md](./docs/main/RISKS.md)** - потенциальные проблемы

---

## 🎯 Основные принципы

1. **Стратегия "Снизу вверх"**: Сначала данные, потом логика, потом UI
2. **Convex для backend**: Автоматический real-time, типобезопасность
3. **ElevenLabs напрямую**: Без proxy, без посредников
4. **Простота > Производительность**: Приоритет на скорость разработки

---

## ✅ Критические моменты

### ⚠️ ElevenLabs НАПРЯМУЮ

Проверьте в логах Convex Dashboard прямой вызов:
```
🎵 TTS: Calling ElevenLabs API directly
```

### 🎬 IMG.ly Video Editor

Интегрирован упрощенный IMG.ly CreativeEditor SDK для редактирования видео:
- **Компонент**: `IMGVideoEditor.tsx` - упрощенная версия без сложной логики
- **Loader**: `optimized-imgly-loader.ts` - загрузка SDK с fallback стратегией
- **Использование**: В StoryboardView есть вкладка "Timeline Editor"
- **Лицензия**: Требуется `NEXT_PUBLIC_CESDK_LICENSE` (опционально, редактор работает без него в демо режиме)

### 🎨 Обновленные промпты

- **Storyboard Generation**: Использует мастер-промпт из оригинального проекта Arlekino AI
- **Image Generation**: Использует FLUX Schnell для быстрой генерации (рекомендация из оригинального промпта)
- **Промпты для изображений**: Детальные промпты с композицией, освещением, стилем (200-400 символов)
URL: https://api.elevenlabs.io/v1/text-to-speech/{voiceId}
```

### ⚠️ Storage только в Actions

`ctx.storage.store()` можно использовать ТОЛЬКО в `action`, НЕ в `mutation`!

### ⚠️ Типизация Convex

После каждого изменения схемы проверьте что типы перегенерировались.

---

## 📁 Структура проекта

```
Cursor-Hackathon/
├── docs/
│   ├── main/              # Ключевые документы (единая точка истины)
│   │   ├── ARCHITECTURE.md
│   │   ├── DEVELOPMENT_PLAN.md
│   │   ├── API_REFERENCE.md
│   │   └── RISKS.md
│   └── reference/         # Справочные материалы
├── frontend/
│   ├── convex/            # Convex функции (schema, functions)
│   ├── src/
│   │   ├── app/           # Next.js App Router
│   │   ├── components/    # React компоненты
│   │   └── context/       # React Context
│   └── package.json
└── README.md
```

---

## 🚀 Следующие шаги

1. Откройте [DEVELOPMENT_PLAN.md](./docs/main/DEVELOPMENT_PLAN.md)
2. Начните с Этапа 1: Схема данных
3. Следуйте плану пошагово
4. При возникновении проблем - смотрите [RISKS.md](./docs/main/RISKS.md)

---

*Создано: 2025-01-31*  
*Удачи на хакатоне! 🚀*
