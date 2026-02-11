-- ============================================
-- SocialCore Database Migration
-- Add threaded comment replies
-- ============================================

ALTER TABLE public.comments
  ADD COLUMN IF NOT EXISTS parent_comment_id UUID REFERENCES public.comments(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_comments_parent_id ON public.comments(parent_comment_id);

COMMENT ON COLUMN public.comments.parent_comment_id IS 'Parent comment for threaded replies';
