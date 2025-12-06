# Arlee AI MVP Frontend

Next.js + Convex приложение для генерации AI storyboard.

## Быстрый старт

### 1. Установить зависимости

```bash
npm install
```

### 2. Запустить Convex dev (в одном терминале)

```bash
npm run convex:dev
```

### 3. Запустить Next.js dev (в другом терминале)

```bash
npm run dev
```

Откройте [http://localhost:3000](http://localhost:3000) в браузере.

## Структура проекта

```
frontend/
├── convex/              # Convex функции (queries, mutations, actions)
│   ├── _generated/     # Автогенерируемые типы
│   └── functions/      # Ваши функции
├── src/
│   └── app/            # Next.js App Router
│       ├── layout.tsx
│       ├── page.tsx
│       └── globals.css
├── .env.local          # Переменные окружения (не коммитить!)
└── package.json
```

## Переменные окружения

`.env.local` должен содержать:

```bash
NEXT_PUBLIC_CONVEX_URL=https://your-url.convex.cloud
CONVEX_DEPLOYMENT=your-deployment
```

## Команды

- `npm run dev` - Запустить Next.js dev server
- `npm run build` - Собрать production build
- `npm run start` - Запустить production server
- `npm run convex:dev` - Запустить Convex dev (синхронизация функций)
- `npm run convex:deploy` - Deploy Convex функции

## Документация

- [CONVEX_DEVELOPMENT_PLAN.md](../CONVEX_DEVELOPMENT_PLAN.md) - План разработки
- [RISK_ANALYSIS.md](../RISK_ANALYSIS.md) - Анализ рисков
- [SETUP_INSTRUCTIONS.md](../SETUP_INSTRUCTIONS.md) - Инструкция по настройке

