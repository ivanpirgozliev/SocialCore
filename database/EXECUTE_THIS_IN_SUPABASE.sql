-- ============================================
-- SUPABASE SQL SCRIPT - Execute in SQL Editor
-- Migration 007: Add Extended Profile Fields
-- ============================================

-- Step 1: Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS phone TEXT,
ADD COLUMN IF NOT EXISTS birthday DATE,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS work TEXT,
ADD COLUMN IF NOT EXISTS education TEXT,
ADD COLUMN IF NOT EXISTS relationship TEXT,
ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT '{}'::jsonb;

-- Step 2: Drop existing constraints if they exist
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS gender_valid_values;

ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS relationship_valid_values;

-- Step 3: Add constraints
ALTER TABLE public.profiles
ADD CONSTRAINT gender_valid_values CHECK (
  gender IS NULL OR 
  gender IN ('male', 'female', 'other')
);

ALTER TABLE public.profiles
ADD CONSTRAINT relationship_valid_values CHECK (
  relationship IS NULL OR 
  relationship IN ('single', 'in-relationship', 'engaged', 'married', 'complicated')
);

-- Step 4: Add comments
COMMENT ON COLUMN public.profiles.phone IS 'User phone number';
COMMENT ON COLUMN public.profiles.birthday IS 'User birthday';
COMMENT ON COLUMN public.profiles.gender IS 'User gender (male, female, other)';
COMMENT ON COLUMN public.profiles.work IS 'User work information (Job Title at Company)';
COMMENT ON COLUMN public.profiles.education IS 'User education information (School or University)';
COMMENT ON COLUMN public.profiles.relationship IS 'User relationship status';
COMMENT ON COLUMN public.profiles.social_links IS 'User social media links (facebook, twitter, instagram, linkedin, github)';

-- ============================================
-- VERIFICATION
-- ============================================
-- Run this to verify columns were added:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'profiles'
  AND column_name IN ('phone', 'birthday', 'gender', 'work', 'education', 'relationship', 'social_links')
ORDER BY column_name;
