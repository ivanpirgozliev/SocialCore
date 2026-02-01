-- ============================================
-- SocialCore Database Migration
-- Table: follows
-- Description: User follow relationships (many-to-many)
-- ============================================

-- Create follows table
CREATE TABLE IF NOT EXISTS public.follows (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  follower_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  following_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT no_self_follow CHECK (follower_id != following_id),
  CONSTRAINT unique_follow UNIQUE (follower_id, following_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_follows_follower_id ON public.follows(follower_id);
CREATE INDEX idx_follows_following_id ON public.follows(following_id);
CREATE INDEX idx_follows_created_at ON public.follows(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.follows ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to view all follows
CREATE POLICY "Follows are viewable by everyone"
  ON public.follows
  FOR SELECT
  USING (true);

-- Allow users to create follows (follow someone)
CREATE POLICY "Users can follow others"
  ON public.follows
  FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Allow users to delete their own follows (unfollow)
CREATE POLICY "Users can unfollow others"
  ON public.follows
  FOR DELETE
  USING (auth.uid() = follower_id);

-- Function to get followers count for a user
CREATE OR REPLACE FUNCTION public.get_followers_count(user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.follows
  WHERE following_id = user_id;
$$ LANGUAGE sql STABLE
SET search_path = '';

-- Function to get following count for a user
CREATE OR REPLACE FUNCTION public.get_following_count(user_id UUID)
RETURNS INTEGER AS $$
  SELECT COUNT(*)::INTEGER
  FROM public.follows
  WHERE follower_id = user_id;
$$ LANGUAGE sql STABLE
SET search_path = '';

-- Function to check if user A follows user B
CREATE OR REPLACE FUNCTION public.is_following(follower UUID, following UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.follows
    WHERE follower_id = follower AND following_id = following
  );
$$ LANGUAGE sql STABLE
SET search_path = '';

-- Comments
COMMENT ON TABLE public.follows IS 'User follow relationships';
COMMENT ON COLUMN public.follows.id IS 'Unique follow relationship identifier';
COMMENT ON COLUMN public.follows.follower_id IS 'User who is following';
COMMENT ON COLUMN public.follows.following_id IS 'User who is being followed';
COMMENT ON CONSTRAINT no_self_follow ON public.follows IS 'Prevents users from following themselves';
COMMENT ON CONSTRAINT unique_follow ON public.follows IS 'Prevents duplicate follow relationships';
