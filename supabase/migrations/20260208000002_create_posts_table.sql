-- ============================================
-- SocialCore Database Migration
-- Table: posts
-- Description: User posts with content and images
-- ============================================

-- Create posts table
CREATE TABLE IF NOT EXISTS public.posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  content TEXT NOT NULL,
  image_url TEXT,
  likes_count INTEGER DEFAULT 0 NOT NULL,
  comments_count INTEGER DEFAULT 0 NOT NULL,
  shares_count INTEGER DEFAULT 0 NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  
  -- Constraints
  CONSTRAINT content_length CHECK (char_length(content) >= 1 AND char_length(content) <= 5000),
  CONSTRAINT likes_count_positive CHECK (likes_count >= 0),
  CONSTRAINT comments_count_positive CHECK (comments_count >= 0),
  CONSTRAINT shares_count_positive CHECK (shares_count >= 0)
);

-- Create indexes for better query performance
CREATE INDEX idx_posts_user_id ON public.posts(user_id);
CREATE INDEX idx_posts_created_at ON public.posts(created_at DESC);
CREATE INDEX idx_posts_likes_count ON public.posts(likes_count DESC);
CREATE INDEX idx_posts_user_created ON public.posts(user_id, created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Allow users to view all posts
CREATE POLICY "Posts are viewable by everyone"
  ON public.posts
  FOR SELECT
  USING (true);

-- Allow authenticated users to create posts
CREATE POLICY "Authenticated users can create posts"
  ON public.posts
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Allow users to update their own posts
CREATE POLICY "Users can update their own posts"
  ON public.posts
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Allow users to delete their own posts
CREATE POLICY "Users can delete their own posts"
  ON public.posts
  FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger to update updated_at on post changes
CREATE TRIGGER set_updated_at
  BEFORE UPDATE ON public.posts
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Comments
COMMENT ON TABLE public.posts IS 'User posts with content and optional images';
COMMENT ON COLUMN public.posts.id IS 'Unique post identifier';
COMMENT ON COLUMN public.posts.user_id IS 'References the user who created the post';
COMMENT ON COLUMN public.posts.content IS 'Post text content';
COMMENT ON COLUMN public.posts.image_url IS 'Optional image URL for the post';
COMMENT ON COLUMN public.posts.likes_count IS 'Cached count of likes for performance';
COMMENT ON COLUMN public.posts.comments_count IS 'Cached count of comments for performance';
COMMENT ON COLUMN public.posts.shares_count IS 'Cached count of shares for performance';
