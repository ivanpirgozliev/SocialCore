-- ============================================
-- SocialCore Database Migration
-- Add reaction types to likes table
-- ============================================

ALTER TABLE public.likes
ADD COLUMN IF NOT EXISTS reaction_type TEXT NOT NULL DEFAULT 'like';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'likes_reaction_type_check'
      AND conrelid = 'public.likes'::regclass
  ) THEN
    ALTER TABLE public.likes
    ADD CONSTRAINT likes_reaction_type_check
    CHECK (reaction_type IN ('like', 'love', 'haha', 'wow', 'sad', 'angry'));
  END IF;
END$$;

CREATE INDEX IF NOT EXISTS idx_likes_reaction_type
  ON public.likes(reaction_type);

COMMENT ON COLUMN public.likes.reaction_type IS 'Reaction type: like, love, haha, wow, sad, angry';
