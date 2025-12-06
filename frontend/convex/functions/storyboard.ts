import { action } from "../_generated/server";
import { v } from "convex/values";
import { api } from "../_generated/api";

export const generateStoryboard = action({
  args: {
    projectId: v.id("projects"),
    scenarioText: v.string(),
    styleId: v.id("styles"),
  },
  handler: async (ctx, args) => {
    // 0. Validate input data
    if (!args.scenarioText || args.scenarioText.trim().length === 0) {
      throw new Error("Scenario text cannot be empty");
    }

    if (!args.projectId) {
      throw new Error("Project ID is required");
    }

    if (!args.styleId) {
      throw new Error("Style ID is required");
    }

    // Debug logging
    console.log("[generateStoryboard] Starting generation", {
      projectId: args.projectId,
      scenarioTextLength: args.scenarioText.length,
      styleId: args.styleId,
    });

    // 1. Get project with settings
    const project = await ctx.runQuery(api.functions.projects.getProjectById, {
      projectId: args.projectId,
    });

    if (!project) {
      throw new Error(`Project not found: ${args.projectId}`);
    }

    // 2. Get style
    const style = await ctx.runQuery(api.functions.styles.getStyleById, {
      styleId: args.styleId,
    });

    if (!style) {
      throw new Error(`Style not found: ${args.styleId}`);
    }

    // Extract settings with defaults
    const settings = project.settings || {};
    const language = settings.language || "en";
    const pacing = settings.pacing || "moderate";
    const targetDuration = settings.target_duration || 60;
    const minSec = settings.min_sec || 2;
    const maxSec = settings.max_sec || 10;
    const framing = settings.framing || "16:9";
    const audience = settings.audience || "general";
    const wordsPerMinute = settings.wordsPerMinute || 140;

    console.log("[generateStoryboard] Style and settings loaded", {
      styleName: style.name,
      hasPrompt: !!style.prompt,
      language,
      pacing,
      targetDuration,
      framing,
    });

    // 2. Build master prompt (based on original Arlee AI master prompt with all settings)
    const settingsAndMeta = {
      language: language,
      pacing: pacing,
      target_duration: targetDuration,
      min_sec: minSec,
      max_sec: maxSec,
      framing: framing,
      audience: audience,
      wordsPerMinute: wordsPerMinute,
    };

    const availableModels = [
      {
        unified_model_name: "black-forest-labs/flux-schnell",
        category: "image_generation",
        quality_score: 9,
        model_meta: {
          aspect_ratios: ["16:9", "9:16", "1:1", "4:3"],
          supports_negative_prompt: true,
        },
      },
    ];

    const prompt = `**Цель**

Преобразовать текстовый сценарий в связный сториборд. На выходе получить сцены без потери контекста, промты для генерации визуала вместе с выбранной моделью, поисковые запросы на стоки для каждой сцены.

# Роль

Ты работаешь как режиссер, сторибордист и продюсер генеративного визуала в команде Arlee AI - платформы для создания профессионального видеоконтента с помощью искусственного интеллекта.

## Контекст продукта Arlee AI:
- **Миссия**: Демократизировать создание качественного видеоконтента, делая профессиональные инструменты доступными каждому
- **Целевая аудитория**: Контент-мейкеры, маркетологи, предприниматели, креаторы, которые хотят создавать видео без сложного монтажа
- **Уникальность**: Полностью автоматизированный пайплайн от идеи до готового видео с AI-генерацией всех элементов
- **Технические возможности**:
  * Поддержка множества AI-моделей (FLUX, Stable Diffusion, Midjourney)
  * Автоматическая генерация промптов под выбранную модель
  * Интеграция со стоковыми платформами для поиска референсов
  * Сохранение всех AI-метаданных для последующего использования

## Твоя экспертность:
- **Сторибординг**: Сегментировать повествование на логические сцены, сохраняя смысловую целостность
- **Визуальное мышление**: Подбирать стили и модели генерации под специфику контента и бренда
- **Техническая экспертиза**: Формировать промты под разные AI-движки (Stable Diffusion, Midjourney, DALL-E, FLUX)
- **Поисковая оптимизация**: Создавать релевантные поисковые запросы для стоковых платформ
- **Понимание трендов**: Знаешь актуальные визуальные тренды, композиционные решения, цветовые палитры

# Контекст

1. **Сценарий проекта** (из QuickStartStep → VoiceCloningStep):
   Это исходный текстовый сценарий, который пользователь создал или отредактировал.
   Вставка:
   ${args.scenarioText}

2. **Транскрибированная аудио дорожка** из Whisper с таймкодами слов (формат: слово, start, end):
   Это результат анализа аудио-дорожки пользователя с точными временными метками для сегментации по сценам.
   Вставка:
   []

3. Стили, список промтов и тегов стиля, приоритеты.
   Вставка,
   ${JSON.stringify([style])}

3. Настройки и метаинформация, язык, темп монтажа, целевая длительность, целевая аудитория, кадрирование, ограничения, запрещенные темы, формат вывода.
   Вставка,
   ${JSON.stringify(settingsAndMeta)}

4. Доступные модели с метаинформацией, ограничения по аспекту, поддержка negative, контроль seed, стоимость, скорость, примечания.
   Вставка,
   ${JSON.stringify(availableModels)}

Правила
=======

1. Сцены без потери контекста, объединяй фразы по смыслу. Не рви мысль на границе кадра, если реплика семантически продолжается. Делить нужно по настройкам из данных editing pacing, сцены лучше делить по знакам препинания, чтобы сохранять логичную структуру переключения кадров.

2. Таймкод сцены, бери start как start первого слова сцены, end как end последнего слова сцены. Формат времени HH:MM:SS.mmm, пример 00:01:07.532.

3. Сегментация, ориентируйся на, смысловой сдвиг, временной скачок, сильную паузу. Если задан темп, используй целевые границы длительностей из {SETTINGS_AND_META}.

## Типы pacing в Arlee AI (ОБЯЗАТЕЛЬНО используй только эти значения):
- **dynamic** (Динамичный): 1-3 секунд - быстрые смены кадров, энергичный ритм
- **moderate** (Размеренный): 3-7 секунд - сбалансированный темп, стандартный монтаж
- **slow** (Спокойный): 7-20 секунд - неторопливый темп, детальная проработка
- **custom** (Настраиваемый): пользовательский диапазон в секундах, конвертируй в слова по формуле: слова = (секунды × 140) / 60

**ВАЖНО: Если pacing не соответствует ни одному из этих типов, используй 'moderate' по умолчанию.**

4. Модель выбирай ТОЛЬКО для генерации изображений из {AVAILABLE_MODELS} с category="image_generation". НЕ используй текстовые модели! Учитывай аспект, фотографичность против иллюстративности, поддержку negative, лиц, текста, скорость. Указывай имя модели из unified_model_name и при необходимости параметры.

**ВАЖНО: Аспект-ратио (соотношение сторон)**
- Обязательно указывай aspect_ratio в параметрах модели на основе настроек проекта из {SETTINGS_AND_META}
- Поддерживаемые форматы: "16:9" (широкоэкранный), "9:16" (вертикальный), "1:1" (квадратный), "4:3" (классический)
- Если в настройках указан framing или aspect_ratio, используй его для всех сцен
- Для социальных сетей: Instagram Stories/Reels = "9:16", Instagram Posts = "1:1", YouTube = "16:9"
- Для коммерческого контента: обычно "16:9" для широкоэкранного формата

**Рекомендация по выбору модели**: Для быстрой генерации высококачественных изображений предпочтительно использовать модель FLUX Schnell (black-forest-labs/flux-schnell) - она обеспечивает отличное качество при высокой скорости генерации.

5. Промт для генерации делай конкретным и воспроизводимым, включай, сюжет сцены, композицию, окружение, стиль из {STYLE_PROMPTS}, свет, оптику или план, настроение, цвет, технические параметры, например аспект, качество, seed при необходимости. Если модель поддерживает negative, добавь concise negative.

6. **Выбор источника изображения (image_source)**: Для каждой сцены выбирай между генерацией AI (image_source: "generate") и поиском по стокам (image_source: "search").

   **Выбирай поиск (image_source: "search") если:**
   - Сцена требует изображения реальных объектов (устройства, техника, люди, локации)
   - Нужны фотографии существующих продуктов или брендов
   - Важна фотографическая достоверность и реализм
   - Нужны изображения конкретных мест или архитектуры
   - Важна идентичность реальных людей или предметов

   **Выбирай генерацию (image_source: "generate") если:**
   - Сцена требует художественного или абстрактного изображения
   - Нужен уникальный стиль или креативное видение
   - Важна согласованность визуального стиля с другими сценами
   - Нужны несуществующие или фантазийные элементы
   - Сцена требует специфического настроения, недоступного в стоках

   **Важно**: Если выбрал image_source: "search", обязательно заполни поле image_search_query - это основной запрос для поиска. Если выбрал image_source: "generate", заполни prompt_generation.

7. Поисковые запросы на стоки создавай под реальный поиск, кратко и предметно, 3-7 слов каждый, включай тип плана, ключевые объекты, действие, окружение, время суток, стиль, настроение(эмоцию). Избегай стоп слов. Генерируй 3 запроса на сцену в поле stock_queries. Язык запросов бери из {SETTINGS_AND_META}.

8. Никаких выдумок сверх входных данных, если чего то явно нет, делай осторожные допущения и помечай их в поле assumptions коротко.

9. Вывод строго в JSON, без комментариев, без лишнего текста, без markdown, соблюдай схему из раздела Формат ответа.

10. Соблюдай лимиты, text как задано в {SETTINGS_AND_META}. prompt_generation до 600-900 символов в зависимости от модели (используй только если image_source = "generate"), image_search_query до 100 символов (используй только если image_source = "search"), stock_queries до 6 элементов.

11. Экранируй служебные символы JSON, кавычки внутри строк.

12. Сортируй сцены по возрастанию времени, не допускай пересечений таймкодов.

Формат ответа
=============

Выводи только JSON по схеме ниже.

{
"scenes": [
    {
      "scene_number": 1,
      "text": "{SCENE_TEXT}",
      "timecodes": {
        "start": "HH:MM:SS.mmm",
        "end": "HH:MM:SS.mmm",
        "duration_sec": {DURATION_FLOAT}
      },
      "source_word_span": {
        "start_index": {FIRST_WORD_INDEX},
        "end_index": {LAST_WORD_INDEX}
      },
      "style": "{CHOSEN_STYLE_NAME}",
      "model": {
        "name": "{CHOSEN_MODEL_NAME}",
        "params": {
          "aspect_ratio": "${framing}",
          "quality": "{QUALITY_HINT}",
          "seed": "{SEED_IF_USED}",
          "negative": "{NEGATIVE_PROMPT_IF_SUPPORTED}"
        }
      },
      "image_source": "{generate|search}",
      "prompt_generation": "{AI_VISUAL_PROMPT_IF_GENERATE}",
      "image_search_query": "{SEARCH_QUERY_IF_SEARCH}",
      "stock_queries": [
        "{QUERY_1}",
        "{QUERY_2}",
        "{QUERY_3}"
      ],
      "assumptions": "{SHORT_NOTES_IF_ANY}"
    }
  ],
  "meta": {
    "language": "${language}",
    "pacing": "${pacing}",
    "target_total_duration": ${targetDuration},
    "styles_used": ["${style.name}"],
    "models_used": ["black-forest-labs/flux-schnell"]
  }
}`;

    // 3. Call OpenRouter API
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    if (!openRouterKey) {
      const errorMessage = 
        "OPENROUTER_API_KEY not set. " +
        "Please add it in Convex Dashboard → Settings → Environment Variables. " +
        "Get your API key at https://openrouter.ai/keys";
      console.error("[generateStoryboard] Configuration error:", errorMessage);
      throw new Error(errorMessage);
    }

    console.log("[generateStoryboard] Calling OpenRouter API", {
      model: "google/gemini-2.5-flash-lite",
      promptLength: prompt.length,
    });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${openRouterKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite", // Using flash-lite for cost efficiency (same as production)
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`OpenRouter API error: ${error}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content in OpenRouter response");
    }

    // 4. Parse JSON with fallback
    let parsedResponse: any;
    try {
      // Try to extract JSON from markdown code blocks if present
      const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/) || [null, content];
      const jsonStr = jsonMatch[1] || content;
      parsedResponse = JSON.parse(jsonStr.trim());
    } catch (error) {
      // Fallback: try to parse as-is
      try {
        parsedResponse = JSON.parse(content.trim());
      } catch (e) {
        console.error("[generateStoryboard] Failed to parse JSON response:", e);
        // Last resort: create a single scene
        parsedResponse = {
          scenes: [
            {
              scene_number: 1,
              text: args.scenarioText,
              title: "Scene 1",
              imagePrompt: `A scene showing: ${args.scenarioText}`,
            },
          ],
        };
      }
    }

    // Extract scenes array from response (API returns { scenes: [...], meta: {...} })
    let scenes = parsedResponse.scenes || parsedResponse;
    
    // Ensure scenes is an array
    if (!Array.isArray(scenes)) {
      console.warn("[generateStoryboard] Scenes is not an array, converting:", scenes);
      scenes = [scenes];
    }

    // Validate scenes array
    if (scenes.length === 0) {
      console.warn("[generateStoryboard] No scenes found, creating fallback scene");
      scenes = [
        {
          scene_number: 1,
          text: args.scenarioText,
          title: "Scene 1",
          imagePrompt: `A scene showing: ${args.scenarioText}`,
        },
      ];
    }
    
    console.log("[generateStoryboard] Parsed scenes", {
      sceneCount: scenes.length,
      firstScene: scenes[0],
    });

    // 5. Delete existing scenes before creating new ones (to avoid duplicates)
    console.log("[generateStoryboard] Deleting existing scenes for project", {
      projectId: args.projectId,
    });
    
    await ctx.runMutation(api.functions.scenes.deleteScenesByProject, {
      projectId: args.projectId,
    });

    // 6. Save new scenes
    console.log("[generateStoryboard] Saving scenes", {
      sceneCount: scenes.length,
      projectId: args.projectId,
    });

    await ctx.runMutation(api.functions.scenes.createScenes, {
      projectId: args.projectId,
      scenes: scenes.map((scene: any, index: number) => {
        // Support both old format (imagePrompt) and new format (prompt_generation)
        const imagePrompt = 
          scene.prompt_generation || // New format: image_source = "generate"
          scene.imagePrompt ||       // Old format
          scene.image_prompt ||      // Alternative old format
          "";                         // Fallback
        
        // Extract script content - try multiple field names
        const scriptContent = 
          scene.text ||              // Primary field from AI response
          scene.scriptContent ||     // Alternative field name
          scene.narration_text ||    // From script generation format
          scene.content ||           // Generic content field
          args.scenarioText ||       // Fallback to full scenario text
          "";                        // Last resort
        
        console.log("[generateStoryboard] Mapping scene", {
          index,
          sceneKeys: Object.keys(scene),
          hasText: !!scene.text,
          hasScriptContent: !!scene.scriptContent,
          scriptContentLength: scriptContent.length,
          imagePromptLength: imagePrompt.length,
        });
        
        return {
          orderIndex: index,
          name: scene.title || scene.name || `Scene ${index + 1}`,
          scriptContent: scriptContent,
          imagePrompt: imagePrompt,
        };
      }),
    });

    console.log("[generateStoryboard] Storyboard generation completed", {
      sceneCount: scenes.length,
      projectId: args.projectId,
    });

    return { success: true, sceneCount: scenes.length };
  },
});



