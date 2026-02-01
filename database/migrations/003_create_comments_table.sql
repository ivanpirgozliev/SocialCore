-- ============================================
-- SocialCore Database Migration
-- Table: comments
-- Description: Comments on user posts
-- ============================================

-- Create comments table
CREATE TABLE IF NOT EXISTS public.comments (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  likes_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 1000),
  CONSTRAINT likes_count_positive CHECK (likes_count >= 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_comments_post_id ON public.comments(post_id);
CREATE INDEX idx_comments_user_id ON public.comments(user_id);
CREATE INDEX idx_comments_created_at ON public.comments(created_at DESC);
CREATE INDEX idx_comments_post_created ON public.comments(post_id, created_at ASC);

-- Enable Row Level Security
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to view all comments
CREATE POLICY "Comments are viewable by everyone"
  ON public.comments
  FOR SELECT
  USING (true);

-- Allow authenticated users to create comments
CREATE POLICY "Authenticated users can create comments"
  ON public.comments
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own comments
CREATE POLICY "Users can update their own comments"
  ON public.comments
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own comments
CREATE POLICY "Users can delete their own comments"
  ON public.comments
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at on comment changes
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Function to increment comments_count on posts
CREATE OR REPLACE FUNCTION public.increment_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET comments_count = comments_count + 1
  WHERE id = NEW.post_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Function to decrement comments_count on posts
CREATE OR REPLACE FUNCTION public.decrement_post_comments_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.posts
  SET comments_count = comments_count - 1
  WHERE id = OLD.post_id;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Trigger to increment comments_count when comment is created
CREATE TRIGGER increment_comments_count
  AFTER INSERT ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_post_comments_count();

-- Trigger to decrement comments_count when comment is deleted
CREATE TRIGGER decrement_comments_count
  AFTER DELETE ON public.comments
  FOR EACH ROW
  EXECUTE FUNCTION public.decrement_post_comments_count();

-- Comments
COMMENT ON TABLE public.comments IS 'Comments on user posts';
COMMENT ON COLUMN public.comments.id IS 'Unique comment identifier';
COMMENT ON COLUMN public.comments.post_id IS 'References the post this comment belongs to';
COMMENT ON COLUMN public.comments.user_id IS 'References the user who created the comment';
COMMENT ON COLUMN public.comments.content IS 'Comment text content';
COMMENT ON COLUMN public.comments.likes_count IS 'Cached count of likes for performance';
