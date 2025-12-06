# 🔧 Инструкция по настройке проекта

## ✅ Что уже готово

1. ✅ Convex проект инициализирован в `frontend/convex/`
2. ✅ Convex проект подключен к вашему аккаунту (project: `frontend-ae4db`)
3. ✅ Создана папка `frontend/` с базовым `package.json`

## 🔨 Что нужно сделать

### Шаг 1: Установить зависимости (2 минуты)

```bash
cd frontend
npm install
```

### Шаг 2: Создать Next.js структуру (5 минут)

Так как у вас уже есть `convex/` в `frontend/`, нужно создать Next.js структуру правильно.

**Вариант A: Быстрый способ (рекомендуется)**

Создайте следующую структуру вручную или скопируйте из оригинального проекта:

```
frontend/
├── convex/              # ✅ Уже есть (Convex функции)
├── src/
│   └── app/
│       ├── layout.tsx
│       └── page.tsx
├── public/
├── .env.local          # ✅ Уже есть (Convex URL)
├── package.json        # ✅ Обновлен
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.mjs
└── next.config.js
```

**Вариант B: Использовать create-next-app (если хотите)**

⚠️ **ВНИМАНИЕ**: Если используете `create-next-app`, нужно быть аккуратным, чтобы не перезаписать `convex/`

```bash
# В корне проекта (НЕ в frontend!)
cd /Users/dov/IdeaProjects/Cursor-Hackathon

# Создать Next.js в отдельной папке, затем переместить
npx create-next-app@latest temp-frontend --typescript --tailwind --app --no-src-dir
mv temp-frontend/* frontend/
rm -rf temp-frontend
```

---

## 📋 Создание необходимых файлов

### 1. `frontend/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [
      {
        "name": "next"
      }
    ],
    "paths": {
      "@/*": ["./src/*"],
      "@/convex/*": ["./convex/*"]
    }
  },
  "include": [
    "next-env.d.ts",
    "**/*.ts",
    "**/*.tsx",
    ".next/types/**/*.ts",
    "convex/**/*"
  ],
  "exclude": ["node_modules"]
}
```

### 2. `frontend/tailwind.config.ts`

```typescript
import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
      },
    },
  },
  plugins: [],
};

export default config;
```

### 3. `frontend/postcss.config.mjs`

```javascript
/** @type {import('postcss-load-config').Config} */
const config = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
};

export default config;
```

### 4. `frontend/next.config.js`

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ['convex'],
};

module.exports = nextConfig;
```

### 5. `frontend/src/app/globals.css`

```css
@tailwind base;
@tailwind components;
@tailwind utilities;

:root {
  --background: 0 0% 100%;
  --foreground: 222.2 84% 4.9%;
}

@media (prefers-color-scheme: dark) {
  :root {
    --background: 222.2 84% 4.9%;
    --foreground: 210 40% 98%;
  }
}

body {
  @apply bg-background text-foreground;
}
```

### 6. `frontend/src/app/layout.tsx`

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ConvexProvider } from "@/convex-provider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Arlekino AI MVP",
  description: "AI-powered storyboard generation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <ConvexProvider>{children}</ConvexProvider>
      </body>
    </html>
  );
}
```

### 7. `frontend/src/app/page.tsx`

```typescript
export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="text-center">
        <h1 className="text-4xl font-bold mb-4">Arlekino AI MVP</h1>
        <p className="text-lg text-muted-foreground">
          Welcome! Convex is connected ✅
        </p>
      </div>
    </main>
  );
}
```

### 8. `frontend/src/convex-provider.tsx`

```typescript
"use client";

import { ConvexProvider, ConvexReactClient } from "convex/react";

const convexUrl = process.env.NEXT_PUBLIC_CONVEX_URL!;

if (!convexUrl) {
  throw new Error("NEXT_PUBLIC_CONVEX_URL is not set");
}

const convex = new ConvexReactClient(convexUrl);

export function ConvexProviderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ConvexProvider client={convex}>{children}</ConvexProvider>;
}
```

---

## 🔐 Настройка переменных окружения

Убедитесь что в `frontend/.env.local` есть:

```bash
# Convex (уже должно быть создано автоматически)
NEXT_PUBLIC_CONVEX_URL=https://your-convex-url.convex.cloud
CONVEX_DEPLOYMENT=your-deployment-name
```

Для использования в Convex functions (Actions), добавьте в Convex Dashboard → Settings → Environment Variables:

```
OPENROUTER_API_KEY=your-key
REPLICATE_API_TOKEN=your-token
ELEVENLABS_API_KEY=your-key
```

---

## ✅ Проверка настройки

### 1. Запустить Convex dev

```bash
cd frontend
npm run convex:dev
```

Должно запуститься без ошибок.

### 2. Запустить Next.js dev

В другом терминале:

```bash
cd frontend
npm run dev
```

Должно открыться на `http://localhost:3000`

### 3. Проверить что все работает

- ✅ Next.js запускается без ошибок
- ✅ Convex функции синхронизируются
- ✅ Страница открывается в браузере

---

## 🚨 Возможные проблемы

### Проблема 1: "NEXT_PUBLIC_CONVEX_URL is not set"

**Решение**: Проверьте что `.env.local` существует и содержит `NEXT_PUBLIC_CONVEX_URL`

### Проблема 2: TypeScript ошибки в `convex/_generated`

**Решение**: Убедитесь что `convex dev` запущен - он генерирует типы автоматически

### Проблема 3: "Cannot find module 'convex'"

**Решение**: Убедитесь что `npm install` выполнен и `convex` в dependencies

---

## 📚 Следующие шаги

После настройки:

1. ✅ Прочитайте [CONVEX_DEVELOPMENT_PLAN.md](../CONVEX_DEVELOPMENT_PLAN.md)
2. ✅ Начните с Этапа 1: Схема данных
3. ✅ Следуйте плану пошагово

---

*Создано: 2025-01-31*

