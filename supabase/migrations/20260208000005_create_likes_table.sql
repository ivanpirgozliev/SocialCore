-- ============================================
-- SocialCore Database Migration
-- Table: likes
-- Description: Tracks likes on posts and comments
-- ============================================

-- Create likes table
CREATE TABLE IF NOT EXISTS public.likes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE,
  comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT like_target CHECK (
    (post_id IS NOT NULL AND comment_id IS NULL) OR
    (post_id IS NULL AND comment_id IS NOT NULL)
  ),
  CONSTRAINT unique_post_like UNIQUE (user_id, post_id),
  CONSTRAINT unique_comment_like UNIQUE (user_id, comment_id)
);

-- Create indexes for better query performance
CREATE INDEX idx_likes_user_id ON public.likes(user_id);
CREATE INDEX idx_likes_post_id ON public.likes(post_id) WHERE post_id IS NOT NULL;
CREATE INDEX idx_likes_comment_id ON public.likes(comment_id) WHERE comment_id IS NOT NULL;
CREATE INDEX idx_likes_created_at ON public.likes(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to view all likes
CREATE POLICY "Likes are viewable by everyone"
  ON public.likes
  FOR SELECT
  USING (true);

-- Allow authenticated users to create likes
CREATE POLICY "Authenticated users can like"
  ON public.likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own likes (unlike)
CREATE POLICY "Users can unlike"
  ON public.likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- Function to increment likes_count on posts
CREATE OR REPLACE FUNCTION public.increment_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.post_id IS NOT NULL THEN
    UPDATE public.posts
    SET likes_count = likes_count + 1
    WHERE id = NEW.post_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Function to decrement likes_count on posts
CREATE OR REPLACE FUNCTION public.decrement_post_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.post_id IS NOT NULL THEN
    UPDATE public.posts
    SET likes_count = likes_count - 1
    WHERE id = OLD.post_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Function to increment likes_count on comments
CREATE OR REPLACE FUNCTION public.increment_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.comment_id IS NOT NULL THEN
    UPDATE public.comments
    SET likes_count = likes_count + 1
    WHERE id = NEW.comment_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Function to decrement likes_count on comments
CREATE OR REPLACE FUNCTION public.decrement_comment_likes_count()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.comment_id IS NOT NULL THEN
    UPDATE public.comments
    SET likes_count = likes_count - 1
    WHERE id = OLD.comment_id;
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql
SET search_path = '';

-- Triggers to update likes_count
CREATE TRIGGER increment_post_likes
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_post_likes_count();

CREATE TRIGGER decrement_post_likes
  AFTER DELETE ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_post_likes_count();

CREATE TRIGGER increment_comment_likes
  AFTER INSERT ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_comment_likes_count();

CREATE TRIGGER decrement_comment_likes
  AFTER DELETE ON public.likes
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_comment_likes_count();

-- Comments
COMMENT ON TABLE public.likes IS 'Likes on posts and comments';
COMMENT ON COLUMN public.likes.id IS 'Unique like identifier';
COMMENT ON COLUMN public.likes.user_id IS 'User who created the like';
COMMENT ON COLUMN public.likes.post_id IS 'Post being liked (mutually exclusive with comment_id)';
COMMENT ON COLUMN public.likes.comment_id IS 'Comment being liked (mutually exclusive with post_id)';
COMMENT ON CONSTRAINT like_target ON public.likes IS 'Ensures like is for either a post or comment, not both';
