# 🔍 Code Review Report: IMG.LY Timeline Integration

**Дата**: 2025-01-XX  
**Анализируемая область**: Добавление ассетов на таймлайн IMG.LY  
**Файлы**: `IMGVideoEditor.tsx`, `StoryboardView.tsx`, `ProjectContext.tsx`, `onboarding/page.tsx`

---

## 📋 Обзор

### Анализируемые компоненты

1. **`IMGVideoEditor.tsx`** — компонент редактора IMG.LY с методами `addImageClip` и `addAssetsToTimeline`
2. **`StoryboardView.tsx`** — главный компонент storyboard с логикой автоматического добавления ассетов
3. **`ProjectContext.tsx`** — контекст для управления проектом и генерации контента
4. **`onboarding/page.tsx`** — страница онбординга с переходом между шагами

### Ключевые изменения

- ✅ Реализовано добавление изображений на таймлайн IMG.LY
- ✅ Добавлена защита от дубликатов через `timelinePopulatedRef`
- ✅ Улучшено логирование для отладки
- ✅ Исправлена загрузка аудио через Convex Storage (обход лимита размера аргументов)

---

## 🧪 Гипотезы и проверки

### Гипотеза 1: Race Condition при одновременном добавлении ассетов

**Описание проблемы**:  
Если пользователь быстро переключается между вкладками или сцены обновляются в реальном времени, может произойти одновременный вызов `addAssetsToTimeline`, что приведет к дублированию треков или конфликтам.

**Текущая защита**:
```typescript
const timelinePopulatedRef = useRef<string>("");
const isPopulatingRef = useRef(false);
```

**Проблемы**:
- ⚠️ `isPopulatingRef` устанавливается в `true`, но не сбрасывается при ошибке в `catch`
- ⚠️ Нет защиты от одновременных вызовов внутри `addAssetsToTimeline` (может быть вызвана из разных мест)
- ⚠️ `setTimeout` в 2000ms может создать гонку, если редактор еще не готов

**Как проверить**:
```typescript
// Тест 1: Быстрое переключение вкладок
1. Открыть storyboard
2. Быстро переключаться между "Scenes" и "Timeline" 5-10 раз
3. Проверить консоль на дубликаты вызовов
4. Проверить таймлайн на дубликаты треков

// Тест 2: Обновление сцен во время добавления
1. Начать добавление ассетов на таймлайн
2. Одновременно обновить сцену (добавить новое изображение)
3. Проверить, что новый ассет не создает дубликат
```

**Рекомендация**:
```typescript
// Добавить мьютекс внутри addAssetsToTimeline
const isAddingRef = useRef(false);
const addAssetsToTimeline = useCallback(async (scenes) => {
  if (isAddingRef.current) {
    console.warn('[IMGVideoEditor] Already adding assets, skipping');
    return;
  }
  isAddingRef.current = true;
  try {
    // ... existing logic
  } finally {
    isAddingRef.current = false;
  }
}, [addImageClip]);
```

---

### Гипотеза 2: Устаревание состояния при быстром обновлении сцен

**Описание проблемы**:  
`scenes` обновляется через `useQuery` в реальном времени. Если изображения генерируются быстро, `timelineKey` может устареть до завершения добавления на таймлайн, что приведет к повторному добавлению.

**Текущая логика**:
```typescript
const timelineKey = scenesWithImages.map(s => `${s.orderIndex}:${s.imageUrl}`).join('|');
if (timelinePopulatedRef.current !== timelineKey) {
  timelinePopulatedRef.current = timelineKey;
  // Добавляем ассеты
}
```

**Проблемы**:
- ⚠️ `timelineKey` вычисляется в `useEffect`, но `scenes` может измениться во время выполнения `addAssetsToTimeline`
- ⚠️ Нет проверки, что редактор готов перед добавлением
- ⚠️ `setTimeout(2000)` — магическое число, может быть недостаточно для медленных устройств

**Как проверить**:
```typescript
// Тест: Быстрая генерация изображений
1. Создать проект с 5 сценами
2. Одновременно запустить генерацию всех изображений
3. Переключиться на Timeline до завершения генерации
4. Проверить, что все изображения добавлены корректно без дубликатов
```

**Рекомендация**:
```typescript
// Добавить проверку готовности редактора
const checkEditorReady = () => {
  return videoEditorRef.current?.addAssetsToTimeline && 
         videoEditorRef.current?.editorRef?.current?.engine;
};

// Использовать debounce для изменений scenes
const debouncedScenes = useMemo(() => {
  // Debounce scenes changes by 500ms
}, [scenes]);
```

---

### Гипотеза 3: Некорректная очистка треков при частичном сбое

**Описание проблемы**:  
Если `addAssetsToTimeline` упадет после очистки треков, но до создания нового трека, таймлайн останется пустым. Если упадет после создания трека, но до добавления всех изображений, останутся частичные данные.

**Текущая логика**:
```typescript
// Очистка треков
for (const trackId of existingTracks) {
  // destroy children and track
}
// Создание нового трека
const trackId = engine.block.create('track');
// Добавление изображений
for (const scene of sortedScenes) {
  await addImageClip(...);
}
```

**Проблемы**:
- ⚠️ Нет транзакционности — очистка и добавление не атомарны
- ⚠️ При ошибке в середине цикла `addImageClip` часть изображений уже добавлена
- ⚠️ Нет отката при ошибке

**Как проверить**:
```typescript
// Тест: Симуляция ошибки
1. Добавить breakpoint в середине цикла addImageClip
2. Симулировать ошибку (невалидный URL)
3. Проверить состояние таймлайна (должны быть частичные данные)
4. Повторить добавление — проверить дубликаты
```

**Рекомендация**:
```typescript
// Сохранить состояние перед изменением
const backupTracks = [...existingTracks];
try {
  // Очистка и добавление
} catch (error) {
  // Восстановить или очистить полностью
  console.error('Failed to add assets, cleaning up...');
  // Очистить все треки
}
```

---

### Гипотеза 4: Проблема с порядком выполнения при инициализации редактора

**Описание проблемы**:  
Редактор IMG.LY инициализируется асинхронно. `useEffect` в `StoryboardView` может сработать до полной готовности редактора, что приведет к ошибке "Editor not ready".

**Текущая логика**:
```typescript
useEffect(() => {
  if (activeTab === "timeline" && videoEditorRef.current?.addAssetsToTimeline) {
    const timer = setTimeout(() => {
      // Добавляем ассеты
    }, 2000);
  }
}, [activeTab, scenes]);
```

**Проблемы**:
- ⚠️ Проверка `videoEditorRef.current?.addAssetsToTimeline` не гарантирует готовность `engine`
- ⚠️ `setTimeout(2000)` — хардкод, может быть недостаточно или избыточно
- ⚠️ Нет проверки `editorRef.current.engine` перед вызовом

**Как проверить**:
```typescript
// Тест: Быстрое переключение на Timeline
1. Открыть storyboard
2. Сразу переключиться на Timeline (до инициализации редактора)
3. Проверить консоль на ошибки "Editor not ready"
4. Проверить, что ассеты добавлены после готовности редактора
```

**Рекомендация**:
```typescript
// Добавить проверку готовности через polling
const waitForEditorReady = async (maxAttempts = 10) => {
  for (let i = 0; i < maxAttempts; i++) {
    if (videoEditorRef.current?.editorRef?.current?.engine) {
      return true;
    }
    await new Promise(resolve => setTimeout(resolve, 200));
  }
  return false;
};

// Использовать в useEffect
if (await waitForEditorReady()) {
  videoEditorRef.current?.addAssetsToTimeline(scenesWithImages);
}
```

---

### Гипотеза 5: Проблема с форматом storageId при загрузке аудио

**Описание проблемы**:  
Convex Storage возвращает `storageId` как текст, но код пытается использовать его как `Id<"_storage">`. Если формат неверный, мутация `updateSceneAudioFromStorage` упадет.

**Текущая логика**:
```typescript
const storageIdText = await uploadResponse.text();
const result = await updateSceneAudioFromStorageMutation({
  sceneId,
  storageId: storageIdText as Id<"_storage">,
});
```

**Проблемы**:
- ⚠️ Нет валидации формата `storageIdText`
- ⚠️ Type assertion `as Id<"_storage">` не гарантирует корректность
- ⚠️ Нет обработки случая, когда Convex возвращает JSON вместо текста

**Как проверить**:
```typescript
// Тест: Проверка формата storageId
1. Сгенерировать аудио для сцены
2. Проверить формат storageId в консоли
3. Симулировать невалидный формат
4. Проверить ошибку в мутации
```

**Рекомендация**:
```typescript
// Добавить валидацию
let storageId: Id<"_storage">;
try {
  const responseText = await uploadResponse.text();
  // Convex может вернуть JSON или текст
  const parsed = JSON.parse(responseText);
  storageId = parsed.storageId || parsed;
} catch {
  storageId = await uploadResponse.text() as Id<"_storage">;
}

// Валидация формата (Convex storage IDs имеют специфичный формат)
if (!storageId || typeof storageId !== 'string') {
  throw new Error('Invalid storage ID format');
}
```

---

## ⚠️ Зоны риска

### 1. **Состояние редактора IMG.LY**

**Риск**: Редактор может быть не готов при вызове `addAssetsToTimeline`

**Текущая защита**: `setTimeout(2000)` и проверка `videoEditorRef.current?.addAssetsToTimeline`

**Улучшение**: Добавить явную проверку готовности через polling или callback

---

### 2. **Конкурентные обновления сцен**

**Риск**: `scenes` обновляется в реальном времени через Convex, может измениться во время добавления на таймлайн

**Текущая защита**: `timelinePopulatedRef` для отслеживания изменений

**Улучшение**: Использовать snapshot сцен в момент начала добавления

---

### 3. **Обработка ошибок в цепочке генерации**

**Риск**: Если генерация изображения/аудио упадет, состояние может остаться неконсистентным

**Текущая защита**: `try/catch` в `generateAudio` и `generateImage`

**Улучшение**: Добавить retry механизм и более детальное логирование ошибок

---

### 4. **Производительность при большом количестве сцен**

**Риск**: При 20+ сценах добавление на таймлайн может занять много времени

**Текущая защита**: Нет

**Улучшение**: Добавить прогресс-бар и возможность отмены операции

---

### 5. **Память при частых обновлениях**

**Риск**: `useEffect` с `scenes` в зависимостях может создавать много таймеров

**Текущая защита**: `return () => clearTimeout(timer)` в `useEffect`

**Улучшение**: Использовать `useMemo` для фильтрации сцен с изображениями

---

## 💡 Рекомендации

### Критичные (до релиза)

1. **Добавить мьютекс в `addAssetsToTimeline`**
   ```typescript
   const isAddingRef = useRef(false);
   // Защита от одновременных вызовов
   ```

2. **Улучшить проверку готовности редактора**
   ```typescript
   const waitForEditorReady = async () => { /* polling */ };
   ```

3. **Добавить валидацию `storageId`**
   ```typescript
   // Проверка формата перед использованием
   ```

4. **Исправить сброс `isPopulatingRef` при ошибке**
   ```typescript
   .finally(() => { isPopulatingRef.current = false; });
   ```

### Важные (после релиза)

1. **Добавить прогресс-бар для добавления ассетов**
2. **Улучшить обработку ошибок с детальными сообщениями**
3. **Добавить метрики производительности**
4. **Реализовать retry механизм для неудачных операций**

### Улучшения (опционально)

1. **Кэширование состояния таймлайна**
2. **Оптимистичные обновления UI**
3. **Debounce для изменений сцен**
4. **Unit тесты для критичных функций**

---

## ✅ Заключение

### Общая оценка качества: 🟡 **Хорошо, но есть риски**

**Сильные стороны**:
- ✅ Правильное использование IMG.LY API (`imageFileURI`, `fillParent`)
- ✅ Защита от дубликатов через `timelinePopulatedRef`
- ✅ Детальное логирование для отладки
- ✅ Правильная очистка треков перед добавлением

**Критичные проблемы**:
- ❌ Нет защиты от race conditions в `addAssetsToTimeline`
- ❌ Нет валидации готовности редактора
- ❌ Проблема с форматом `storageId` при загрузке аудио
- ⚠️ `setTimeout(2000)` — хардкод, может быть ненадежным

**Рекомендации по тестированию**:

1. **Ручное тестирование**:
   - Быстрое переключение между вкладками (10+ раз)
   - Генерация проекта с 10+ сценами
   - Одновременная генерация изображений и переключение на Timeline
   - Тест на медленном устройстве/сети

2. **Проверка консоли**:
   - Отсутствие ошибок "Editor not ready"
   - Отсутствие дубликатов вызовов `addAssetsToTimeline`
   - Корректные логи добавления ассетов

3. **Проверка UI**:
   - Все изображения добавлены на таймлайн
   - Правильный порядок по `orderIndex`
   - Нет дубликатов треков
   - Корректная длительность страницы

**Приоритет исправлений**: 🔴 **Высокий** — исправить критические проблемы перед релизом.
