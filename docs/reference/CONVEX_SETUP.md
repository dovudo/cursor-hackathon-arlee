# ✅ Проверка подключения Convex

## Шаг 1: Проверьте .env.local

Убедитесь что в `frontend/.env.local` есть:

```bash
NEXT_PUBLIC_CONVEX_URL=https://adventurous-cow-755.convex.cloud
CONVEX_URL=https://adventurous-cow-755.convex.cloud
CONVEX_DEPLOYMENT=dev:adventurous-cow-755
```

## Шаг 2: Запустите Convex dev

В терминале 1:
```bash
cd frontend
npm run convex:dev
```

Должно показать:
```
✓ Convex functions ready!
```

## Шаг 3: Запустите Next.js

В терминале 2:
```bash
cd frontend
npm run dev
```

Откройте http://localhost:3000

## Шаг 4: Проверьте подключение

На странице должно быть:
- ✅ "Convex is working! 🎉"
- Время подключения

Если видите "Loading..." - проверьте:
1. Convex dev запущен?
2. NEXT_PUBLIC_CONVEX_URL в .env.local?
3. Нет ошибок в консоли браузера?

## Troubleshooting

### Ошибка: "NEXT_PUBLIC_CONVEX_URL is not set"
- Проверьте что в `.env.local` есть `NEXT_PUBLIC_CONVEX_URL`
- Перезапустите Next.js dev server

### Ошибка: "Failed to fetch"
- Убедитесь что `convex dev` запущен
- Проверьте что URL правильный в `.env.local`

### Типы не генерируются
- Убедитесь что `convex dev` запущен
- Проверьте что файлы в `convex/_generated/` есть

