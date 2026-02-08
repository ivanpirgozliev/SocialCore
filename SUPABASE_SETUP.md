# Supabase Setup Guide

Това ръководство ще ви помогне да настроите Supabase за вашето SocialCore приложение.

## Стъпка 1: Създайте Supabase проект

1. Отидете на [https://app.supabase.com/](https://app.supabase.com/)
2. Влезте или създайте акаунт
3. Кликнете **"New Project"**
4. Попълнете:
   - **Name**: SocialCore
   - **Database Password**: Запазете я на сигурно място!
   - **Region**: Изберете най-близкия до вас регион
5. Кликнете **"Create new project"**

## Стъпка 2: Получете API ключовете

След като проектът е създаден:

1. Отидете на **Settings** (от лявото меню)
2. Изберете **API**
3. Ще видите:
   - **Project URL** (например: `https://xxxxx.supabase.co`)
   - **anon public** ключ (дълъг низ, започващ с `eyJ...`)

## Стъпка 3: Създайте .env файл

1. В корена на проекта създайте файл `.env`
2. Добавете следното съдържание:

```env
VITE_SUPABASE_URL=your-project-url-here
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

**Важно:** Заменете `your-project-url-here` и `your-anon-key-here` с реалните стойности от Supabase!

## Стъпка 4: Изпълнете Database миграциите

Имате 2 начина:

### Вариант A (препоръчително): Supabase CLI миграции (ще ги виждате като миграции)

Този вариант записва history за миграциите и е най-удобен за екипна работа.

1. Уверете се, че имате `.env` с ключовете (Стъпка 3) – за приложението.
2. В терминал, в root папката на проекта, изпълнете:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

3. Миграциите са в `/supabase/migrations/` и ще се приложат по ред.

Забележка: Ако пускате SQL ръчно през SQL Editor, Supabase няма да ги отчете като „миграции“.

### Вариант B: Ръчно (SQL Editor)

1. Отидете на вашия Supabase проект
2. От лявото меню изберете **SQL Editor**
3. Изпълнете всеки SQL файл от `/database/migrations/` по ред:

### 4.1 Създайте profiles таблица
- Отворете `001_create_profiles_table.sql`
- Копирайте цялото съдържание
- Поставете го в SQL Editor
- Кликнете **"Run"**

### 4.2 Създайте posts таблица
- Отворете `002_create_posts_table.sql`
- Копирайте и изпълнете

### 4.3 Създайте comments таблица
- Отворете `003_create_comments_table.sql`
- Копирайте и изпълнете

### 4.4 Създайте follows таблица
- Отворете `004_create_follows_table.sql`
- Копирайте и изпълнете

### 4.5 Създайте likes таблица
- Отворете `005_create_likes_table.sql`
- Копирайте и изпълнете

### 4.6 Добавете полета към profiles (по желание, ако ги ползвате)
- `006_add_location_website_to_profiles.sql`
- `007_add_extended_profile_fields.sql`

### 4.7 Оптимизация на RLS (ако Supabase Advisor показва performance warning)
- `008_optimize_rls_policies_auth_calls.sql`

## Стъпка 5: Проверете базата данни

1. От лявото меню изберете **Table Editor**
2. Трябва да видите 5 таблици:
   - ✓ profiles
   - ✓ posts
   - ✓ comments
   - ✓ follows
   - ✓ likes

## Стъпка 6: Конфигурирайте Authentication

1. От лявото меню изберете **Authentication** → **Providers**
2. Убедете се, че **Email** е enabled
3. (Опционално) Деактивирайте **"Confirm email"** за развойна среда:
   - Отидете на **Authentication** → **Settings**
   - Намерете **"Enable email confirmations"**
   - Изключете го за по-лесна разработка

## Стъпка 7: Тествайте приложението

1. Инсталирайте зависимостите:
```bash
npm install
```

2. Стартирайте dev сървъра:
```bash
npm run dev
```

3. Отворете [http://localhost:3000](http://localhost:3000)

4. Регистрирайте нов потребител

5. Проверете в Supabase Table Editor дали:
   - В `auth.users` има нов запис
   - В `profiles` автоматично е създаден профил

## Стъпка 8: Тестване на функционалност

### Създаване на пост
1. Отидете на **Create Post** страница
2. Напишете нещо и публикувайте
3. Проверете в Supabase Table Editor → `posts` дали постът е записан

### Likes
1. Отидете на **Feed** страница
2. Кликнете бутона за like
3. Проверете в Supabase Table Editor → `likes` дали лайкът е записан

### Comments
1. Кликнете бутона за коментар на пост
2. Напишете коментар
3. Проверете в Supabase Table Editor → `comments`

## Често срещани проблеми

### 1. "Missing Supabase environment variables"
**Решение:** Проверете дали `.env` файлът е в корена на проекта и съдържа правилните стойности.

### 2. "Permission denied" грешки
**Решение:** Проверете Row Level Security (RLS) политиките. Всички таблици имат RLS enabled.

### 3. Профилът не се създава автоматично
**Решение:** 
- Проверете дали trigger-ът `on_auth_user_created` е създаден
- Опитайте да регистрирате нов потребител

### 4. "relation does not exist" грешка
**Решение:** Убедете се, че всички миграционни SQL файлове са изпълнени успешно.

## Допълнителни ресурси

- [Supabase Documentation](https://supabase.com/docs)
- [Supabase JavaScript Client](https://supabase.com/docs/reference/javascript/introduction)
- [Row Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)

## Следващи стъпки

След успешна настройка можете да:

1. Добавите изображения към постове (Supabase Storage)
2. Добавите real-time функционалност
3. Добавите email нотификации
4. Добавите социални login-и (Google, Facebook)
5. Deploy приложението (Netlify, Vercel)

---

За въпроси или проблеми, проверете Supabase документацията или Console логовете във вашия браузър.
