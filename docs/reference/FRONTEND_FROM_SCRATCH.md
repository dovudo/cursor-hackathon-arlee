# 🎨 Создание фронтенда с нуля - Arlekino AI MVP

> **Цель**: Создать фронтенд с идентичным user-flow, но без сложной логики  
> **Время**: 2-3 часа  
> **Принцип**: Простота, приятный дизайн, единая структура endpoints и данных

---

## 📋 Обзор

Этот документ описывает создание фронтенда с нуля для MVP. Фронтенд должен иметь идентичный user-flow с оригиналом, но без сложной бизнес-логики (кредиты, балансы, сложные состояния).

---

## 🏗️ Структура проекта

```
frontend/
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout с Provider
│   │   ├── (onboarding)/
│   │   │   └── onboarding/
│   │   │       └── page.tsx        # Главная страница онбординга
│   │   └── api/                    # API routes (опционально)
│   ├── components/
│   │   ├── ui/                     # shadcn/ui компоненты
│   │   ├── onboarding/
│   │   │   ├── StyleSelector.tsx   # Выбор стиля
│   │   │   └── StoryboardView.tsx  # Отображение storyboard
│   │   └── Storyboard.tsx          # Компонент storyboard
│   ├── context/
│   │   └── ProjectContext.tsx      # React Context для state
│   ├── lib/
│   │   ├── supabase/
│   │   │   └── client.ts          # Supabase client
│   │   └── utils.ts               # Утилиты
│   └── hooks/
│       └── use-polling.ts          # Hook для polling статуса
├── public/                         # Статические файлы
├── package.json
├── tailwind.config.js
└── tsconfig.json
```

---

## 🚀 Шаг 1: Инициализация проекта (15 минут)

### 1.1 Создать Next.js проект

```bash
npx create-next-app@latest frontend --typescript --tailwind --app --no-src-dir=false
cd frontend
```

### 1.2 Установить зависимости

```bash
npm install @supabase/supabase-js @supabase/ssr
npm install lucide-react clsx tailwind-merge
npm install -D @types/node
```

### 1.3 Настроить shadcn/ui

```bash
npx shadcn-ui@latest init
npx shadcn-ui@latest add button card textarea select progress skeleton
```

---

## 🎨 Шаг 2: Настройка базовой инфраструктуры (30 минут)

### 2.1 Supabase Client

**`lib/supabase/client.ts`**:
```typescript
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
```

### 2.2 ProjectContext

**`context/ProjectContext.tsx`**:
```typescript
'use client'

import { createContext, useContext, useState, ReactNode, useCallback } from 'react'
import { supabase } from '@/lib/supabase/client'

interface Project {
  id: string
  name: string
  scenarioText: string
  styleId: string | null
  scenes: Scene[]
}

interface Scene {
  id: string
  orderIndex: number
  title: string
  text: string
  imagePrompt: string
  imageUrl?: string
  audioUrl?: string
  imageStatus?: 'pending' | 'processing' | 'completed' | 'failed'
  audioStatus?: 'pending' | 'processing' | 'completed' | 'failed'
}

interface ProjectContextType {
  project: Project | null
  setProject: (project: Project | null) => void
  updateScene: (sceneId: string, updates: Partial<Scene>) => void
  generateStoryboard: (projectId: string, scenarioText: string, styleId: string) => Promise<void>
  generateImageForScene: (sceneId: string, prompt: string) => Promise<void>
  generateAudioForScene: (sceneId: string, text: string, voiceId: string) => Promise<void>
}

const ProjectContext = createContext<ProjectContextType | null>(null)

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [project, setProject] = useState<Project | null>(null)

  const updateScene = useCallback((sceneId: string, updates: Partial<Scene>) => {
    if (!project) return
    setProject({
      ...project,
      scenes: project.scenes.map(s =>
        s.id === sceneId ? { ...s, ...updates } : s
      )
    })
  }, [project])

  const generateStoryboard = useCallback(async (
    projectId: string,
    scenarioText: string,
    styleId: string
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/storyboard-generation`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ projectId, scenarioText, styleId })
        }
      )

      if (!response.ok) {
        throw new Error('Storyboard generation failed')
      }

      const { scenes } = await response.json()
      
      setProject(prev => prev ? {
        ...prev,
        scenes: scenes.map((s: any) => ({
          id: s.id,
          orderIndex: s.orderIndex,
          title: s.title,
          text: s.text,
          imagePrompt: s.imagePrompt,
          imageStatus: 'pending' as const,
          audioStatus: 'pending' as const
        }))
      } : null)
    } catch (error) {
      console.error('Storyboard generation error:', error)
      throw error
    }
  }, [])

  const generateImageForScene = useCallback(async (sceneId: string, prompt: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      updateScene(sceneId, { imageStatus: 'processing' })

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-image`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sceneId, prompt })
        }
      )

      if (!response.ok) {
        throw new Error('Image generation failed')
      }

      const { url } = await response.json()
      updateScene(sceneId, { imageUrl: url, imageStatus: 'completed' })
    } catch (error) {
      console.error('Image generation error:', error)
      updateScene(sceneId, { imageStatus: 'failed' })
      throw error
    }
  }, [updateScene])

  const generateAudioForScene = useCallback(async (
    sceneId: string,
    text: string,
    voiceId: string = '21m00Tcm4TlvDq8ikWAM'  // Rachel voice по умолчанию
  ) => {
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      updateScene(sceneId, { audioStatus: 'processing' })

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/generate-audio`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ sceneId, text, voiceId })
        }
      )

      if (!response.ok) {
        throw new Error('Audio generation failed')
      }

      const { url } = await response.json()
      updateScene(sceneId, { audioUrl: url, audioStatus: 'completed' })
    } catch (error) {
      console.error('Audio generation error:', error)
      updateScene(sceneId, { audioStatus: 'failed' })
      throw error
    }
  }, [updateScene])

  return (
    <ProjectContext.Provider value={{
      project,
      setProject,
      updateScene,
      generateStoryboard,
      generateImageForScene,
      generateAudioForScene
    }}>
      {children}
    </ProjectContext.Provider>
  )
}

export const useProject = () => {
  const context = useContext(ProjectContext)
  if (!context) throw new Error('useProject must be used within ProjectProvider')
  return context
}
```

### 2.3 Обновить Root Layout

**`app/layout.tsx`**:
```typescript
import { ProjectProvider } from '@/context/ProjectContext'
import './globals.css'

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>
        <ProjectProvider>
          {children}
        </ProjectProvider>
      </body>
    </html>
  )
}
```

---

## 🎯 Шаг 3: Onboarding Page (1.5 часа)

### 3.1 Основная структура

**`app/(onboarding)/onboarding/page.tsx`**:
```typescript
'use client'

import { useState, useEffect } from 'react'
import { useProject } from '@/context/ProjectContext'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Progress } from '@/components/ui/progress'
import { Loader2 } from 'lucide-react'
import StyleSelector from '@/components/onboarding/StyleSelector'
import StoryboardView from '@/components/onboarding/StoryboardView'

type Step = 'script' | 'style' | 'generating' | 'result'

export default function OnboardingPage() {
  const {
    project,
    setProject,
    generateStoryboard,
    generateImageForScene,
    generateAudioForScene
  } = useProject()

  const [step, setStep] = useState<Step>('script')
  const [scenarioText, setScenarioText] = useState('')
  const [selectedStyle, setSelectedStyle] = useState<string | null>(null)
  const [styles, setStyles] = useState<any[]>([])
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)

  // Загружаем стили при монтировании
  useEffect(() => {
    supabase.from('styles')
      .select('*')
      .eq('is_public', true)
      .then(({ data }) => setStyles(data || []))
  }, [])

  const handleGenerateStoryboard = async () => {
    if (!scenarioText || !selectedStyle) return

    setIsGenerating(true)
    setStep('generating')
    setProgress(0)

    try {
      // 1. Создаем проект
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')

      const { data: newProject, error: projectError } = await supabase
        .from('projects')
        .insert({
          name: 'My Project',
          scenario_text: scenarioText,
          style_id: selectedStyle
        })
        .select()
        .single()

      if (projectError) throw projectError

      setProject({
        id: newProject.id,
        name: newProject.name,
        scenarioText,
        styleId: selectedStyle,
        scenes: []
      })

      setProgress(20)

      // 2. Генерируем storyboard
      await generateStoryboard(newProject.id, scenarioText, selectedStyle)
      setProgress(40)

      // 3. Генерируем изображения и аудио для каждой сцены
      if (project?.scenes) {
        const totalScenes = project.scenes.length
        let completed = 0

        for (const scene of project.scenes) {
          // Генерируем изображение
          await generateImageForScene(scene.id, scene.imagePrompt)
          completed++
          setProgress(40 + (completed / totalScenes) * 30)

          // Генерируем аудио
          await generateAudioForScene(scene.id, scene.text)
          completed++
          setProgress(40 + (completed / totalScenes) * 30)
        }
      }

      setProgress(100)
      setStep('result')
    } catch (error) {
      console.error('Generation error:', error)
      alert('Ошибка генерации: ' + (error as Error).message)
      setStep('style')
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <div className="container mx-auto p-8 max-w-6xl">
      {step === 'script' && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader>
            <CardTitle className="text-3xl font-bold">Создайте ваш сценарий</CardTitle>
            <CardDescription>
              Введите текст вашего сценария. AI разобьет его на сцены и создаст визуализацию.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Textarea
              value={scenarioText}
              onChange={e => setScenarioText(e.target.value)}
              placeholder="Введите текст вашего сценария..."
              className="min-h-[300px]"
            />
            <Button
              onClick={() => setStep('style')}
              disabled={!scenarioText.trim()}
              className="w-full"
            >
              Далее: Выбрать стиль
            </Button>
          </CardContent>
        </Card>
      )}

      {step === 'style' && (
        <div className="max-w-4xl mx-auto">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Выберите стиль</CardTitle>
              <CardDescription>
                Выберите визуальный стиль для вашего видео
              </CardDescription>
            </CardHeader>
            <CardContent>
              <StyleSelector
                styles={styles}
                selected={selectedStyle}
                onSelect={setSelectedStyle}
              />
              <div className="flex gap-4 mt-6">
                <Button variant="outline" onClick={() => setStep('script')}>
                  Назад
                </Button>
                <Button
                  onClick={handleGenerateStoryboard}
                  disabled={!selectedStyle || isGenerating}
                  className="flex-1"
                >
                  {isGenerating ? 'Генерируем...' : 'Создать storyboard'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {step === 'generating' && (
        <Card className="max-w-2xl mx-auto">
          <CardContent className="pt-6">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin mx-auto text-primary" />
              <h2 className="text-2xl font-bold">Генерируем ваш storyboard...</h2>
              <Progress value={progress} className="w-full" />
              <p className="text-sm text-muted-foreground">{progress}%</p>
            </div>
          </CardContent>
        </Card>
      )}

      {step === 'result' && project && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-3xl font-bold">Ваш Storyboard</CardTitle>
              <CardDescription>
                Результат генерации: {project.scenes.length} сцен
              </CardDescription>
            </CardHeader>
          </Card>
          <StoryboardView project={project} />
        </div>
      )}
    </div>
  )
}
```

---

## 🎨 Шаг 4: Компоненты (1 час)

### 4.1 StyleSelector

**`components/onboarding/StyleSelector.tsx`**:
```typescript
'use client'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface Style {
  id: string
  name: string
  description: string
  image_url?: string
}

interface StyleSelectorProps {
  styles: Style[]
  selected: string | null
  onSelect: (styleId: string) => void
}

export default function StyleSelector({ styles, selected, onSelect }: StyleSelectorProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {styles.map(style => (
        <Card
          key={style.id}
          onClick={() => onSelect(style.id)}
          className={cn(
            'cursor-pointer transition-all hover:shadow-lg',
            selected === style.id && 'ring-2 ring-primary'
          )}
        >
          {style.image_url && (
            <img
              src={style.image_url}
              alt={style.name}
              className="w-full h-48 object-cover rounded-t-lg"
            />
          )}
          <CardHeader>
            <CardTitle>{style.name}</CardTitle>
            <CardDescription>{style.description}</CardDescription>
          </CardHeader>
        </Card>
      ))}
    </div>
  )
}
```

### 4.2 StoryboardView

**`components/onboarding/StoryboardView.tsx`**:
```typescript
'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { Loader2 } from 'lucide-react'
import { Project } from '@/context/ProjectContext'

interface StoryboardViewProps {
  project: Project
}

export default function StoryboardView({ project }: StoryboardViewProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {project.scenes.map((scene, index) => (
        <Card key={scene.id}>
          <CardHeader>
            <CardTitle>Сцена {index + 1}: {scene.title}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-muted-foreground">{scene.text}</p>
            
            {/* Изображение */}
            {scene.imageStatus === 'processing' && (
              <div className="w-full h-48 bg-muted rounded-lg flex items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin" />
                <span className="ml-2">Генерируем изображение...</span>
              </div>
            )}
            {scene.imageUrl && (
              <img
                src={scene.imageUrl}
                alt={scene.title}
                className="w-full rounded-lg"
              />
            )}
            {scene.imageStatus === 'failed' && (
              <div className="text-destructive">Ошибка генерации изображения</div>
            )}

            {/* Аудио */}
            {scene.audioStatus === 'processing' && (
              <div className="text-sm text-muted-foreground">
                Генерируем аудио...
              </div>
            )}
            {scene.audioUrl && (
              <audio controls src={scene.audioUrl} className="w-full" />
            )}
            {scene.audioStatus === 'failed' && (
              <div className="text-destructive">Ошибка генерации аудио</div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}
```

---

## 🎨 Шаг 5: Дизайн и стилизация (30 минут)

### 5.1 Цветовая схема

Используйте цвета похожие на оригинал:
- Primary: синий (#3b82f6)
- Secondary: серый (#64748b)
- Accent: фиолетовый (#8b5cf6)

### 5.2 Типографика

- Заголовки: Inter, bold
- Текст: Inter, regular
- Размеры: responsive (mobile-first)

### 5.3 Анимации

Добавьте плавные переходы:
```css
/* globals.css */
.transition-all {
  transition: all 0.3s ease;
}
```

---

## ✅ Чеклист

- [ ] Проект создан и настроен
- [ ] Supabase client настроен
- [ ] ProjectContext реализован
- [ ] Onboarding page работает (4 шага)
- [ ] StyleSelector компонент создан
- [ ] StoryboardView компонент создан
- [ ] Дизайн приятный и похож на оригинал
- [ ] Все endpoints работают
- [ ] Polling статуса работает
- [ ] Error handling реализован

---

## 🚀 Запуск

```bash
npm run dev
```

Откройте http://localhost:3000/onboarding

---

*Создано: 2025-01-31*  
*Для API документации см.: [API_REFERENCE.md](./API_REFERENCE.md)*
