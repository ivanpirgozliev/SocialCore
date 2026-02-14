# SocialCore 🌐

SocialCore е multi-page social network приложение с Vanilla JavaScript, Bootstrap 5, Vite и Supabase.

![SocialCore Logo](./assets/images/logo.svg)

## 📌 Какво представлява проектът

Приложението предоставя базови social функции:
- регистрация и вход със Supabase Auth
- feed с публикации, лайкове и коментари (вкл. отговори)
- профили и редакция на профил
- приятели и friend requests
- директни съобщения (conversations/messages)
- административен панел (роли и управление)

## 🧱 Технологичен стек

- **Frontend:** HTML5, CSS3, Vanilla JavaScript (ES Modules)
- **UI:** Bootstrap 5 + Bootstrap Icons
- **Build Tool:** Vite (MPA конфигурация)
- **Backend:** Supabase (PostgreSQL, Auth, RLS, Storage)

## 🚀 Стартиране локално

### Изисквания
- Node.js 18+
- npm
- Supabase проект

### 1) Инсталация

```bash
npm install
```

### 2) Environment променливи

Създай `.env` в root директорията:

```env
VITE_SUPABASE_URL=https://your-project-id.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 3) Миграции в Supabase

Препоръчителен вариант (Supabase CLI):

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Миграциите са в `supabase/migrations/`.

Алтернативно можеш да изпълниш SQL файловете ръчно от `database/migrations/`.

### 4) Dev сървър

```bash
npm run dev
```

Приложението се отваря на `http://localhost:3000`.

## 📜 NPM скриптове

- `npm run dev` — стартира dev сървър
- `npm run build` — production build в `dist/`
- `npm run preview` — локален preview на production build

## 🗂️ Основна структура

```text
SocialCore/
├── index.html
├── pages/                 # MPA страници
├── js/                    # JS модули по страници + shared helpers
├── css/                   # глобални и page-specific стилове
├── assets/                # изображения, видео и други статични ресурси
├── database/migrations/   # SQL миграции (manual вариант)
├── supabase/migrations/   # CLI миграции (препоръчително)
├── supabase/functions/    # Edge Functions
└── vite.config.js         # MPA входни точки
```

## 📄 Налични страници

- `/` (landing)
- `/pages/login.html`
- `/pages/register.html`
- `/pages/feed.html`
- `/pages/messages.html`
- `/pages/profile.html`
- `/pages/photos.html`
- `/pages/friends.html`
- `/pages/create-post.html`
- `/pages/edit-profile.html`
- `/pages/settings.html`
- `/pages/admin.html`

## 🧠 Архитектура (кратко)

- Проектът е **MPA**, конфигуриран във `vite.config.js` чрез `rollupOptions.input`.
- Всяка страница има собствен JS модул в `js/`.
- Общи utilities са централизирани в `js/main.js`.
- Базовият data layer е в `js/database.js` и използва Supabase client от `js/supabase.js`.

## 🗄️ База данни (обзор)

Основни домейни в схемата:
- профили (`profiles`)
- публикации (`posts`), коментари (`comments`), лайкове (`likes`)
- follows и friend requests
- messaging таблици (conversations/messages + unread counters)
- user roles за admin функционалност

Подробности:
- [SUPABASE_SETUP.md](./SUPABASE_SETUP.md)
- [QUICK_START.md](./QUICK_START.md)
- [database/schema-diagram.md](./database/schema-diagram.md)

## ⚠️ Често срещани проблеми

- Грешка `Missing Supabase environment variables` → провери `.env` файла и имената на ключовете.
- `Permission denied`/RLS грешки → провери дали всички миграции са приложени.
- `relation does not exist` → липсва изпълнена миграция.

## 🌍 Deployment

### Netlify

Проектът съдържа готов `netlify.toml`, така че можеш да deploy-неш директно от Git repository.

- **Build command:** `npm ci && ./node_modules/.bin/vite build`
- **Publish directory:** `dist`
- **Node version:** `18`

Препоръка: в Netlify Site Settings → Environment Variables задай/override:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

### Vercel

За Vercel използвай стандартни настройки за Vite:

- **Framework preset:** `Vite`
- **Build command:** `npm run build`
- **Output directory:** `dist`

В Project Settings → Environment Variables добави:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

След deployment, ако имаш auth callback ограничения, добави production домейна в Supabase:
- Authentication → URL Configuration → Site URL / Redirect URLs

## ✅ Production Checklist

- [ ] Build минава успешно: `npm run build`
- [ ] Environment variables са зададени в хостинга (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`)
- [ ] Всички Supabase миграции са приложени (`npx supabase db push`)
- [ ] Supabase Auth URL Configuration съдържа production домейна
- [ ] RLS политиките са активни и тествани с реален потребител
- [ ] Основните страници са smoke-tested след deploy (`/`, `login`, `register`, `feed`, `profile`, `messages`)

## 📌 Бележки

- Проектът е в активна разработка.
- Част от функционалностите зависят от коректно настроен Supabase проект и RLS политики.
