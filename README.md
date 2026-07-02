# APCrypto MiniApp

Telegram Mini App: React + Vite + TypeScript (фронтенд) и Node.js + Express API-сервер
с серверной валидацией Telegram `initData`.

## Структура

```
MiniApp/
├── frontend/        # React + Vite + TS (UI мини-приложения)
│   └── src/
│       ├── main.tsx     # инициализация Telegram SDK
│       ├── App.tsx      # экран приложения
│       └── index.css
└── server/          # Node + Express API
    └── src/
        ├── index.ts     # роуты /api/me, /api/health
        └── initData.ts  # проверка подписи Telegram initData
```

## Запуск (локально)

Нужны **два терминала**.

### 1. Сервер
```bash
cd server
cp .env.example .env       # впишите BOT_TOKEN от @BotFather
npm install
npm run dev                # http://localhost:3000
```

### 2. Фронтенд
```bash
cd frontend
npm install
npm run dev                # http://localhost:5173
```

Vite проксирует `/api/*` на сервер (`localhost:3000`), поэтому CORS в dev не мешает.

## Подключение к Telegram

1. Создайте бота в [@BotFather](https://t.me/BotFather) → получите `BOT_TOKEN`.
2. `/newapp` или `/myapps` → задайте Web App URL.
3. Для локального теста используйте туннель (ngrok / cloudflared), т.к. Telegram
   требует HTTPS-URL:
   ```bash
   cloudflared tunnel --url http://localhost:5173
   ```
   Полученный HTTPS-адрес укажите как Web App URL в BotFather.

## Как работает авторизация

1. Telegram передаёт в WebApp подписанную строку `initData`.
2. Фронтенд шлёт её на сервер в заголовке `Authorization: tma <initData>`.
3. Сервер проверяет HMAC-подпись с помощью `BOT_TOKEN` (`server/src/initData.ts`)
   и возвращает данные пользователя только при валидной подписи.

## Сборка прод
```bash
cd frontend && npm run build   # статика в frontend/dist
cd server && npm start         # API-сервер
```
