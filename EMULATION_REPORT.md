# 🧠 Эмуляция потока данных: Добавление ассетов на таймлайн IMG.LY

**Дата**: 2025-01-XX  
**Анализируемый поток**: От обновления сцен до добавления на таймлайн  
**Цель**: Выявить расхождения и потенциальные проблемы в потоке данных

---

## 📘 Контекст

**Модуль**: `StoryboardView.tsx` → `IMGVideoEditor.tsx`  
**Функция**: Автоматическое добавление изображений сцен на таймлайн IMG.LY  
**Цель**: При переключении на вкладку "Timeline" автоматически добавить все изображения сцен в правильном порядке

**Входные данные**:
- `scenes` — массив сцен из Convex query (real-time обновления)
- `activeTab` — текущая активная вкладка ("scenes" | "timeline" | "settings")
- `videoEditorRef` — ref на компонент IMGVideoEditor

**Ожидаемый результат**: Все изображения сцен добавлены на таймлайн в правильном порядке

**Фактический результат**: (требует проверки) — возможны дубликаты или пропуски при race conditions

---

## 🔄 Путь выполнения

### Шаг 1: Обновление сцен через Convex Query

**Функция**: `useQuery(api.functions.scenes.getScenesByProject, { projectId })`

**Вход**: `{ projectId: "j97fmztedh8z1r9asqpb12z8md7wsya9" }`

**Операция**:
- Convex query подписывается на изменения в таблице `scenes`
- Фильтрует по `projectId`
- Сортирует по `orderIndex`
- Возвращает массив сцен в реальном времени

**Выход**: 
```typescript
scenes = [
  { _id: "scene1", orderIndex: 0, imageUrl: "https://...", imagePrompt: "..." },
  { _id: "scene2", orderIndex: 1, imageUrl: null, imagePrompt: "..." },
  { _id: "scene3", orderIndex: 2, imageUrl: "https://...", imagePrompt: "..." }
]
```

**Побочные эффекты**:
- Компонент перерендеривается при изменении `scenes`
- Запускаются `useEffect` с зависимостью от `scenes`

**Возможные исключения**: Нет (Convex query всегда возвращает массив или `undefined`)

---

### Шаг 2: Автогенерация изображений (параллельно)

**Функция**: `useEffect(() => { scenes.forEach(...) }, [scenes, generateImage, generateAudio])`

**Вход**: `scenes` из шага 1

**Операция**:
```typescript
scenes.forEach((scene) => {
  if (!scene.imageUrl && scene.imagePrompt && !generatingImagesRef.current.has(scene._id)) {
    generatingImagesRef.current.add(scene._id);
    generateImage(scene._id, scene.imagePrompt);
  }
});
```

**Условие**: `!scene.imageUrl && scene.imagePrompt && !generatingImagesRef.current.has(scene._id)`

**Выход**: 
- Для `scene2`: запускается `generateImage("scene2", "...")`
- `generatingImagesRef.current = Set(["scene2"])`

**Побочные эффекты**:
- Вызов Convex action `generateImageAction`
- Обновление `scene.imageUrl` через Convex mutation (асинхронно)
- Обновление `scenes` через real-time query (асинхронно)

**Возможные исключения**: 
- `generateImage` может упасть → ошибка логируется, `generatingImagesRef` очищается в `finally`

**Расхождение**: 
- ⚠️ Если `generateImage` выполняется долго, `scenes` может обновиться несколько раз до завершения
- ⚠️ `generatingImagesRef` может не синхронизироваться с реальным состоянием генерации

---

### Шаг 3: Переключение на вкладку Timeline

**Функция**: `setActiveTab("timeline")` (вызывается пользователем)

**Вход**: `activeTab = "scenes"`

**Операция**: 
```typescript
setActiveTab("timeline");
```

**Выход**: `activeTab = "timeline"`

**Побочные эффекты**:
- Компонент перерендеривается
- Запускается `useEffect` с зависимостью `[activeTab, scenes]`

**Возможные исключения**: Нет

---

### Шаг 4: Проверка условий в useEffect

**Функция**: `useEffect(() => { ... }, [activeTab, scenes])`

**Вход**: 
- `activeTab = "timeline"`
- `scenes = [...]` (может быть обновлен с шага 2)
- `videoEditorRef.current = { addAssetsToTimeline: fn, editorRef: { current: { engine: ... } } }`

**Условие**: 
```typescript
if (activeTab === "timeline" && 
    videoEditorRef.current?.addAssetsToTimeline && 
    scenes.length > 0)
```

**Проверка 1**: `activeTab === "timeline"` → ✅ `true`

**Проверка 2**: `videoEditorRef.current?.addAssetsToTimeline` → ⚠️ **ПРОБЛЕМА**: Проверяет наличие метода, но не готовность `engine`

**Проверка 3**: `scenes.length > 0` → ✅ `true` (если есть сцены)

**Выход**: Условие выполнено → запускается `setTimeout`

**Расхождение**: 
- ⚠️ `videoEditorRef.current?.addAssetsToTimeline` может существовать, но `engine` еще не готов
- ⚠️ Нет проверки `videoEditorRef.current.editorRef.current.engine`

---

### Шаг 5: Задержка перед добавлением

**Функция**: `setTimeout(() => { ... }, 2000)`

**Вход**: Таймер на 2000ms

**Операция**: Ожидание 2000ms

**Побочные эффекты**:
- За это время `scenes` может обновиться (новые изображения сгенерированы)
- `activeTab` может измениться обратно на "scenes"
- Редактор может быть готов или нет

**Выход**: Вызов колбэка через 2000ms

**Расхождение**: 
- ⚠️ Магическое число 2000ms — может быть недостаточно для медленных устройств
- ⚠️ Может быть избыточно для быстрых устройств
- ⚠️ Нет гарантии, что редактор готов после 2000ms

---

### Шаг 6: Фильтрация сцен с изображениями

**Функция**: `scenes.filter(s => s.imageUrl).map(...)`

**Вход**: `scenes` (может быть обновлен с момента шага 4)

**Операция**:
```typescript
const scenesWithImages = scenes
  .filter(s => s.imageUrl)
  .map(s => ({
    imageUrl: s.imageUrl!,
    orderIndex: s.orderIndex,
  }));
```

**Пример данных**:
```typescript
// До фильтрации
scenes = [
  { _id: "scene1", orderIndex: 0, imageUrl: "https://img1.jpg" },
  { _id: "scene2", orderIndex: 1, imageUrl: null }, // Генерация еще идет
  { _id: "scene3", orderIndex: 2, imageUrl: "https://img3.jpg" }
]

// После фильтрации
scenesWithImages = [
  { imageUrl: "https://img1.jpg", orderIndex: 0 },
  { imageUrl: "https://img3.jpg", orderIndex: 2 }
]
```

**Выход**: `scenesWithImages = [...]`

**Расхождение**: 
- ⚠️ Если `scene2` сгенерирует изображение во время выполнения `addAssetsToTimeline`, оно не будет добавлено
- ⚠️ `timelineKey` вычисляется на основе текущего состояния, но может устареть

---

### Шаг 7: Проверка изменений через timelineKey

**Функция**: `timelineKey` вычисление и сравнение

**Вход**: `scenesWithImages`

**Операция**:
```typescript
const timelineKey = scenesWithImages.map(s => `${s.orderIndex}:${s.imageUrl}`).join('|');
// Результат: "0:https://img1.jpg|2:https://img3.jpg"

if (scenesWithImages.length > 0 && timelinePopulatedRef.current !== timelineKey) {
  timelinePopulatedRef.current = timelineKey;
  // Добавляем ассеты
}
```

**Условие**: `timelinePopulatedRef.current !== timelineKey`

**Пример 1**: Первый вызов
- `timelinePopulatedRef.current = ""`
- `timelineKey = "0:https://img1.jpg|2:https://img3.jpg"`
- Условие выполнено → ✅ Добавляем ассеты

**Пример 2**: Повторный вызов с теми же данными
- `timelinePopulatedRef.current = "0:https://img1.jpg|2:https://img3.jpg"`
- `timelineKey = "0:https://img1.jpg|2:https://img3.jpg"`
- Условие не выполнено → ✅ Пропускаем (правильно)

**Пример 3**: Новое изображение сгенерировано
- `timelinePopulatedRef.current = "0:https://img1.jpg|2:https://img3.jpg"`
- `timelineKey = "0:https://img1.jpg|1:https://img2.jpg|2:https://img3.jpg"` (scene2 добавился)
- Условие выполнено → ✅ Добавляем ассеты (правильно)

**Расхождение**: 
- ⚠️ Если `scenes` обновится во время выполнения `addAssetsToTimeline`, `timelineKey` может измениться, но операция уже начата
- ⚠️ Нет защиты от одновременных вызовов `addAssetsToTimeline`

---

### Шаг 8: Вызов addAssetsToTimeline

**Функция**: `videoEditorRef.current.addAssetsToTimeline(scenesWithImages)`

**Вход**: 
```typescript
scenesWithImages = [
  { imageUrl: "https://img1.jpg", orderIndex: 0 },
  { imageUrl: "https://img3.jpg", orderIndex: 2 }
]
```

**Операция**: Асинхронный вызов метода

**Побочные эффекты**: 
- Устанавливается `isPopulatingRef.current = true`
- Запускается `addAssetsToTimeline` в `IMGVideoEditor`

**Возможные исключения**: 
- `videoEditorRef.current` может быть `null` → проверка через `?.`
- `addAssetsToTimeline` может упасть → ошибка логируется в `catch`

**Расхождение**: 
- ⚠️ Если `addAssetsToTimeline` упадет, `isPopulatingRef.current` не сбросится (исправлено в последней версии через `finally`)

---

### Шаг 9: Проверка готовности редактора в addAssetsToTimeline

**Функция**: `addAssetsToTimeline` в `IMGVideoEditor.tsx`

**Вход**: `scenes = [...]`

**Операция**:
```typescript
if (!editorRef.current?.engine) {
  console.error('[IMGVideoEditor] Editor not ready');
  return;
}
```

**Проверка**: `editorRef.current?.engine`

**Сценарий 1**: Редактор готов
- `editorRef.current.engine` существует → ✅ Продолжаем

**Сценарий 2**: Редактор не готов
- `editorRef.current.engine` = `null` → ❌ Возвращаемся, ассеты не добавлены
- `isPopulatingRef.current` остается `true` → ⚠️ **ПРОБЛЕМА**: Блокирует повторные попытки

**Расхождение**: 
- ⚠️ Нет retry механизма при "Editor not ready"
- ⚠️ `isPopulatingRef` не сбрасывается при раннем возврате

---

### Шаг 10: Очистка существующих треков

**Функция**: `engine.block.findByType('track').filter(...)`

**Вход**: `pageId` из `engine.scene.getCurrentPage()`

**Операция**:
```typescript
const existingTracks = engine.block.findByType('track')
  .filter((id: any) => engine.block.getParent(id) === pageId);

for (const trackId of existingTracks) {
  const children = engine.block.getChildren(trackId);
  for (const childId of children) {
    engine.block.destroy(childId);
  }
  engine.block.destroy(trackId);
}
```

**Пример данных**:
- `existingTracks = ["track1", "track2"]`
- `children of track1 = ["graphic1", "graphic2"]`

**Выход**: Все треки и их дети уничтожены

**Побочные эффекты**: Таймлайн очищен

**Возможные исключения**: 
- `engine.block.destroy` может упасть → игнорируется в `catch`

**Расхождение**: 
- ⚠️ Если очистка упадет частично, могут остаться "зомби" треки
- ⚠️ Нет проверки успешности очистки

---

### Шаг 11: Создание нового трека

**Функция**: `engine.block.create('track')`

**Вход**: Нет

**Операция**:
```typescript
const trackId = engine.block.create('track');
engine.block.appendChild(pageId, trackId);
engine.block.fillParent(trackId);
```

**Выход**: `trackId = "track_new_123"`

**Побочные эффекты**: Новый трек создан на странице

**Возможные исключения**: 
- `engine.block.create` может упасть → исключение пробрасывается вверх

**Расхождение**: 
- ⚠️ Если создание трека упадет после очистки, таймлайн останется пустым
- ⚠️ Нет отката при ошибке

---

### Шаг 12: Добавление изображений последовательно

**Функция**: `for (const scene of sortedScenes) { await addImageClip(...) }`

**Вход**: 
```typescript
sortedScenes = [
  { imageUrl: "https://img1.jpg", orderIndex: 0 },
  { imageUrl: "https://img3.jpg", orderIndex: 2 }
]
currentTime = 0
```

**Операция**:
```typescript
for (const scene of sortedScenes) {
  if (scene.imageUrl) {
    await addImageClip(scene.imageUrl, 3, currentTime, trackId);
    currentTime += 3;
  }
}
```

**Итерация 1**:
- `scene = { imageUrl: "https://img1.jpg", orderIndex: 0 }`
- `addImageClip("https://img1.jpg", 3, 0, trackId)` → создает graphic блок
- `currentTime = 3`

**Итерация 2**:
- `scene = { imageUrl: "https://img3.jpg", orderIndex: 2 }`
- `addImageClip("https://img3.jpg", 3, 3, trackId)` → создает graphic блок
- `currentTime = 6`

**Выход**: 2 изображения добавлены на таймлайн

**Побочные эффекты**: Таймлайн содержит 2 клипа

**Возможные исключения**: 
- `addImageClip` может упасть → ошибка логируется, цикл продолжается

**Расхождение**: 
- ⚠️ Если `addImageClip` упадет для `scene2`, `scene3` все равно добавится
- ⚠️ Частичное состояние таймлайна (не все изображения добавлены)
- ⚠️ Нет отката при ошибке

---

### Шаг 13: Обновление длительности страницы

**Функция**: `engine.block.setDuration(pageId, currentTime)`

**Вход**: `currentTime = 6`

**Операция**:
```typescript
if (currentTime > 0) {
  engine.block.setDuration(pageId, 6);
}
```

**Выход**: Длительность страницы = 6 секунд

**Побочные эффекты**: Страница имеет правильную длительность

**Возможные исключения**: 
- `engine.block.setDuration` может упасть → исключение пробрасывается вверх

---

## 🔍 Нарушенные инварианты

### Инвариант 1: Атомарность операции добавления

**Ожидание**: Операция добавления ассетов должна быть атомарной — либо все добавлены, либо ничего

**Факт**: При ошибке в середине цикла часть изображений уже добавлена

**Нарушение**: ❌ Операция не атомарна

---

### Инвариант 2: Синхронизация состояния редактора

**Ожидание**: `isPopulatingRef` должен отражать реальное состояние операции

**Факт**: При раннем возврате из `addAssetsToTimeline` (`Editor not ready`) `isPopulatingRef` не сбрасывается

**Нарушение**: ⚠️ Частичное нарушение (исправлено через `finally`)

---

### Инвариант 3: Консистентность данных сцен

**Ожидание**: `timelineKey` должен соответствовать состоянию сцен на момент начала добавления

**Факт**: `scenes` может обновиться во время выполнения `addAssetsToTimeline`

**Нарушение**: ⚠️ Возможна рассинхронизация

---

## 🎯 Возможные причины расхождений

1. **Race Condition**: Одновременные вызовы `addAssetsToTimeline` из разных источников
2. **Устаревание состояния**: `scenes` обновляется во время выполнения операции
3. **Асинхронная инициализация**: Редактор не готов при первом вызове
4. **Частичные ошибки**: Ошибка в середине цикла оставляет частичное состояние
5. **Отсутствие транзакционности**: Очистка и добавление не атомарны

---

## 🔧 Вероятный корень проблемы

**Основная проблема**: Отсутствие защиты от race conditions и неатомарность операции

**Вторичные проблемы**:
- Нет гарантии готовности редактора
- Нет snapshot состояния сцен
- Нет отката при ошибке

---

## ✅ Рекомендации по исправлению

### 1. Добавить мьютекс для защиты от race conditions

```typescript
const isAddingRef = useRef(false);
const addAssetsToTimeline = useCallback(async (scenes) => {
  if (isAddingRef.current) return;
  isAddingRef.current = true;
  try {
    // ... existing logic
  } finally {
    isAddingRef.current = false;
  }
}, [addImageClip]);
```

### 2. Использовать snapshot сцен

```typescript
const scenesSnapshot = useMemo(() => [...scenes], [scenes]);
// Использовать scenesSnapshot вместо scenes в addAssetsToTimeline
```

### 3. Добавить проверку готовности редактора

```typescript
const waitForEditorReady = async () => {
  for (let i = 0; i < 10; i++) {
    if (editorRef.current?.engine) return true;
    await new Promise(r => setTimeout(r, 200));
  }
  return false;
};
```

### 4. Добавить откат при ошибке

```typescript
const backupTracks = [...existingTracks];
try {
  // Очистка и добавление
} catch (error) {
  // Восстановить или очистить полностью
  console.error('Failed, cleaning up...');
  // Очистить все треки
}
```

---

## 📊 Таблица трассировки

| Step | Function / Module | Input | Operation / Condition | Output | Notes / Discrepancy |
|------|-------------------|-------|----------------------|--------|---------------------|
| 1 | `useQuery` | `{ projectId }` | Convex real-time query | `scenes = [...]` | ✅ OK |
| 2 | `useEffect` | `scenes` | Auto-generate images | `generateImage()` called | ⚠️ Async, может обновить scenes |
| 3 | `setActiveTab` | `"timeline"` | User action | `activeTab = "timeline"` | ✅ OK |
| 4 | `useEffect` | `[activeTab, scenes]` | Check conditions | `setTimeout` started | ⚠️ Проверка не гарантирует готовность engine |
| 5 | `setTimeout` | `2000ms` | Wait | Callback called | ⚠️ Магическое число |
| 6 | `filter/map` | `scenes` | Filter scenes with images | `scenesWithImages` | ⚠️ scenes может обновиться |
| 7 | `timelineKey` | `scenesWithImages` | Create key | `"0:url1\|2:url2"` | ⚠️ Может устареть |
| 8 | `addAssetsToTimeline` | `scenesWithImages` | Call method | Async operation | ⚠️ Нет защиты от race |
| 9 | `addAssetsToTimeline` | - | Check editor ready | Continue or return | ⚠️ Ранний возврат не сбрасывает флаг |
| 10 | `findByType('track')` | `pageId` | Clear tracks | Tracks destroyed | ⚠️ Частичные ошибки игнорируются |
| 11 | `create('track')` | - | Create new track | `trackId` | ⚠️ Нет отката при ошибке |
| 12 | `addImageClip` loop | `sortedScenes` | Add images | Images added | ⚠️ Частичное состояние при ошибке |
| 13 | `setDuration` | `currentTime` | Update page duration | Duration set | ✅ OK |

---

## 🧪 Мини-тесты для верификации

### Тест 1: Проверка защиты от race conditions

```typescript
// В консоли браузера
let callCount = 0;
const originalAdd = videoEditorRef.current.addAssetsToTimeline;
videoEditorRef.current.addAssetsToTimeline = async (...args) => {
  callCount++;
  console.log(`Call ${callCount} started`);
  await originalAdd(...args);
  console.log(`Call ${callCount} finished`);
};

// Быстро переключить вкладку 5 раз
// Ожидаемый результат: callCount <= 2 (защита работает)
```

### Тест 2: Проверка готовности редактора

```typescript
// В консоли браузера
const checkReady = () => {
  console.log('Editor ready:', !!videoEditorRef.current?.editorRef?.current?.engine);
  console.log('Method exists:', !!videoEditorRef.current?.addAssetsToTimeline);
};

// Вызвать checkReady() сразу после переключения на Timeline
// Ожидаемый результат: Оба должны быть true
```

---

## 📝 Выводы

**Основные проблемы**:
1. ❌ Отсутствие защиты от race conditions
2. ⚠️ Нет гарантии готовности редактора
3. ⚠️ Неатомарность операции добавления
4. ⚠️ Возможна рассинхронизация состояния сцен

**Приоритет исправлений**: 🔴 **Высокий** — критично для стабильности
