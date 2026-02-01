-- ============================================
-- SocialCore Database Migration
-- Add location and website fields to profiles
-- ============================================

-- Add new columns to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS location TEXT,
ADD COLUMN IF NOT EXISTS website TEXT;

-- Add constraint for website URL format (optional)
ALTER TABLE public.profiles
ADD CONSTRAINT website_format CHECK (
  website IS NULL OR 
  website ~ '^https?://.*'
);

-- Comments
COMMENT ON COLUMN public.profiles.location IS 'User location (city, country)';
COMMENT ON COLUMN public.profiles.website IS 'User personal website URL';
