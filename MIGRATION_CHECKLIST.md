# Migration Checklist

## ⚠️ ВАЖНО: Трябва да изпълниш тази миграция в Supabase!

Ако използваш Supabase CLI (папка `/supabase/migrations/`), просто пусни:

```bash
npx supabase login
npx supabase link --project-ref your-project-ref
npx supabase db push
```

Иначе използвай ръчния вариант по-долу.

### Migration 006 - Add Location & Website

**Файл:** `database/migrations/006_add_location_website_to_profiles.sql`

**Как да я изпълниш:**

1. Отвори [Supabase Dashboard](https://supabase.com/dashboard/project/nyrftrwrqcgglrprwuqz)
2. **SQL Editor** → **New query**
3. Копирай и изпълни:

```sql
-- Add location and website fields to profiles
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Add constraint for website URL format
ALTER TABLE public.profiles
ADD CONSTRAINT website_format CHECK (
  website IS NULL OR 
  website ~ '^https?://.*'
);

-- Comments
COMMENT ON COLUMN public.profiles.location IS 'User location (city, country)';
COMMENT ON COLUMN public.profiles.website IS 'User personal website URL';
```

4. Натисни **Run** или **Ctrl+Enter**

### Проверка дали е изпълнена:

Изпълни това в SQL Editor:

```sql
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'profiles' 
AND column_name IN ('location', 'website');
```

Трябва да видиш 2 реда.

---

## Следващи стъпки (след migration 006):

### 1. Създай Storage Bucket за снимки

В Supabase Dashboard → **Storage**:

1. Create new bucket: `profile-images`
   - Public bucket: ✅ YES
2. Create new bucket: `post-images`
   - Public bucket: ✅ YES

### 2. Storage Policies

Изпълни в SQL Editor:

```sql
-- Allow authenticated users to upload their own profile images
CREATE POLICY "Users can upload own profile images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'profile-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Allow public read access
CREATE POLICY "Public read access to profile images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-images');

-- Allow users to upload post images
CREATE POLICY "Users can upload post images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'post-images' AND auth.uid()::text = (storage.foldername(name))[1]);

-- Public read for post images
CREATE POLICY "Public read access to post images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'post-images');
```

---

## Статус

- [ ] Migration 006 изпълнена
- [ ] Storage buckets създадени
- [ ] Storage policies създадени
