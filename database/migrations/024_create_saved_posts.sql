-- Saved posts (one saved row per user + post)
CREATE TABLE IF NOT EXISTS public.saved_posts (
  user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE NOT NULL,
  post_id UUID REFERENCES public.posts(id) ON DELETE CASCADE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  PRIMARY KEY (user_id, post_id)
);

CREATE INDEX IF NOT EXISTS idx_saved_posts_user_created_at ON public.saved_posts(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_saved_posts_post_id ON public.saved_posts(post_id);

ALTER TABLE public.saved_posts ENABLE ROW LEVEL SECURITY;

DO $do$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='saved_posts' AND policyname='Users can view their own saved posts'
  ) THEN
    CREATE POLICY "Users can view their own saved posts"
      ON public.saved_posts
      FOR SELECT
      USING (auth.uid() = public.saved_posts.user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='saved_posts' AND policyname='Users can insert their own saved posts'
  ) THEN
    CREATE POLICY "Users can insert their own saved posts"
      ON public.saved_posts
      FOR INSERT
      WITH CHECK (auth.uid() = public.saved_posts.user_id);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='saved_posts' AND policyname='Users can delete their own saved posts'
  ) THEN
    CREATE POLICY "Users can delete their own saved posts"
      ON public.saved_posts
      FOR DELETE
      USING (auth.uid() = public.saved_posts.user_id);
  END IF;
END
$do$;
