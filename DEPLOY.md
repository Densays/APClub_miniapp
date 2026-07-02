# Деплой APClub Mini App

Три части: **API** (Render) · **Mini App + Админка** (Vercel, две статики) · **Бот/канал** (BotFather + Telegram). Supabase уже готов.

---

## 0. Git → GitHub
```bash
cd ~/APCrypto/MiniApp
git init && git add -A && git commit -m "APClub mini app"
# создать репозиторий на GitHub и:
git remote add origin git@github.com:<you>/apclub-miniapp.git
git push -u origin main
```
`.env`, `node_modules/`, `dist/` уже в `.gitignore`. Баннер `server/assets/welcome.jpg` — коммитится (нужен боту).

## 1. API на Render
1. Render → **New → Blueprint** → выбрать репозиторий (подхватит `render.yaml`).
2. План — **Starter** (always-on). ⚠️ Free засыпает → бот перестаёт отвечать.
3. В **Environment** задать секреты (см. `server/.env.production.example`):
   `BOT_TOKEN`, `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `ADMIN_PASSWORD` (сменить!), `ADMIN_IDS`.
   `ALLOW_DEV_AUTH=0` уже в blueprint.
4. Deploy → получить адрес вида `https://apclub-api.onrender.com`. Проверить `/api/health`.

## 2. Mini App + Админка на Vercel (два проекта)
Оба — Vite. В каждом проекте задать env **`VITE_API_URL`** = адрес API с шага 1.

**Mini App** (`frontend/`): Root Directory `frontend`, Build `npm run build`, Output `dist`.
**Админка** (`admin/`): Root Directory `admin`, Build `npm run build`, Output `dist`.

Получишь два адреса, напр. `https://apclub.vercel.app` (Mini App) и `https://apclub-admin.vercel.app` (админка → это твой ЛК apk-lab).

## 3. BotFather — привязать Mini App
1. `@BotFather` → `/mybots` → **@apclubnews_bot** → **Bot Settings**.
2. **Menu Button / Web App** → указать URL Mini App (`https://apclub.vercel.app`).
3. **Direct Link Mini App** (`/newapp`) → создать приложение, получить ссылку `https://t.me/apclubnews_bot/app`.

## 4. Дозадать ссылки в Render (Environment) и передеплой API
- `MINIAPP_URL=https://apclub.vercel.app` — web_app-кнопка в **личке** бота.
- `MINIAPP_LINK=https://t.me/apclubnews_bot/app` — url-кнопка входа в **канале**.
- `CHANNEL_ID=@твой_канал` — куда публиковать закреплённое приветствие.

## 5. Бот в канале клуба
1. В канале → **Администраторы → Добавить** → **@apclubnews_bot**.
2. Дать права: **Публикация сообщений** + **Закрепление сообщений**.
3. В админке → **Уведомления → Приветствие в канал**: проверить, что «Бот — админ: да», «Может публиковать/закреплять: да», затем **«Опубликовать и закрепить»**.

## 6. Финальная проверка
- Личка: `/start` боту → баннер + текст + кнопки «Вход в клуб» / «Меморандум».
- Канал: закреплён пост с кнопкой «Вход в клуб» (открывает Mini App).
- Mini App: первый вход → окно регистрации → приложение.
- Админка: вход по паролю, дашборд, уведомления, тест себе.

## Прод-чек-лист безопасности
- [ ] `ALLOW_DEV_AUTH=0` на Render.
- [ ] `ADMIN_PASSWORD` сменён с дефолтного.
- [ ] Реальный `.env` не в git (только `.env.production.example`).
- [ ] Демо-данные подчищены (если остались тестовые профили).
- [ ] Каталог ачивок синхронен: `server/src/content.ts` ↔ `frontend/src/mock.ts`.
